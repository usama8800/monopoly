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
export type Action = {
  action: 'Land';
  who: number;
  where: number;
  money: number;
} | {
  action: 'Recevie Title';
  who: number;
  which: number;
} | {
  action: 'Owns';
  who: number;
  where: number;
} | {
  action: 'Rent';
  where: number;
  amount: number;
  to: number;
} | {
  action: 'Pass Go';
  who: number;
  money: number;
} | {
  action: 'Spend';
  who: number;
  amount: number;
  money: number;
  to?: number;
  toMoney?: number;
} | {
  action: 'Earn';
  who: number;
  amount: number;
  money: number;
} | {
  action: 'Jail';
  who: number;
} | {
  action: 'Auction';
  for: number;
  bids: number[];
  winner: number;
} | {
  action: 'Bankrupt';
  who: number;
  to?: number;
} | {
  action: 'Build';
  who: number;
  where: number;
  number: number;
} | {
  action: 'Demolish';
  who: number;
  where: number;
  amount: number;
  money: number;
} | {
  action: 'Mortgage';
  who: number;
  where: number;
  amount: number;
  money: number;
} | {
  action: 'Unmortgage';
  who: number;
  where: number;
} | {
  action: 'Trade';
  what: 'Tile';
  which: number;
  from: number;
  to: number;
} | {
  action: 'Trade';
  what: 'Jail Card';
  from: number;
  to: number;
  number: number;
} | {
  action: 'Draw card';
  who: number;
  card: CCard;
} | {
  action: 'Roll';
  who: number;
  dice: [number, number];
  money: number;
} | {
  action: 'Use Jail Card';
  who: number;
} | {
  action: 'Pay for jail';
  who: number;
  money: number;
} | {
  action: 'Double for jail';
  who: number;
} | {
  action: 'Staying in jail';
  who: number;
} | {
  action: 'Double to jail';
  who: number;
} | {
  action: 'Info';
  who?: number;
  to?: number;
  where?: number;
  amount?: number;
  string: string;
};

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
    goMoney: 200,
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
  lastActions: Action[] = [];

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

  addPlayer(player?: Player) {
    if (this.rounds !== 0) return false;
    if (!player) player = new Player({ seed: this.seed });
    player.init(this);
    this.players.push(player);
  }

  localizeItem(item: BoardItem | CCard, color = true): string {
    if (Object.prototype.hasOwnProperty.call(item, 'name')) {
      const tile = item as BoardItem;
      const name = tile.name;
      let ret = typeof name === 'string' ? name : name[this.edition];
      if (tile.type === 'property') {
        if (tile.buildings > 0 && tile.buildings < 5) ret += ` (${tile.buildings} 🏠)`;
        if (tile.buildings === 5) ret += ' (🏨)';
      }
      if (tile.type === 'railroad' || tile.type === 'utility' || tile.type === 'property') {
        if (tile.mortgaged) {
          ret += ' 🚫';
        }
      }
      if (color) return chalk.hex(this.tileColor(item as BoardItem, ret))(ret);
      return ret;
    } else {
      const card = item as CCard;
      const desc: string = card.description;
      return desc
        .replaceAll(/@(\d+)/g, (_, p1) => this.localizeItem(this.board[parseInt(p1, 10)]))
        .replaceAll(/\$(\d+)/g, (_, p1) => this.localizeMoney(parseInt(p1, 10)));
    }
  }

  localizeMoney(amount: number) {
    return `${this.edition === 'uk' ? '£' : '$'} ${amount}`;
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

  nextPlayer(): Action[] {
    const actions = this.players[this.turnOfPlayer].endTurn();
    this.doubles = 0;
    this.turnOfPlayer = this.turnOfPlayer + 1;
    if (this.turnOfPlayer >= this.players.length) {
      this.rounds++;
      this.turnOfPlayer -= this.players.length;
    }
    if (this.players[this.turnOfPlayer].isLost) this.nextPlayer();
    return actions;
  }

  turn(dice1?: number, dice2?: number, dice3?: number, dice4?: number, dice5?: number, dice6?: number): Action[] {
    const player = this.players[this.turnOfPlayer];
    dice1 = dice1 ?? player.rollDice();
    dice2 = dice2 ?? player.rollDice();
    this.roll = dice1 + dice2;
    const actions: Action[] = [];
    const jailCheck = player.jailCheck(dice1, dice2);
    const rollAction: Action = {
      action: 'Roll',
      who: player.index,
      dice: [dice1, dice2],
      money: player.money,
    };
    if (jailCheck === JailCheck.NOT_JAILED) {
      actions.push(rollAction);
    } else if (jailCheck === JailCheck.CARD) {
      actions.push({ action: 'Use Jail Card', who: player.index });
      actions.push(rollAction);
    } else if (jailCheck === JailCheck.PAYING) {
      actions.push({ action: 'Pay for jail', who: player.index, money: player.money });
      const [success, actions1] = player.spend(50);
      actions.push(...actions1);
      actions.push(rollAction);
    } else if (jailCheck === JailCheck.THIRD_ROLL) {
      actions.push(rollAction);
      actions.push({ action: 'Pay for jail', who: player.index, money: player.money });
      const [success, actions1] = player.spend(50);
      actions.push(...actions1);
    } else if (jailCheck === JailCheck.DOUBLE) {
      actions.push(rollAction);
      actions.push({ action: 'Double for jail', who: player.index });
    } else if (jailCheck === JailCheck.JAILED) {
      actions.push(rollAction);
      actions.push({ action: 'Staying in jail', who: player.index });
    }
    let isMoving = !player.isLost && jailCheck !== JailCheck.JAILED;
    if (dice1 === dice2) {
      this.doubles++;
      if (this.doubles === 3) {
        actions.push({ action: 'Double to jail', who: player.index });
        player.jail();
        isMoving = false;
      }
    }
    if (isMoving) {
      if (player.move(dice1 + dice2)) actions.push({ action: 'Pass Go', who: player.index, money: player.money });
      const actions1 = this.handleTile();
      actions.push(...actions1);
      if (dice1 === dice2 && !player.isJailed) actions.push(...this.turn(dice3, dice4, dice5, dice6));
      else actions.push(...this.nextPlayer());
    } else actions.push(...this.nextPlayer());
    this.lastActions = actions;
    return actions;
  }

  handleTile(): Action[] {
    const player = this.players[this.turnOfPlayer];
    const tile = this.board[player.position];
    const actions: Action[] = [{ action: 'Land', who: player.index, where: tile.index, money: player.money }];
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
          actions.push({ action: 'Recevie Title', which: tile.index, who: player.index });
        } else actions.push(...this.auction(tile));
      } else if (tile.owner === player.index) {
        if (rent) actions.push({ action: 'Owns', who: tile.owner, where: tile.index });
      } else if (rent) {
        actions.push({ action: 'Rent', amount: rent, to: tile.owner, where: tile.index });
        const [success, actions1] = player.spend(rent, this.players[tile.owner]);
        actions.push(...actions1);
      }
    }
    return actions;
  }

  handleCard(card: CCard): Action[] {
    const player = this.players[this.turnOfPlayer];
    const actions: Action[] = [{ action: 'Draw card', card, who: player.index }];
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
      if (player.move(distance)) actions.push({ action: 'Pass Go', who: player.index, money: player.money });
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
      const players = this.players.filter(p => p.index !== this.turnOfPlayer && !p.isLost);
      if (player.money > amount * players.length)
        for (const otherPlayer of players) {
          const [success, actions1] = player.spend(amount, otherPlayer);
          actions.push(...actions1);
        }
      else {
        const money = Math.floor(player.money / players.length);
        for (const otherPlayer of players) {
          const [success, actions1] = player.spend(money, otherPlayer);
          actions.push(...actions1);
        }
        const [success, actions1] = player.spend(Number.POSITIVE_INFINITY);
        actions.push(...actions1);
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

  handleLosing(player: Player, to?: Player): Action[] {
    const actions: Action[] = [{ action: 'Bankrupt', who: player.index, to: to?.index }];
    for (const tile of this.board) {
      if (tile.type !== 'property' && tile.type !== 'railroad' && tile.type !== 'utility') continue;
      if (tile.owner !== player.index) continue;
      if (tile.type === 'property') tile.buildings = 0;
      if (to) {
        tile.owner = to?.index ?? -1;
        tile.ownershipChanged = [this.rounds, this.turnOfPlayer];
        actions.push({ action: 'Recevie Title', who: to.index, which: tile.index });
      } else {
        actions.push(...this.auction(tile));
      }
    }
    return actions;
  }

  winner(): Player | undefined {
    const players = this.players.filter(p => !p.isLost);
    if (players.length > 1) return undefined;
    return players[0];
  }

  auction(tile: OwnableBoardItem): Action[] {
    const actions: Action[] = [];
    const bids: number[] = Array.from({ length: this.players.length }, _ => -1);
    let highestBidder = -1;
    let highestBid = 0;
    let allFolded = false;
    while (!allFolded) {
      allFolded = true;
      for (let i = 0; i < this.players.length; i++) {
        if (this.players[i].isLost) continue;
        const bid = this.players[i].bid(tile, highestBid, highestBidder);
        if (bid > bids[i]) bids[i] = bid;
        if (bid > highestBid) {
          // actions.push(`#${i} bids $${bid}`);
          highestBid = bid;
          highestBidder = i;
          allFolded = false;
        }
      }
    }
    if (highestBidder !== -1) {
      const [success, actions1] = this.players[highestBidder].spend(highestBid);
      tile.owner = highestBidder;
      tile.ownershipChanged = [this.rounds, this.turnOfPlayer];
      actions.push(...actions1);
      actions.push({ action: 'Recevie Title', who: highestBidder, which: tile.index });
    }
    actions.unshift({ action: 'Auction', for: tile.index, bids, winner: highestBidder });
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
