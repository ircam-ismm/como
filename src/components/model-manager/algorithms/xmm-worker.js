
import { getTime } from '@ircam/sc-utils';
import { parentPort, Worker, isMainThread } from 'node:worker_threads';

import xmm from '#xmm.js';

export class XmmWorker {
  #worker = null;

  async init() {
    const { promise: onlinePromise, resolve } = Promise.withResolvers();
    this.#worker = new Worker(new URL(import.meta.url));
    this.#worker.on('online', resolve);
    await onlinePromise;

    return this;
  }

  async terminate() {
    const { promise: terminatePromise, resolve } = Promise.withResolvers();
    this.#worker.on('exit', resolve);
    this.#worker.terminate();
    await terminatePromise;
  }

  addListener(...args) {
    this.#worker.addListener(...args);
  }

  removeListener(...args) {
    this.#worker.removeListener(...args);
  }

  postMessage(...args) {
    this.#worker.postMessage(...args);
  }
}

if (!isMainThread) {
  parentPort.on('message', event => {
    const startTime = getTime();
    const { modelUuid, promiseId, config, examples, multiClass } = event;
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
        parentPort.postMessage({ modelUuid, promiseId, parameters, trainingDuration });
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
        parentPort.postMessage({ modelUuid, promiseId, parameters, trainingDuration });
        break;
      }
      default: {
        parentPort.postMessage({ modelUuid, promiseId, err: 'Invalid model type "' + config.modelType + '", should be gmm or hhmm' });
        break;
      }
    }
  });
}
