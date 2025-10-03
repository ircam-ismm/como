import ComoComponent from '../../core/ComoComponent.js';

import {
  isPlainObject,
} from '@ircam/sc-utils';

import SourceFactory from '#sources/factory.js';

export default class SourceManager extends ComoComponent {
  #ownedSources = new Set(); // owned sources created on this node
  #sources;
  #factory;

  constructor(como, name) {
    super(como, name);

    this.#factory = new SourceFactory(como);
  }

  get sources() {
    return this.#sources;
  }

  get list() {
    return this.#sources.get('id');
  }

  async start() {
    await super.start();

    // collections
    this.#sources = await this.como.stateManager.getCollection(`${this.name}:source`,
      // parameter whitelist - we really don't want the streams here
      // @todo - move to blacklist once implemented in soundworks
      ['id', 'type', 'infos', 'active', 'record', 'control']
    );

    this.como.setRfcHandler(`${this.name}:createSource`, this.#createSourceHandler);
    this.como.setRfcHandler(`${this.name}:deleteSource`, this.#deleteSourceHandler);

    this.como.setRfcResolverHook(`${this.name}:createSource`, this.#createSourceResolverHook);
  }

  async stop() {
    await super.stop();

    await this.#sources.detach();

    for (let source of this.#ownedSources.values()) {
      await source.delete();
    }

    this.#factory.stop();
  }

  sourceExists(sourceId) {
    return !!this.sources.find(s => s.get('id') === sourceId);
  }

  getSourceFiltered(sourceId) {
    return this.sources.find(source => source.get('id') === sourceId);
  }

  async getSource(sourceId) {
    // if the source has been created on this node, return the underlying owned source state
    const owned = Array.from(this.#ownedSources).find(source => source.id === sourceId);
    if (owned) {
      return owned.state;
    }

    // if the source has been created on another node, attach to the "real" source
    const notOwned = this.sources.find(s => s.get('id') === sourceId);
    if (notOwned) {
      return await this.como.stateManager.attach(`${this.name}:source`, notOwned.id);
    }

    // source does not exits
    return null;
  }

  async createSource(config, nodeId = this.como.nodeId) {
    if (!isPlainObject(config)) {
      throw new Error(`Cannot execute "createSource" on SourceManager: argument 1 is not an object`);
    }

    if (!('id' in config)) {
      throw new Error(`Cannot execute "createSource" on SourceManager: config.id is not defined`);
    }

    const exists = this.#sources.find(source => source.get('id') === config.id);

    if (exists) {
      throw new Error(`Cannot execute "createSource" on SourceManager: a source with id "${config.id}" already exists`);
    }

    // always go though the rfc roundtrip, even if `nodeId = this.como.nodeId`,
    // to benefit from the hook logic
    // @note - this could be optimized within the Rfc logic
    return await this.como.requestRfc(nodeId, `${this.name}:createSource`, config);
  }

  #createSourceHandler = async (config) => {
    const source = await this.#factory.createSource(config);
    this.#ownedSources.add(source);

    return source.id;
  }

  #createSourceResolverHook = async (err, sourceId) => {
    if (err) {
      return;
    }

    // make sure the new source is in the list before we resolve `createSource`
    // cf. https://github.com/collective-soundworks/soundworks/issues/118
    //
    // 1. check that the source is not already in list, this may happen server-side
    const source = this.como.sourceManager.sources.find(s => s.get('id') === sourceId);

    if (source !== undefined) {
      return Promise.resolve();
    }

    // 2. else, wait for the source to attach to the collection before resolving
    return new Promise(resolve => {
      // detach listener will be defined as we will be asynchronous
      //
      const detachListener = this.como.sourceManager.sources.onAttach(source => {
        // console.log(source.get('id'), sourceId);
        if (source.get('id') === sourceId) {
          detachListener();
          resolve();
        }
      });
    });
  }

  async deleteSource(config, nodeId = this.como.nodeId) {
    // always go though the rfc roundtrip, even if `nodeId = this.como.nodeId`,
    // to benefit from the hook logic
    // @note - this could be optimized within the Rfc logic
    return await this.como.requestRfc(nodeId, `${this.name}:deleteSource`, config);
  }

  #deleteSourceHandler = async (config) => {
    return this.#factory.deleteSource(config);
  }
}
