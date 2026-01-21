import AbstractSource from './AbstractSource.js';
import {
  oscBundleToJson,
  oscMessageToJson,
  getMetaFromBundle,
  getMetaFromMessage,
} from '../utils/comote-format.js';

import { getTime } from '@ircam/sc-gettime';
import { Lowpass } from '@ircam/sc-signal';

const DEFAULT_ACTIVE_TIMEOUT_MS = 500;

// used for initialisation of interval and frequency estimation
// (when timestamp is estimated from incoming OSC messages)
const FREQUENCY_MAX = 1000; // Hz
const INTERVAL_MIN = 1e3 / FREQUENCY_MAX; // ms

export default class RiotSource extends AbstractSource {
  static type = 'riot';

  #server;
  #config;

  // @todo - make this more robust
  #activeTimeoutDuration;
  #activeTimeoutId;

  #timestampCurrent = null;
  #timestampLast = null;
  #intervalSmoother = new Lowpass({ lowpassFrequency: 0.02 });


  constructor(como, server, config) {
    super(como);

    this.#server = server;
    this.#config = config;
  }

  async init() {
    this.#activeTimeoutDuration = this.#config.activeTimeout || DEFAULT_ACTIVE_TIMEOUT_MS;

    const state = await this.como.stateManager.create(`${this.como.sourceManager.name}:source`, {
      id: this.#config.id,
      type: RiotSource.type,
      nodeId: this.como.nodeId,
      infos: {
        receivePort: this.#config.port,
      },
    });

    super.init(state);

    this.#timestampReset();

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

  #timestampReset = () => {
    this.#timestampCurrent = null;
    this.#timestampLast = null;
    this.#intervalSmoother.reset();
  };

  #timestampUpdate = ({
    timestamp = getTime() * 1e3, // milliseconds
  } = {}) => {
    const initPhase = this.#timestampLast === null;
    this.#timestampLast = this.#timestampCurrent;
    this.#timestampCurrent = timestamp;
    if (this.#timestampLast !== null) {
      const intervalRaw = this.#timestampCurrent - this.#timestampLast;
      if (initPhase && intervalRaw < INTERVAL_MIN) {
        // first interval might be erratic, as it is not smoothed yet
        // discard and restart
        this.#timestampLast = null;
        return {};
      }

      const interval = this.#intervalSmoother.process(intervalRaw);
      const frequency = 1e3 / interval;
      return { timestamp, interval, frequency };
    }
    return {};
  };

  #onOscBundle = bundle => {
    const { source, api, id } = getMetaFromBundle(bundle);

    if (id === this.#config.id) {
      clearTimeout(this.#activeTimeoutId);

      this.#activeTimeoutId = setTimeout(() => {
        this.#timestampReset();
        this.state.set({ active: false });
      }, this.#activeTimeoutDuration);

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
        this.#timestampReset();
        this.state.set({ active: false });
      }, this.#activeTimeoutDuration);

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
