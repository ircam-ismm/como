import Manager from '../Manager.js';
import SourceFactory from '#sources/SourceFactory.js';

export default class SourceManager extends Manager {
  #sources;
  #factory;

  constructor(como, entityName = 'sourceManager') {
    super(como, entityName);

    this.#factory = new SourceFactory(como);

    this.createSource = this.createSource.bind(this);
    this.deleteSource = this.deleteSource.bind(this);
  }

  get sources() {
    return this.#sources;
  }

  async start() {
    super.start();

    // collections
    this.#sources = await this.como.stateManager.getCollection('source',
      ['id', 'type', 'infos', 'active', 'record', 'control']
    );

    this.como.setCommandHandler('createSource', this.createSource);
    this.como.setCommandHandler('deleteSource', this.deleteSource);
  }

  async stop() {
    return this.#factory.stop();
  }

  async getSource(sourceId) {
    const result = this.sources.find(s => s.get('id') === sourceId);

    if (result !== undefined) {
      // @todo
      // - if `source.type !== file reader` -> blacklist `['loop', 'loopStart', 'loopEnd', 'seek']`
      const source = await this.como.node.stateManager.attach('source', result.id);
      return source;
    } else {
      return null;
    }
  }

  async createSource(payload) {
    return this.#factory.createSource(payload);
  }

  async deleteSource(payload) {
    return this.#factory.deleteSource(payload);
  }
}
