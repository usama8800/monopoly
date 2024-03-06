import { Monopoly } from '../monopoly';
import { Player } from '../player';

export const bids = () => describe('Bids', () => {
  let game: Monopoly;
  let p1: Player;
  let p2: Player;

  beforeEach(() => {
    game = new Monopoly();
    p1 = new Player();
    p2 = new Player();
    game.addPlayer(p1);
    game.addPlayer(p2);
  });

  it('Doesn\'t go above 1.2 * cost',);
});
