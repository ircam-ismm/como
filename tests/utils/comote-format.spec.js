import { assert } from 'chai';

import { jsonToOsc, oscToJson, getSourceAndIdFromBundle } from '../../src/utils/comote-format.js';
import { Bundle, Client, Server } from 'node-osc';

import {
  oscBundleNoFreq0,
  oscBundleNoFreq1,
  oscBundleFull,
  jsonFrame,
  jsonFrameBno055,
} from '../fixtures.js';

describe('# getSourceAndIdFromBundle', () => {
  it('should work', () => {
    const { source, id } = getSourceAndIdFromBundle(oscBundleFull);
    assert.equal(source, 'riot');
    assert.equal(id, '0');
  });
});

describe('# oscToJson / jsonToOsc', () => {
  it('should work - default', () => {
    const json = oscToJson(oscBundleFull);
    // frequency estimation
    assert.deepEqual(json, jsonFrame);
    // convert back to osc
    const osc = jsonToOsc(json);

    osc.forEach(msg => {
      const expected = oscBundleFull.elements.find(el => el[0] === msg[0]);

      if (!expected) {
        console.log(msg, 'not found');
        assert.fail();
      }

      assert.deepEqual(msg, expected);
    });
  });

  it('should estimate frequency if not found in OSC bundle', () => {
    const nullFrame = oscToJson(oscBundleNoFreq0);
    assert.isNull(nullFrame); // required to estimate missing frequency with current Riot frame
    const json = oscToJson(oscBundleNoFreq1);
    // frequency estimation
    assert.equal(json.accelerometer.frequency, 100);
    assert.deepEqual(json, jsonFrame);
    // convert back to osc
    const osc = jsonToOsc(json);

    osc.forEach(msg => {
      const expected = oscBundleNoFreq1.elements.find(el => el[0] === msg[0]);

      if (!expected) {
        console.log(msg, 'not found');
        assert.fail();
      }

      // push estimated frequency in result, except for control
      if (!expected[0].includes('control')) {
        expected.push(100);
      }

      assert.deepEqual(msg, expected);
    });
  });

  it('oscToJson - useBno055 = true', () => {
    const json = oscToJson(oscBundleFull, { useBno055: true });
    // frequency estimation
    assert.equal(json.accelerometer.frequency, 100);
    assert.deepEqual(json, jsonFrameBno055);
  });

  it('jsonToOsc - asNodeOscBundle = true', async () => {
    const bundle = jsonToOsc(jsonFrame, { asNodeOscBundle: true });
    assert.isTrue(bundle instanceof Bundle);

    return new Promise(resolve => {
      const server = new Server(8888, '0.0.0.0');
      const client = new Client('127.0.0.1', 8888);
      server.on('bundle', (bundle) => {
        bundle.elements.forEach(msg => {
          const expected = oscBundleFull.elements.find(el => el[0] === msg[0]);

          if (!expected) {
            console.log(msg, 'not found');
            assert.fail();
          }

          assert.deepEqual(msg, expected);
        });

        server.close();
        client.close();
        resolve();
      });
      client.send(bundle);
    });
  });
});


