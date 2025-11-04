import {
  AudioBufferLoader,
} from '@ircam/sc-audio';

import ComoComponent from '../../core/ComoComponent.js';


// IMPORTANT
// For now we just load everything based on the state of the filesystem
// and deliver the buffers on demand

export default class SoundbankManager extends ComoComponent {
  #filesystem;
  #audioBufferLoader;
  #buffers = {};

  constructor(como, name) {
    super(como, name);
  }

  get filesystem() {
    return this.#filesystem;
  }

  async start() {
    await super.start();

    const runtime = this.como.runtime;
    let serverAddress = null;

    if (runtime === 'node') {
      const env = this.como.host.config.env;
      serverAddress = `${env.useHttps ? 'https' : 'http'}://${env.serverAddress || '127.0.0.1'}:${env.port}`;
      if (env.baseUrl) {
        serverAddress += env.baseUrl;
      }
    }

    // @todo
    // - lazily load on demand
    // - on node runtime, load from filesystem whenever possible
    // cf. https://github.com/collective-soundworks/soundworks-plugin-filesystem/issues/11
    this.#audioBufferLoader = new AudioBufferLoader(this.como.audioContext, serverAddress);

    this.#filesystem = await this.como.pluginManager.get(`${this.name}:filesystem`);
    this.#filesystem.onUpdate(async ({ tree }) => {
      if (tree === null) {
        this.#buffers = {};
        return;
      }

      const urlMap = this.getTreeAsUrlMap();
      const current = Object.keys(this.#buffers);
      const next = Object.keys(urlMap);
      const toAdd = next.filter(i => !current.includes(i));
      const toRemove = current.filter(i => !next.includes(i));
      // clean current loaded buffers
      toRemove.forEach(name => delete this.#buffers[name])
      // add new buffers
      for (let name in urlMap) {
        if (!toAdd.includes(name)) {
          delete urlMap[name];
        }
      }

      const loaded = await this.#audioBufferLoader.load(urlMap);
      Object.assign(this.#buffers, loaded);
    }, true);
  }

  // getTree() {
  //   return this.filesystem.getTree();
  // }

  getTreeAsUrlMap() {
    // return only wav and mp3 files by default
    return this.filesystem.getTreeAsUrlMap('wav|mp3', true);
  }

  onUpdate(...args) {
    return this.filesystem.onUpdate(...args);
  }

  async getBuffers(fileList) {
    return fileList.reduce((acc, name) => {
      acc[name] = this.#buffers[name];
      return acc;
    }, {});
  }
}
