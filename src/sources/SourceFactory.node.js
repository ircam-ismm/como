// @IMPORTANT
//
// This file must be imported using:
// ```
// import SourceManager from '#sources/SourceManager.js';
// ```
// To satisfy both node and the bundler, cf. package.json `imports` field
import { Server as ComoteServer } from '@ircam/comote-helpers/server.js';
import { Server as OscServer } from 'node-osc';

import ComoteSource from './ComoteSource.js';
import RiotSource from './RiotSource.js';
import AggregatedSource from './AggregatedSource.js';
import { SERVER_ID } from '../constants.js';


const oscServers = new Map(); // <port, { Server, config }>
const wsServers = new Map(); // <port, { Server, config }>
// @todo - review
const sourceStore = new Map();

export default class SourceFactory {
  constructor(como) {
    this.como = como;
  }

  async createSource(payload) {
    const { type } = payload;

    if (type === undefined) {
      throw new Error('Cannot execute "createSource" on SourceFactory: no source type given');
    }

    switch (type.toLowerCase()) {
      case 'comote': {
        // @todo - check payload
        return this.#createComoteSource(payload);
      }
      case 'riot': {
        // @todo - check payload
        return this.#createRiotSource(payload);
      }
      case 'aggregated': {
        // @todo - check payload
        return this.#createAggregatedSource(payload);
      }
      case 'osc-bridge': {
        // @todo - check payload
        return this.#createOscBridge(payload);
      }
      default: {
        throw new Error('Cannot execute "createSource" on SourceFactory: source of type "${type}" is not a valid source type for node.js runtime');
      }
    }
  }

  async deleteSource(como, payload) {
    throw new Error('@todo - node SourceFactory#deleteSource handler');
  }

  async stop() {
    for (let { server } of wsServers.values()) {
      await server.stop();
    }

    wsServers.clear();
  }

  async #createComoteSource(payload) {
    // @todo
    // - make port choice more simple and resilient: if no explicit port
    // given, just pick one randomly or reuse an existing server
    // - Using comote server may be problem to deploy online
    const { port, verbose } = payload;

    if (!wsServers.has(port)) {
      const serverConfig = { port };
      const server = new ComoteServer({ ws: serverConfig }, { verbose });
      await server.start();

      wsServers.set(port, { server, serverConfig });
    }

    const { server, serverConfig } = wsServers.get(port);
    const config = Object.assign({}, payload, serverConfig);

    const source = new ComoteSource(this.como, server, config);
    await source.init();

    sourceStore.set(source.id, source);

    return true;
  }

  async #createRiotSource(payload) {
    const { port, verbose } = payload;

    if (!oscServers.has(port)) {
      if (verbose) {
        console.log(`> como: Launching OSC server on port: ${port}`);
      }

      const serverConfig = { port };
      const server = await new Promise((resolve, reject) => {
        const oscServer = new OscServer(port, '0.0.0.0')
        oscServer.on('listening', () => {
          if (verbose) {
            console.log(`> como: OSC server listening`);
          }
          resolve(oscServer);
        });
      });

      oscServers.set(port, { server, serverConfig });
    }

    const { server, serverConfig } = oscServers.get(port);
    const config = Object.assign({}, payload, serverConfig);

    const source = new RiotSource(this.como, server, config);
    await source.init();

    sourceStore.set(source.id, source);

    return true;
  }

  async #createAggregatedSource(payload) {
    if (this.como.nodeId !== SERVER_ID) {
      throw new Error('Cannot create aggregated source, only server has this ability');
    }

    const { sourceId, sources } = payload;

    if (!Array.isArray(sources)) {
      throw new Error('Cannot create aggregated source: sources must be an array of source id');
    }

    const config = { sources, sourceId };
    const source = new AggregatedSource(this.como, config);
    await source.init();

    sourceStore.set(source.id, source);

    return true;
  }

  async #createOscBridge(payload) {
    throw new Error('@todo - osc bridge: take a source as input, and forward data through osc client');
  }
}

