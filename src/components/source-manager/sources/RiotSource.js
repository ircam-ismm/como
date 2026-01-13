import AbstractSource from './AbstractSource.js';
import {
  oscBundleToJson,
  oscMessageToJson,
  getMetaFromBundle,
  getMetaFromMessage,
} from '../utils/comote-format.js';

import { getTime } from '@ircam/sc-gettime';
import { Lowpass } from '@ircam/sc-signal';

export default class RiotSource extends AbstractSource {
  static type = 'riot';

  #server;
  #config;

  // @todo - make this more robust
  #activeTimeout = 200; // ms
  #activeTimeoutId;

  #timestampCurrent = null;
  #timestampLast = null;
  #interval = null;
  #intervalSmoother = new Lowpass({ lowpassFrequency: 0.02 });


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
      },
    });

    super.init(state);

    this.#resetTimestamp();

    this.#server.on('bundle', this.#onOscBundle);
    this.#server.on('message', this.#onOscMessage);

    return true;
  }

  async delete() {
    clearTimeout(this.#activeTimeoutId);
    this.#server.off('bundle', this.#onOscBundle);
    this.#server.off('message', this.#onOscMessage);

    await this.state.delete();
  }

  #resetTimestamp = () => {
    this.#timestampCurrent = null;
    this.#timestampLast = null;
    this.#interval = null;

    this.#intervalSmoother.reset();
  };

  #timestampUpdate = ({
    timestamp = getTime() * 1e3, // milliseconds
  } = {}) => {
    this.#timestampLast = this.#timestampCurrent;
    this.#timestampCurrent = timestamp;
    if (this.#timestampLast !== null) {
      const rawInterval = this.#timestampCurrent - this.#timestampLast;
      this.#interval = this.#intervalSmoother.process(rawInterval);
      const frequency = 1e3 / this.#interval;
      const interval = this.#interval;
      return { timestamp, interval, frequency };
    }
    return {};
  };

  #onOscBundle = bundle => {
    const { source, api, id } = getMetaFromBundle(bundle);

    if (id === this.#config.id) {
      clearTimeout(this.#activeTimeoutId);

      this.#activeTimeoutId = setTimeout(() => {
        this.#resetTimestamp();
        this.state.set({ active: false });
      }, this.#activeTimeout);

      // @todo - allow to disable use of bno055
      const json = oscBundleToJson(bundle, {
        useBno055: true,
        timestampUpdate: this.#timestampUpdate,
      });

      // @todo - first output can be null to estimate frequency
      if (json !== null) {
        if (!this.state.get('active')) {
          this.state.set({ active: true });
        }

        // source frames are multichannel, so we wrap in an array
        this.state.set({ frame: [json] });
      }
    }
  };

  #onOscMessage = message => {
    const { id } = getMetaFromMessage(message);
    if (id === this.#config.id) {
      clearTimeout(this.#activeTimeoutId);

      this.#activeTimeoutId = setTimeout(() => {
        this.#resetTimestamp();
        this.state.set({ active: false });
      }, this.#activeTimeout);

      const json = oscMessageToJson(message, {
        timestampUpdate: this.#timestampUpdate,
      });
      if (json !== null) {
        if (!this.state.get('active')) {
          this.state.set({ active: true });
        }

        // source frames are multichannel, so we wrap in an array
        this.state.set({ frame: [json] });
      }
    }
  };
}
