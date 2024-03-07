import { expect } from 'chai';
import { AIPlayer } from '../ai_player';
import { ConsoleMonopoly } from '../console_monopoly';
import { Monopoly } from '../monopoly';

describe('Base', function () {
  let game: Monopoly;
  let p1: AIPlayer;
  let p2: AIPlayer;

  beforeEach(() => {
    game = new Monopoly();
    p1 = new AIPlayer();
    p2 = new AIPlayer();
    game.addPlayer(p1);
    game.addPlayer(p2);
  });

  it('Correct turns', () => {
    expect(game.turnOfPlayer).to.equal(0);
    game.turn(1, 2);
    expect(game.turnOfPlayer).to.equal(1);
    game.turn(6, 4);
    expect(game.turnOfPlayer).to.equal(0);
    game.turn(1, 1, 1, 1, 1, 1);
    expect(p1.position).to.equal(10);
    expect(game.turnOfPlayer).to.equal(1);
    game.turn(5, 5, 6, 4);
    expect(p2.position).to.equal(10);
    expect(game.turnOfPlayer).to.equal(0);
  });

  // bids();

  it('Spend each player', () => {
    const p3 = new AIPlayer();
    game.addPlayer(p3);
    game.chance = [{
      description: 'You have been elected chairman of the board – pay each player 50',
      type: 'spend-each-player',
      data: 50
    }];
    p1.money = 90 + 60;
    game.turn(2, 1);
    game.turn(6, 4);
    game.turn(6, 4);
    game.turn(3, 1);
    expect(p1.isLost).to.be.true;
    expect(p1.money).to.equal(0);
    const auction = game.actions.find(a => a.action === 'Auction') as any;
    expect(auction).to.exist;
    const winner = auction.winner;
    expect(p2.money).to.equal(1545 - (winner === p2.index ? auction.bids[winner] : 0));
    expect(p3.money).to.equal(1545 - (winner === p3.index ? auction.bids[winner] : 0));
  });

  it('', () => {
    const turns = 3;
    const cGame = new ConsoleMonopoly({ seed: 1 });
    cGame.addPlayer();
    cGame.addPlayer();
    for (let i = 0; i < turns; i++) {
      cGame.turn();
      console.log(cGame.actionsToString(), '\n');
    }
  });
});
