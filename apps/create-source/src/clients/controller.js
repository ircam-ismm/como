import '@soundworks/helpers/polyfills.js';
import { Client } from '@soundworks/core/client.js';
import { loadConfig, launcher } from '@soundworks/helpers/browser.js';
import { html, render } from 'lit';

import ComoClient from '@ircam/como/ComoClient.js';
import { rawLink } from '@ircam/comote-helpers/qrcode.js';

import '@ircam/sc-components';
import '@ircam/como/components/como-sensor-plot.js';
import '@ircam/como/components/como-sensor.js';

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

  const como = new ComoClient(client);
  await como.start();

  como.sourceManager.sources.onChange(renderApp);
  como.recordingManager.onUpdate(renderApp);

  // const source = await como.sourceManager.getSource('comote-test');
  // source.onUpdate(updates => {
  //   // if ('stream' in updates) {
  //   //   console.log('stream', updates.stream);
  //   // }
  // });

  const recordings = como.recordingManager.list();
  const firstRecord = recordings.children[0];
  const recordData = await como.recordingManager.read(firstRecord.name);
  // const text
  await como.requestCommand(como.nodeId, 'createSource', {
    type: 'file-player',
    id: 'my-file-player',
    verbose: true,
    data: await recordData.text(),
  });

  function renderApp() {
    render(html`
      <div class="controller-layout">
        <header>
          <h1>${client.config.app.name} | ${client.role}</h1>
          <sw-audit .client="${client}"></sw-audit>
        </header>
        <section>
          <div>
            <h2>Sources</h2>
            ${como.sourceManager.sources.map(source => {
              return html`
                <div>
                  <sc-text>${source.get('type')}: ${source.get('id')}</sc-text>
                  <sc-status ?active=${source.get('active')}></sc-status>
                  ${source.get('type') === 'comote'
                    ? html`
                      <sc-qrcode
                        style="display: block"
                        value=${rawLink(source.get('infos'))}
                      ></sc-qrcode>`
                    : ``}
                  ${source.get('type') === 'file-player'
                    ? html`
                      <sc-transport
                        value=${source.get('control')}
                        @change=${e => source.set('control', e.detail.value)}
                        .buttons=${source.getDescription('control').list}
                      ></sc-transport>`
                    : ``}
                  <div>
                    <!-- This one creates a full attached instance -->
                    <como-sensor .como=${como} .sourceId=${source.get('id')}></como-sensor>
                  </div>
                  <div>
                    <sc-text>record</sc-text>
                    <sc-toggle @change=${e => source.set('record', e.detail.value )}></sc-toggle>
                  </div>
                </div>
              `;
            })}
          </div>
          <div>
            <h2>Recordings</h2>
            <sc-filetree
              .value=${como.recordingManager.list()}
              @input=${async e => {
                const recording = await como.recordingManager.read(e.detail.value.name);
                const recordingStr = await recording.text()
                const $viewer = e.target.nextElementSibling;
                $viewer.value = recordingStr;
                const $plot = $viewer.nextElementSibling;
                $plot.value = recordingStr;
              }}
            ></sc-filetree>
            <sc-editor></sc-editor>
            <como-sensor-plot></como-sensor-plot>
          </div>
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
