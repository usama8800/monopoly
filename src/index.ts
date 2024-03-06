import { select } from '@inquirer/prompts';
import { ConsoleMonopoly } from './console_monopoly';
import { Player } from './player';

const seed = 1;
const auto = {
  rounds: 51,
  turns: 2,
};
async function main() {
  const game = new ConsoleMonopoly({ seed });
  game.addPlayer(new Player({ seed }));
  game.addPlayer(new Player({ seed }));
  // game.addPlayer(new Player({ seed }));

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
        console.log(game.actionsToString(), '\n');
        continue;
      }
      yes = selected === 'turn';
    }
    if (!yes) break;

    game.turn();
    console.log(game.actionsToString(), '\n');
    console.log(game.printPlayers(), '\n');
  }
}

main();
