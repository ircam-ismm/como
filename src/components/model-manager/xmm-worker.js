import { parentPort } from 'node:worker_threads';
import { getTime } from '@ircam/sc-utils';

import xmm from '#xmm.js';

parentPort.on('message', event => {
  const startTime = getTime();
  const { promiseId, config, examples, multiClass } = event;
  let trainingSet;

  if (examples.length === 0) {
    // no examples, create empty training set
    trainingSet = xmm.TrainingSet({ inputDimension: 0 });
  } else {
    examples.forEach((example, index) => {
      const { label, input } = example;

      if (index === 0) {
        const inputDimension = input[0].length;
        trainingSet = xmm.TrainingSet({ inputDimension });
      }

      // create and populate phrase
      const phrase = trainingSet.push(index, label);
      input.forEach(frame => phrase.push(frame));
    });
  }

  switch (config.modelType) {
    case 'gmm': {
      const xmmConfig = {
        gaussians: config.gaussians,
        regularization: {
          relative: config.relativeRegularization,
          absolute: config.absoluteRegularization,
        },
        covarianceMode: config.covarianceMode,
      };

      const parameters = multiClass
        ? xmm.trainMulticlassGMM(trainingSet, xmmConfig)
        : xmm.trainGMM(trainingSet, xmmConfig);

      const trainingDuration = getTime() - startTime;
      parentPort.postMessage({ promiseId, parameters, trainingDuration });
      break;
    }
    case 'hhmm': {
      const xmmConfig = {
        states: config.states,
        gaussians: config.gaussians,
        regularization: {
          relative: config.relativeRegularization,
          absolute: config.absoluteRegularization,
        },
        covarianceMode: config.covarianceMode,
      };

      const parameters = multiClass
        ? xmm.trainMulticlassHMM(trainingSet, xmmConfig)
        : xmm.trainHMM(trainingSet, xmmConfig);

      const trainingDuration = getTime() - startTime;
      parentPort.postMessage({ promiseId, parameters, trainingDuration });
      break;
    }
    default: {
      parentPort.postMessage({ promiseId, err: 'Invalid model type "' + config.modelType + '", should be gmm or hhmm' });
      break;
    }
  }
});
