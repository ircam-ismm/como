import '@soundworks/helpers/polyfills.js';
import { Client } from '@soundworks/core/client.js';
import { loadConfig, launcher } from '@soundworks/helpers/browser.js';
import { html, render, nothing } from 'lit';

import ComoClient from '@ircam/como/core/ComoClient.js';

// - General documentation: https://soundworks.dev/
// - API documentation:     https://soundworks.dev/api
// - Issue Tracker:         https://github.com/collective-soundworks/soundworks/issues
// - Wizard & Tools:        `npx soundworks`

async function main($container) {
  const config = loadConfig();
  const client = new Client(config);
  const como = new ComoClient(client);

  // cf. https://soundworks.dev/tools/helpers.html#browserlauncher
  launcher.register(client, {
    initScreensContainer: $container,
    reloadOnVisibilityChange: false,
  });

  await como.start();

  let showEditor = false;

  function renderApp() {
    render(html`
      <div class="controller-layout">
        <header>
          <h1>${client.config.app.name} | ${client.role}</h1>
          <sc-icon
            type="prompt"
            @input=${e => {
              showEditor = !showEditor;
              renderApp();
            }}
          ></sc-icon>
          <como-project-manager .como=${como}></como-project-manager>
          <sw-audit .client="${client}"></sw-audit>
        </header>
        <section>
          <como-session-manager .como=${como}></como-session-manager>
          <como-player-manager .como=${como}></como-player-manager>
          <como-soundbank-manager .como=${como}></como-soundbank-manager>
          ${showEditor
            ? html`<como-script-manager .como=${como}></como-script-manager>`
            : nothing
          }

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
