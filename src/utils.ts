import stringWidth from 'string-width';

const generators = {};

function rand(seed?: number) {
  if (!seed) return Math.random();
  if (!generators[seed]) generators[seed] = splitmix32(seed);
  return generators[seed]();
}

export function rollDice(seed?: number): number {
  return Math.floor(rand(seed) * 6) + 1;
}

export function shuffle<T>(array: T[], seed?: number): T[] {
  let currentIndex = array.length;
  let randomIndex: number;
  // While there remain elements to shuffle.
  while (currentIndex > 0) {
    // Pick a remaining element.
    randomIndex = Math.floor(rand(seed) * currentIndex);
    currentIndex--;
    // And swap it with the current element.
    [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
  }

  return array;
}

function splitmix32(seed: number) {
  return function () {
    seed |= 0;
    seed = seed + 0x9e3779b9 | 0;
    let t = seed ^ seed >>> 16;
    t = Math.imul(t, 0x21f0aaad);
    t = t ^ t >>> 15;
    t = Math.imul(t, 0x735a2d97);
    return ((t = t ^ t >>> 15) >>> 0) / 4294967296;
  };
}

export function padStart(str: string, length: number, repeat = ' ') {
  const diff = length - strlen(str);
  if (diff > 0) str = repeat.repeat(diff) + str;
  return str;
}

export function padEnd(str: string, length: number, repeat = ' ') {
  const diff = length - strlen(str);
  if (diff > 0) str = str + repeat.repeat(diff);
  return str;
}

export function padCenter(str: string, length: number, repeat = ' ') {
  const diff = length - strlen(str);
  if (diff > 0) {
    const left = Math.floor(diff / 2);
    const right = diff - left;
    str = repeat.repeat(left) + str + repeat.repeat(right);
  }
  return str;
}

export function strlen(str: string) {
  let len = stringWidth(str);
  if (str.includes('⛓️')) len -= 1;
  return len;
}


export type Name = string | {
  us: string;
  uk: string;
};
export type Property = {
  index: number;
  name: Name;
  type: 'property';
  cost: number;
  set: number;
  rent: number[];
  buildingCost: number;
  buildings: number;
  mortgaged: boolean;
  ownershipChanged: [number, number];
  owner: number;
  color: string,
};
export type Corner = {
  index: number;
  name: Name;
  type: 'go' | 'jail' | 'free-parking' | 'go-to-jail';
  corner: true;
}
export type Railroad = {
  index: number;
  name: Name;
  type: 'railroad';
  cost: number;
  rent: number[];
  mortgaged: boolean;
  ownershipChanged: [number, number];
  owner: number;
}
export type Utility = {
  index: number;
  name: Name;
  type: 'utility';
  cost: number;
  rent: number[];
  mortgaged: boolean;
  ownershipChanged: [number, number];
  owner: number;
}
export type CommunityChest = {
  index: number;
  name: Name;
  type: 'community-chest';
}
export type Chance = {
  index: number;
  name: Name;
  type: 'chance';
}
export type Tax = {
  index: number;
  name: Name;
  type: 'tax';
  cost: number;
}
export type OwnableBoardItem = Property | Railroad | Utility;
export type BoardItem = OwnableBoardItem | Corner | CommunityChest | Chance | Tax;
export type Board = BoardItem[];
export type CCard = {
  description: string;
  type: 'advance' | 'earn' | 'jail' | 'jail-card' | 'back' | 'spend' | 'repairs' | 'spend-each-player' | 'earn-each-player';
  data: number | string | number[] | undefined;
}
export enum JailCheck {
  NOT_JAILED, THIRD_ROLL, CARD, PAYING, DOUBLE, JAILED
}
export type Action = {
  action: 'Land';
  who: number;
  where: number;
  money: number;
} | {
  action: 'Recevie Title';
  who: number;
  which: number;
} | {
  action: 'Owns';
  who: number;
  where: number;
} | {
  action: 'Rent';
  where: number;
  amount: number;
  to: number;
} | {
  action: 'Pass Go';
  who: number;
  money: number;
} | {
  action: 'Spend';
  who: number;
  amount: number;
  money: number;
  to?: number;
  toMoney?: number;
} | {
  action: 'Earn';
  who: number;
  amount: number;
  money: number;
} | {
  action: 'Jail';
  who: number;
} | {
  action: 'Auction Start',
  for: number;
} | {
  action: 'Auction End';
  for: number;
  bids: number[];
  winner: number;
} | {
  action: 'Bankrupt';
  who: number;
  to?: number;
} | {
  action: 'Build';
  who: number;
  where: number;
  number: number;
} | {
  action: 'Demolish';
  who: number;
  where: number;
  amount: number;
  money: number;
} | {
  action: 'Mortgage';
  who: number;
  where: number;
  amount: number;
  money: number;
} | {
  action: 'Unmortgage';
  who: number;
  where: number;
} | {
  action: 'Trade';
  what: 'Tile';
  which: number;
  from: number;
  to: number;
} | {
  action: 'Trade';
  what: 'Jail Card';
  from: number;
  to: number;
  number: number;
} | {
  action: 'Trade Declined';
  declinedBy: number;
  tradeFrom: number;
} | {
  action: 'Draw card';
  who: number;
  card: CCard;
} | {
  action: 'Roll';
  who: number;
  dice: [number, number];
  money: number;
} | {
  action: 'Use Jail Card';
  who: number;
} | {
  action: 'Pay for jail';
  who: number;
  money: number;
} | {
  action: 'Double for jail';
  who: number;
} | {
  action: 'Staying in jail';
  who: number;
} | {
  action: 'Double to jail';
  who: number;
} | {
  action: 'Info';
  who?: number;
  to?: number;
  where?: number;
  amount?: number;
  string: string;
};
