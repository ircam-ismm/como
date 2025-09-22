import AbstractSource from './AbstractSource.js';
import { jsonToOsc } from '../utils/comote-format.js';

export default class OscBridgeSource extends AbstractSource {
  static type = 'osc-bridge';

  #oscClient;
  #config;
  #inputSource;

  constructor(como, oscClient, config) {
    super(como);

    this.#oscClient = oscClient;
    this.#config = config;
  }

  async init() {
    this.#inputSource = await this.como.sourceManager.getSource(this.#config.source);
    this.#inputSource.onUpdate(this.#onInputUpdate);

    const state = await this.como.stateManager.create(`${this.como.sourceManager.name}:source`, {
      type: OscBridgeSource.type,
      id: this.#config.id,
      nodeId: this.como.nodeId,
      infos: {
        inputSource: this.#config.inputSource,
        destIp: this.#config.destIp,
        destPort: this.#config.destPort,
      },
      active: this.#inputSource.get('active'),
    });

    super.init(state);
  }

  async delete() {
    await this.state.delete();
  }

  #onInputUpdate = updates => {
    for (let [key, value] of Object.entries(updates)) {
      switch (key) {
        case 'active': {
          this.state.set('active', value);
          break;
        }
        case 'frame': {
          this.state.set('frame', value);
          // handle multi-channel
          value.forEach(channel => {
            const bundle = jsonToOsc(channel, { asNodeOscBundle: true });
            this.#oscClient.send(bundle);
          });

          break;
        }
      }
    }
  }
}
