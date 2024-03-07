import { cloneDeep, groupBy, max, min, sum } from 'lodash';
import { MakeMoney, MakeMoneyItem, MakeMoneyPropertySet, Player, TradeItem } from './player';
import { OwnableBoardItem, Property, Railroad, Utility } from './utils';

// Strategies
// - House hogger
// - No trader
// - Auction if don't want to pay full price
// - Drive up auction price if someone is close to a monopoly
// - Trade for monopolies
// - Team up against winner
// - Bid at least 50% of cost (can immediately mortgage for money back)
// - Pay to get out of jail before houses
// - Buy auction by selling buildings or mortgaging

export class AIPlayer extends Player {
  type = 'ai';
  config = {
    makeMoneyOrder: [
      MakeMoney.SELL | MakeMoney.JAIL_CARD,
      MakeMoney.MORTGAGE | MakeMoney.NONSET_PROPERTY,
      MakeMoney.MORTGAGE | MakeMoney.UTILITY,
      MakeMoney.MORTGAGE | MakeMoney.RAILROAD,
      MakeMoney.MORTGAGE | MakeMoney.SET_PROPERTY,
      MakeMoney.SELL | MakeMoney.UTILITY,
      MakeMoney.SELL | MakeMoney.RAILROAD,
      MakeMoney.SELL | MakeMoney.NONSET_PROPERTY,
      MakeMoney.SELL | MakeMoney.BUILDING,
      MakeMoney.MORTGAGE | MakeMoney.SET_PROPERTY,
      MakeMoney.SELL | MakeMoney.SET_PROPERTY,
    ],
    spite: false,
  };

  async wantOutOfJail() {
    // Always use card or money
    // Always use only card
    // Use card only when streets mostly clear
    // Never
    if (this.jailCards) return 'card';
    if (this.usableMoney(true) > 50) return 'money';
    return 'none';
  }

  async willBuy(tile: OwnableBoardItem) {
    const maxMoneyOthers = max(this.game.players.map(p => p.index === this.index ? 0 : p.money))!;
    if (maxMoneyOthers < tile.cost) return false;
    if (tile.type === 'property') {
      const set = this.game.set(tile.set);
      const almostSet = set.filter(t => t.owner !== this.index).length === 1;
      // Check if enough money
      if (almostSet) return true;
    }
    return this.money > tile.cost;
  }

  async bid(tile: OwnableBoardItem, highestBid: number, highestBidder: number) {
    if (this.money <= highestBid) return 0;
    if (highestBidder === this.index) return highestBid;

    let bid = 0;
    let maxSpending = tile.cost / (tile.mortgaged ? 2 * this.game.config.lateUnmortgageMultiplier : 1) * 1.2;
    if (tile.type === 'property') {
      const set = this.game.set(tile.set);
      if (set.filter(t => t.owner !== this.index).length === 1) maxSpending = tile.cost * 2;
      if (set.filter(t => t.owner !== highestBidder).length === 1) maxSpending = tile.cost * 1.6;
    }
    if (highestBid < maxSpending) bid = highestBid + this.game.config.minBidIncrease;
    // if (highestBid < tile.cost / 2) bid = highestBid + 1;
    // else if (highestBid < tile.cost) bid = highestBid + 1;
    // else if (highestBidder === this.game.turnOfPlayer && highestBid < tile.cost * 1.2) return highestBid + 1;

    // const maxMoneyOthers = max(this.game.players.map(p => p.index === this.index ? 0 : p.money))!;
    // if (bid > maxMoneyOthers) bid = maxMoneyOthers + 1;
    if (bid > this.money) bid = this.money;
    if (bid < highestBid + this.game.config.minBidIncrease) bid = 0;
    return bid;
  }

  async endTurn() {
    const wantTrade: OwnableBoardItem[] = this.wantInTrade();
    // console.log('wantTrade', wantTrade.map(t => this.game.localizeItem(t, false)));
    for (const want of wantTrade) {
      const [to, giving, receiving] = this.generateTradeOffer(want);
      if (to === -1) continue;
      const accepted = await this.sendTradeOffer(giving, receiving, this.game.players[to]);
    }

    const building = this.wantToBuild();
    outer: for (const tileIndex in building) {
      const tile = this.game.board[tileIndex] as Property;
      const set = this.game.set(tile.set);
      for (const t of set) {
        if (t.mortgaged) {
          const cost = t.cost * this.game.unmortgageMultiplier(t);
          const success = await this.spend(cost);
          if (!success) break outer;
          t.mortgaged = false;
          this.game.pushActions({ action: 'Unmortgage', who: this.index, where: t.index });
        }
      }
      await this.build(tile, building[tileIndex]);
    }

    const wantUnmortgage = this.wantToUnmortgage();
    for (const tileIndex of wantUnmortgage) {
      const tile = this.game.board[tileIndex] as OwnableBoardItem;
      const cost = Math.round(tile.cost * this.game.unmortgageMultiplier(tile));
      const success = await this.spend(cost);
      if (!success) continue;
      tile.mortgaged = false;
      this.game.pushActions({ action: 'Unmortgage', who: this.index, where: tile.index });
    }
  }

  async receiveTradeOffer(giving: TradeItem[], receiving: TradeItem[], from: Player) {
    // Check usable money
    const myProperties = groupBy(this.properties(), 'set');
    const givingProperties = groupBy(giving.filter(t => t.tile && t.tile.type === 'property') as Property[], 'set');
    const givingRailroads = giving.filter(t => t.tile && t.tile.type === 'railroad') as Railroad[];
    const givingUtilities = giving.filter(t => t.tile && t.tile.type === 'utility') as Utility[];
    const givingMoney = sum(giving.filter(t => t.money));
    const receivingProperties = groupBy(receiving.filter(t => t.tile && t.tile.type === 'property') as Property[], 'set');
    const receivingRailroads = receiving.filter(t => t.tile && t.tile.type === 'railroad') as Railroad[];
    const receivingUtilities = receiving.filter(t => t.tile && t.tile.type === 'utility') as Utility[];
    const receivingMoney = sum(receiving.filter(t => t.money));

    const totalGivingValue = this.valueItems(giving);
    const totalReceivingValue = this.valueItems(receiving);
    const allPlayersValue = this.game.players.map(p => this.valuePlayer(p));
    // const sortedOtherPlayersValue = otherPlayersValue.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]);
    const playerValueDiff = allPlayersValue[this.index] - allPlayersValue[from.index];
    const tradeDiff = totalReceivingValue - totalGivingValue;
    return tradeDiff > 0;
  }

  async makeMoney(amount: number) {
    let jailCards = this.jailCards;
    let properties: (Property & { unusable?: boolean })[] = cloneDeep(this.properties());
    let utilities = cloneDeep(this.utilities());
    let railroads = cloneDeep(this.railroads());
    const currentTile = this.game.board[this.position] as (Property & { unusable?: boolean });
    if (currentTile.type === 'property' && currentTile.owner === -1) {
      const clone = cloneDeep(currentTile);
      clone.unusable = true;
      clone.owner = this.index;
      properties.push(clone);
    }
    while (true) {
      // console.log('Need to make', diff);
      const [amountLeft, whatToDo] = await this.getMakeMoneyItems(amount, jailCards, groupBy(properties, 'set'), utilities, railroads);
      // console.log(amountLeft, whatToDo.map(x =>
      //   x.demolish ? 'Remove a house from ' + this.game.localizeItem(x.demolish, false)
      //     : x.jailCard ? 'Sell one jail card'
      //       : x.mortgage ? 'Mortgage ' + this.game.localizeItem(x.mortgage, false)
      //         : x.sell ? 'Sell ' + this.game.localizeItem(x.sell, false) : x
      // ));
      if (amountLeft > 0) break;

      let noProblems = true;
      for (const action of whatToDo) {
        if (action.jailCard) {
          const accepted = await this.sendTradeOfferToEveryone([{ jailCards: 1 }], [{ money: 50 }]);
          if (accepted === -1) {
            jailCards--;
            noProblems = false;
            // console.log('No one bought jail card');
          } else {
            amount -= 50;
          }
        } else if (action.demolish) {
          const tile = this.game.board[action.demolish.index] as Property;
          this.demolish(tile);
          amount -= tile.buildingCost * this.game.config.demolishMultiplier;
        } else if (action.mortgage) {
          const tile = this.game.board[action.mortgage.index] as OwnableBoardItem;
          this.mortgage(tile);
          amount -= tile.cost * this.game.config.mortgageMultiplier;
        } else if (action.sell) {
          const tile = this.game.board[action.sell.index] as OwnableBoardItem;
          let making = (tile.mortgaged ? tile.cost * this.game.config.mortgageMultiplier : tile.cost) * 1.2;
          let accepted = await this.sendTradeOfferToEveryone([{ tile }], [{ money: making }]);
          if (accepted === -1) {
            making = making / 1.2 * 1.1;
            accepted = await this.sendTradeOfferToEveryone([{ tile }], [{ money: making }]);
            if (accepted === -1) {
              making = making / 1.1;
              accepted = await this.sendTradeOfferToEveryone([{ tile }], [{ money: making }]);
            }
          }
          if (accepted === -1) {
            utilities = utilities.filter(u => u.index !== tile!.index);
            railroads = railroads.filter(r => r.index !== tile!.index);
            properties = properties.filter(p => p.index !== tile!.index);
            // console.log('No one bought', this.game.localizeItem(tile!));
            noProblems = false;
          } else {
            amount -= making;
          }
        }
      }
      if (noProblems) break;
    }
    return amount;
  }

  async sendTradeOfferToEveryone(giving: TradeItem[], receiving: TradeItem[]): Promise<number> {
    for (let i = 0; i < this.game.players.length; i++) {
      if (i === this.index || this.game.players[i].isLost) continue;
      const accepted = await this.sendTradeOffer(giving, receiving, this.game.players[i]);
      if (accepted) return i;
    }
    return -1;
  }

  async getMakeMoneyItems(amount: number, jailCards: number, properties: MakeMoneyPropertySet,
    utilities: Utility[], railroads: Railroad[]) {
    const actions: MakeMoneyItem[] = [];
    let actionIndex = 0;
    while (actionIndex < this.config.makeMoneyOrder.length && amount > 0) {
      const action = this.config.makeMoneyOrder[actionIndex];
      switch (action) {
        case MakeMoney.SELL | MakeMoney.JAIL_CARD:
          if (jailCards > 0) {
            // console.log('sell jail card');
            amount -= 50;
            jailCards--;
            actions.push({ jailCard: true });
          } else actionIndex++;
          break;
        case MakeMoney.MORTGAGE | MakeMoney.UTILITY: {
          let found = false;
          for (let i = 0; i < utilities.length; i++) {
            const utility = utilities[i];
            if (utility.mortgaged) continue;
            // console.log('mortgage', this.game.localizeItem(utility));
            amount -= utility.cost * this.game.config.mortgageMultiplier;
            utility.mortgaged = true;
            actions.push({ mortgage: utility });
            found = true;
            break;
          }
          if (!found) actionIndex++;
          break;
        }
        case MakeMoney.SELL | MakeMoney.UTILITY: {
          const utility = utilities.pop();
          if (utility) {
            // console.log('sell', this.game.localizeItem(utility));
            amount -= utility.mortgaged ? utility.cost * this.game.config.mortgageMultiplier : utility.cost;
            actions.push({ sell: utility });
          } else actionIndex++;
          break;
        }
        case MakeMoney.MORTGAGE | MakeMoney.RAILROAD: {
          let found = false;
          for (let i = 0; i < railroads.length; i++) {
            const railroad = railroads[i];
            if (railroad.mortgaged) continue;
            // console.log('mortgage', this.game.localizeItem(railroad));
            amount -= railroad.cost * this.game.config.mortgageMultiplier;
            railroad.mortgaged = true;
            actions.push({ mortgage: railroad });
            found = true;
            break;
          }
          if (!found) actionIndex++;
          break;
        }
        case MakeMoney.SELL | MakeMoney.RAILROAD: {
          const utility = railroads.pop();
          if (utility) {
            // console.log('sell', this.game.localizeItem(utility));
            amount -= utility.mortgaged ? utility.cost * this.game.config.mortgageMultiplier : utility.cost;
            actions.push({ sell: utility });
          } else actionIndex++;
          break;
        }
        case MakeMoney.MORTGAGE | MakeMoney.NONSET_PROPERTY: {
          let found = false;
          setLabel: for (const set in properties) {
            const totalSet = this.game.set(+set);
            if (totalSet.length === properties[set].length) continue;
            for (let i = 0; i < properties[set].length; i++) {
              const property = properties[set][i];
              if (property.mortgaged || property.unusable) continue;
              // console.log('mortgage nonset', this.game.localizeItem(property));
              amount -= property.cost * this.game.config.mortgageMultiplier;
              property.mortgaged = true;
              actions.push({ mortgage: property });
              found = true;
              break setLabel;
            }
          }
          if (!found) actionIndex++;
          break;
        }
        case MakeMoney.SELL | MakeMoney.NONSET_PROPERTY: {
          let found = false;
          setLabel: for (const set in properties) {
            const totalSet = this.game.set(+set);
            if (totalSet.length === properties[set].length) continue;
            for (let i = 0; i < properties[set].length; i++) {
              const property = properties[set][i];
              if (property.unusable) continue;
              // console.log('sell nonset', this.game.localizeItem(property));
              amount -= property.mortgaged ? property.cost * this.game.config.mortgageMultiplier : property.cost;
              property.unusable = true;
              actions.push({ sell: property });
              found = true;
              break setLabel;
            }
          }
          if (!found) actionIndex++;
          break;
        }
        case MakeMoney.MORTGAGE | MakeMoney.SET_PROPERTY: {
          let found = false;
          setLabel: for (const set in properties) {
            const totalSet = this.game.set(+set);
            const mySet = properties[set];
            if (totalSet.length !== mySet.length) continue;
            if (mySet.some(t => t.buildings > 0)) continue;
            for (let i = 0; i < mySet.length; i++) {
              const property = mySet[i];
              if (property.mortgaged || property.unusable) continue;
              // console.log('mortgage set', this.game.localizeItem(property));
              amount -= property.cost * this.game.config.mortgageMultiplier;
              property.mortgaged = true;
              actions.push({ mortgage: property });
              found = true;
              break setLabel;
            }
          }
          if (!found) actionIndex++;
          break;
        }
        case MakeMoney.SELL | MakeMoney.SET_PROPERTY: {
          let found = false;
          setLabel: for (const set in properties) {
            const totalSet = this.game.set(+set);
            const mySet = properties[set];
            if (totalSet.length !== mySet.length) continue;
            if (mySet.some(t => t.buildings > 0)) continue;
            for (let i = 0; i < mySet.length; i++) {
              const property = mySet[i];
              if (property.unusable) continue;
              // console.log('sell set', this.game.localizeItem(property));
              amount -= property.mortgaged ? property.cost * this.game.config.mortgageMultiplier : property.cost;
              property.unusable = true;
              actions.push({ sell: property });
              found = true;
              break setLabel;
            }
          }
          if (!found) actionIndex++;
          break;
        }
        case MakeMoney.SELL | MakeMoney.BUILDING: {
          let found = false;
          for (const set in properties) {
            const mySet = properties[set];
            const [highestBuiltIndex] = mySet.reduce((ret, curr, i) => ret[1] > curr.buildings ? ret : [i, curr.buildings], [-1, -1]);
            if (highestBuiltIndex === -1) continue;
            const highestBuilt = mySet[highestBuiltIndex];
            if (highestBuilt.buildings === 0 || highestBuilt.unusable) continue;
            // console.log('sell house from', this.game.localizeItem(highestBuilt));
            amount -= highestBuilt.buildingCost * this.game.config.demolishMultiplier;
            highestBuilt.buildings -= 1;
            actions.push({ demolish: highestBuilt });
            found = true;
            break;
          }
          if (!found) actionIndex++;
          break;
        }
        default:
          throw new Error('Unkown action');
      }
    }
    return [amount, actions] as [number, MakeMoneyItem[]];
  }

  usableMoney(double = false): number {
    let neededMoney = 0;
    for (let i = 1; i <= 6; i++) {
      for (let j = 1; j <= 6; j++) {
        const tile = this.game.board[(this.position + i + j) % this.game.board.length];
        if (tile.type === 'chance') neededMoney += 50;
        else if (tile.type === 'community-chest') neededMoney += 50;
        else if (tile.type === 'tax') neededMoney += tile.cost;
        else if (tile.type === 'utility' && tile.owner !== this.index && tile.owner !== 0)
          neededMoney += this.game.calculateRent(tile, i + j);
        else if (tile.type === 'railroad' && tile.owner !== this.index && tile.owner !== 0)
          neededMoney += this.game.calculateRent(tile, i + j);
        else if (tile.type === 'property' && tile.owner !== this.index && tile.owner !== 0)
          neededMoney += this.game.calculateRent(tile, i + j);
        else if (['utility', 'railroad', 'property'].includes(tile.type))
          neededMoney += (tile as OwnableBoardItem).cost;
      }
    }
    neededMoney = neededMoney / 36;
    if (double) neededMoney *= 2;
    return this.money - neededMoney;
  }

  wantInTrade(): OwnableBoardItem[] {
    const ret: OwnableBoardItem[] = [];
    const sets = groupBy(this.properties(), 'set');

    for (const set in sets) {
      const totalSet = this.game.set(+set);
      const notInMySet = totalSet.filter(t => t.owner !== this.index);
      if (notInMySet.length === 1 && notInMySet[0].owner !== -1)
        ret.push(notInMySet[0]);
    }
    return ret;
  }

  wantToBuild(): { [key: string]: number } {
    let usableMoney = this.usableMoney();
    let wantBuildSet: { [key: string]: number } = {};
    const wantBuildTile: { [key: string]: number } = {};
    const freqs = this.landingFrequency();
    for (let i = 0; i < freqs.length; i++) {
      const tile = this.game.board[i];
      if (tile.type === 'property' && tile.owner === this.index) {
        if (wantBuildSet[tile.set]) wantBuildSet[tile.set] += freqs[i];
        else wantBuildSet[tile.set] = freqs[i];
        if (wantBuildTile[tile.index]) wantBuildTile[tile.index] += freqs[i];
        else wantBuildTile[tile.index] = freqs[i];
      }
    }
    const wantBuildSetArr = Object.entries(wantBuildSet).sort((a, b) => b[1] - a[1]);
    wantBuildSet = {};
    for (const [setNumber, count] of wantBuildSetArr) {
      if (usableMoney < 0 || count === 0) break;
      const set = this.game.set(+setNumber);
      const mySet = set.filter(t => t.owner === this.index);
      if (mySet.length !== set.length) continue;
      for (let i = 0; i < mySet.length; i++) {
        if (mySet[i].mortgaged) usableMoney -= mySet[i].cost * this.game.unmortgageMultiplier(mySet[i]);
      }
      const cost = set[0].buildingCost;
      const maxBuildable = Math.floor(usableMoney / cost);
      const maxBuildSpace = set.length * 5 - sum(mySet.map(t => t.buildings));
      const building = Math.min(maxBuildable, maxBuildSpace);
      wantBuildSet[setNumber] = building;
    }
    const building: { [key: string]: number } = {};
    for (const set in wantBuildSet) {
      const totalSet = this.game.set(+set);
      const tileWants = totalSet
        .map(t => [t, building[t.index]] as [Property, number])
        .sort((a, b) => a[1] - b[1])
        .map(t => t[0]);
      const buildCost = totalSet[0].buildingCost;
      while (usableMoney > buildCost) {
        const maxBuildings = max(tileWants.map(t => t.buildings + (building[t.index] ?? 0)))!;
        const minBuildings = min(tileWants.map(t => t.buildings + (building[t.index] ?? 0)))!;
        if (maxBuildings - minBuildings === 0) break;
        const minIndex = tileWants.findIndex(t => t.buildings === minBuildings);
        building[tileWants[minIndex].index] = 1;
        usableMoney -= buildCost;
      }
      for (let i = 0; i < tileWants.length && usableMoney > buildCost; i++) {
        const buildingsOnTile = (building[tileWants[i].index] ?? 0) + tileWants[i].buildings;
        if (buildingsOnTile === 5) continue;
        building[tileWants[i].index] = (building[tileWants[i].index] ?? 0) + 1;
        usableMoney -= buildCost;
        if (buildingsOnTile + 1 < 5 && i + 1 === tileWants.length) i = -1;
      }
    }
    return building;
  }

  wantToUnmortgage(): number[] {
    let usableMoney = this.usableMoney(true);
    const ret: number[] = [];
    const freqs = this.landingFrequency();
    const freqsDone: number[] = [];
    while (true) {
      let maxIndex = -1;
      let maxx = 0;
      for (let i = 0; i < freqs.length; i++) {
        if (freqs[i] > maxx && !freqsDone.includes(i)) {
          maxx = freqs[i];
          maxIndex = i;
        }
      }
      if (maxx === 0) break;
      freqsDone.push(maxIndex);
      const tile = this.game.board[maxIndex];
      if (!tile) break;
      if ((tile.type === 'property' || tile.type === 'railroad' || tile.type === 'utility') && tile.owner === this.index && tile.mortgaged) {
        const cost = tile.cost * this.game.unmortgageMultiplier(tile);
        if (usableMoney > cost) {
          ret.push(tile.index);
          usableMoney -= tile.cost * this.game.unmortgageMultiplier(tile);
        }
      }
    }
    return ret;
  }

  landingFrequency(): number[] {
    const freq: number[] = new Array(this.game.board.length).fill(0);
    for (let playerI = 0; playerI < this.game.players.length; playerI++) {
      if (playerI === this.index || this.game.players[playerI].isLost) continue;
      for (let i = 1; i <= 6; i++) {
        for (let j = 1; j <= 6; j++) {
          freq[(this.game.players[playerI].position + i + j) % this.game.board.length]++;
        }
      }
    }
    return freq;
  }

  valuePlayer(p: Player): number {
    const properties = p.properties();
    const railroads = p.railroads();
    const utilities = p.utilities();
    const money = p.money;
    const jailCards = p.jailCards;
    return this.valueItems([
      ...properties.map(t => ({ tile: t })),
      ...railroads.map(t => ({ tile: t })),
      ...utilities.map(t => ({ tile: t })),
      { money },
      { jailCards },
    ]);
  }

  valueItems(items: TradeItem[]): number {
    const tiles = items.filter(t => t.tile).map(t => t.tile!);
    const money = sum(items.filter(t => t.money).map(t => t.money));
    const cards = sum(items.filter(t => t.jailCards).map(t => t.jailCards));

    const properties = tiles.filter(t => t.type === 'property') as Property[];
    const railroads = tiles.filter(t => t.type === 'railroad') as Railroad[];
    const utilities = tiles.filter(t => t.type === 'utility') as Utility[];

    let value = money + cards * 50;
    const mortgageFactor = this.game.config.mortgageMultiplier / this.game.config.lateUnmortgageMultiplier;

    // Utilities
    const allUtilities = this.game.board.filter(tile => tile.type === 'utility') as Utility[];
    const myUtilities = allUtilities.filter(tile => tile.owner === this.index);
    for (const t of utilities) {
      const factor = t.mortgaged ? mortgageFactor : 1;
      if (myUtilities.length < 2) value += t.cost * factor;
      else value += t.cost * 1.5 * factor;
    }

    // Railroads
    const allRailroads = this.game.board.filter(tile => tile.type === 'railroad') as Railroad[];
    const myRailroads = allRailroads.filter(tile => tile.owner === this.index);
    for (const t of railroads) {
      const factor = t.mortgaged ? mortgageFactor : 1;
      value += t.cost * (2 ** ((myRailroads.length - 1) / 5)) * factor;
    }

    // Properties
    const sets = groupBy(properties, 'set');
    for (const set in sets) {
      const totalSet = this.game.set(+set);
      const incomingSet = sets[set];
      const mySet = totalSet.filter(t => t.owner === this.index);
      for (const t of incomingSet) {
        const factor = t.mortgaged ? mortgageFactor : 1;
        if (mySet.length === totalSet.length) value += t.cost * 3 * factor;
        else if (mySet.length === 1) value += t.cost * factor;
        else value += t.cost * 1.6 * factor;
        value += t.buildingCost * t.buildings;
      }
    }
    return Math.floor(value);
  }

  generateTradeOffer(want: OwnableBoardItem): [number, TradeItem[], TradeItem[]] {
    const toIndex = want.owner;
    if (toIndex === -1) return [-1, [], []];
    const to = this.game.players[toIndex];
    const myProperties = groupBy(this.properties(), 'set');
    const myRailroads = this.railroads();
    const myUtilities = this.utilities();
    const theirProperties = groupBy(to.properties(), 'set');
    const theirRailroads = to.railroads();
    const theirUtilities = to.utilities();


    return [-1, [], []];
  }

}
