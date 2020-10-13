const InputResampler = require('../common/modules/InputResampler').default;

const resampler = new InputResampler({}, 'InputResampler', 'test', {
  resamplingPeriod: 1000,
});
const log = {
  inputs: new Set(),
  process(frame) {
    console.log(frame);
  },
};

resampler.connect(log);

const frame0 = {
  data: {
    arr: [0, 0, 0],
    obj: { a: 0, b: 0, c: 0 },
    scalar: 0,
  },
};

const frame1 = {
  data: {
    arr: [1, 1, 1],
    obj: { a: 1, b: 1, c: 1 },
    scalar: 1,
  },
};

const frame2 = {
  data: {
    arr: [2, 2, 2],
    obj: { a: 2, b: 2, c: 2 },
    scalar: 2,
  },
};

const frame3 = {
  data: {
    arr: [3, 3, 3],
    obj: { a: 3, b: 3, c: 3 },
    scalar: 3,
  },
};

// this one will be processed now by the ticker
resampler.process(frame0);

// we should have the mean of these two ones
resampler.process(frame1);
resampler.process(frame2);
resampler.propagate();

// this one will be processed alone
resampler.process(frame3);
resampler.propagate();

// and repropageted a second time
resampler.propagate();

resampler.destroy();

