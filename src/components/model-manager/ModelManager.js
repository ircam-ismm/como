import ComoComponent from '../../core/ComoComponent.js';

import Model from './Model.js';

class ModelManager extends ComoComponent {
  #models;

  /**
   * @hideconstructor
   * @param {ComoNode} como
   * @param {String} name
   */
  constructor(como, name) {
    super(como, name);

    this.como.setRfcResolverHook(`${this.name}:createModel`, this.#getModelResolverHook);
  }

  get models() {
    return this.#models;
  }

  /** @private */
  async start() {
    await super.start();

    // lightweight collection of models
    this.#models = await this.como.stateManager.getCollection(`${this.name}:model`, [
      'id', 'config', 'infos',
    ]);
  }

  async getModel(modelId, options = {}) {
    // if model already exists, attach to it, else create it
    const {
      preset = 'postures',
    } = options;

    let state = this.#models.find(model => model.get('id') === modelId);
    const model = new Model(this);

    if (!state) {
      const id = await this.como.requestRfc(
        this.como.constants.SERVER_ID,
        `${this.name}:createModel`,
        {
          modelId,
          preset,
        },
      );
      // getModelResolverHook guarantees the model is in the collection
      state = this.#models.find(model => model.get('id') === id);
    }

    const fullState = await this.como.stateManager.attach(`${this.name}:model`, state.id);
    model.init(fullState);

    return model;
  }

  /** @private */
  #getModelResolverHook = async (err, modelId) => {
    if (err) {
      return;
    }

    // make sure the new model is in the collection before we resolve `getModel`
    // cf. https://github.com/collective-soundworks/soundworks/issues/118
    //
    // 1. check that the model is not already in list, this may happen server-side
    const model = this.#models.find(model => model.get('id') === modelId);

    if (model) {
      return Promise.resolve();
    }

    // 2. else, wait for the model to attach to the collection before resolving
    const { promise, resolve } = Promise.withResolvers();
    // detach listener will be defined as we will be asynchronous
    const detachListener = this.#models.onAttach(model => {
      if (model.get('id') === modelId) {
        detachListener();
        resolve();
      }
    });

    return promise;
  };

  async addExample(modelId, label, example) {
    await this.como.requestRfc(
      this.como.constants.SERVER_ID,
      `${this.name}:addExample`,
      { modelId, label, example },
    );
  }

  async deleteExample(modelId, exampleUuid) {
    await this.como.requestRfc(
      this.como.constants.SERVER_ID,
      `${this.name}:deleteExample`,
      { modelId, exampleUuid },
    );
  }

  async clearExamples(modelId, label = null) {
    await this.como.requestRfc(
      this.como.constants.SERVER_ID,
      `${this.name}:clearExamples`,
      { modelId, label },
    );
  }

  // async train(modelId) {
  //   await this.como.requestRfc(
  //     this.como.constants.SERVER_ID,
  //     `${this.name}:train`,
  //     { modelId },
  //   );
  // }
}

export default ModelManager;
