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
  #xmmWorker;
  #idGenerator = counter();
  #idPromiseMap = new Map();

  constructor(xmmWorker, state, examples = []) {
    this.#state = state;
    this.#examples = examples;
    this.#xmmWorker = xmmWorker;

    this.#xmmWorker.on('message', msg => {
      const { promiseId, err, parameters, trainingDuration } = msg;
      const { resolve, reject } = this.#idPromiseMap.get(promiseId);
      this.#idPromiseMap.delete(promiseId);

      err ? reject(new Error(err)) : resolve({ parameters, trainingDuration });
    });
  }

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

    // retrain full model, removing a label may change something in other classes
    // @todo - confirm this, the test is not clear
    // cf. `tests/component-model-manager/xmm-vendor.spec.js`
    const multiClass = true;
    const config = this.#state.get('config').payload;
    const examples = this.#examples;

    const { promise, resolve, reject } = Promise.withResolvers();
    const promiseId = this.#idGenerator();
    this.#idPromiseMap.set(promiseId, { resolve, reject });

    this.#xmmWorker.postMessage({
      promiseId,
      config,
      examples,
      multiClass,
    });

    try {
      const { parameters, trainingDuration } = await promise;
      console.log(`> Model "${this.#state.get('id')}" updated: ${Math.round(trainingDuration * 1e3)}ms`);

      const infos = examplesInfos(this.#examples);
      await this.#state.set({ parameters, infos });
    } catch (err) {
      return err;
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

    this.#xmmWorker.postMessage({
      promiseId,
      config,
      examples,
      multiClass,
    });

    try {
      const { parameters: singleOrMultiClassParameters, trainingDuration } = await promise;
      console.log(`> Training model "${this.#state.get('id')}": ${Math.round(trainingDuration * 1e3)}ms`);

      let parameters;

      if (!multiClass) {
        parameters = this.#state.getUnsafe('parameters');
        parameters.classes[label] = singleOrMultiClassParameters;
      } else {
        parameters = singleOrMultiClassParameters;
      }

      const infos = examplesInfos(this.#examples);
      await this.#state.set({ parameters, infos });
    } catch (err) {
      return err;
    }
  }
}

export default PrivateModel;
