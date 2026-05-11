import xmm from '#xmm.js';

function getXmmDecoder(config, parameters) {
  switch (config.modelType) {
    case 'gmm': {
      const decoder = xmm.MulticlassGMMPredictor(parameters);
      // @todo - review this weird default
      decoder.setLikelihoodWindow(config.likelihoodWindow || 10);
      return decoder;
    }
    case 'hhmm': {
      const decoder = xmm.MulticlassHMMPredictor(parameters);
      // @todo - review this weird default
      decoder.setLikelihoodWindow(config.likelihoodWindow || 10);
      return decoder;
    }
    default: {
      throw new Error(`Cannot create xmm decoder: modelType "${config.modelType}" is not supported`);
    }
  }
}

class Model {
  #modelManager;
  #state;
  #decoder;

  constructor(modelManager) {
    this.#modelManager = modelManager;
  }

  /* @private */
  async init(state) {
    this.#state = state;

    this.#state.onUpdate(updates => {
      if ('parameters' in updates) {
        const { payload: config } = this.#state.get('config');
        const parameters = this.#state.getUnsafe('parameters');
        this.#decoder = getXmmDecoder(config, parameters);
      }
    }, true);
  }

  async detach() {
    await this.#state.detach();
  }

  get id() {
    return this.#state.get('id');
  }

  get state() {
    return this.#state;
  }

  /**
   * Add an
   * @param {Array} example
   */
  async addExample(label, example) {
    const { promise, resolve, reject } = Promise.withResolvers();
    const unsubscribe = this.#state.onUpdate(updates => {
      if ('parameters' in updates) {
        unsubscribe();
        resolve();
      }
    });

    try {
      await this.#modelManager.addExample(this.id, label, example);
    } catch (err) {
      console.log(err.message);
      reject(err);
    }

    return promise;
  }

  async clearExamples(label = null) {
    const { promise, resolve, reject } = Promise.withResolvers();
    const unsubscribe = this.#state.onUpdate(updates => {
      if ('parameters' in updates) {
        unsubscribe();
        resolve();
      }
    });

    try {
      await this.#modelManager.clearExamples(this.id, label);
    } catch (err) {
      console.log(err.message);
      reject(err);
    }

    return promise;
  }

  process(frame) {
    this.#decoder.predict(frame);
    return this.#decoder.results;
  }
}

export default Model;
