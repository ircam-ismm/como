import path from 'node:path';
import { Worker } from 'node:worker_threads';

import { isString } from '@ircam/sc-utils';

import ModelManager from './ModelManager.js';
import PrivateModel from './PrivateModel.js';
import modelDescription from './model-description.js';

const presets = {
  postures: {
    target: {
      name: 'xmm',
    },
    payload: {
      modelType: 'gmm',
      gaussians: 1,
      absoluteRegularization: 0.01,
      relativeRegularization: 0.01,
      covarianceMode: 'full',
      states: 1,
      transitionMode: 'ergodic',
    },
  },
  shortGestures: {
    target: {
      name: 'xmm',
    },
    payload: {
      modelType: 'hhmm',
      gaussians: 1,
      absoluteRegularization: 0.1,
      relativeRegularization: 0.1,
      covarianceMode: 'full',
      states: 4,
      transitionMode: 'leftright',
    },
  },
  longGestures: {
    target: {
      name: 'xmm',
    },
    payload: {
      modelType: 'hhmm',
      gaussians: 1,
      absoluteRegularization: 0.1,
      relativeRegularization: 0.1,
      covarianceMode: 'full',
      states: 10,
      transitionMode: 'leftright',
    },
  },
};

/**
 * Server-side representation of the {@link ModelManager}
 *
 * @extends {ModelManager}
 */
class ModelManagerServer extends ModelManager {
  #privateModels = new Map();
  #xmmWorker;

  constructor(como, name) {
    super(como, name);

    this.como.setRfcHandler(`${this.name}:createModel`, this.#createModelHandler);
    this.como.setRfcHandler(`${this.name}:addExample`, this.#addExampleHandler);
    this.como.setRfcHandler(`${this.name}:clearExamples`, this.#clearExamplesHandler);
    // this.como.setRfcHandler(`${this.name}:train`, this.#trainHandler);
  }

  async init() {
    await super.init();

    await this.como.stateManager.defineClass(`${this.name}:model`, modelDescription);
  }

  async start() {
    await super.start();

    const { promise: onlinePromise, resolve } = Promise.withResolvers();
    this.#xmmWorker = new Worker(path.join(import.meta.dirname, 'xmm-worker.js'));
    this.#xmmWorker.on('online', resolve);
    await onlinePromise;
  }

  async stop() {
    const { promise: terminatePromise, resolve } = Promise.withResolvers();
    this.#xmmWorker.on('exit', resolve);
    this.#xmmWorker.terminate();
    await terminatePromise;

    await super.stop();
  }

  #createModelHandler = async ({ modelId, preset = 'postures' }) => {
    const state = await this.como.stateManager.create(`${this.name}:model`, {
      id: modelId,
      config: presets[preset],
    });

    const model = new PrivateModel(this.#xmmWorker, state);
    await model.train();

    this.#privateModels.set(modelId, model);

    return modelId;
  };

  // #deleteModelHandler = async (modelId) => {}

  #addExampleHandler = async ({ modelId, label, example }) => {
    const model = this.#privateModels.get(modelId);

    if (!model) {
      throw new Error(`Cannot add example ("${label}") to model: model with id "${modelId}" does not exists`);
    }

    if (!isString(label)) {
      throw new Error(`Cannot add example ("${label}") to model "${modelId}": label is not a string`);
    }

    if (!Array.isArray(example)) {
      throw new Error(`Cannot add example ("${label}") to model "${modelId}": example is not an array`);
    }

    return await model.addExample(label, example);
  };

  #clearExamplesHandler = async ({ modelId, label = null }) => {
    const model = this.#privateModels.get(modelId);

    if (!model) {
      throw new Error(`Cannot add example ("${label}") to model: model with id "${modelId}" does not exists`);
    }

    if (label !== null && !isString(label)) {
      throw new Error(`Cannot add example ("${label}") to model "${modelId}": label is not a string`);
    }

    return await model.clearExamples(label);
  };

  // #trainHandler = async (modelId) => {
  //   // train all classes
  //   // persist to filesystem
  // };
}

export default ModelManagerServer;
