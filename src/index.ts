import { select } from '@inquirer/prompts';
import pad from '@stdlib/string-pad';
import chalk from 'chalk';
import { Monopoly } from './monopoly';
import { Player } from './player';
import { padEnd, padStart } from './utils';

const playerColors = ['red', 'green', 'blue', 'yellow', 'magenta', 'cyan', 'white'];
const seed = 5;
const auto = {
  rounds: 0,
  turns: 0,
};
async function main() {
  const game = new Monopoly({ seed });
  game.addPlayer(new Player({ seed }));
  game.addPlayer(new Player({ seed }));

  while (true) {
    let yes: boolean;
    if (auto.rounds && game.rounds < auto.rounds) yes = true;
    else if (auto.turns) {
      yes = true;
      auto.turns--;
    }
    else {
      const selected = await select({
        message: 'What would you like to do?', choices: [{
          name: `Next turn (Player ${game.turnOfPlayer + 1} round ${game.rounds + 1})`,
          value: 'turn',
        }, {
          name: 'Players info',
          value: 'players',
        }, {
          name: 'Board info',
          value: 'board',
        }, {
          name: 'Exit',
          value: 'exit'
        }]
      });
      if (selected === 'players') {
        console.log(printPlayers(game), '\n');
        continue;
      }
      if (selected === 'board') {
        console.log(printBoard(game), '\n');
        continue;
      }
      yes = selected === 'turn';
    }
    if (!yes) break;

    const actions = game.turn();
    console.log(actions.join('\n'), '\n');
    console.log(printPlayers(game), '\n');
  }
}

function printPlayers(game: Monopoly) {
  const lines: string[] = [];
  const colLength = 35;
  const playersPerRow = 3;
  let colGap = '';
  const rowGap = 3;
  let lineRow = 0;
  let tableRow = 0;
  for (let i = 0; i < game.players.length; i++) {
    const player = game.players[i];
    let lineOfPlayer = 0;
    const thisPlayerTurn = i === (game.turnOfPlayer - 1 + game.players.length) % game.players.length;
    lines[lineRow + lineOfPlayer] = (lines[lineRow + lineOfPlayer++] ?? '') + colGap + padEnd(chalk[thisPlayerTurn ? 'bgWhite' : 'bold'](chalk[i < 6 ? playerColors[i] : 6](`----Player ${player.index + 1}----`)), colLength);
    lines[lineRow + lineOfPlayer] = (lines[lineRow + lineOfPlayer++] ?? '') + colGap + padEnd(`Money   : ${pad(player.money.toString(), 5)}`, colLength);
    lines[lineRow + lineOfPlayer] = (lines[lineRow + lineOfPlayer++] ?? '') + colGap + padEnd(`Position: ${player.positionString()}`, colLength);
    lines[lineRow + lineOfPlayer] = (lines[lineRow + lineOfPlayer++] ?? '') + colGap + padEnd(`On      : ${chalk.hex(game.tileColor(game.board[player.position]))(game.localizeItem(game.board[player.position]))}`, colLength);
    lines[lineRow + lineOfPlayer] = (lines[lineRow + lineOfPlayer++] ?? '') + colGap + padEnd(`Value   : ${player.valuePlayer(player)}`, colLength);
    lines[lineRow + lineOfPlayer] = (lines[lineRow + lineOfPlayer++] ?? '') + colGap + '';
    lines[lineRow + lineOfPlayer] = (lines[lineRow + lineOfPlayer++] ?? '') + colGap + chalk.underline(padEnd('      Title Deeds', colLength));
    for (let j = 0, k = lineRow + lineOfPlayer; j < game.board.length; j++) {
      const tile = game.board[j];
      if ((tile.type === 'property' || tile.type === 'railroad' || tile.type === 'utility') && tile.owner === player.index) {
        const prevLengthNeeded = (colLength + colGap.length) * (i % playersPerRow);
        lines[k] = padEnd(lines[k] ?? '', prevLengthNeeded);
        lines[k] += padStart(`${k - lineRow - lineOfPlayer + 1}`, 2) + '. ' + chalk.hex(game.tileColor(tile))(padEnd(game.localizeItem(tile), colLength - 4));
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

function printBoard(game: Monopoly) {
  const colEnds = [30, 37, 49, 57];
  let header = padEnd(' #  Tile', colEnds[0]);
  header = padEnd(header + 'Cost', colEnds[1]);
  header = padEnd(header + 'Owner', colEnds[2]);
  header = padEnd(header + 'Rent', colEnds[3]);
  header += 'Players';
  const board = game.board;
  const boardLines = [header];
  for (let i = 0; i < board.length; i++) {
    const tile = board[i];
    if (i !== 0 && (tile as any).corner) boardLines.push('');
    // Serial
    let line = padStart((i + 1).toString(), 2) + ': ';
    // Tile
    line += chalk.hex(game.tileColor(tile))(game.localizeItem(tile));
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
        line += chalk[owner < 6 ? playerColors[owner] : 6](`Player ${owner + 1}`);
      } else {
        line += 'Bank';
      }
    }
    line = padEnd(line, colEnds[2]);
    // Rent
    if (['railroad', 'utility', 'property'].includes(tile.type)) {
      const rent = game.calculateRent(tile as any);
      if (rent > 0) line += `${rent}`;
    }
    line = padEnd(line, colEnds[3]);
    // Players
    const players = game.players.filter(player => player.position === i);
    const playerStr = players.length ? players.map(player =>
      chalk[player.index < 6 ? playerColors[player.index] : 6](`Player ${player.index + 1}`)
    ).join('   ') : '';
    line += chalk.bold(playerStr);
    boardLines.push(line);
  }
  return boardLines.join('\n');
}

main();
