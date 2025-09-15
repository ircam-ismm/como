import { assert } from 'chai';
import { delay } from '@ircam/sc-utils';

import { Server } from '@soundworks/core/server.js';
import { Client } from '@soundworks/core/client.js';

import ComoClient from '../../src/core/ComoClient.js';
import ComoServer from '../../src/core/ComoServer.js';

import config from '../config.js';

describe('# Core: Lifecycle', () => {
  it('should start and stop properly (1)', async () => {
    const _server = new Server(config);
    const server = new ComoServer(_server);
    await server.start();

    const _client = new Client({ role: 'test', ...config });
    const client = new ComoClient(_client);
    await client.start();

    await client.stop();
    await server.stop();
  });

  it('should start and stop properly (2) - client stops after server', async () => {
    const _server = new Server(config);
    const server = new ComoServer(_server);
    await server.start();

    const _client = new Client({ role: 'test', ...config });
    const client = new ComoClient(_client);
    await client.start();

    await server.stop();
    await delay(10);
    await client.stop();
  });
});
