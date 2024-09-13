import { AIPlayer } from './ai_player';
import { ConsoleMonopoly } from './console_monopoly';
import { Monopoly } from './monopoly';
import { padEnd, rand } from './utils';

type Stats = {
  firstToGetSet: number,
  winner: number,
  sets: {
    firstOwner: number;
    firstOwnedRound: number;
  }[],
  rounds: number,
  seed?: number,
  tilesEarned: {
    index: number;
    earned: number;
    name: string;
  }[],
};

function tilesEarned(game: Monopoly) {
  const earability = Array.from({ length: game.board.length }, _ => 0);
  for (let i = 0; i < game.allTurns.length; i++) {
    for (let j = 0; j < game.allTurns[i].length; j++) {
      const action = game.allTurns[i][j];
      if (action.action === 'Rent') {
        earability[action.where] += action.amount;
      }
    }
  }
  return earability.map((e, i) => ({
    index: i,
    earned: e,
    name: game.localizeItem(game.board[i]),
  })).sort((a, b) => b.earned - a.earned);
}

export async function oneGame(options: {
  gameNum: number,
  players: number,
  seed?: number,
}): Promise<Stats> {
  const game = new ConsoleMonopoly({ seed: options.seed }, false);
  for (let i = 0; i < options.players; i++) {
    game.addPlayer(new AIPlayer({ seed: options.seed }));
  }
  const stats: Stats = {
    firstToGetSet: -1,
    sets: game.board.reduce((acc, curr) => {
      if (curr.type !== 'property') return acc;
      if (acc[curr.set] === undefined) acc[curr.set] = { firstOwner: -1, firstOwnedRound: -1 };
      return acc;
    }, [] as { firstOwner: number, firstOwnedRound: number }[]),
    winner: -1,
    rounds: -1,
    seed: options.seed,
    tilesEarned: [],
  };
  while (!game.winner()) {
    // console.log(`Game ${options.gameNum} (${options.seed}): Round ${game.rounds + 1}, turn ${game.turnOfPlayer}`);
    await game.turn();
    if (game.rounds >= 300) break;
    if (stats.firstToGetSet === -1) {
      for (let i = 0; i < game.players.length; i++) {
        if (game.players[i].sets().length > 0) {
          stats.firstToGetSet = i;
          break;
        }
      }
    }
    for (const setNum in stats.sets) {
      const stat = stats.sets[setNum];
      if (stat.firstOwner === -1) {
        const set = game.set(+setNum);
        const owned = set.every((p) => p.owner === set[0].owner);
        if (!owned) continue;
        stat.firstOwner = set[0].owner;
        stat.firstOwnedRound = game.rounds;
      }
    }
  }
  stats.winner = game.winner()?.index ?? -1;
  stats.rounds = game.rounds;
  stats.tilesEarned = tilesEarned(game);
  return stats;
}

export async function simulate(options: {
  games: number,
  players: number,
}) {
  const stats: Stats[] = [];
  for (let i = 0; i < options.games; i++) {
    const seed = Math.trunc(rand() * 1e9);
    console.log(`Game ${i + 1}/${options.games} (${seed})`);
    const gameStats = await oneGame({ players: options.players, seed, gameNum: i + 1 });
    stats.push(gameStats);
  }
  return stats;
}

export async function main() {
  const games = 10000;
  const players = 5;
  const stats = await simulate({ games, players });
  const overallStats: Stats = {
    firstToGetSet: 0,
    winner: 0,
    sets: [],
    rounds: -1,
    tilesEarned: [],
  };
  for (let i = 0; i < games; i++) {
    // console.log('-'.repeat(50));
    // console.log(`Game ${i + 1} (${stats[i].seed}): ${stats[i].winner === -1 ? 'Draw' : `Player ${stats[i].winner} wins in ${stats[i].rounds} rounds`}`);
    // console.log('First to get set:', stats[i].firstToGetSet === -1 ? 'No one' : `Player ${stats[i].firstToGetSet}`);
    // for (const { earned, name } of stats[i].tilesEarned.slice(0, 5)) {
    // console.log(padEnd(name, 30), 'earned', earned);
    // }
    for (const { index, earned, name } of stats[i].tilesEarned) {
      if (!overallStats.tilesEarned[index]) overallStats.tilesEarned[index] = { index, earned, name };
      overallStats.tilesEarned[index].earned += earned;
    }
    overallStats.rounds += stats[i].rounds;
    // for (const setNum in stats[i].sets) {
    //   if (stats[i].sets[setNum].firstOwnedRound === stats[i].rounds) continue;
    //   if (stats[i].sets[setNum].firstOwner === -1) continue;
    //   console.log(setNum, stats[i].sets[setNum]);
    // }
  }
  console.log('-'.repeat(50));
  console.log(`Overall Stats: ${games} games of ${players} players`);
  overallStats.tilesEarned = overallStats.tilesEarned.sort((a, b) => b.earned - a.earned);
  console.log('Average number of rounds:', Math.trunc(overallStats.rounds / games));
  for (const { earned, name } of overallStats.tilesEarned.slice(0, 5)) {
    console.log(padEnd(name, 30), 'earned', Math.trunc(earned / games));
  }
}

// Overall Stats: 10000 games of 3 players
// Average number of rounds: 85
// Mayfair                   earned 1020
// Whitechapel Road          earned 816
// Park Lane                 earned 738
// Marlborough Street        earned 528
// Bow Street                earned 524

// Overall Stats: 10000 games of 4 players
// Average number of rounds: 81
// Mayfair                   earned 1775
// Whitechapel Road          earned 1459
// Park Lane                 earned 1223
// Old Kent Road             earned 810
// Marlborough Street        earned 796

// Overall Stats: 10000 games of 5 players
// Average number of rounds: 82
// Mayfair                   earned 2788
// Whitechapel Road          earned 2165
// Park Lane                 earned 1867
// Old Kent Road             earned 1211
// Vine Street               earned 1022
