import { assert } from 'chai';

import { delay } from '@ircam/sc-utils';

import { Server } from '@soundworks/core/server.js';
import { Client } from '@soundworks/core/client.js';

import ComoClient from '../../src/ComoClient.js';
import ComoServer from '../../src/ComoServer.js';

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
}

describe('# Commands: createSource', () => {
  describe('## Comote source', () => {
    it.only('should create a source on the right node - server', async () => {
      const pkServer = new Server(config);
      const server = new ComoServer(pkServer);
      await server.start();

      const pkClient = new Client({ role: 'test', ...config });
      const client = new ComoClient(pkClient);
      await client.start();

      const sourceId = 'comote-test';

      await client.requestCommand(server.nodeId, 'createSource', {
        type: 'comote',
        sourceId,
        port: 9881,
        verbose: true,
      });

      // we can't really guarantee synchrony there as getSource relies on the
      // source to be added in the collection which is another network roundtrip
      // @todo - define if it can become a problem (to be fixed soundworks wise)
      await delay(10);

      {
        const source = await server.sourceManager.getSource(sourceId);
        assert.isNotNull(source);
        assert.equal(source.get('id'), sourceId);
      }

      {
        const source = await client.sourceManager.getSource(sourceId);
        assert.isNotNull(source);
        assert.equal(source.get('id'), sourceId);
      }

      await client.stop();
      await server.stop();
    });

    // it('should fail if target node is a web client', () => {

    // });
  });
});




