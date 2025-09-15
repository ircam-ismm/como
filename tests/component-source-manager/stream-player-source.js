import { assert } from 'chai';
import { delay } from '@ircam/sc-utils';

import { Server } from '@soundworks/core/server.js';
import { Client } from '@soundworks/core/client.js';

// import ComoClient from '../../src/ComoClient.js';
import ComoServer from '../../src/core/ComoServer.js';

import config from '../config.js';

const DEV = false;

const stream = [
  [{ id: 'test', timestamp: 10 * (DEV ? 100 : 1), value: 1 }],
  [{ id: 'test', timestamp: 20 * (DEV ? 100 : 1), value: 2 }],
  [{ id: 'test', timestamp: 30 * (DEV ? 100 : 1), value: 3 }],
  [{ id: 'test', timestamp: 40 * (DEV ? 100 : 1), value: 4 }],
]

describe('# StreamPlayerSource', () => {
  it('loop = true', async function() {
    this.timeout(10 * 1000);

    const _server = new Server(config);
    const server = new ComoServer(_server);
    await server.start();

    await server.sourceManager.createSource({
      id: 'test',
      type: 'stream-player',
      stream,
    });

    const source = await server.sourceManager.getSource('test');
    const result = [];
    source.onUpdate(updates => {
      if ('frame' in updates) {
        result.push(updates.frame);
      }
    });

    source.set({
      loop: true,
      control: 'play',
    });

    await delay(1000);

    assert.isAbove(result.length, stream.length);
    result.forEach((frame, index) => {
      let sourceIndex = index % stream.length;
      // console.log(frame, stream[sourceIndex]);
      assert.deepEqual(frame, stream[sourceIndex]);
    });

    await server.stop();
  });
});
