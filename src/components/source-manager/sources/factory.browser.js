// @IMPORTANT
//
// This file must be imported using:
// ```
// import SourceManager from '#sources/SourceManager.js';
// ```
// To satisfy both node and the bundler, cf. package.json `imports` field

import StreamPlayerSource from "./sources/StreamPlayerSource.js";
// @todo - review
const sourceStore = new Map();

export default class SourceFactory {
  constructor(como) {
    this.como = como;
  }

  async createSource(config) {
    const { type } = config;

    if (type === undefined) {
      throw new Error('Cannot execute "createSource" on SourceFactory: no source type given');
    }

    switch (type.toLowerCase()) {
      case 'stream-player': {
        return await this.#createStreamPlayerSource(config);
      }
      default: {
        throw new Error(`Cannot execute "createSource" on SourceFactory: source of type "${type}" is not a valid source type for browser runtime`);
      }
    }
  }

  async deleteSource(como, config) {
    throw new Error('@todo - browser SourceFactory#deleteSource handler');
  }

  async stop() {
    // @todo - delete all sources
    // something else to do ?
    throw new Error('@todo - browser SourceFactory#stop not implemented');
  }

  // common node / browser
  async #createStreamPlayerSource(config) {
    const source = new StreamPlayerSource(this.como, config);
    await source.init();

    sourceStore.set(source.id, source);

    return source.id;
  }
}
