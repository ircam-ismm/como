import { assert } from 'chai';
import xmm from 'xmmjs';

describe('# Vendor - xmm', () => {
  describe('## remove label', () => {
    it('check that we need to retrain whole model when removing a class - looks like floating point errors, but...', () => {
      const configuration = {
        gaussians: 3,
        regularization: {
          absolute: 1e-1,
          relative: 1e-10,
        },
        covarianceMode: 'full',
      };

      // ---------------------------------------------------------------
      // train model with two classes
      // ---------------------------------------------------------------
      const ts1 = xmm.TrainingSet({ inputDimension: 3 });

      // Add a new phrase to the training set, and record data frames
      const phrase1_1 = ts1.push(0, 'one');
      for (let i = 0; i < 1000; i += 1) {
        const frame = Array.from(Array(3), () => Math.random()); // get data from somewhere
        phrase1_1.push(frame);
      }
      const phrase1_2 = ts1.push(1, 'two');
      for (let i = 0; i < 1000; i += 1) {
        const frame = Array.from(Array(3), () => 1 + Math.random()); // get data from somewhere
        phrase1_2.push(frame);
      }
      const gmmParams1 = xmm.trainMulticlassGMM(ts1, configuration);

      // ---------------------------------------------------------------
      // train model with only one class
      // ---------------------------------------------------------------
      const ts2 = xmm.TrainingSet({ inputDimension: 3 });

      // Add a new phrase to the training set, and record data frames
      const phrase2_1 = ts2.push(0, 'one');
      for (let i = 0; i < 1000; i += 1) {
        const frame = Array.from(Array(3), () => Math.random()); // get data from somewhere
        phrase2_1.push(frame);
      }

      const gmmParams2 = xmm.trainMulticlassGMM(ts2, configuration);

      // just delete label 'two' from first model
      delete gmmParams1.classes['two'];

      // console.log(JSON.stringify(gmmParams1.classes, null, 2));
      // console.log(JSON.stringify(gmmParams2.classes, null, 2));
      assert.notDeepEqual(gmmParams1, gmmParams2);
    });
  });
});
