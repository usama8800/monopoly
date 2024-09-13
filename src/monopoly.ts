import chalk from 'chalk';
import { exists, readJsonSync, writeJSONSync } from 'fs-extra';
import { join } from 'path';
import { Player } from './player';
import { Action, Board, BoardItem, CCard, JailCheck, OwnableBoardItem, Property, rand, randsUsed, shuffle } from './utils';

export class Monopoly {
  houses = 32;
  hotels = 12;
  players: Player[] = [];
  board: Board;
  chance: CCard[];
  communityChest: CCard[] = [];
  turnOfPlayer = 0;
  prevTurnOfPlayer = 0;
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
  allTurns: Action[][] = [];
  actions: Action[] = [];

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

  pushActions(...actions: Action[]) {
    this.actions.push(...actions);
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

  activePlayers() {
    return this.players.filter(p => !p.isLost);
  }

  async nextPlayer(lost = false): Promise<void> {
    if (!lost) this.prevTurnOfPlayer = this.turnOfPlayer;
    await this.players[this.turnOfPlayer].endTurn();
    this.allTurns.push(this.actions);
    this.actions = [];
    this.doubles = 0;
    this.turnOfPlayer = this.turnOfPlayer + 1;
    if (this.turnOfPlayer >= this.players.length) {
      this.rounds++;
      this.turnOfPlayer -= this.players.length;
    }
    if (this.players[this.turnOfPlayer].isLost) await this.nextPlayer(true);
    if (this.rounds % 10 === 0 && this.turnOfPlayer === 0) this.save();
  }

  async turn(dice1?: number, dice2?: number, dice3?: number, dice4?: number, dice5?: number, dice6?: number): Promise<void> {
    const player = this.players[this.turnOfPlayer];
    dice1 = dice1 ?? player.rollDice();
    dice2 = dice2 ?? player.rollDice();
    this.roll = dice1 + dice2;
    const actions: Action[] = [];
    const jailCheck = await player.jailCheck(dice1, dice2);
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
      await player.spend(50);
      actions.push(rollAction);
    } else if (jailCheck === JailCheck.THIRD_ROLL) {
      actions.push(rollAction);
      actions.push({ action: 'Pay for jail', who: player.index, money: player.money });
      await player.spend(50);
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
      this.pushActions(...actions);
      await this.handleTile();
      if (dice1 === dice2 && !player.isJailed) await this.turn(dice3, dice4, dice5, dice6);
      else await this.nextPlayer();
    } else {
      this.pushActions(...actions);
      await this.nextPlayer();
    }
  }

  async handleTile(): Promise<void> {
    const player = this.players[this.turnOfPlayer];
    const tile = this.board[player.position];
    this.pushActions({ action: 'Land', who: player.index, where: tile.index, money: player.money });
    if (tile.type === 'chance') {
      if (this.chance.length === 0) this.setChance();
      const card = this.chance.shift();
      if (card) await this.handleCard(card);
    } else if (tile.type === 'community-chest') {
      if (this.communityChest.length === 0) this.setCommunityChest();
      const card = this.communityChest.shift();
      if (card) await this.handleCard(card);
    } else if (tile.type === 'go-to-jail') {
      player.jail();
      this.pushActions({ action: 'Jail', who: player.index });
    } else if (tile.type === 'tax') {
      await player.spend(tile.cost);
    } else if (tile.type === 'property' || tile.type === 'railroad' || tile.type === 'utility') {
      const rent = this.calculateRent(tile);
      if (tile.owner === -1) {
        if (await player.willBuy(tile)) {
          await player.spend(tile.cost);
          tile.owner = player.index;
          this.pushActions({ action: 'Recevie Title', which: tile.index, who: player.index });
        } else await this.auction(tile);
      } else if (tile.owner === player.index) {
        if (!tile.mortgaged) this.pushActions({ action: 'Owns', who: tile.owner, where: tile.index });
      } else if (!tile.mortgaged) {
        this.pushActions({ action: 'Rent', amount: rent, to: tile.owner, where: tile.index, who: player.index });
        await player.spend(rent, this.players[tile.owner]);
      }
    }
  }

  async handleCard(card: CCard): Promise<void> {
    const player = this.players[this.turnOfPlayer];
    this.pushActions({ action: 'Draw card', card, who: player.index });
    if (card.type === 'advance') {
      if (card.data === undefined) return;
      const position = +card.data;
      let distance: number;
      if (isNaN(position)) {
        if (card.data === 'railroad') {
          distance = this.board.filter(item => item.type === 'railroad')
            .map(item => this.distanceToTile(player.position, item.index)).sort((a, b) => a - b)[0];
        } else if (card.data === 'utility') {
          distance = this.board.filter(item => item.type === 'utility')
            .map(item => this.distanceToTile(player.position, item.index)).sort((a, b) => a - b)[0];
        } else return;
      } else {
        distance = this.distanceToTile(player.position, position);
      }
      if (player.move(distance)) this.pushActions({ action: 'Pass Go', who: player.index, money: player.money });
      await this.handleTile();
    } else if (card.type === 'back') {
      if (card.data === undefined) return;
      const steps = +card.data;
      if (isNaN(steps)) return;
      player.move(-steps);
      await this.handleTile();
    } else if (card.type === 'earn') {
      if (card.data === undefined) return;
      const amount = +card.data;
      if (isNaN(amount)) return;
      player.earn(amount);
      this.pushActions({ action: 'Earn', who: player.index, amount, money: player.money });
    } else if (card.type === 'jail') {
      player.jail();
    } else if (card.type === 'spend') {
      if (card.data === undefined) return;
      const amount = +card.data;
      if (isNaN(amount)) return;
      await player.spend(amount);
    } else if (card.type === 'earn-each-player') {
      if (card.data === undefined) return;
      const amount = +card.data;
      if (isNaN(amount)) return;
      const players = this.players.filter((_, i) => i !== this.turnOfPlayer);
      for (const otherPlayer of players) {
        await otherPlayer.spend(amount, player);
      }
    } else if (card.type === 'spend-each-player') {
      if (card.data === undefined) return;
      const amount = +card.data;
      if (isNaN(amount)) return;
      const players = this.players.filter(p => p.index !== this.turnOfPlayer && !p.isLost);
      if (player.money > amount * players.length)
        for (const otherPlayer of players) {
          await player.spend(amount, otherPlayer);
        }
      else {
        const money = Math.floor(player.money / players.length);
        for (const otherPlayer of players) {
          await player.spend(money, otherPlayer);
        }
        await player.spend(Number.POSITIVE_INFINITY);
      }
    } else if (card.type === 'repairs') {
      if (card.data === undefined) return;
      const [houseRepair, hotelRepair] = card.data as number[];
      if (isNaN(houseRepair) || isNaN(hotelRepair)) return;
      const properties = player.properties();
      const houses = properties.reduce((acc, property) => acc + (property.buildings === 5 ? 0 : property.buildings), 0);
      const hotels = properties.reduce((acc, property) => acc + (property.buildings === 5 ? 1 : 0), 0);
      const amount = houseRepair * houses + hotelRepair * hotels;
      await player.spend(amount);
    } else if (card.type === 'jail-card') {
      player.jailCards++;
    }
  }

  async handleBankruptcy(player: Player, to?: Player) {
    this.pushActions({ action: 'Bankrupt', who: player.index, to: to?.index });
    for (const tile of this.board) {
      if (tile.type !== 'property' && tile.type !== 'railroad' && tile.type !== 'utility') continue;
      if (tile.owner !== player.index) continue;
      if (tile.type === 'property') tile.buildings = 0;
      if (to) {
        tile.owner = to?.index ?? -1;
        tile.ownershipChanged = [this.rounds, this.turnOfPlayer];
        this.pushActions({ action: 'Recevie Title', who: to.index, which: tile.index });
      } else {
        await this.auction(tile);
      }
    }
  }

  winner(): Player | undefined {
    const players = this.players.filter(p => !p.isLost);
    if (players.length > 1) return undefined;
    return players[0];
  }

  async auction(tile: OwnableBoardItem) {
    const bids: number[] = Array.from({ length: this.players.length }, _ => -1);
    const folded: boolean[] = Array.from({ length: this.players.length }, _ => false);
    let highestBidder = -1;
    let highestBid = 0;
    this.pushActions({ action: 'Auction Start', for: tile.index });
    auction: while (folded.includes(false)) {
      for (let i = 0; i < this.players.length; i++) {
        if (i === highestBidder) break auction;
        if (this.players[i].isLost || folded[i]) continue;
        const bid = await this.players[i].bid(tile, highestBid, highestBidder, bids);
        if (bid > bids[i]) bids[i] = bid;
        if (bid > highestBid) {
          // this.pushActions(`#${i} bids $${bid}`);
          highestBid = bid;
          highestBidder = i;
        } else {
          folded[i] = true;
        }
      }
    }
    if (highestBidder !== -1) {
      this.pushActions({ action: 'Auction End', for: tile.index, bids, winner: highestBidder });
      const success = await this.players[highestBidder].spend(highestBid);
      if (success) {
        tile.owner = highestBidder;
        tile.ownershipChanged = [this.rounds, this.turnOfPlayer];
        this.pushActions({ action: 'Recevie Title', who: highestBidder, which: tile.index });
      }
    }
  }

  calculateRent(tile: OwnableBoardItem, options?: { player?: number, roll?: number, cost?: boolean }): number {
    const roll = options?.roll ?? this.roll;
    const player = options?.player ?? this.turnOfPlayer;
    const cost = options?.cost ?? false;
    if ((!cost && tile.owner === -1) || tile.mortgaged || tile.owner === player) return 0;
    if (tile.owner === -1) return tile.cost;
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

  save(filename?: string) {
    filename = filename ?? 'monopoly.json';
    writeJSONSync(filename, {
      // allTurns: this.allTurns,
      rounds: this.rounds,
      turnOfPlayer: this.turnOfPlayer,
      board: this.board,
      chance: this.chance,
      communityChest: this.communityChest,
      players: this.players.map(p => ({
        index: p.index,
        isJailed: p.isJailed,
        isLost: p.isLost,
        position: p.position,
        money: p.money,
        jailCards: p.jailCards,
        jailRolls: p.jailRolls,
      })),
      randsUsed: randsUsed(),
      actions: this.actions,
    });
  }

  load(filename?: string) {
    filename = filename ?? 'monopoly.json';
    if (!exists(filename)) return;
    const data = readJsonSync(filename);
    this.rounds = data.rounds;
    this.turnOfPlayer = data.turnOfPlayer;
    this.board = data.board;
    this.chance = data.chance;
    this.communityChest = data.communityChest;
    this.actions = data.actions;
    for (const player of data.players) {
      const thisPlayer = this.players[player.index];
      thisPlayer.isJailed = player.isJailed;
      thisPlayer.isLost = player.isLost;
      thisPlayer.position = player.position;
      thisPlayer.money = player.money;
      thisPlayer.jailCards = player.jailCards;
      thisPlayer.jailRolls = player.jailRolls;
    }
    const rands: { seed: number, used: number }[] = data.randsUsed;
    const currentRandsUsed = randsUsed();
    for (const { seed, used } of rands) {
      const usedCurrent = currentRandsUsed.find(r => r.seed === seed)?.used ?? 0;
      const diff = used - usedCurrent;
      for (let i = 0; i < diff; i++) {
        rand(seed);
      }
    }
  }
}
