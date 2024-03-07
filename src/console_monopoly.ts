import chalk from 'chalk';
import { Monopoly } from './monopoly';
import { Action, OwnableBoardItem, padCenter, padEnd, padStart } from './utils';

export class ConsoleMonopoly extends Monopoly {

  playerColors = ['red', 'green', 'blue', 'yellow', 'magenta', 'cyan', 'white'];

  pushActions(...actions: Action[]) {
    super.pushActions(...actions);
    console.log(this.actionsToString(actions));
  }

  actionsToString(actions?: Action[]): string {
    let ret = '';
    if (!actions) actions = this.actions;
    while (actions.length) {
      const action = actions.shift()!;
      const nextAction = actions[0];
      if (action.action === 'Land') {
        ret += `${this.localizePlayer(action.who)} (${this.localizeMoney(action.money)}) lands on ${this.localizeItem(this.board[action.where])} ${this.localizePlayer(action.who, { name: false, position: true, color: false })}`;
        ret += '\n';
      } else if (action.action === 'Rent') {
        ret += `${this.localizePlayer(action.to)} owns ${this.localizeItem(this.board[action.where])}. Charges rent ${this.localizeMoney(action.amount)}\n`;
      } else if (action.action === 'Recevie Title') {
        ret += `${this.localizePlayer(action.who)} receives the title deed for ${this.localizeItem(this.board[action.which])}\n`;
      } else if (action.action === 'Owns') {
        ret += `${this.localizePlayer(action.who)} owns ${this.localizeItem(this.board[action.where])}\n`;
      } else if (action.action === 'Pass Go') {
        ret += `${this.localizePlayer(action.who)} (${this.localizeMoney(action.money)}) passes ${this.localizeItem(this.board[0])}, collects ${this.localizeMoney(this.config.goMoney)}\n`;
      } else if (action.action === 'Spend') {
        ret += `${this.localizePlayer(action.who)} (${this.localizeMoney(action.money)}) pays ${this.localizeMoney(action.amount)} to ${this.localizePlayer(action.to ?? -1)}`;
        if (action.toMoney) ret += ' (' + this.localizeMoney(action.toMoney) + ')';
        ret += '\n';
      } else if (action.action === 'Earn') {
        ret += `${this.localizePlayer(action.who)} earns ${this.localizeMoney(action.amount)}\n`;
      } else if (action.action === 'Jail') {
        ret += `${this.localizePlayer(action.who)} goes to jail\n`;
      } else if (action.action === 'Auction Start') {
        ret += `Auction starting for ${this.localizeItem(this.board[action.for])} (${this.localizeMoney((this.board[action.for] as OwnableBoardItem).cost)})\n`;
      } else if (action.action === 'Auction End') {
        if (action.winner === -1) ret += 'No one makes a bid';
        else {
          ret += chalk.underline(padCenter('Player', 13) + '|' + padCenter('Bid', 9)) + '\n';
          for (let j = 0; j < action.bids.length; j++) {
            if (action.bids[j] === -1) continue;
            ret += padCenter(this.localizePlayer(j), 13, j === action.winner ? '~' : ' ') + '|' + padCenter(this.localizeMoney(action.bids[j]), 9) + '\n';
          }
        }
      } else if (action.action === 'Bankrupt') {
        ret += `${this.localizePlayer(action.who)} is bankrupt\n`;
      } else if (action.action === 'Build') {
        let sp = 'a house';
        if (action.number > 1) sp = action.number + ' houses';
        ret += `${this.localizePlayer(action.who)} builds ${sp} on ${this.localizeItem(this.board[action.where])}\n`;
      } else if (action.action === 'Demolish') {
        ret += `${this.localizePlayer(action.who)} (${this.localizeMoney(action.money)}) demolishes a house on ${this.localizeItem(this.board[action.where])} for ${this.localizeMoney(action.amount)}\n`;
      } else if (action.action === 'Mortgage') {
        ret += `${this.localizePlayer(action.who)} (${this.localizeMoney(action.money)}) mortgages ${this.localizeItem(this.board[action.where])} for ${this.localizeMoney(action.amount)}\n`;
      } else if (action.action === 'Unmortgage') {
        ret += `${this.localizePlayer(action.who)} unmortgages ${this.localizeItem(this.board[action.where])}\n`;
      } else if (action.action === 'Trade' && action.what === 'Jail Card') {
        let sp = 'a Get out of Jail card';
        if (action.number > 1) sp = action.number + ' Get out of Jail cards';
        ret += `${this.localizePlayer(action.from)} gives ${sp} to ${this.localizePlayer(action.to)}\n`;
      } else if (action.action === 'Trade' && action.what === 'Tile') {
        ret += `${this.localizePlayer(action.from)} gives ${this.localizeItem(this.board[action.which])} to ${this.localizePlayer(action.to)}\n`;
      } else if (action.action === 'Trade Declined') {
        ret += `${this.localizePlayer(action.declinedBy)} declined trade from ${this.localizePlayer(action.tradeFrom)}`;
      } else if (action.action === 'Draw card') {
        ret += `${this.localizePlayer(action.who)} draws card: ${this.localizeItem(action.card)}\n`;
      } else if (action.action === 'Roll') {
        let moneyStr = '';
        if (nextAction?.action === 'Pass Go') moneyStr = ` (${this.localizeMoney(action.money)})`;
        ret += `${this.localizePlayer(action.who)}${moneyStr} rolls ${action.dice.join(', ')}\n`;
      } else if (action.action === 'Use Jail Card') {
        ret += `${this.localizePlayer(action.who)} uses Get out of Jail card\n`;
      } else if (action.action === 'Double for jail') {
        ret += `${this.localizePlayer(action.who)} rolls doubles to get out of jail\n`;
      } else if (action.action === 'Double to jail') {
        ret += `${this.localizePlayer(action.who)} rolls 3 doubles and goes to jail\n`;
      } else if (action.action === 'Pay for jail') {
        ret += `${this.localizePlayer(action.who)} pays to get out of jail\n`;
      } else if (action.action === 'Staying in jail') {
        ret += `${this.localizePlayer(action.who)} stays in jail\n`;
      } else if (action.action === 'Info') {
        // action.string.replaceAll(/\$\$(\w+)/g, match => {
        //   if (match === 'amount' && action.amount) return this.localizeMoney(action.amount);
        //   if (match === 'who' && action.who) return this.localizePlayer(action.who);
        //   if (match === 'where' && action.where) return this.localizeItem(this.board[action.where]);
        //   if (match === 'to' && action.to) return this.localizePlayer(action.to);
        //   return '$$' + match;
        // });
      }
    }
    return ret.slice(0, -1);
  }

  localizeMoney(amount: number) {
    return chalk.greenBright(super.localizeMoney(amount));
  }

  localizePlayer(index: number, settings?: {
    color?: boolean,
    bold?: boolean,
    highlight?: boolean,
    surround?: string,
    position?: boolean,
    name?: boolean,
    jail?: boolean,
  }) {
    let ret = '';
    if (!settings) settings = {};
    if (settings.color === undefined) settings.color = true;
    if (settings.name === undefined) settings.name = true;
    const player = this.players[index];

    if (settings.name) {
      if (index === -1) ret += 'Bank';
      else ret += `Player ${index + 1}`;
    }

    if (settings.surround) ret = settings.surround + ret + settings.surround;
    if (settings.color) ret = chalk[this.playerColors[index < 6 && index >= 0 ? index : 6]](ret);
    if (settings.jail && this.board[player.position].type === 'jail') {
      if (player.isJailed) ret = ret === '' ? '⛓️' : `⛓️ ${ret} ⛓️`;
      else ret = ret === '' ? '(Visiting)' : `${ret} (Visiting Jail)`;
    }
    if (settings.position) ret += (ret === '' ? '(' : ' (') + player.positionString() + ')';
    if (settings.bold) ret = chalk.bold(ret);
    if (settings.highlight) ret = chalk.bgWhite(ret);
    return ret;
  }

  printPlayers() {
    const lines: string[] = [];
    const colLength = 35;
    const playersPerRow = 3;
    let colGap = '';
    const rowGap = 3;
    let lineRow = 0;
    let tableRow = 0;
    for (let i = 0; i < this.players.length; i++) {
      const player = this.players[i];
      const prevLengthNeeded = (colLength + colGap.length) * (i % playersPerRow);
      let lineOfPlayer = 0;
      const thisPlayerTurn = i === (this.turnOfPlayer - 1 + this.players.length) % this.players.length;
      if (!player.isLost) {
        lines[lineRow + lineOfPlayer] = padEnd(lines[lineRow + lineOfPlayer++] ?? '', prevLengthNeeded) + colGap + padEnd(this.localizePlayer(player.index, { bold: true, surround: '----', highlight: thisPlayerTurn }), colLength);
        lines[lineRow + lineOfPlayer] = padEnd(lines[lineRow + lineOfPlayer++] ?? '', prevLengthNeeded) + colGap + padEnd(`Money   : ${this.localizeMoney(player.money)}`, colLength);
        lines[lineRow + lineOfPlayer] = padEnd(lines[lineRow + lineOfPlayer++] ?? '', prevLengthNeeded) + colGap + padEnd(`Position: ${player.positionString()}`, colLength);
        lines[lineRow + lineOfPlayer] = padEnd(lines[lineRow + lineOfPlayer++] ?? '', prevLengthNeeded) + colGap + padEnd(`On      : ${this.localizeItem(this.board[player.position])} ${this.localizePlayer(player.index, { name: false, jail: true })}`, colLength);
        // lines[lineRow + lineOfPlayer] = padEnd(lines[lineRow + lineOfPlayer++] ?? '', prevLengthNeeded) + colGap + padEnd(`Value   : ${player.valuePlayer(player)}`, colLength);
        lines[lineRow + lineOfPlayer] = padEnd(lines[lineRow + lineOfPlayer++] ?? '', prevLengthNeeded) + colGap + '';
        lines[lineRow + lineOfPlayer] = padEnd(lines[lineRow + lineOfPlayer++] ?? '', prevLengthNeeded) + colGap + chalk.underline(padEnd('      Title Deeds', colLength));
        for (let j = 0, k = lineRow + lineOfPlayer; j < this.board.length; j++) {
          const tile = this.board[j];
          if ((tile.type === 'property' || tile.type === 'railroad' || tile.type === 'utility') && tile.owner === player.index) {
            lines[k] = padEnd(lines[k] ?? '', prevLengthNeeded) + colGap;
            lines[k] += padStart(`${k - lineRow - lineOfPlayer + 1}`, 2) + '. ' + padEnd(this.localizeItem(tile), colLength - 4);
            k++;
          }
          if (k > tableRow) tableRow = k;
        }
      }
      colGap = '     ';
      if ((i + 1) % playersPerRow === 0 && i !== 0) {
        lineRow = tableRow + rowGap;
        tableRow = lineRow;
        colGap = '';
      }
    }
    return lines.join('\n');
  }

  printBoard() {
    const colEnds = [30, 37, 49, 57];
    let header = padEnd(' #  Tile', colEnds[0]);
    header = padEnd(header + 'Cost', colEnds[1]);
    header = padEnd(header + 'Owner', colEnds[2]);
    header = padEnd(header + 'Rent', colEnds[3]);
    header += 'Players';
    const board = this.board;
    const boardLines = [header];
    for (let i = 0; i < board.length; i++) {
      const tile = board[i];
      if (i !== 0 && (tile as any).corner) boardLines.push('');
      // Serial
      let line = padStart((i).toString(), 2) + ': ';
      // Tile
      line += this.localizeItem(tile);
      line = padEnd(line, colEnds[0]);
      // Cost
      if (['railroad', 'utility', 'property', 'tax'].includes(tile.type)) {
        const cost = (tile as any).cost;
        line += `${cost}`;
      }
      line = padEnd(line, colEnds[1]);
      // Owner
      if (['railroad', 'utility', 'property'].includes(tile.type)) {
        const owner = (tile as any).owner;
        if (owner !== undefined && owner !== -1) {
          line += chalk[owner < 6 ? this.playerColors[owner] : 6](`Player ${owner + 1}`);
        } else {
          line += 'Bank';
        }
      }
      line = padEnd(line, colEnds[2]);
      // Rent
      if (['railroad', 'utility', 'property'].includes(tile.type)) {
        const rent = this.calculateRent(tile as any);
        if (rent > 0) line += `${rent}`;
      }
      line = padEnd(line, colEnds[3]);
      // Players
      const players = this.players.filter(player => player.position === i);
      const playerStr = players.length ? players.map(player =>
        chalk[player.index < 6 ? this.playerColors[player.index] : 6](`Player ${player.index + 1}`)
      ).join('   ') : '';
      line += chalk.bold(playerStr);
      boardLines.push(line);
    }
    return boardLines.join('\n');
  }
}
