import AbstractSource from './AbstractSource.js';
import {
  oscToJson,
  getSourceAndIdFromBundle,
  resetPreviousBundleTimestamp,
} from '../utils/comote-format.js';

export default class RiotSource extends AbstractSource {
  static type = 'riot';

  #server;
  #config;
  // @todo - make this more robust
  #activeTimeout = 100; // ms
  #activeTimeoutId;
  #onOscBundleBinded;

  constructor(como, server, config) {
    super(como);

    this.#server = server;
    this.#config = config;

    this.#onOscBundleBinded = this.#onOscBundle.bind(this);
  }

  get id() {
    this.#config.id;
  }

  async init() {
    const state = await this.como.stateManager.create('source', {
      id: this.#config.sourceId,
      type: RiotSource.type,
      infos: {
        // @tbd
      }
    });

    super.init(state);

    this.#server.on('bundle', this.#onOscBundleBinded);
    this.state.onDelete(() => this.#server.off(this.#onOscBundleBinded));

    return true;
  }

  async delete() {
    clearTimeout(this.#activeTimeoutId);
    await this.state.delete();
  }

  #onOscBundle(bundle) {
    const { source, id } = getSourceAndIdFromBundle(bundle);

    if (source === RiotSource.type && id === this.#config.sourceId) {
      clearTimeout(this.#activeTimeoutId);

      if (!this.state.get('active')) {
        this.state.set({ active: true });
      }

      this.#activeTimeoutId = setTimeout(() => {
        resetPreviousBundleTimestamp(id);
        this.state.set({ active: false });
      }, this.#activeTimeout);

      const json = oscToJson(bundle);
      // @todo - first output can be null to estimate frequency
      if (json !== null) {
        // source frames are multichannel, so we wrap in an array
        this.state.set({ frame: [json] });
      }
    }
  }
}
