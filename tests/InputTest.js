const Input = require('../common/modules/Input').default;

const input = new Input({}, 'Input', 'input-test', {});
const log = {
  inputs: new Set(),
  process: (frame) => console.log(frame),
};

input.connect(log);

const data0 = {
  arr: [0, 0, 0],
  obj: { a: 0, b: 0, c: 0 },
  scalar: 0,
};

const data1 = {
  arr: [1, 1, 1],
  obj: { a: 1, b: 1, c: 1 },
  scalar: 1,
};

const data2 = {
  arr: [2, 2, 2],
  obj: { a: 2, b: 2, c: 2 },
  scalar: 2,
};

const data3 = {
  arr: [3, 3, 3],
  obj: { a: 3, b: 3, c: 3 },
  scalar: 3,
};

// we should get proper frames
input.process(data0);
input.process(data1);
input.process(data2);
input.process(data3);
