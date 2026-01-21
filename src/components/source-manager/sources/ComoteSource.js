
import AbstractSource from './AbstractSource.js';
import os from 'node:os';

const DEFAULT_INTERVAL_MS = 100;
const DEFAULT_ACTIVE_TIMEOUT_MS = 500;

export default class ComoteSource extends AbstractSource {
  static type = 'comote';

  #server;
  #config;

  #activeTimeoutPeriod;
  #activeTimeoutId;

  constructor(como, server, config) {
    super(como);

    this.#server = server;
    this.#config = config;
  }

  async init() {
    const interval = this.#config.interval || DEFAULT_INTERVAL_MS;
    this.#activeTimeoutPeriod = this.#config.activeTimeout || DEFAULT_ACTIVE_TIMEOUT_MS;

    const state = await this.como.stateManager.create(`${this.como.sourceManager.name}:source`, {
      id: this.#config.id,
      type: ComoteSource.type,
      nodeId: this.como.nodeId,
      // ```
      // id: 0,
      // interval: 10, // period in ms
      // ws: {
      //   port: 8901,
      //   hostname: wifiInfos.ip,
      //   autostart: true,
      // },
      // [webview: `http://${wifiInfos.ip}:${config.env.port}/webview`,]
      // ```
      infos: {
        id: this.#config.id,
        interval,
        ws: {
          hostname: os.hostname().split('.')[0] + '.local',
          port: this.#config.port,
          autostart: true,
        },
      },
    });

    super.init(state);

    this.#server.addWsListener(this.#onData);

    return true;
  }

  async delete() {
    clearTimeout(this.#activeTimeoutId);
    this.#server.removeWsListener(this.#onData);

    await this.state.delete();
  }

  #onData = (data) => {
    if (data.source === ComoteSource.type && data.id === this.#config.id) {
      clearTimeout(this.#activeTimeoutId);

      if (!this.state.get('active')) {
        this.state.set({ active: true });
      }

      this.#activeTimeoutId = setTimeout(() => {
        this.state.set({ active: false });
      }, this.#activeTimeoutPeriod);

      // source frames are multichannel, so we wrap in an array
      this.state.set({ frame: [data] });
    }
  };
}
