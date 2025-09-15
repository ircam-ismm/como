import { assert } from 'chai';

import {
  delay
} from '@ircam/sc-utils';

import { Server } from '@soundworks/core/server.js';
import { Client } from '@soundworks/core/client.js';

import ComoClient from '../../src/core/ComoClient.js';
import ComoServer from '../../src/core/ComoServer.js';

import config from '../config.js';

describe('# Core: Remote Function Call', () => {
  let client, server;

  beforeEach(async () => {
    const _server = new Server(config);
    server = new ComoServer(_server);
    await server.start();

    const _client = new Client({ role: 'test', ...config });
    client = new ComoClient(_client);
    await client.start();
  });

  afterEach(async () => {
    await client.stop();
    await server.stop();
  });

  describe('## setRfcHandler', () => {
    it('should throw if first argument is not a string', () => {
      assert.throws(() => client.setRfcHandler(null, null));
    });

    it('should throw second argument is not a function', () => {
      assert.throws(() => client.setRfcHandler('test', null));
    });
  });

  describe('## async requestRfc', () => {
    it('should throw if first argument is not a number', async () => {
      let errored = false;

      try {
        await client.requestRfc(null, null);
      } catch (err) {
        console.log(err.message);
        errored = true;
      }

      assert.isTrue(errored);
    });

    it('should throw second argument is not a string', async () => {
      let errored = false;

      try {
        await client.requestRfc(0, null);
      } catch (err) {
        console.log(err.message);
        errored = true;
      }

      assert.isTrue(errored);
    });

    it.skip('should throw third argument is not stringifyable', async () => {
      // what is not stringifyable actually... ?
      // let errored = false;
      // class A {};
      // try {
      //   await client.requestRfc(0, 'test', new A())
      // } catch (err) {
      //   console.log(err.message);
      //   errored = true;
      // }

      // assert.isTrue(errored);
    });

    it('should execute command on the right node and resolve properly (server -> thing)', async () => {
      let result = null;

      client.setRfcHandler('test', async payload => {
        assert.deepEqual(payload, { value: true });
        await delay(50);
        return result = 42;
      });

      const returnValue = await server.requestRfc(client.nodeId, 'test', { value: true });

      assert.equal(returnValue, 42);
      assert.equal(result, 42);
    });

    it('should execute command on the right node and resolve properly (thing -> server)', async () => {
      let result = null;
      server.setRfcHandler('test', async payload => {
        assert.deepEqual(payload, { value: true });
        await delay(50);
        return result = 42;
      });

      const returnValue = await client.requestRfc(server.nodeId, 'test', { value: true });
      assert.equal(returnValue, 42);
      assert.equal(result, 42);
    });

    it('should execute command on the right node and resolve properly (thing -> thing)', async () => {
      let result = null;
      client.setRfcHandler('test', async payload => {
        assert.deepEqual(payload, { value: true });
        await delay(50);
        return result = 42;
      });

      const returnValue = await client.requestRfc(client.nodeId, 'test', { value: true });
      assert.equal(returnValue, 42);
      assert.equal(result, 42);
    });


    it('should propagate error back to requester if command handler throws (thing -> thing)', async () => {
      client.setRfcHandler('test', async payload => {
        assert.deepEqual(payload, { value: true });
        await delay(50);
        throw new Error('handler throws');
      });

      try {
        await server.requestRfc(client.nodeId, 'test', { value: true });
      } catch (err) {
        assert.equal(err.message, 'handler throws');
      }
    });
  });

  describe('## setRfcResolverHook', () => {
    it('should execute the resolve hook before fulfilling', async () => {
      let result = null;
        server.setRfcHandler('test', async payload => {
          assert.deepEqual(payload, { value: true });
          await delay(50);
          return result = 42;
        });

        let hookExecuted = false;
        client.setRfcResolverHook('test', async (err, result) => {
          await delay(100);
          hookExecuted = true;
        });

        const returnValue = await client.requestRfc(server.nodeId, 'test', { value: true });
        assert.isTrue(hookExecuted);
        assert.equal(returnValue, 42);
        assert.equal(result, 42);
    });
  });
});




