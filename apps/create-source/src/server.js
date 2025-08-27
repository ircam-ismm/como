import '@soundworks/helpers/polyfills.js';
import '@soundworks/helpers/catch-unhandled-errors.js';
import { Server } from '@soundworks/core/server.js';
import { loadConfig, configureHttpRouter } from '@soundworks/helpers/server.js';

import ComoServer from '@ircam/como/ComoServer.js'

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

const como = new ComoServer(server);
await como.start();

await como.requestCommand(como.nodeId, 'createSource', {
  type: 'comote',
  sourceId: 'comote-test',
  port: 8001,
  verbose: false,
});

await como.requestCommand(como.nodeId, 'createSource', {
  type: 'riot',
  sourceId: '0',
  port: 8002,
  verbose: true,
  useBno55: true, // @todo
});

await como.requestCommand(como.nodeId, 'createSource', {
  type: 'aggregated',
  sourceId: 'aggregated',
  sources: ['0', 'comote-test'],
});
