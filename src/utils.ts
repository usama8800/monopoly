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
