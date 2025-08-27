import { assert } from 'chai';

import {
  delay
} from '@ircam/sc-utils';

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

describe('# Commands: createSource', () => {
  describe('## Comote source', () => {
    it('should execute command on the right node and resolve properly (server -> thing)', async () => {
      const _server = new Server(config);
      const server = new ComoServer(_server);
      await server.start();

      const _client = new Client({ role: 'test', ...config });
      const client = new ComoClient(_client);
      await client.start();

      let result = null;

      client.setCommandHandler('test', async payload => {
        assert.deepEqual(payload, { value: true });
        await delay(50);
        return result = 42;
      });

      const returnValue = await server.requestCommand(client.nodeId, 'test', { value: true });

      assert.equal(returnValue, 42);
      assert.equal(result, 42);

      await client.stop();
      await server.stop();
    });

    it('should execute command on the right node and resolve properly (thing -> server)', async () => {
      const _server = new Server(config);
      const server = new ComoServer(_server);
      await server.start();

      const _client = new Client({ role: 'test', ...config });
      const client = new ComoClient(_client);
      await client.start();

      let result = null;
      server.setCommandHandler('test', async payload => {
        assert.deepEqual(payload, { value: true });
        await delay(50);
        return result = 42;
      });

      const returnValue = await client.requestCommand(server.nodeId, 'test', { value: true });
      assert.equal(returnValue, 42);
      assert.equal(result, 42);

      await client.stop();
      await server.stop();
    });

    it('should execute command on the right node and resolve properly (thing -> thing)', async () => {
      const _server = new Server(config);
      const server = new ComoServer(_server);
      await server.start();

      const _client = new Client({ role: 'test', ...config });
      const client = new ComoClient(_client);
      await client.start();

      let result = null;
      client.setCommandHandler('test', async payload => {
        assert.deepEqual(payload, { value: true });
        await delay(50);
        return result = 42;
      });

      const returnValue = await client.requestCommand(client.nodeId, 'test', { value: true });
      assert.equal(returnValue, 42);
      assert.equal(result, 42);

      await client.stop();
      await server.stop();
    });


    it('should propagate error back to requester if command handler throws (thing -> thing)', async () => {
      const _server = new Server(config);
      const server = new ComoServer(_server);
      await server.start();

      const _client = new Client({ role: 'test', ...config });
      const client = new ComoClient(_client);
      await client.start();

      let result = null;
      client.setCommandHandler('test', async payload => {
        assert.deepEqual(payload, { value: true });
        await delay(50);
        throw new Error('handler throws');
      });

      try {
        await server.requestCommand(client.nodeId, 'test', { value: true });
      } catch (err) {
        assert.equal(err.message, 'handler throws');
      }

      await client.stop();
      await server.stop();
    });
  });
});




