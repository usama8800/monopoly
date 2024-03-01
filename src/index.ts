import { select } from '@inquirer/prompts';
import { ConsoleMonopoly } from './console_monopoly';
import { Player } from './player';

const seed = 6;
const auto = {
  rounds: 31,
  turns: 0,
};
async function main() {
  const game = new ConsoleMonopoly({ seed });
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
          name: 'Last turn info',
          value: 'lastTurn',
        }, {
          name: 'Exit',
          value: 'exit'
        }]
      });
      if (selected === 'players') {
        console.log(game.printPlayers(), '\n');
        continue;
      }
      if (selected === 'board') {
        console.log(game.printBoard(), '\n');
        continue;
      }
      if (selected === 'lastTurn') {
        console.log(game.lastActions.join('\n'), '\n');
        continue;
      }
      yes = selected === 'turn';
    }
    if (!yes) break;

    const actions = game.turn();
    console.log(actions.join('\n'), '\n');
    console.log(game.printPlayers(), '\n');
  }
}

main();
