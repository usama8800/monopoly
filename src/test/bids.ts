import { AIPlayer } from '../ai_player';
import { Monopoly } from '../monopoly';

export const bids = () => describe('Bids', () => {
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

  it('Doesn\'t go above 1.2 * cost',);
});
