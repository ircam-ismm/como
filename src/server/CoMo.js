import path from 'path';
import fs from 'fs';
import serveStatic from 'serve-static';
import serviceFileSystemFactory from '@soundworks/service-file-system/server';
import servicePlatformFactory from '@soundworks/service-platform/server';
import serviceCheckinFactory from '@soundworks/service-checkin/server';
import serviceAudioBufferLoaderFactory from '@soundworks/service-audio-buffer-loader/server';
import serviceSyncFactory from '@soundworks/service-sync/server';
import serviceScriptingFactory from '@soundworks/service-scripting/server';
import serviceLoggerFactory from '@soundworks/service-logger/server';

import Project from './Project';


class CoMo {
  // init
  constructor(server, projectsDirectory, projectName) {
    this.server = server;
    this.projectName = projectName;
    this.projectDirectory = path.join(projectsDirectory, projectName);
    this.project = null;

    this.idClientMap = new Map();

    // register services needed for
    this.server.registerService('file-watcher', serviceFileSystemFactory, {
      directories: [
        {
          name: 'audio',
          path: path.join(this.projectDirectory, 'audio'),
          publicDirectory: path.join(this.projectDirectory),
          watch: true,
        },
        {
          name: 'sessions',
          path: path.join(this.projectDirectory, 'sessions'),
          publicDirectory: path.join(this.projectDirectory),
          watch: true,
        },
        { // for now, we can't create presets dynamically
          name: 'presets',
          path: path.join(this.projectDirectory, 'presets'),
          publicDirectory: path.join(this.projectDirectory),
          watch: false,
        }
      ],
    });

    this.server.registerService('logger', serviceLoggerFactory, {
      directory: path.join(this.projectDirectory, 'recordings'),
    });

    const scriptsDataDir = path.join(this.projectDirectory, 'scripts/data');
    const scriptsAudioDir = path.join(this.projectDirectory, 'scripts/audio');

    this.server.registerService('scripts-data', serviceScriptingFactory, {
      directory: scriptsDataDir,
      defaultScriptValue: fs.readFileSync(path.join(scriptsDataDir, 'default.js')).toString(),
    });

    this.server.registerService('scripts-audio', serviceScriptingFactory, {
      directory: scriptsAudioDir,
    });

    this.server.registerService('sync', serviceSyncFactory);
    this.server.registerService('platform', servicePlatformFactory);
    this.server.registerService('checkin', serviceCheckinFactory);
    this.server.registerService('audio-buffer-loader', serviceAudioBufferLoaderFactory);
  }

  get clientTypes() {
    const clientTypes = Object.keys(this.server.config.app.clients);
    return clientTypes;
  }

  async init(config) {
    // open public route for audio files
    this.server.router.use('audio', serveStatic(path.join(this.projectDirectory, 'audio')));
    // projects needs the file watcher
    this.fileWatcher = this.server.serviceManager.get('file-watcher');

    return Promise.resolve(true);
  }

  async start() {
    // server is started and all services are ready
    this.project = new Project(this);
    await this.project.init();

    return Promise.resolve(true);
  }

  configureExperience(experience) {
    this.experience = experience;
    this.experience.services = {};

    const services = [
      'file-watcher',
      'sync',
      'platform',
      'checkin',
      'audio-buffer-loader',
      'scripts-data',
      'scripts-audio',
      'logger',
    ];

    services.forEach(serviceName => {
      this.experience.services[serviceName] = this.experience.require(serviceName);
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

