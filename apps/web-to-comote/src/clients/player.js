import '@soundworks/helpers/polyfills.js';
import { Client } from '@soundworks/core/client.js';
import { loadConfig, launcher } from '@soundworks/helpers/browser.js';
import { html, render } from 'lit';
import { getTime } from '@ircam/sc-utils';

import ClientPluginPlatformInit from '@soundworks/plugin-platform-init/client.js';
import ClientPluginLogger from '@soundworks/plugin-logger/client.js';

import devicemotion from '@ircam/devicemotion';
import {
  Gravity
} from '@ircam/sc-motion/gravity.js';
import {
  devicemotionToAccelerometerGyroscope,
  degreeToRadian,
} from '@ircam/sc-motion/format.js';

// - General documentation: https://soundworks.dev/
// - API documentation:     https://soundworks.dev/api
// - Issue Tracker:         https://github.com/collective-soundworks/soundworks/issues
// - Wizard & Tools:        `npx soundworks`

async function main($container) {
  const config = loadConfig();
  const client = new Client(config);

  // Eventually register plugins
  client.pluginManager.register('platform-init', ClientPluginPlatformInit, {
    devicemotion
  });
  client.pluginManager.register('recorder', ClientPluginLogger, {

  });

  // cf. https://soundworks.dev/tools/helpers.html#browserlauncher
  launcher.register(client, { initScreensContainer: $container });

  await client.start();

  const sensor = await client.stateManager.create('sensor', {
    id: 'my-source',
  });

  // Notes
  // - deviceorientation is not regular

  // https://w3c.github.io/orientation-sensor/#create-a-quaternion-from-euler-angles
  function orientationToAbsoluteOrientation(orientation) {
    const alphaInRadians = degreeToRadian(orientation.alpha);
    const betaInRadians = degreeToRadian(orientation.beta);
    const gammaInRadians = degreeToRadian(orientation.gamma);
    // Let cosZ be the cosine of (0.5 * alphaInRadians).
    const cosZ = Math.cos(0.5 * alphaInRadians);
    // Let sinZ be the sine of (0.5 * alphaInRadians).
    const sinZ = Math.sin(0.5 * alphaInRadians);
    // Let cosX be the cosine of (0.5 * betaInRadians).
    const cosX = Math.cos(0.5 * betaInRadians);
    // Let sinX be the sine of (0.5 * betaInRadians).
    const sinX = Math.sin(0.5 * betaInRadians);
    // Let cosY be the cosine of (0.5 * gammaInRadians).
    const cosY = Math.cos(0.5 * gammaInRadians);
    // Let sinY be the sine of (0.5 * gammaInRadians).
    const sinY = Math.sin(0.5 * gammaInRadians);
    // Let quaternionX be (sinX * cosY * cosZ - cosX * sinY * sinZ).
    const quaternionX = sinX * cosY * cosZ - cosX * sinY * sinZ
    // Let quaternionY be (cosX * sinY * cosZ + sinX * cosY * sinZ).
    const quaternionY = cosX * sinY * cosZ + sinX * cosY * sinZ;
    // Let quaternionZ be (cosX * cosY * sinZ + sinX * sinY * cosZ).
    const quaternionZ = cosX * cosY * sinZ + sinX * sinY * cosZ;
    // Let quaternionW be (cosX * cosY * cosZ - sinX * sinY * sinZ).
    const quaternionW = cosX * cosY * cosZ - sinX * sinY * sinZ;
    // Return « quaternionX, quaternionY, quaternionZ, quaternionW ».
    return {
      euler: structuredClone(orientation),
      quaternion: [quaternionX, quaternionY, quaternionZ, quaternionW],
    };
  }

  const comoteEventHeader = {
    source: 'web',
    api: 'v3',
    id: 'in-progress',
  }
  const gravityProcessor = new Gravity({ outputApi: 'v3'});
  const deviceorientation = { alpha: 0, beta: 0, gamma: 0 };
  //
  window.addEventListener('deviceorientation', e => {
    // update
    deviceorientation.alpha = e.alpha;
    deviceorientation.beta = e.beta;
    deviceorientation.gamma = e.gamma;
  });

  // this our "regular"
  devicemotion.addEventListener(e => {
    const timestamp = getTime();
    const interval = e.interval;
    const frequency = 1 / (interval / 1000);

    const {
      accelerometer,
      gyroscope,
    } = devicemotionToAccelerometerGyroscope({
      accelerationIncludingGravity: e.accelerationIncludingGravity,
      rotationRate: e.rotationRate,
      // how to use "extra" ?
    });

    accelerometer.timestamp = timestamp;
    accelerometer.frequency = frequency;
    gyroscope.timestamp = timestamp;
    gyroscope.frequency = frequency;

    const { gravity } = gravityProcessor.process({
      api: 'v3',
      sampleTime: timestamp, // this is inconsistent with `timestamp`
      accelerometer,
      gyroscope,
    });
    gravity.timestamp = timestamp;
    gravity.frequency = frequency;

    const absoluteOrientation = orientationToAbsoluteOrientation(deviceorientation);
    absoluteOrientation.timestamp = timestamp;
    absoluteOrientation.frequency = frequency;

    const comoteEvent = {
      ...comoteEventHeader,
      accelerometer,
      gyroscope,
      gravity,
      absoluteOrientation,
    }
    // console.log(sensor);
    sensor.set('data', comoteEvent);
  });

  // let writer;
  // sensor.onUpdate(updates => {
  //   for (let [key, value] of Object.entries(updates)) {
  //     switch (key) {
  //       case 'record': {
  //         if (value) {
  //           // writer =
  //         }
  //         break;
  //       }
  //     }
  //   }

    renderApp();
  }, true);

  function renderApp() {
    render(html`
      <div class="simple-layout">
        <pre><code>${JSON.stringify(sensor.get('data'), null, 2)}</code></pre>

        <sw-credits .infos="${client.config.app}"></sw-credits>
      </div>
    `, $container);
  }
}

// The launcher allows to launch multiple clients in the same browser window
// e.g. `http://127.0.0.1:8000?emulate=10` to run 10 clients side-by-side
launcher.execute(main, {
  numClients: parseInt(new URLSearchParams(window.location.search).get('emulate') || '') || 1,
});
