import { getDecoder } from './algorithms/xmm-lib.js';

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
        this.#decoder = getDecoder(config, parameters);
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
   * @return {String} uuid
   */
  async addExample(label, example) {
    return await this.#modelManager.addExample(this.id, label, example);
  }

  async deleteExample(uuid) {
    await this.#modelManager.deleteExample(this.id, uuid);
  }

  async clearExamples(label = null) {
    await this.#modelManager.clearExamples(this.id, label);
  }

  process(frame) {
    return this.#decoder.process(frame);
  }
}

export default Model;
