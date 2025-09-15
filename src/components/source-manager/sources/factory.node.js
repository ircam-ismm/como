// @IMPORTANT
//
// This file must be imported using:
// ```
// import SourceManager from '#sources/SourceManager.js';
// ```
// To satisfy both node and the bundler, cf. package.json `imports` field
import {
  Server as ComoteServer
} from '@ircam/comote-helpers/server.js';
import {
  Server as OscServer,
  Client as OscClient
} from 'node-osc';

import ComoteSource from './ComoteSource.js';
import RiotSource from './RiotSource.js';
import AggregatedSource from './AggregatedSource.js';
import OscBridgeSource from './OscBridgeSource.js';
import StreamPlayerSource from './StreamPlayerSource.js';

export default class SourceFactory {
  #oscServers = new Map(); // <port, { Server, config }>
  #oscClients = new Map(); // <ip:port, { Server, config }>
  #wsServers = new Map(); // <port, { Server, config }>
  // @todo - review
  #store = new Map();

  constructor(como) {
    this.como = como;
  }

  async createSource(config) {
    const { type } = config;

    if (type === undefined) {
      throw new Error('Cannot execute "createSource" on SourceFactory: no source type given');
    }

    switch (type.toLowerCase()) {
      case 'comote': {
        // @todo - check config
        return await this.#createComoteSource(config);
      }
      case 'riot': {
        // @todo - check config
        return await this.#createRiotSource(config);
      }
      case 'aggregated': {
        // @todo - check config
        return await this.#createAggregatedSource(config);
      }
      case 'osc-bridge': {
        // @todo - check config
        return await this.#createOscBridge(config);
      }
      case 'stream-player': {
        return await this.#createStreamPlayerSource(config);
      }
      default: {
        throw new Error(`Cannot execute "createSource" on SourceFactory: source of type "${type}" is not a valid source type for Node.js runtime`);
      }
    }
  }

  async deleteSource(como, config) {
    throw new Error('@todo - node SourceFactory#deleteSource handler');
  }

  async stop() {
    for (let source of this.#store.values()) {
      await source.delete();
    }

    for (let server of this.#wsServers.values()) {
      await server.stop();
    }

    for (let client of this.#oscClients.values()) {
      await client.close();
    }

    for (let server of this.#oscServers.values()) {
      await server.close();
    }

    this.#store.clear();
    this.#wsServers.clear();
    this.#oscClients.clear();
    this.#oscServers.clear();
  }

  async #createComoteSource(config) {
    // @todo
    // - make port choice more simple and resilient: if no explicit port
    // given, just pick one randomly or reuse an existing server
    // - Using comote server may be problem to deploy online
    const { port } = config;

    if (!this.#wsServers.has(port)) {
      const server = new ComoteServer({
        ws: { port },
      }, {
        verbose: config.verbose,
      });
      await server.start();

      this.#wsServers.set(port, server);
    }

    const server = this.#wsServers.get(port);
    const source = new ComoteSource(this.como, server, config);
    await source.init();

    this.#store.set(source.id, source);
    return source.id;
  }

  async #createRiotSource(config) {
    const { port } = config;

    if (!this.#oscServers.has(port)) {
      if (config.verbose) {
        console.log(`> como: Launching OSC server on port: ${port}`);
      }

      const server = await new Promise((resolve, reject) => {
        const oscServer = new OscServer(port, '0.0.0.0')
        oscServer.on('listening', () => {
          if (config.verbose) {
            console.log(`> como: OSC server listening`);
          }
          resolve(oscServer);
        });
      });

      this.#oscServers.set(port, server);
    }

    const server = this.#oscServers.get(port);
    const source = new RiotSource(this.como, server, config);
    await source.init();

    this.#store.set(source.id, source);

    return source.id;
  }

  async #createAggregatedSource(config) {
    if (this.como.nodeId !== this.como.constants.SERVER_ID) {
      throw new Error('Cannot create aggregated source, only the server (id: -1) has this ability');
    }

    if (!Array.isArray(config.sources)) {
      throw new Error('Cannot create aggregated source: sources must be an array of source id');
    }

    const source = new AggregatedSource(this.como, config);
    await source.init();

    this.#store.set(source.id, source);

    return source.id;
  }

  async #createOscBridge(config) {
    const { destIp, destPort } = config;

    const key = `${destIp}:${destPort}`;

    if (!this.#oscClients.has(key)) {
      const client = new OscClient(destIp, destPort);
      this.#oscClients.set(key, client);
    }

    const oscClient = this.#oscClients.get(key);

    const source = new OscBridgeSource(this.como, oscClient, config);
    await source.init();

    this.#store.set(source.id, source);

    return source.id
  }

  // common node / browser
  async #createStreamPlayerSource(config) {
    const source = new StreamPlayerSource(this.como, config);
    await source.init();

    this.#store.set(source.id, source);

    return source.id;
  }
}

