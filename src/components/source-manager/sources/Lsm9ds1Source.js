import AbstractSource from './AbstractSource.js';

class Lsm9ds1Source extends AbstractSource {
  static type = 'lsm9ds1';
  #config = null;

  constructor(como, config) {
    super(como);

    this.#config = config;
  }

  async init() {
    const state = await this.como.stateManager.create(`${this.como.sourceManager.name}:source`, {
      id: this.#config.id || 'coucou',
      type: Lsm9ds1Source.type,
      nodeId: this.como.nodeId,
      infos: {},
    });

    super.init(state);

    // somehow
    this.state.set('frame', {
      /*accelerometer*/
    });
  }

  async delete() {

  }
}

export default Lsm9ds1Source;
