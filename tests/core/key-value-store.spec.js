import { assert } from 'chai';

import { Server } from '@soundworks/core/server.js';
import { Client } from '@soundworks/core/client.js';

import ComoClient from '../../src/ComoClient.js';
import ComoServer from '../../src/ComoServer.js';

import { jsonFrame } from '../fixtures.js';

const config = {
  env: {
    port: 9880,
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
};

describe('# key / value store', () => {
  it('should work', async () => {
    const _server = new Server(config);
    const server = new ComoServer(_server);
    await server.start();

    const _client = new Client({ role: 'test', ...config });
    const client = new ComoClient(_client);
    await client.start();

    const value0 = await server.keyValueStore.set('my-key', 'my-value');
    assert.isTrue(value0);

    const value1 = await server.keyValueStore.get('my-key');
    assert.equal(value1, 'my-value');

    const value2 = await client.keyValueStore.get('my-key');
    assert.equal(value2, 'my-value');

    await client.keyValueStore.set('como-frame', jsonFrame);
    const value3 = await client.keyValueStore.get('como-frame');
    assert.deepEqual(value3, jsonFrame);

    // const value3 = await client.keyValueStore.delete('my-key');
    // assert.isTrue(value3);

    // const value4 = await client.keyValueStore.delete('my-key');
    // assert.isFalse(value4);

    // const value5 = await client.keyValueStore.get('my-key');
    // assert.isUndefined(value5);

    // const value6 = await client.keyValueStore.clear();
    // assert.isFalse(value6); // this is weird

    await client.stop();
    await server.stop();
  });
});
