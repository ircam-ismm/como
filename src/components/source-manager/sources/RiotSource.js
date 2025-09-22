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

  constructor(como, server, config) {
    super(como);

    this.#server = server;
    this.#config = config;
  }

  async init() {
    const state = await this.como.stateManager.create(`${this.como.sourceManager.name}:source`, {
      id: this.#config.id,
      type: RiotSource.type,
      nodeId: this.como.nodeId,
      infos: {
        receivePort: this.#config.port,
      }
    });

    super.init(state);

    this.#server.on('bundle', this.#onOscBundle);

    return true;
  }

  async delete() {
    clearTimeout(this.#activeTimeoutId);
    this.#server.off('bundle', this.#onOscBundle);

    await this.state.delete();
  }

  #onOscBundle = bundle => {
    const { source, id } = getSourceAndIdFromBundle(bundle);

    if (source === RiotSource.type && id === this.#config.id) {
      clearTimeout(this.#activeTimeoutId);

      if (!this.state.get('active')) {
        this.state.set({ active: true });
      }

      this.#activeTimeoutId = setTimeout(() => {
        resetPreviousBundleTimestamp(id);
        this.state.set({ active: false });
      }, this.#activeTimeout);

      // @todo - allow to disable use of bno055
      const json = oscToJson(bundle, { useBno055: true });
      // @todo - first output can be null to estimate frequency
      if (json !== null) {
        // source frames are multichannel, so we wrap in an array
        this.state.set({ frame: [json] });
      }
    }
  }
}
