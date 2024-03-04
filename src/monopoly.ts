import chalk from 'chalk';
import { readJsonSync } from 'fs-extra';
import { join } from 'path';
import { Player } from './player';
import { shuffle } from './utils';

type Name = string | {
  us: string;
  uk: string;
};
export type Property = {
  index: number;
  name: Name;
  type: 'property';
  cost: number;
  set: number;
  rent: number[];
  buildingCost: number;
  buildings: number;
  mortgaged: boolean;
  ownershipChanged: [number, number];
  owner: number;
  color: string,
};
export type Corner = {
  index: number;
  name: Name;
  type: 'go' | 'jail' | 'free-parking' | 'go-to-jail';
  corner: true;
}
export type Railroad = {
  index: number;
  name: Name;
  type: 'railroad';
  cost: number;
  rent: number[];
  mortgaged: boolean;
  ownershipChanged: [number, number];
  owner: number;
}
export type Utility = {
  index: number;
  name: Name;
  type: 'utility';
  cost: number;
  rent: number[];
  mortgaged: boolean;
  ownershipChanged: [number, number];
  owner: number;
}
export type CommunityChest = {
  index: number;
  name: Name;
  type: 'community-chest';
}
export type Chance = {
  index: number;
  name: Name;
  type: 'chance';
}
export type Tax = {
  index: number;
  name: Name;
  type: 'tax';
  cost: number;
}
export type OwnableBoardItem = Property | Railroad | Utility;
export type BoardItem = OwnableBoardItem | Corner | CommunityChest | Chance | Tax;
export type Board = BoardItem[];
export type CCard = {
  description: string;
  type: 'advance' | 'earn' | 'jail' | 'jail-card' | 'back' | 'spend' | 'repairs' | 'spend-each-player' | 'earn-each-player';
  data: number | string | number[] | undefined;
}
export enum JailCheck {
  NOT_JAILED, THIRD_ROLL, CARD, PAYING, DOUBLE, JAILED
}

export class Monopoly {
  houses = 32;
  hotels = 12;
  players: Player[] = [];
  board: Board;
  chance: CCard[];
  communityChest: CCard[] = [];
  turnOfPlayer = 0;
  rounds = 0;
  doubles = 0;
  roll = 0;
  edition: 'uk' | 'us' = 'uk';
  seed?: number;
  config = {
    mortgageMultiplier: 0.5,
    unmortgageMultiplier: 1.1,
    lateUnmortgageMultiplier: 1.2,
    demolishMultiplier: 0.5,
    auctions: true,
    minBidIncrease: 1,
    noMonopoliesNeeded: false,
    jailChooseAfterRolling: false,
    freeParkingTaxes: false,
    sellJailCard: false,
    mortageRemovesDoubleRent: false,
  };
  lastActions: string[] = [];

  constructor(config?: {
    edition?: 'uk' | 'us';
    seed?: number;
  }) {
    this.board = readJsonSync(join(__dirname, 'data', 'board.json')).map((x: BoardItem, i: number) => {
      x.index = i;
      if (x.type === 'railroad' || x.type === 'utility' || x.type === 'property') {
        x.owner = -1;
        x.mortgaged = false;
        x.ownershipChanged = [0, 0];
      }
      if (x.type === 'property') {
        x.buildings = 0;
      }
      return x;
    });
    if (config) {
      this.seed = config.seed;
      if (config.edition) this.edition = config.edition;
    }
    this.setChance();
    this.setCommunityChest();
  }

  setChance() {
    this.chance = shuffle(readJsonSync(join(__dirname, 'data', 'chance.json')), this.seed);
  }

  setCommunityChest() {
    this.communityChest = shuffle(readJsonSync(join(__dirname, 'data', 'community-chest.json')), this.seed);
  }

  addPlayer(player: Player) {
    if (this.rounds !== 0) return false;
    player.init(this);
    this.players.push(player);
  }

  localizeItem(data: { index: number, type: 'board' | 'chance' | 'community-chest' } | BoardItem | CCard, color = true): string {
    let item: BoardItem | CCard;
    if (['board', 'chance', 'community-chest'].includes(data.type) && data['name'] === undefined) {
      const { index, type } = data as any;
      if (type === 'board') {
        item = this.board[index];
      } else if (type === 'chance') {
        item = this.chance[index];
      } else {
        item = this.communityChest[index];
      }
    } else {
      item = data as BoardItem | CCard;
    }

    if (Object.prototype.hasOwnProperty.call(item, 'name')) {
      const name = (item as any).name;
      let ret = typeof name === 'string' ? name : name[this.edition];
      if (item.type === 'property') {
        if (item.buildings > 0 && item.buildings < 5) ret += ` (${item.buildings} 🏠)`;
        if (item.buildings === 5) ret += ' (🏨)';
      }
      if (item.type === 'railroad' || item.type === 'utility' || item.type === 'property') {
        if (item.mortgaged) {
          ret += ' 🚫';
        }
      }
      if (color) return chalk.hex(this.tileColor(item as BoardItem, ret))(ret);
      return ret;
    } else {
      const desc: string = (item as any).description;
      return desc.replace(/@(\d+)/, (_, p1) => this.localizeItem({ index: parseInt(p1, 10), type: 'board' }));
    }
  }

  tileColor(tile: BoardItem, localized?: string): string {
    if (tile.type === 'property') return tile.color;
    if (tile.type === 'railroad') return '#000000';
    localized = localized ?? this.localizeItem(tile, false);
    if (tile.type === 'utility' && localized.toLowerCase().includes('water')) return '#00b1ee';
    if (tile.type === 'utility') return '#ffdf91';
    return '#ffffff';
  }

  tileAsOwnable(tile: BoardItem): undefined | OwnableBoardItem {
    if (tile.type === 'property' || tile.type === 'railroad' || tile.type === 'utility') return tile;
    return undefined;
  }

  set(num: number): Property[] {
    return this.board.filter(t => t.type === 'property' && t.set === num) as Property[];
  }

  distanceToTile(from: BoardItem | number, to: BoardItem | number): number {
    if (typeof from !== 'number') from = from.index;
    if (typeof to !== 'number') to = to.index;
    return (to - from + this.board.length) % this.board.length;
  }

  nextPlayer(): string[] {
    const actions = this.players[this.turnOfPlayer].endTurn();
    this.doubles = 0;
    this.turnOfPlayer = this.turnOfPlayer + 1;
    if (this.turnOfPlayer >= this.players.length) {
      this.rounds++;
      this.turnOfPlayer -= this.players.length;
    }
    if (this.players[this.turnOfPlayer].lost) this.nextPlayer();
    return actions;
  }

  turn(dice1?: number, dice2?: number): string[] {
    const player = this.players[this.turnOfPlayer];
    dice1 = dice1 ?? player.rollDice();
    dice2 = dice2 ?? player.rollDice();
    this.roll = dice1 + dice2;
    const actions: string[] = [];
    const jailCheck = player.jailCheck(dice1, dice2);
    if (jailCheck === JailCheck.NOT_JAILED) {
      actions.push(`Player ${player.index + 1} rolls ${dice1} and ${dice2}`);
    } else if (jailCheck === JailCheck.CARD) {
      actions.push(`Player ${player.index + 1} uses a get out of jail free card`);
      actions.push(`Player ${player.index + 1} rolls ${dice1} and ${dice2}`);
    } else if (jailCheck === JailCheck.PAYING) {
      actions.push(`Player ${player.index + 1} pays to get out of jail`);
      actions.push(`Player ${player.index + 1} rolls ${dice1} and ${dice2}`);
    } else if (jailCheck === JailCheck.THIRD_ROLL) {
      actions.push(`Player ${player.index + 1} rolls ${dice1} and ${dice2}`);
      actions.push(`Player ${player.index + 1} has to pay to get out of jail`);
      const [success, actions1] = player.spend(50);
      actions.push(...actions1);
    } else if (jailCheck === JailCheck.DOUBLE) {
      actions.push(`Player ${player.index + 1} rolls ${dice1} and ${dice2}`);
      actions.push(`Player ${player.index + 1} rolls a double to get out of jail`);
    } else if (jailCheck === JailCheck.JAILED) {
      actions.push(`Player ${player.index + 1} rolls ${dice1} and ${dice2}`);
      actions.push(`Player ${player.index + 1} still in jail`);
    }
    let doubleJailed = false;
    if (dice1 === dice2) {
      this.doubles++;
      if (this.doubles === 3) {
        actions.push(`Player ${player.index + 1} rolls three doubles and goes to jail`);
        player.jail();
        doubleJailed = true;
      }
    }
    if (!doubleJailed && jailCheck !== JailCheck.JAILED) {
      if (player.move(dice1 + dice2)) actions.push(`Player ${player.index + 1} passes Go, collects 200 (${player.money})`);
      const actions1 = this.handleTile();
      actions.push(...actions1);
    }
    if (!doubleJailed && dice1 === dice2) {
      if (!player.isJailed) actions.push(...this.turn());
      else actions.push(...this.nextPlayer());
    } else {
      actions.push(...this.nextPlayer());
    }
    this.lastActions = actions;
    return actions;
  }

  handleTile(): string[] {
    const player = this.players[this.turnOfPlayer];
    const tile = this.board[player.position];
    const actions = [`Player ${player.index + 1} (${player.money}) lands on ${this.localizeItem(tile)} (${player.positionString()})`];
    if (tile.type === 'chance') {
      if (this.chance.length === 0) this.setChance();
      const card = this.chance.shift();
      if (card) {
        const actions1 = this.handleCard(card);
        actions.push(...actions1);
      }
    } else if (tile.type === 'community-chest') {
      if (this.communityChest.length === 0) this.setCommunityChest();
      const card = this.communityChest.shift();
      if (card) {
        const actions1 = this.handleCard(card);
        actions.push(...actions1);
      }
    } else if (tile.type === 'go-to-jail') {
      actions.push(player.jail());
    } else if (tile.type === 'tax') {
      const [success, actions1] = player.spend(tile.cost);
      actions.push(...actions1);
    } else if (tile.type === 'property' || tile.type === 'railroad' || tile.type === 'utility') {
      const rent = this.calculateRent(tile);
      if (tile.owner === -1) {
        if (player.willBuy(tile)) {
          const [success, actions1] = player.spend(tile.cost);
          tile.owner = player.index;
          actions.push(...actions1);
          actions.push(`Player ${player.index + 1} gets ${this.localizeItem(tile)}`);
        } else actions.push(...this.auction(tile));
      } else if (tile.owner === player.index) {
        if (rent) actions.push(`Player ${player.index + 1} owns ${this.localizeItem(tile)}`);
      } else if (rent) {
        actions[actions.length - 1] += '. Rent: ' + rent;
        const [success, actions1] = player.spend(rent, this.players[tile.owner]);
        actions.push(...actions1);
      }
    }
    return actions;
  }

  handleCard(card: CCard): string[] {
    const player = this.players[this.turnOfPlayer];
    const actions = [`Player ${player.index + 1} draws card: ${this.localizeItem(card)}`];
    if (card.type === 'advance') {
      if (card.data === undefined) return [];
      const position = +card.data;
      let distance: number;
      if (isNaN(position)) {
        if (card.data === 'railroad') {
          distance = this.board.filter(item => item.type === 'railroad')
            .map(item => this.distanceToTile(player.position, item.index)).sort((a, b) => a - b)[0];
        } else if (card.data === 'utility') {
          distance = this.board.filter(item => item.type === 'utility')
            .map(item => this.distanceToTile(player.position, item.index)).sort((a, b) => a - b)[0];
        } else return [];
      } else {
        distance = this.distanceToTile(player.position, position);
      }
      if (player.move(distance)) actions.push(`Player ${player.index + 1} passes Go, collects 200 (${player.money})`);
      const actions1 = this.handleTile();
      return [...actions, ...actions1];
    }
    if (card.type === 'back') {
      if (card.data === undefined) return [];
      const steps = +card.data;
      if (isNaN(steps)) return [];
      player.move(-steps);
      const actions1 = this.handleTile();
      return [...actions, ...actions1];
    }
    if (card.type === 'earn') {
      if (card.data === undefined) return [];
      const amount = +card.data;
      if (isNaN(amount)) return [];
      actions.push(player.earn(amount));
      return actions;
    }
    if (card.type === 'jail') {
      actions.push(player.jail());
      return actions;
    }
    if (card.type === 'spend') {
      if (card.data === undefined) return [];
      const amount = +card.data;
      if (isNaN(amount)) return [];
      const [success, actions1] = player.spend(amount);
      actions.push(...actions1);
      return actions;
    }
    if (card.type === 'earn-each-player') {
      if (card.data === undefined) return [];
      const amount = +card.data;
      if (isNaN(amount)) return [];
      const players = this.players.filter((_, i) => i !== this.turnOfPlayer);
      for (const otherPlayer of players) {
        const [success, actions1] = otherPlayer.spend(amount, player);
        actions.push(...actions1);
      }
      return actions;
    }
    if (card.type === 'spend-each-player') {
      if (card.data === undefined) return [];
      const amount = +card.data;
      if (isNaN(amount)) return [];
      const players = this.players.filter((_, i) => i !== this.turnOfPlayer);
      if (player.money > amount * players.length)
        for (const otherPlayer of players) {
          const [success, actions1] = player.spend(amount, otherPlayer);
          actions.push(...actions1);
        }
      else {
        // TODO
      }
      return actions;
    }
    if (card.type === 'repairs') {
      if (card.data === undefined) return [];
      const [houseRepair, hotelRepair] = card.data as number[];
      if (isNaN(houseRepair) || isNaN(hotelRepair)) return [];
      const properties = player.properties();
      const houses = properties.reduce((acc, property) => acc + (property.buildings === 5 ? 0 : property.buildings), 0);
      const hotels = properties.reduce((acc, property) => acc + (property.buildings === 5 ? 1 : 0), 0);
      const amount = houseRepair * houses + hotelRepair * hotels;
      const [success, actions1] = player.spend(amount);
      actions.push(...actions1);
      return actions;
    }
    if (card.type === 'jail-card') {
      player.jailCards++;
      return actions;
    }
    return actions;
  }

  auction(tile: OwnableBoardItem): string[] {
    const actions: string[] = [`Auction starting for ${this.localizeItem(tile)} (${tile.cost})`];
    const bids: number[] = [];
    for (let i = 0; i < this.players.length; i++) {
      bids.push(-1);
    }
    let highestBidder = -1;
    let highestBid = 0;
    let allFolded = false;
    while (!allFolded) {
      allFolded = true;
      for (let i = 0; i < this.players.length; i++) {
        const bid = this.players[i].bid(tile, highestBid, highestBidder);
        if (bid > bids[i]) bids[i] = bid;
        if (bid > highestBid) {
          // actions.push(`Player ${i + 1} bids ${bid}`);
          highestBid = bid;
          highestBidder = i;
          allFolded = false;
        }
      }
    }
    actions.push('\t-Player-\tBid');
    for (let i = 0; i < this.players.length; i++) {
      actions.push(`\tPlayer ${i + 1}\t${bids[i]}`);
    }
    if (highestBidder !== -1) {
      actions.push(`Player ${highestBidder + 1} wins the auction`);
      const [success, actions1] = this.players[highestBidder].spend(highestBid);
      tile.owner = highestBidder;
      tile.ownershipChanged = [this.rounds, this.turnOfPlayer];
      actions.push(...actions1);
    } else {
      actions.push(`No one bids for ${this.localizeItem(tile)}`);
    }
    return actions;
  }

  calculateRent(tile: OwnableBoardItem, roll?: number): number {
    if (tile.owner === -1 || tile.mortgaged) return 0;
    if (!roll) roll = this.roll;
    if (tile.type === 'property') {
      const set = this.set(tile.set);
      let rent = tile.rent[tile.buildings];
      if (tile.buildings === 0 && set.every(t => t.owner === tile.owner)) rent *= 2;
      return rent;
    }
    if (tile.type === 'railroad') {
      return tile.rent[this.players[tile.owner].railroads().length - 1];
    }
    if (tile.type === 'utility') {
      const utilities = this.players[tile.owner].utilities().length;
      return roll * tile.rent[utilities - 1];
    }
    return 0;
  }

  unmortgageMultiplier(tile: OwnableBoardItem): number {
    let multiplier = this.config.unmortgageMultiplier;
    const [round, turn] = tile.ownershipChanged;
    if (this.rounds - round > 1) multiplier = this.config.lateUnmortgageMultiplier;
    if (this.rounds - round === 1 && this.turnOfPlayer > turn) multiplier = this.config.lateUnmortgageMultiplier;
    return multiplier / 2;
  }
}
