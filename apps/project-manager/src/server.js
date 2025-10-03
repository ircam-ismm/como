import '@soundworks/helpers/polyfills.js';
import '@soundworks/helpers/catch-unhandled-errors.js';
import { Server } from '@soundworks/core/server.js';
import { loadConfig, configureHttpRouter } from '@soundworks/helpers/server.js';

import ComoServer from '@ircam/como/core/ComoServer.js';

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

// @todo - init with project
// 1: use `process.env.PROJECT`
// 2: use `config.application.project`
// 3: take first project in list
const projectDirname = como.projectManager.projects.getValues()[0].dirname;
await como.setProject(projectDirname);

const sourceId = await como.sourceManager.createSource({
  type: 'comote',
  id: 'comote-test',
  port: 8001,
  verbose: false,
});

const player = await como.playerManager.createPlayer(sourceId);
