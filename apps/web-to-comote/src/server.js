import '@soundworks/helpers/polyfills.js';
import '@soundworks/helpers/catch-unhandled-errors.js';
import { Server } from '@soundworks/core/server.js';
import { loadConfig, configureHttpRouter } from '@soundworks/helpers/server.js';

import ServerPluginPlatformInit from '@soundworks/plugin-platform-init/server.js';
import ServerPluginLogger from '@soundworks/plugin-logger/server.js';


// - General documentation: https://soundworks.dev/
// - API documentation:     https://soundworks.dev/api
// - Issue Tracker:         https://github.com/collective-soundworks/soundworks/issues
// - Wizard & Tools:        `npx soundworks`

const config = loadConfig(process.env.ENV, import.meta.url);

console.log(`
--------------------------------------------------------
- launching "${config.app.name}" in "${process.env.ENV || 'default'}" environment
- [pid: ${process.pid}]
--------------------------------------------------------
`);

const server = new Server(config);
configureHttpRouter(server);

server.pluginManager.register('platform-init', ServerPluginPlatformInit);
server.pluginManager.register('recorder', ServerPluginLogger, {
  dirname: 'recordings',
});

server.stateManager.defineClass('sensor', {
  id: {
    type: 'string',
    required: true,
  },
  data: {
    type: 'any',
    default: null,
    nullable: true,
    acknowledge: false,
  },
  record: {
    type: 'boolean',
    default: false,
  },
  recordingFilename: {
    type: 'string',
    default: null,
    nullable: true,
  },
})

await server.start();

// and do your own stuff!

