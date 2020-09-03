import path from 'path';
import fs from 'fs';
import serveStatic from 'serve-static';
import pluginFileSystemFactory from '@soundworks/plugin-filesystem/server';
import pluginPlatformFactory from '@soundworks/plugin-platform/server';
import pluginCheckinFactory from '@soundworks/plugin-checkin/server';
import pluginAudioBufferLoaderFactory from '@soundworks/plugin-audio-buffer-loader/server';
import pluginSyncFactory from '@soundworks/plugin-sync/server';
import pluginScriptingFactory from '@soundworks/plugin-scripting/server';
import pluginLoggerFactory from '@soundworks/plugin-logger/server';

import modules from '../common/modules/index.js';

import Project from './Project.js';


class CoMo {
  // init
  constructor(server, projectsDirectory, projectName) {
    this.server = server;
    this.projectName = projectName;
    this.projectDirectory = path.join(projectsDirectory, projectName);
    this.project = null;
    this.modules = modules;

    this.idClientMap = new Map();

    // register plugins needed for
    this.server.pluginManager.register('file-watcher', pluginFileSystemFactory, {
      directories: [
        {
          name: 'audio',
          path: path.join(this.projectDirectory, 'audio'),
          publicDirectory: 'audio',
        },
        {
          name: 'sessions',
          path: path.join(this.projectDirectory, 'sessions'),
          publicDirectory: 'sessions',
        },
        { // for now, we can't create presets dynamically
          name: 'presets',
          path: path.join(this.projectDirectory, 'presets'),
          publicDirectory: 'presets',
        }
      ],
    });

    this.server.pluginManager.register('logger', pluginLoggerFactory, {
      directory: path.join(this.projectDirectory, 'recordings'),
    });

    const scriptsDataDir = path.join(this.projectDirectory, 'scripts/data');
    const scriptsAudioDir = path.join(this.projectDirectory, 'scripts/audio');

    this.server.pluginManager.register('scripts-data', pluginScriptingFactory, {
      directory: scriptsDataDir,
      defaultScriptValue: fs.readFileSync(path.join(scriptsDataDir, 'default.js')).toString(),
    });

    this.server.pluginManager.register('scripts-audio', pluginScriptingFactory, {
      directory: scriptsAudioDir,
      defaultScriptValue: fs.readFileSync(path.join(scriptsAudioDir, 'default.js')).toString(),
    });

    this.server.pluginManager.register('sync', pluginSyncFactory);
    this.server.pluginManager.register('platform', pluginPlatformFactory);
    this.server.pluginManager.register('checkin', pluginCheckinFactory);
    this.server.pluginManager.register('audio-buffer-loader', pluginAudioBufferLoaderFactory);
  }

  get clientTypes() {
    const clientTypes = Object.keys(this.server.config.app.clients);
    return clientTypes;
  }

  async init(config) {
    // open public route for audio files
    this.server.router.use('audio', serveStatic(path.join(this.projectDirectory, 'audio')));
    // projects needs the file watcher
    this.fileWatcher = this.server.pluginManager.get('file-watcher');

    return Promise.resolve(true);
  }

  async start() {
    // server is started and all plugins are ready
    this.project = new Project(this);
    await this.project.init();

    return Promise.resolve(true);
  }

  configureExperience(experience) {
    this.experience = experience;
    this.experience.plugins = {};

    const plugins = [
      'file-watcher',
      'sync',
      'platform',
      'checkin',
      'audio-buffer-loader',
      'scripts-data',
      'scripts-audio',
      'logger',
    ];

    plugins.forEach(pluginName => {
      this.experience.plugins[pluginName] = this.experience.require(pluginName);
    });
  }

  addClient(client) {
    this.idClientMap.set(client.id, client);

    client.socket.addListener(`como:project:createSession:req`, async (sessionName, sessionPreset) => {
      const uuid = await this.project.createSession(sessionName, sessionPreset);

      if (uuid !== null) {
        client.socket.send(`como:project:createSession:ack`, uuid);
      } else {
        client.socket.send(`como:project:createSession:err`, 'session already exists');
      }
    });

    client.socket.addListener(`como:project:deleteSession:req`, async (sessionId) => {
      const result = await this.project.deleteSession(sessionId);

      if (result === true) {
        client.socket.send(`como:project:deleteSession:ack`);
      } else {
        client.socket.send(`como:project:deleteSession:err`, 'session ${sessionId} does not exists');
      }
    });

    // streams routing definitions
    client.socket.addListener(`como:routing:createStreamRoute:req`, async (fromSourceId, toNodeId) => {
      const result = await this.project.createStreamRoute(fromSourceId, toNodeId);

      if (result === true) {
        client.socket.send(`como:routing:createStreamRoute:ack`, result);
      } else {
        client.socket.send(`como:routing:createStreamRoute:err`,
          `an error occured creating route [${fromSourceId}, ${toNodeId}]`);
      }
    });

    client.socket.addListener(`como:routing:deleteStreamRoute:req`, async (fromSourceId, toNodeId) => {
      const result = await this.project.deleteStreamRoute(fromSourceId, toNodeId);

      if (result === true) {
        client.socket.send(`como:routing:deleteStreamRoute:ack`, result);
      } else {
        client.socket.send(`como:routing:deleteStreamRoute:err`,
          `an error occured creating route [${fromSourceId}, ${toNodeId}]`);
      }
    });

    // streams routing
    client.socket.addBinaryListener('stream', frame => {
      const routes = this.project.get('streamsRouting');
      const fromId = frame[0];

      for (let i = 0; i < routes.length; i++) {
        const route = routes[i];
        if (route[0] === fromId) {
          const targetClient = this.idClientMap.get(route[1]);

          // if we have a client with the right nodeId
          if (targetClient) {
            targetClient.socket.sendBinary('stream', frame);
          } else {
            // might be an OSC target client
            // osc.send('/stream/${route[1]}/${route[0]}', frame);
          }
        }
      }
    });


    // ------------------------------------------------------------
    // session / examples
    client.socket.addListener(`como:session:addExample`, async (sessionId, example) => {
      if (this.project.sessions.has(sessionId)) {
        const session = this.project.sessions.get(sessionId);
        session.addExample(example);
      }
    });

    client.socket.addListener(`como:session:deleteExample`, async (sessionId, exampleUuid) => {
      if (this.project.sessions.has(sessionId)) {
        const session = this.project.sessions.get(sessionId);
        session.deleteExample(exampleUuid);
      }
    });

    client.socket.addListener(`como:session:clearLabel`, async (sessionId, label) => {
      if (this.project.sessions.has(sessionId)) {
        const session = this.project.sessions.get(sessionId);
        session.clearLabel(label);
      }
    });

    client.socket.addListener(`como:session:clearExamples`, async (sessionId) => {
      if (this.project.sessions.has(sessionId)) {
        const session = this.project.sessions.get(sessionId);
        session.clearExamples();
      }
    });
  }

  deleteClient(client) {
    this.idClientMap.delete(client.id, client);
  }
}

export default CoMo;

