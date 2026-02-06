
const isNumeric = (string) => Number.isFinite(+string)

const parseBool = str => str === '0' ? false : true;
const riotifyBool = bool => bool ? '1' : '0';

const parseString = str => str;
const riotifyString = str => str;

// return index of the list, as string
// const parseEnum =


export function parseRiotConfig(input) {
  const lines = input.split('\n')
    .map(l => l.trim())
    .filter(l => l !== '');

  const output = {};

  lines.forEach(line => {
    // try number
    let [key, value] = line.split(/(?<=^\S+)\s/);

    // handle special cases
    if (key === 'pass') {
      output[key] = value;
    }

    // no value, just ignore (i.e. "refresh" field ?)
    if (value === undefined) {
      return;
    }

    if (isNumeric(value)) {
      output[key] = parseFloat(value);
      return;
    }

    // array syntax: soft_matrix1 [ 1.000000 -0.255186 0.002639 ]
    if (/^\[.*\]$/.test(value)) {
      const array = value
        .replace('[', '')
        .replace(']', '')
        .trim()
        .split(' ')
        .map(str => isNumeric(str) ? parseFloat(str) : str);

      output[key] = array;
      return;
    }

    // object syntax: ledcolor [R]:0 - [G]:5 - [B]:10 - [W]:0
    if (value.match(/\[[A-Za-z]\]:/g)) {
      const object = {};

      value.split(' - ').forEach(el => {
          el.trim();
          const parts = el.split(':');
          const key = parts[0]
            .replace('[', '')
            .replace(']', '');
          const value = isNumeric(parts[1]) ? parseFloat(parts[1]) : parts[1];
          object[key] = value;
        });

      output[key] = object;
      return;
    }

    // just a regular string
    output[key] = value;
  });

  return output;
}
