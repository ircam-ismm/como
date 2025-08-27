import AbstractSource from './AbstractSource.js';

export default class FilePlayerSource extends AbstractSource {
  static type = 'file-player';

  #config;
  #startTime;

  constructor(como, config) {
    super(como);

    this.#config = config;
    console.log(config)
  }

  get id() {
    return this.#config.id;
  }

  async init() {
    const state = await this.como.stateManager.create('source', {
      id: this.#config.sourceId,
      type: FilePlayerSource.type,
      infos: {
        // this
      }
    });
  }

  async delete() {

  }

  #processor(currentTime) {

  }
}
