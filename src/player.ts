import { groupBy, max, min, sum } from 'lodash';
import { JailCheck, Monopoly, OwnableBoardItem, Property, Railroad, Utility } from './monopoly';
import { rollDice } from './utils';

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

// Settings
// - No auctions
// - Min bid increase
// - No monopolies needed
// - Jail choose after rolling
// - Free parking taxes
// - Unmortgage at 0% interest
// - Changed owner unmortgage at 10% or 0% interest
// - Sell buildings at 100% cost
// - Mortgaged set no double rent (railroad and utility)
// - Sell jail card to bank

type TradeItem = {
  tile?: OwnableBoardItem,
  jailCards?: number,
  money?: number,
};

export class Player {
  index: number;
  game: Monopoly;
  position = 0;
  money = 1500;
  isJailed = false;
  jailRolls = 0;
  jailCards = 0;
  lost = false;
  seed?: number;

  constructor(config?: {
    seed?: number;
  }) {
    if (config) {
      this.seed = config.seed;
    }
  }

  init(game: Monopoly) {
    this.index = game.players.length;
    this.game = game;
  }

  rollDice() {
    return rollDice(this.seed);
  }

  positionString(name = false): string {
    let str = `line ${Math.floor(this.position / 10) + 1}, pos ${this.position % 10}`;
    if (name) str = this.game.localizeItem(this.game.board[this.position]) + ' - ' + str;
    return str;
  }

  properties(): Property[] {
    return this.game.board.filter(t => t.type === 'property' && t.owner === this.index) as Property[];
  }

  railroads(): Railroad[] {
    return this.game.board.filter(t => t.type === 'railroad' && t.owner === this.index) as Railroad[];
  }

  utilities(): Utility[] {
    return this.game.board.filter(t => t.type === 'utility' && t.owner === this.index) as Utility[];
  }

  move(steps: number): boolean {
    this.position = this.position + steps;
    if (this.position >= this.game.board.length) {
      this.position -= this.game.board.length;
      this.passGo();
      return true;
    }
    if (this.position < 0) this.position += this.game.board.length;
    return false;
  }

  jailCheck(dice1: number, dice2: number): JailCheck {
    if (!this.isJailed) return JailCheck.NOT_JAILED;
    this.jailRolls++;
    if (this.doubleOutOfJail(dice1, dice2)) return JailCheck.DOUBLE;
    const want = this.wantOutOfJail();
    if (want === 'money') return JailCheck.PAYING;
    if (want == 'card') return JailCheck.CARD;
    if (this.forceOutOfJail()) return JailCheck.THIRD_ROLL;
    return JailCheck.JAILED;
  }

  doubleOutOfJail(dice1: number, dice2: number): boolean {
    if (dice1 === dice2) {
      this.isJailed = false;
      this.jailRolls = 0;
      return true;
    }
    return false;
  }

  forceOutOfJail(): boolean {
    if (this.jailRolls === 3) {
      this.isJailed = false;
      this.jailRolls = 0;
      return true;
    }
    return false;
  }

  wantOutOfJail(): 'card' | 'money' | 'none' {
    // Always use card or money
    // Always use only card
    // Use card only when streets mostly clear
    // Never
    if (this.jailCards) {
      this.jailCards -= 1;
      this.jailRolls = 0;
      this.isJailed = false;
      return 'card';
    }
    if (this.usableMoney() > 200) {
      this.jailRolls = 0;
      this.isJailed = false;
      return 'money';
    }
    return 'none';
  }

  jail(): string {
    this.position = 10;
    this.isJailed = true;
    return `Player ${this.index + 1} got Jailed`;
  }

  passGo() {
    this.earn(200);
  }

  spend(amount: number, to?: Player): [boolean, string] {
    const diff = amount - this.money;
    if (diff < 0) {
      this.money -= amount;
      if (to) {
        to.earn(amount);
        return [true, `Player ${this.index + 1} (${this.money}) paid ${amount} to Player ${to.index + 1} (${this.game.players[to.index].money})`];
      }
      return [true, `Player ${this.index + 1} paid ${amount} to bank (${this.money})`];
    } else {
      // 1. Trade jail cards
      // 1. Mortgage non full sets
      // 1. Mortgage non building properties
      // 1. Sell buildings
      // 1. Trade
      // 1. Mortgage full sets

      // if (this.jailCards) {
      //   const x = this.makeTradeOfferToEveryone([{ jailCards: 1 }], [{ money: 50 }]);
      // }

      return [false, `Player ${this.index + 1} does not have enough money`];
    }
  }

  earn(amount: number): string {
    this.money += amount;
    return `Player ${this.index + 1} earned ${amount} from bank (${this.money})`;
  }

  willBuy(tile: OwnableBoardItem): boolean {
    const maxMoneyOthers = max(this.game.players.map(p => p.index === this.index ? 0 : p.money))!;
    if (maxMoneyOthers < tile.cost) return false;
    if (tile.type === 'property') {
      const set = this.game.set(tile.set);
      if (set.filter(t => t.owner !== this.index).length === 1) return true;
    }
    return this.money > tile.cost;
  }

  bid(tile: OwnableBoardItem, highestBid: number, highestBidder: number): number {
    if (this.money <= highestBid) return 0;
    if (highestBidder === this.index) return highestBid;

    let bid = highestBid + 1;
    let maxSpending = tile.cost * 1.2;
    if (tile.type === 'property') {
      const set = this.game.set(tile.set);
      if (set.filter(t => t.owner !== this.index).length === 1) maxSpending = tile.cost * 2;
    }
    if (highestBid < maxSpending) bid = highestBid + 1;
    // if (highestBid < tile.cost / 2) bid = highestBid + 1;
    // else if (highestBid < tile.cost) bid = highestBid + 1;
    // else if (highestBidder === this.game.turnOfPlayer && highestBid < tile.cost * 1.2) return highestBid + 1;

    // const maxMoneyOthers = max(this.game.players.map(p => p.index === this.index ? 0 : p.money))!;
    // if (bid > maxMoneyOthers) bid = maxMoneyOthers + 1;
    if (bid > this.money) bid = this.money;
    return bid;
  }

  mortgage() {

  }

  usableMoney(): number {
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
    return this.money - neededMoney;
  }

  endTurn(): string[] {
    const actions: string[] = [];
    let usableMoney = this.usableMoney();

    const wantTrade: OwnableBoardItem[] = [];
    const sets = groupBy(this.properties(), 'set');
    for (const set in sets) {
      const totalSet = this.game.set(+set);
      const notInMySet = totalSet.filter(t => t.owner !== this.index);
      if (notInMySet.length === 1 && notInMySet[0].owner !== -1)
        wantTrade.push(notInMySet[0]);
    }
    for (const want of wantTrade) {
      const [to, giving, receiving] = this.generateTradeOffer(want);
      if (to === -1) continue;
      const [accepted, tradeActions] = this.sendTradeOffer(giving, receiving, this.game.players[to]);
      actions.push(...tradeActions);
    }

    let wantBuildSet: { [key: string]: number } = {};
    const wantBuildTile: { [key: string]: number } = {};
    for (let i = 0; i < this.game.players.length; i++) {
      if (i === this.index) continue;
      const p = this.game.players[i];
      for (let j = 1; j <= 6; j++) {
        for (let k = 1; k <= 6; k++) {
          const tile = this.game.board[(p.position + j + k) % this.game.board.length];
          if (tile.type === 'property' && tile.owner === this.index) {
            if (wantBuildSet[tile.set]) wantBuildSet[tile.set]++;
            else wantBuildSet[tile.set] = 1;
            if (wantBuildTile[tile.index]) wantBuildTile[tile.index]++;
            else wantBuildTile[tile.index] = 1;
          }
        }
      }
    }
    const wantBuildSetArr = Object.entries(wantBuildSet).sort((a, b) => a[1] - b[1]);
    wantBuildSet = {};
    for (const [setNumber, _] of wantBuildSetArr) {
      if (usableMoney < 0) break;
      const set = this.game.set(+setNumber);
      const mySet = set.filter(t => t.owner === this.index);
      if (mySet.length !== set.length) continue;
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
      for (let i = 0; i < tileWants.length, usableMoney > buildCost; i++) {
        const buildingsOnTile = (building[tileWants[i].index] ?? 0) + tileWants[i].buildings;
        if (buildingsOnTile === 5) continue;
        building[tileWants[i].index] = (building[tileWants[i].index] ?? 0) + 1;
        usableMoney -= buildCost;
        if (buildingsOnTile + 1 < 5 && i + 1 === tileWants.length) i = -1;
      }
    }
    for (const tileIndex in building) {
      const tile = this.game.board[tileIndex] as Property;
      tile.buildings += building[tileIndex];
      const cost = tile.buildingCost * building[tileIndex];
      this.spend(cost);
      actions.push(`Player ${this.index + 1} built ${building[tileIndex]} houses on ${this.game.localizeItem(tile)} for ${cost}`);
    }
    console.log('wantTrade', wantTrade.map(t => this.game.localizeItem(t)));
    return actions;
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
    const cards = sum(items.filter(t => t.jailCards));

    const properties = tiles.filter(t => t.type === 'property') as Property[];
    const railroads = tiles.filter(t => t.type === 'railroad') as Railroad[];
    const utilities = tiles.filter(t => t.type === 'utility') as Utility[];

    let value = money + cards * 50;

    // Utilities
    const allUtilities = this.game.board.filter(tile => tile.type === 'utility') as Utility[];
    const myUtilities = allUtilities.filter(tile => tile.owner === this.index);
    for (const t of utilities) {
      const factor = t.mortgaged ? 0.4 : 1;
      if (myUtilities.length < 2) value += t.cost * factor;
      else value += t.cost * 1.5 * factor;
    }

    // Railroads
    const allRailroads = this.game.board.filter(tile => tile.type === 'railroad') as Railroad[];
    const myRailroads = allRailroads.filter(tile => tile.owner === this.index);
    for (const t of railroads) {
      const factor = t.mortgaged ? 0.4 : 1;
      value += t.cost * (2 ** ((myRailroads.length - 1) / 5)) * factor;
    }

    // Properties
    const sets = groupBy(properties, 'set');
    for (const set in sets) {
      const totalSet = this.game.set(+set);
      const incomingSet = sets[set];
      const mySet = totalSet.filter(t => t.owner === this.index);
      for (const t of incomingSet) {
        const factor = t.mortgaged ? 0.4 : 1;
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

  receiveTradeOffer(giving: TradeItem[], receiving: TradeItem[], from: Player): boolean {
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

  sendTradeOfferToEveryone(giving: TradeItem[], receiving: TradeItem[]): [number, string[]] {
    for (let i = 0; i < this.game.players.length; i++) {
      if (i === this.index) continue;
      const [accepted, actions] = this.sendTradeOffer(giving, receiving, this.game.players[i]);
      if (accepted) return [i, actions];
    }
    return [-1, []];
  }

  sendTradeOffer(giving: TradeItem[], receiving: TradeItem[], to: Player): [boolean, string[]] {
    const accepted = to.receiveTradeOffer(receiving, giving, this);
    const actions: string[] = [];
    if (accepted) {
      for (const { tile, jailCards, money } of giving) {
        if (tile) {
          tile.owner = to.index;
          actions.push(`Player ${this.index + 1} gave ${this.game.localizeItem(tile)} to Player ${to.index + 1}`);
        } else if (jailCards) {
          to.jailCards += jailCards;
          this.jailCards -= jailCards;
          if (jailCards === 1) actions.push(`Player ${this.index + 1} gave a Get out of Jail card to Player ${to.index + 1}`);
          else actions.push(`Player ${this.index + 1} gave ${jailCards} Get out of Jail cards to Player ${to.index + 1}`);
        } else if (money) {
          this.spend(money, to);
          actions.push(`Player ${this.index + 1} gave $${money} to Player ${to.index + 1}`);
        }
      }
      for (const { tile, jailCards, money } of receiving) {
        if (tile) {
          tile.owner = this.index;
          actions.push(`Player ${to.index + 1} gave ${this.game.localizeItem(tile)} to Player ${this.index + 1}`);
        } else if (jailCards) {
          this.jailCards += jailCards;
          to.jailCards -= jailCards;
          if (jailCards === 1) actions.push(`Player ${to.index + 1} gave a Get out of Jail card to Player ${this.index + 1}`);
          else actions.push(`Player ${to.index + 1} gave ${jailCards} Get out of Jail cards to Player ${this.index + 1}`);
        } else if (money) {
          to.spend(money, this);
          actions.push(`Player ${to.index + 1} gave $${money} to Player ${this.index + 1}`);
        }
      }
    }
    return [accepted, actions];
  }

}
