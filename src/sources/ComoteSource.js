
import AbstractSource from './AbstractSource.js';
import os from 'node:os';

const DEFAULT_INTERVAL_MS = 10;

export default class ComoteSource extends AbstractSource {
  static type = 'comote';

  #server;
  #config;

  #activeTimeout;
  #activeTimeoutId;
  #onDataBinded;

  constructor(como, server, config) {
    super(como);

    this.#server = server;
    this.#config = config;

    this.#onDataBinded = this.#onData.bind(this);
  }

  get id() {
    this.#config.id;
  }

  async init() {
    const interval = this.#config.interval || DEFAULT_INTERVAL_MS;
    // @todo - confirm this is a sensible default
    this.#activeTimeout = interval * 10;

    const state = await this.como.node.stateManager.create('source', {
      id: this.#config.id,
      type: ComoteSource.type,
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

    this.#server.addWsListener(this.#onDataBinded);
    this.state.onDelete(() => this.#server.removeWsListener(this.#onDataBinded));

    return true;
  }

  async delete() {
    clearTimeout(this.#activeTimeoutId);
    await this.state.delete();
  }

  #onData(data) {
    if (data.source === ComoteSource.type && data.id === this.#config.id) {
      clearTimeout(this.#activeTimeoutId);

      if (!this.state.get('active')) {
        this.state.set({ active: true });
      }

      this.#activeTimeoutId = setTimeout(() => {
        this.state.set({ active: false });
      }, this.#activeTimeout);

      // source frames are multichannel, so we wrap in an array
      this.state.set({ frame: [data] });
    }
  }
}
