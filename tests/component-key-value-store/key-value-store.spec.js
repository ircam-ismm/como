import { assert } from 'chai';

import { Server } from '@soundworks/core/server.js';
import { Client } from '@soundworks/core/client.js';

import ComoClient from '../../src/core/ComoClient.js';
import ComoServer from '../../src/core/ComoServer.js';

import config from '../config.js';
import { jsonFrame } from '../fixtures.js';

describe('# key / value store', () => {
  it('should work', async () => {
    const _server = new Server(config);
    const server = new ComoServer(_server);
    await server.start();

    const _client = new Client({ role: 'test', ...config });
    const client = new ComoClient(_client);
    await client.start();

    const value0 = await server.store.set('my-key', 'my-value');
    assert.isTrue(value0);

    const value1 = await server.store.get('my-key');
    assert.equal(value1, 'my-value');

    const value2 = await client.store.get('my-key');
    assert.equal(value2, 'my-value');

    await client.store.set('como-frame', jsonFrame);
    const value3 = await client.store.get('como-frame');
    assert.deepEqual(value3, jsonFrame);

    // const value3 = await client.store.delete('my-key');
    // assert.isTrue(value3);

    // const value4 = await client.store.delete('my-key');
    // assert.isFalse(value4);

    // const value5 = await client.store.get('my-key');
    // assert.isUndefined(value5);

    // const value6 = await client.store.clear();
    // assert.isFalse(value6); // this is weird

    await client.stop();
    await server.stop();
  });
});
