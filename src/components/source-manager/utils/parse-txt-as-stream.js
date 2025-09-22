import { EOL } from '#isomorphic-utils.js';

export function parseTxtAsStream(txt) {
  const stream = txt.trim()
    .split(EOL)
    .filter(line => line.trim() !== '')
    .map(line => JSON.parse(line));

  return stream;
}
