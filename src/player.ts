import { groupBy, max, sum } from 'lodash';
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
      return 'card';
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
    // TODO Mortages, Buildings

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
      const factor = t.cost;
      if (myUtilities.length < 2) value += t.cost;
      else value += t.cost * 1.5;
    }

    // Railroads
    const allRailroads = this.game.board.filter(tile => tile.type === 'railroad') as Railroad[];
    const myRailroads = allRailroads.filter(tile => tile.owner === this.index);
    for (const t of railroads) {
      if (myRailroads.length < 2) value += t.cost;
      else value += t.cost * (1 + (myRailroads.length ** 1.2) / allRailroads.length);
    }

    // Properties
    const sets = groupBy(properties, 'set');
    for (const set in sets) {
      const totalSet = this.game.set(+set);
      const inSet = sets[set];
      for (const t of inSet) {
        value += t.cost;
      }
    }
    return value;
  }

  getTradeOffer(giving: TradeItem[], receiving: TradeItem[], from: Player): boolean {
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

  makeTradeOfferToEveryone(giving: TradeItem[], receiving: TradeItem[]): number {
    for (let i = 0; i < this.game.players.length; i++) {
      if (i === this.index) continue;
      if (this.makeTradeOffer(giving, receiving, this.game.players[i])) return i;
    }
    return -1;
  }

  makeTradeOffer(giving: TradeItem[], receiving: TradeItem[], to: Player): [boolean, string[]] {
    const accepted = to.getTradeOffer(receiving, giving, this);
    const actions: string[] = [];
    if (accepted) {
      for (const { tile, jailCards, money } of giving) {
        if (tile) {
          tile.owner = to.index;
          actions.push(`Player ${this.index + 1} gave ${this.game.localizeItem(tile)} to Player ${to.index + 1}`);
        } else if (jailCards) {
          if (jailCards[0]) {
            to.jailCards += jailCards;
          }
        } else if (money) {
          this.spend(money, to);
        }
      }
      for (const { tile, jailCards, money } of receiving) {
        if (tile) {
          tile.owner = this.index;
        } else if (jailCards) {
          this.jailCards += jailCards;
        } else if (money) {
          to.spend(money, this);
        }
      }

    }
    return [accepted, actions];
  }

}
