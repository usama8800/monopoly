import { Monopoly } from './monopoly';
import { JailCheck, OwnableBoardItem, Property, Railroad, Utility, rollDice } from './utils';

export enum MakeMoney {
  SELL = 0,
  MORTGAGE = 1,
  SET_PROPERTY = 1 << 1,
  NONSET_PROPERTY = 1 << 2,
  UTILITY = 1 << 3,
  RAILROAD = 1 << 4,
  BUILDING = 1 << 5,
  JAIL_CARD = 1 << 6,
}

export type MakeMoneyItem = {
  jailCard?: boolean;
  mortgage?: OwnableBoardItem;
  sell?: OwnableBoardItem;
  demolish?: Property;
};

export type MakeMoneyPropertySet = { [key: string]: (Property & { unusable?: boolean })[] };

export type TradeItem = {
  tile?: OwnableBoardItem,
  jailCards?: number,
  money?: number,
};

export abstract class Player {
  index: number;
  game: Monopoly;
  abstract type: string;
  position = 0;
  money = 1500;
  isJailed = false;
  jailRolls = 0;
  jailCards = 0;
  isLost = false;
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

  titles(): OwnableBoardItem[] {
    return this.game.board.filter(t => (t.type === 'property' || t.type === 'railroad' || t.type === 'utility')
      && t.owner === this.index) as OwnableBoardItem[];
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

  async jailCheck(dice1: number, dice2: number): Promise<JailCheck> {
    if (!this.isJailed) return JailCheck.NOT_JAILED;
    this.jailRolls++;
    const want = await this.wantOutOfJail();
    if (want === 'money') {
      this.jailRolls = 0;
      this.isJailed = false;
      return JailCheck.PAYING;
    }
    if (want == 'card') {
      this.jailCards--;
      this.jailRolls = 0;
      this.isJailed = false;
      return JailCheck.CARD;
    }
    if (this.doubleOutOfJail(dice1, dice2)) return JailCheck.DOUBLE;
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

  jail() {
    this.position = 10;
    this.isJailed = true;
    this.game.pushActions({ action: 'Jail', who: this.index });
  }

  passGo() {
    this.earn(this.game.config.goMoney);
  }

  async spend(amount: number, to?: Player): Promise<boolean> {
    const diff = amount - this.money;
    if (diff <= 0) {
      this.money -= amount;
      if (to) to.earn(amount);
      this.game.pushActions({ action: 'Spend', who: this.index, amount, money: this.money, to: to?.index, toMoney: to?.money });
      return true;
    } else {
      const amountLeft = await this.makeMoney(diff);
      const success = amountLeft > 0 ? false : await this.spend(amount, to);
      if (!success) {
        this.isLost = true;
        await this.game.handleLosing(this, to);
      }
      return success;
    }
  }

  earn(amount: number) {
    this.money += amount;
    this.game.pushActions({ action: 'Earn', who: this.index, amount, money: this.money });
  }

  async build(tile: Property, number: number) {
    const cost = tile.buildingCost * number;
    const success = await this.spend(cost);
    if (!success) return false;
    tile.buildings += number;
    this.game.pushActions({ action: 'Build', who: this.index, where: tile.index, number });
    return true;
  }

  demolish(tile: Property) {
    if (tile.buildings === 0) return false;
    tile.buildings--;
    const making = tile.buildingCost * this.game.config.demolishMultiplier;
    this.money += making;
    this.game.pushActions({ action: 'Demolish', who: this.index, amount: making, where: tile.index, money: this.money });
    return true;
  }

  mortgage(tile: OwnableBoardItem) {
    if (tile.mortgaged) return false;
    tile.mortgaged = true;
    const making = tile.cost * this.game.config.mortgageMultiplier;
    this.money += making;
    this.game.pushActions({ action: 'Mortgage', who: this.index, amount: making, where: tile.index, money: this.money });
    return true;
  }

  async unmortgage(tile: OwnableBoardItem) {
    if (!tile.mortgaged) return false;
    const cost = tile.cost * this.game.unmortgageMultiplier(tile);
    const success = await this.spend(cost);
    if (!success) return false;
    tile.mortgaged = false;
    this.game.pushActions({ action: 'Unmortgage', who: this.index, where: tile.index });
    return true;
  }

  async sendTradeOffer(giving: TradeItem[], receiving: TradeItem[], to: Player): Promise<boolean> {
    const accepted = await to.receiveTradeOffer(receiving, giving, this);
    if (accepted) {
      for (const { tile, jailCards, money } of giving) {
        if (tile) {
          tile.owner = to.index;
          tile.ownershipChanged = [this.game.rounds, this.game.turnOfPlayer];
          this.game.pushActions({ action: 'Trade', what: 'Tile', from: this.index, to: to.index, which: tile.index });
        } else if (jailCards) {
          to.jailCards += jailCards;
          this.jailCards -= jailCards;
          this.game.pushActions({ action: 'Trade', what: 'Jail Card', number: jailCards, from: this.index, to: to.index });
        } else if (money) {
          await this.spend(money, to);
        }
      }
      for (const { tile, jailCards, money } of receiving) {
        if (tile) {
          tile.owner = this.index;
          tile.ownershipChanged = [this.game.rounds, this.game.turnOfPlayer];
          this.game.pushActions({ action: 'Trade', what: 'Tile', from: to.index, to: this.index, which: tile.index });
        } else if (jailCards) {
          this.jailCards += jailCards;
          to.jailCards -= jailCards;
          this.game.pushActions({ action: 'Trade', what: 'Jail Card', number: jailCards, from: to.index, to: this.index });
        } else if (money) {
          await to.spend(money, this);
        }
      }
    }
    return accepted;
  }

  abstract wantOutOfJail(): Promise<'card' | 'money' | 'none'>;
  abstract willBuy(tile: OwnableBoardItem): Promise<boolean>;
  abstract bid(tile: OwnableBoardItem, highestBid: number, highestBidder: number): Promise<number>;
  abstract endTurn(): Promise<void>;
  abstract receiveTradeOffer(giving: TradeItem[], receiving: TradeItem[], from: Player): Promise<boolean>;
  abstract makeMoney(amount: number): Promise<number>;
}
