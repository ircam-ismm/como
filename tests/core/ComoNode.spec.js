import { assert } from 'chai';
import { delay } from '@ircam/sc-utils';

import { Server } from '@soundworks/core/server.js';
import { Client } from '@soundworks/core/client.js';

import ComoClient from '../../src/core/ComoClient.js';
import ComoServer from '../../src/core/ComoServer.js';

import config from '../config.js';

describe('# ComoNode', () => {
  it('should start and stop properly (1)', async () => {
    const _server = new Server(config);
    const server = new ComoServer(_server);
    await server.start();

    const _client = new Client({ role: 'test', ...config });
    const client = new ComoClient(_client);
    await client.start();

    assert.isFinite(client.nodeId, 0);
    assert.equal(client.runtime, 'node');
    assert.equal(client.role, 'test');
    assert.notEqual(client.id, client.nodeId);
    assert.notEqual(client.id, client.runtime);
    assert.notEqual(client.id, client.role);

    assert.equal(server.nodeId, -1);
    assert.equal(server.runtime, 'node');
    assert.equal(server.role, 'server');
    assert.notEqual(server.id, server.nodeId);
    assert.notEqual(server.id, server.runtime);
    // assert.notEqual(server.id, server.role);

    await client.stop();
    await server.stop();
  });
});
