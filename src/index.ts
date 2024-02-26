import { select } from '@inquirer/prompts';
import pad from '@stdlib/string-pad';
import chalk from 'chalk';
import { Monopoly } from './monopoly';
import { Player } from './player';
import { padEnd, padStart } from './utils';

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
          name: 'Info',
          value: 'info',
        }, {
          name: 'Exit',
          value: 'exit'
        }]
      });
      if (selected === 'info') {
        console.log(gameInfo(game), '\n');
        continue;
      }
      yes = selected === 'turn';
    }
    if (!yes) break;

    const actions = game.turn();
    console.log(actions.join('\n'), '\n');
    console.log(gameInfo(game), '\n');
  }
}

function gameInfo(game: Monopoly) {
  const lines: string[] = [];
  const colLength = 35;
  const playersPerRow = 3;
  let colGap = '';
  const rowGap = 3;
  const playerColors = ['red', 'green', 'blue', 'yellow', 'magenta', 'cyan', 'white'];
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
        lines[k] += padStart(`${k - lineRow - 5}`, 2) + '. ' + chalk.hex(game.tileColor(tile))(padEnd(game.localizeItem(tile), colLength - 4));
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

function lineAdd(lines: string[], row: number, line: string) {
  lines[row] = (lines[row] ?? '') + line;
}

main();
