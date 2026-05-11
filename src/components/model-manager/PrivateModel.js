import { counter } from '@ircam/sc-utils';

function examplesInfos(examples) {
  const infos = {};

  examples.forEach(example => {
    if (!infos[example.label]) {
      infos[example.label] = {
        numExamples: 0,
      };
    }

    infos[example.label].numExamples += 1;
  });

  return infos;
}

/** @private */
class PrivateModel {
  #examples;
  #state;
  #manager;
  #idGenerator = counter();
  #idPromiseMap = new Map();

  constructor(manager, state, examples = []) {
    this.#manager = manager;
    this.#state = state;
    this.#examples = examples;
    // Worker extends the Node.js "EventEmitter" not the W3C `EventTarget`
    this.#manager.xmmWorker.addListener('message', this.#onWorkerMessage);
  }

  get state() {
    return this.#state;
  }

  get examples() {
    return this.#examples;
  }

  /** @private */
  async delete() {
    this.#manager.xmmWorker.removeListener('message', this.#onWorkerMessage);
    await this.#state.delete();
  }

  #onWorkerMessage = msg => {
    const { promiseId, err, parameters, trainingDuration } = msg;
    const { resolve, reject } = this.#idPromiseMap.get(promiseId);
    this.#idPromiseMap.delete(promiseId);

    err ? reject(new Error(err)) : resolve({ parameters, trainingDuration });
  };

  async addExample(label, input, output = null) {
    const example = { label, input, output };
    this.#examples.push(example);

    await this.train(label);
  }

  async clearExamples(label = null) {
    if (label !== null) {
      this.#examples = this.#examples.filter(example => example.label !== label);
    } else {
      this.#examples = [];
    }

    // Retrain full model, removing a label may change something in other classes
    // @todo - confirm (test is not clear) cf. `tests/component-model-manager/xmm-vendor.spec.js`
    await this.train();
  }

  async train(label = null) {
    const config = this.#state.get('config').payload;
    const parameters = this.#state.getUnsafe('parameters');
    let examples = this.#examples;
    let multiClass = true;

    if (label) {
      examples = examples.filter(example => example.label === label);
      // if this is the first example added to the model, force multiClass to have consistent metadata
      multiClass = parameters.inputDimension === 0 ? true : false;
    }

    const { promise, resolve, reject } = Promise.withResolvers();
    const promiseId = this.#idGenerator();
    this.#idPromiseMap.set(promiseId, { resolve, reject });

    this.#manager.xmmWorker.postMessage({
      promiseId,
      config,
      examples,
      multiClass,
    });

    try {
      const { parameters: singleOrMultiClassParameters, trainingDuration } = await promise;
      console.log(`> Model "${this.#state.get('id')}" updated: ${Math.round(trainingDuration * 1e3)}ms`);

      let parameters;

      if (!multiClass) {
        parameters = this.#state.get('parameters');
        parameters.classes[label] = singleOrMultiClassParameters;
      } else {
        parameters = singleOrMultiClassParameters;
      }

      const infos = examplesInfos(this.#examples);
      await this.#state.set({ parameters, infos });
    } catch (err) {
      return err;
    }

    await this.#manager.persist(this);
  }
}

export default PrivateModel;
