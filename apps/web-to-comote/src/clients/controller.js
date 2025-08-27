import '@soundworks/helpers/polyfills.js';
import { Client } from '@soundworks/core/client.js';
import { loadConfig, launcher } from '@soundworks/helpers/browser.js';
import { html, render } from 'lit';

import '../components/como-sensor.js';
import '../components/como-sensor-3d.js';

import '@ircam/sc-components';

// - General documentation: https://soundworks.dev/
// - API documentation:     https://soundworks.dev/api
// - Issue Tracker:         https://github.com/collective-soundworks/soundworks/issues
// - Wizard & Tools:        `npx soundworks`

async function main($container) {
  const config = loadConfig();
  const client = new Client(config);

  // cf. https://soundworks.dev/tools/helpers.html#browserlauncher
  launcher.register(client, {
    initScreensContainer: $container,
    reloadOnVisibilityChange: false,
  });

  await client.start();

  const sensors = await client.stateManager.getCollection('sensor');
  console.log(sensors.size);

  sensors.onAttach(renderApp, true);
  sensors.onDetach(renderApp, true);

  function renderApp() {
    render(html`
      <div class="controller-layout">
        <header>
          <h1>${client.config.app.name} | ${client.role}</h1>
          <sw-audit .client="${client}"></sw-audit>
        </header>
        <section>
          ${sensors.map(sensor => {
            return html`
              <div>
                <sc-text>sensor id: ${sensor.get('id')}</sc-text>
              </div>
              <como-sensor .source=${sensor}></como-sensor>
              <como-sensor-3d .source=${sensor}></como-sensor-3d>
              <div>
                <sc-text>record</sc-text>
                <sc-text editable
                  @change=${e => sensor.set('recordingFilename', e.detail.value)}
                >filename</sc-text>
                <sc-toggle
                  @change=${e => sensor.set('record', e.detail.value)}
                ></sc-toggle>
              </div>
            `;
          })}
        </section>
      </div>
    `, $container);
  }

  renderApp();
}

launcher.execute(main, {
  numClients: parseInt(new URLSearchParams(window.location.search).get('emulate') || '') || 1,
  width: '50%',
});
