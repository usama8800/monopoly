import chalk from 'chalk';
import { Monopoly } from './monopoly';
import { padEnd, padStart } from './utils';

export class ConsoleMonopoly extends Monopoly {

  playerColors = ['red', 'green', 'blue', 'yellow', 'magenta', 'cyan', 'white'];

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
      let lineOfPlayer = 0;
      const thisPlayerTurn = i === (this.turnOfPlayer - 1 + this.players.length) % this.players.length;
      lines[lineRow + lineOfPlayer] = (lines[lineRow + lineOfPlayer++] ?? '') + colGap + padEnd(chalk[thisPlayerTurn ? 'bgWhite' : 'bold'](chalk[i < 6 ? this.playerColors[i] : 6](`----Player ${player.index + 1}----`)), colLength);
      lines[lineRow + lineOfPlayer] = (lines[lineRow + lineOfPlayer++] ?? '') + colGap + padEnd(`Money   : ${padStart(player.money.toString(), 5)}`, colLength);
      lines[lineRow + lineOfPlayer] = (lines[lineRow + lineOfPlayer++] ?? '') + colGap + padEnd(`Position: ${player.positionString()}`, colLength);
      lines[lineRow + lineOfPlayer] = (lines[lineRow + lineOfPlayer++] ?? '') + colGap + padEnd(`On      : ${this.localizeItem(this.board[player.position])}`, colLength);
      lines[lineRow + lineOfPlayer] = (lines[lineRow + lineOfPlayer++] ?? '') + colGap + padEnd(`Value   : ${player.valuePlayer(player)}`, colLength);
      lines[lineRow + lineOfPlayer] = (lines[lineRow + lineOfPlayer++] ?? '') + colGap + '';
      lines[lineRow + lineOfPlayer] = (lines[lineRow + lineOfPlayer++] ?? '') + colGap + chalk.underline(padEnd('      Title Deeds', colLength));
      for (let j = 0, k = lineRow + lineOfPlayer; j < this.board.length; j++) {
        const tile = this.board[j];
        if ((tile.type === 'property' || tile.type === 'railroad' || tile.type === 'utility') && tile.owner === player.index) {
          const prevLengthNeeded = (colLength + colGap.length) * (i % playersPerRow);
          lines[k] = padEnd(lines[k] ?? '', prevLengthNeeded);
          lines[k] += padStart(`${k - lineRow - lineOfPlayer + 1}`, 2) + '. ' + padEnd(this.localizeItem(tile), colLength - 4);
          k++;
        }
        if (k > tableRow) tableRow = k;
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
      let line = padStart((i + 1).toString(), 2) + ': ';
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
