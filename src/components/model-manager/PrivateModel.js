import { randomUUID } from 'node:crypto';
import { counter } from '@ircam/sc-utils';



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
    this.#manager.algorithms['xmm'].addListener('message', this.#onWorkerMessage);

    // const infos = examplesInfos(this.#examples);
    // this.state.set({ infos });

    this.state.onUpdate(updates => {
      if ('config' in updates) {
        this.train();
      }
    });
  }

  get state() {
    return this.#state;
  }

  get examples() {
    return this.#examples;
  }

  /** @private */
  async delete() {
    this.#manager.algorithms['xmm'].removeListener('message', this.#onWorkerMessage);
    await this.#state.delete();
  }

  #onWorkerMessage = msg => {
    const { promiseId, err, parameters, trainingDuration } = msg;
    const promiseHandlers = this.#idPromiseMap.get(promiseId);

    // To be able to have multiple models
    if (!promiseHandlers) {
      return;
    }

    const { resolve, reject } = promiseHandlers;

    this.#idPromiseMap.delete(promiseId);

    err ? reject(new Error(err)) : resolve({ parameters, trainingDuration });
  };

  async addExample(label, input, output = null) {
    const uuid = randomUUID();
    const example = { uuid, label, input, output };
    this.#examples.push(example);

    await this.train(label);
  }

  async deleteExample(uuid) {
    const example = this.#examples.find(example => example.uuid === uuid);

    if (example) {
      const label = example.label;
      this.#examples = this.#examples.filter(ex => ex !== example);
      const other = this.#examples.find(ex => ex.label === label);

      if (other) {
        await this.train(label);
      } else {
        await this.clearExamples(label);
      }
    }
  }

  async clearExamples(label = null) {
    if (label !== null) {
      this.#examples = this.#examples.filter(example => example.label !== label);
    } else {
      this.#examples = [];
    }

    if (label) {
      // const infos = examplesInfos(this.#examples);
      const parameters = this.#state.get('parameters');
      delete parameters.classes[label];
      await this.#state.set({ parameters });
      await this.#manager.persist(this);
    } else {
      this.train(); // retrain empty model
    }
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

    this.#manager.algorithms['xmm'].postMessage({
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

      await this.#state.set({ parameters });
    } catch (err) {
      return err;
    }

    await this.#manager.persist(this);
  }
}

export default PrivateModel;
