import { assert } from 'chai';
import { delay } from '@ircam/sc-utils';

import { Server } from '@soundworks/core/server.js';
import { Client } from '@soundworks/core/client.js';

import ComoClient from '../../src/ComoClient.js';
import ComoServer from '../../src/ComoServer.js';

const config = {
  env: {
    port: 8081,
    serverAddress: '127.0.0.1',
    useHttps: false,
    verbose: false,
  },
  app: {
    clients: {
      'test': {
        runtime: 'node',
      },
    },
  }
}

describe('# Core', () => {
  it('should start and stop properly', async () => {
    const _server = new Server(config);
    const server = new ComoServer(_server);
    await server.start();

    const _client = new Client({ role: 'test', ...config });
    const client = new ComoClient(_client);
    await client.start();

    await client.stop();
    await server.stop();
  });

  // this one crashes for an unknown reason... a priori, not a soundworks issue
  it.only('should start and stop properly - client after server', async () => {
    const server = new Server(config);
    // const server = new ComoServer(_server);
    await server.start();

    const client = new Client({ role: 'test', ...config });
    // const client = new ComoClient(_client);
    await client.start();

    await server.stop();
    await delay(500);
    await client.stop();
  });

  // it('should start and stop properly', async () => {
  //   const server = new Server(config);
  //   // const server = new ComoServer(_server);
  //   await server.start();

  //   const client = new Client({ role: 'test', ...config });
  //   // const client = new ComoClient(_client);
  //   await client.start();

  //   await server.stop();
  //   await client.stop();
  // });
});
