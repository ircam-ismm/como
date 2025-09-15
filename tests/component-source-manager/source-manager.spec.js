import { assert } from 'chai';
import fs from 'node:fs';

import { delay } from '@ircam/sc-utils';

import { Server } from '@soundworks/core/server.js';
import { Client } from '@soundworks/core/client.js';

import ComoClient from '../../src/core/ComoClient.js';
import ComoServer from '../../src/core/ComoServer.js';

import config from '../config.js';

const streamStr = fs.readFileSync('tests/stream-test.txt').toString();

describe('# SourceManager', () => {
  let client, server;

  const configs = {
    comote: {
      type: 'comote',
      id: 'comote-test',
      port: 9881,
      verbose: false,
    },
    riot: {
      type: 'riot',
      id: 'riot-test',
      port: 9881,
      verbose: false,
    },
    streamPlayer: {
      type: 'stream-player',
      id: 'stream-player-test',
      stream: streamStr,
      verbose: false,
    },
    aggregated: {
      type: 'aggregated',
      id: 'aggregated-test',
      sources: ['comote-test', 'riot-test'],
      verbose: false,
    },
    oscBridge: {
      type: 'osc-bridge',
      id: 'osc-bridge-test',
      source: 'riot-test',
      verbose: false,
    },
  };

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

  describe(`## createSource`, () => {

    describe(`### comote`, () => {
      const config = configs.comote;

      it(`should create a source locally`, async () => {
        const sourceId = await client.sourceManager.createSource(config);
        assert.equal(sourceId, config.id);

        {
          const source = await server.sourceManager.getSource(config.id);
          assert.isNotNull(source);
          assert.equal(source.get('id'), config.id);
          assert.equal(source.get('type'), config.type);
          assert.equal(source.get('nodeId'), client.nodeId);
        }

        {
          const source = await client.sourceManager.getSource(config.id);
          assert.isNotNull(source);
          assert.equal(source.get('id'), config.id);
          assert.equal(source.get('type'), config.type);
          assert.equal(source.get('nodeId'), client.nodeId);
        }
      });

      it(`should create a source through rfc`, async () => {
        const sourceId = await client.sourceManager.createSource(config, server.nodeId);
        assert.equal(sourceId, config.id);

        {
          const source = await server.sourceManager.getSource(config.id);
          assert.isNotNull(source);
          assert.equal(source.get('id'), config.id);
          assert.equal(source.get('type'), config.type);
          assert.equal(source.get('nodeId'), server.nodeId);
        }

        {
          const source = await client.sourceManager.getSource(config.id);
          assert.isNotNull(source);
          assert.equal(source.get('id'), config.id);
          assert.equal(source.get('type'), config.type);
          assert.equal(source.get('nodeId'), server.nodeId);
        }
      });

      it.skip('should throw on invalid config', () => {

      });
    });

    describe(`### riot`, () => {
      const config = configs.riot;

      it(`should create a source locally`, async () => {
        const sourceId = await client.sourceManager.createSource(config);
        assert.equal(sourceId, config.id);

        {
          const source = await server.sourceManager.getSource(config.id);
          assert.isNotNull(source);
          assert.equal(source.get('id'), config.id);
          assert.equal(source.get('type'), config.type);
          assert.equal(source.get('nodeId'), client.nodeId);
        }

        {
          const source = await client.sourceManager.getSource(config.id);
          assert.isNotNull(source);
          assert.equal(source.get('id'), config.id);
          assert.equal(source.get('type'), config.type);
          assert.equal(source.get('nodeId'), client.nodeId);
        }
      });

      it(`should create a source through rfc`, async () => {
        const sourceId = await client.sourceManager.createSource(config, server.nodeId);
        assert.equal(sourceId, config.id);

        {
          const source = await server.sourceManager.getSource(config.id);
          assert.isNotNull(source);
          assert.equal(source.get('id'), config.id);
          assert.equal(source.get('type'), config.type);
          assert.equal(source.get('nodeId'), server.nodeId);
        }

        {
          const source = await client.sourceManager.getSource(config.id);
          assert.isNotNull(source);
          assert.equal(source.get('id'), config.id);
          assert.equal(source.get('type'), config.type);
          assert.equal(source.get('nodeId'), server.nodeId);
        }
      });

      it.skip('should throw on invalid config', () => {

      });
    });

    describe(`### stream-player`, () => {
      const config = configs.streamPlayer;

      it(`should create a source locally`, async () => {
        const sourceId = await client.sourceManager.createSource(config);
        assert.equal(sourceId, config.id);

        {
          const source = await server.sourceManager.getSource(config.id);
          assert.isNotNull(source);
          assert.equal(source.get('id'), config.id);
          assert.equal(source.get('type'), config.type);
          assert.equal(source.get('nodeId'), client.nodeId);
        }

        {
          const source = await client.sourceManager.getSource(config.id);
          assert.isNotNull(source);
          assert.equal(source.get('id'), config.id);
          assert.equal(source.get('type'), config.type);
          assert.equal(source.get('nodeId'), client.nodeId);
        }
      });

      it(`should create a source through rfc`, async () => {
        const sourceId = await client.sourceManager.createSource(config, server.nodeId);
        assert.equal(sourceId, config.id);

        {
          const source = await server.sourceManager.getSource(config.id);
          assert.isNotNull(source);
          assert.equal(source.get('id'), config.id);
          assert.equal(source.get('type'), config.type);
          assert.equal(source.get('nodeId'), server.nodeId);
        }

        {
          const source = await client.sourceManager.getSource(config.id);
          assert.isNotNull(source);
          assert.equal(source.get('id'), config.id);
          assert.equal(source.get('type'), config.type);
          assert.equal(source.get('nodeId'), server.nodeId);
        }
      });

      it.skip('should throw on invalid config', () => {

      });
    });

    describe('### aggregated', () => {
      it(`should create a source locally`, async () => {
        await client.sourceManager.createSource(configs.riot);
        await client.sourceManager.createSource(configs.comote);

        const sourceId = await server.sourceManager.createSource(configs.aggregated);
        assert.equal(sourceId, configs.aggregated.id);

        {
          const source = await server.sourceManager.getSource(configs.aggregated.id);
          assert.isNotNull(source);
          assert.equal(source.get('id'), configs.aggregated.id);
          assert.equal(source.get('nodeId'), server.nodeId);
        }

        // make sure the collection update has been propagated
        await delay(10);

        {
          const source = await client.sourceManager.getSource(configs.aggregated.id);
          assert.isNotNull(source);
          assert.equal(source.get('id'), configs.aggregated.id);
          assert.equal(source.get('nodeId'), server.nodeId);
        }
      });

      it(`should create a source through rfc`, async () => {
        await client.sourceManager.createSource(configs.riot);
        await client.sourceManager.createSource(configs.comote);

        const sourceId = await client.sourceManager.createSource(configs.aggregated, server.nodeId);
        assert.equal(sourceId, configs.aggregated.id);

        {
          const source = await server.sourceManager.getSource(configs.aggregated.id);
          assert.isNotNull(source);
          assert.equal(source.get('id'), configs.aggregated.id);
          assert.equal(source.get('nodeId'), server.nodeId);
        }

        {
          const source = await client.sourceManager.getSource(configs.aggregated.id);
          assert.isNotNull(source);
          assert.equal(source.get('id'), configs.aggregated.id);
          assert.equal(source.get('nodeId'), server.nodeId);
        }
      });

      it.skip('should throw if target node is not server', () => {

      });

      it.skip('should throw if input source does not exists', () => {

      });

      it.skip('should throw on invalid config', () => {

      });
    });

    describe('### osc-bridge', () => {
      it(`should create a source locally`, async () => {
        await client.sourceManager.createSource(configs.riot);
        const sourceId = await client.sourceManager.createSource(configs.oscBridge);
        assert.equal(sourceId, configs.oscBridge.id);

        {
          const source = await server.sourceManager.getSource(configs.oscBridge.id);
          assert.isNotNull(source);
          assert.equal(source.get('id'), configs.oscBridge.id);
          assert.equal(source.get('nodeId'), client.nodeId);
        }

        {
          const source = await client.sourceManager.getSource(configs.oscBridge.id);
          assert.isNotNull(source);
          assert.equal(source.get('id'), configs.oscBridge.id);
          assert.equal(source.get('nodeId'), client.nodeId);
        }
      });

      it(`should create a through rfc`, async () => {
        await client.sourceManager.createSource(configs.riot);
        const sourceId = await client.sourceManager.createSource(configs.oscBridge, server.nodeId);
        assert.equal(sourceId, configs.oscBridge.id);

        {
          const source = await server.sourceManager.getSource(configs.oscBridge.id);
          assert.isNotNull(source);
          assert.equal(source.get('id'), configs.oscBridge.id);
          assert.equal(source.get('nodeId'), server.nodeId);
        }

        {
          const source = await client.sourceManager.getSource(configs.oscBridge.id);
          assert.isNotNull(source);
          assert.equal(source.get('id'), configs.oscBridge.id);
          assert.equal(source.get('nodeId'), server.nodeId);
        }
      });

      it.skip('should throw if input source does not exists', () => {

      });
    });

    it(`should throw if two sources are created with the same id (1)`, async () => {
      await server.sourceManager.createSource(configs.riot);
      let errored = false;

      try {
        await server.sourceManager.createSource(configs.riot);
      } catch (err) {
        console.log(err.message);
        errored = true;
      }

      assert.isTrue(errored);
    });

    it(`should throw if two sources are created with the same id (2)`, async () => {
      await client.sourceManager.createSource(configs.riot);
      let errored = false;

      try {
        await client.sourceManager.createSource(configs.riot);
      } catch (err) {
        console.log(err.message);
        errored = true;
      }

      assert.isTrue(errored);
    });
  });

  describe(`## getSource`, () => {
    it('should be able to create a source and get it right after on same node', async () => {
      const sourceId = await client.sourceManager.createSource(configs.riot);
      const source = client.sourceManager.getSource(sourceId);
      assert.isNotNull(source);
    });
  });
});




