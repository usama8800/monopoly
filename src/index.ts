import { select } from '@inquirer/prompts';
import { AIPlayer } from './ai_player';
import { ConsoleMonopoly } from './console_monopoly';
import { ConsolePlayer } from './console_player';
import * as s from './simulations';
import { rollDice } from './utils';

const seed = 12409508;
const auto = {
  rounds: 0,
  turns: 0,
};
async function main() {
  const game = new ConsoleMonopoly({ seed });
  game.addPlayer(new ConsolePlayer({ seed }));
  game.addPlayer(new AIPlayer({ seed }));
  game.addPlayer(new AIPlayer({ seed }));
  // game.addPlayer(new AIPlayer({ seed }));
  // game.addPlayer(new AIPlayer({ seed }));

  while (true) {
    const winner = game.winner();
    let yes: boolean;
    if (auto.rounds && game.rounds < auto.rounds) yes = true;
    else if (auto.turns) {
      yes = true;
      auto.turns--;
    } else if (winner) {
      console.log(`Player ${winner.index + 1} wins!`);
      break;
    } else {
      const choices: { name: string, value: any }[] = [];
      if (game.rounds === 0 && game.turnOfPlayer === 0) {
        choices.push({
          name: 'Start game',
          value: 'start',
        }, {
          name: 'Load game',
          value: 'load',
        });
      } else {
        choices.push({
          name: `Next turn (Player ${game.turnOfPlayer + 1} round ${game.rounds + 1})`,
          value: 'turn',
        }, {
          name: 'Players info',
          value: 'players',
        }, {
          name: 'Board info',
          value: 'board',
        }, {
          name: 'Last turn info',
          value: 'lastTurn',
        });
      }
      choices.push({
        name: 'Exit',
        value: 'exit'
      });
      const selected = await select({ message: 'What would you like to do?', choices });
      if (selected === 'players') {
        console.log(game.printPlayers(), '\n');
        continue;
      }
      if (selected === 'board') {
        console.log(game.printBoard(), '\n');
        continue;
      }
      if (selected === 'lastTurn') {
        console.log(game.actionsToString(), '\n');
        continue;
      }
      if (selected === 'load') {
        game.load();
        continue;
      }
      if (selected === 'exit' && game.rounds !== 0) game.save();
      yes = selected === 'turn' || selected === 'start';
    }
    if (!yes) break;

    await game.turn();
    console.log();
    console.log(game.printPlayers(), '\n');
  }
}

function foo() {
  const turns = 1e6;
  let freqs = Array.from({ length: 40 }).map(_ => 0);
  for (let turn = 0; turn < 1e6; turn++) {
    const dice1 = rollDice();
    const dice2 = rollDice();
    freqs[dice1 + dice2]++;
    if (dice1 === dice2) {
      const dice3 = rollDice();
      const dice4 = rollDice();
      freqs[dice1 + dice2 + dice3 + dice4]++;
      if (dice3 === dice4) {
        const dice5 = rollDice();
        const dice6 = rollDice();
        if (dice5 !== dice6) freqs[dice1 + dice2 + dice3 + dice4 + dice5 + dice6]++;
      }
    }
  }
  freqs = freqs.map(x => x / turns);
  console.log(freqs);
}

const args = process.argv.slice(2);
switch (args[0]) {
  case 'simulate':
  case 's':
    s.main();
    break;
  default:
    main();
}
