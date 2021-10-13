import path from 'path';
import fs from 'fs';
import JSON5 from 'json5';
import { v4 as uuidv4 } from 'uuid';
import slugify from '@sindresorhus/slugify';

import Session from './Session';
import db from './utils/db';
import diffArrays from '../common/utils/diffArrays';

import projectSchema from './schemas/project.js';
import sessionSchema from './schemas/session.js';
import playerSchema from './schemas/player.js';

// const PROJECT_VERSION = '0.0.0';

class Project {
  constructor(como) {
    this.como = como;

    this.state = null;
    this.players = new Map();
    this.sessions = new Map();

    this.como.server.stateManager.registerSchema('project', projectSchema);
    this.como.server.stateManager.registerSchema(`session`, sessionSchema);
    this.como.server.stateManager.registerSchema('player', playerSchema);
  }

  // `State` interface
  subscribe() {
    return this.state.subscribe(func);
  }

  getValues() {
    return this.state.getValues();
  }

  get(name) {
    return this.state.get(name);
  }

  set(updates) {
    this.state.set(updates);
  }

  async init() {
    // parse existing presets
    this.graphPresets = new Map();
    let learningPresets = {};

    const fileTree = this.como.fileWatcher.state.get('presets');

    for (let i = 0; i < fileTree.children.length; i++) {
      const leaf = fileTree.children[i];

      // graph presets
      if (leaf.type === 'directory') {
        const presetName = leaf.name;
        const dataGraph = await db.read(path.join(leaf.path, 'graph-data.json'));
        const audioGraph = await db.read(path.join(leaf.path, 'graph-audio.json'));
        const preset = { data: dataGraph, audio: audioGraph };
        this.graphPresets.set(presetName, preset);
      }

      // learning presets
      if (leaf.type === 'file' && leaf.name === 'learning-presets.json') {
        learningPresets = await db.read(leaf.path);
      }
    }

    this.state = await this.como.server.stateManager.create('project', {
      graphPresets: Array.from(this.graphPresets.keys()),
      learningPresets: learningPresets,
    });

    this.como.server.stateManager.observe(async (schemaName, stateId, nodeId) => {
      // track players
      if (schemaName === 'player') {
        const playerState = await this.como.server.stateManager.attach(schemaName, stateId);
        const playerId = playerState.get('id');

        playerState.onDetach(() => {
          this.clearStreamRouting(playerId, null); // clear routing where player is the source
          this.players.delete(playerId)
        });

        // maybe move this in Session, would be more logical...
        playerState.subscribe(updates => {
          for (let [name, values] of Object.entries(updates)) {
            switch (name) {
              // reset player state when it change session
              // @note - this could be a kind of reducer provided by
              // the stateManager itself (soundworks/core issue)
              case 'sessionId': {
                const sessionId = values;

                if (sessionId !== null) {
                  const session = this.sessions.get(sessionId);

                  if (!session) {
                    console.warn(`[como] required session "${sessionId}" does not exists`);
                    playerState.set({ sessionId: null });
                    return;
                  }

                  const defaultLabel = session.get('labels')[0];
                  const graphOptions = session.get('graphOptions');

                  playerState.set({
                    label: defaultLabel,
                    recordingState: 'idle',
                    graphOptions,
                  });
                } else {
                  playerState.set({
                    label: '',
                    recordingState: 'idle',
                    graphOptions: null,
                  });
                }
                break;
              }

              case 'graphOptionsEvent': {
                const optionsUpdates = values;
                const graphOptions = playerState.get('graphOptions');

                for (let moduleId in optionsUpdates) {
                  Object.assign(graphOptions[moduleId], optionsUpdates[moduleId]);
                }

                playerState.set({ graphOptions });
                break;
              }
            }
          }
        });

        this.players.set(playerId, playerState);
      }
    });

    // track file system
    this.como.fileWatcher.state.subscribe(updates => {
      for (let name in updates) {
        switch (name) {
          case 'audio':
            this._updateAudioFilesFromFileSystem(updates[name]);
            break;
          case 'sessions':
            this._updateSessionsFromFileSystem(updates[name]);
            break;
        }
      }
    });

    await this._updateAudioFilesFromFileSystem(this.como.fileWatcher.state.get('audio'));
    await this._updateSessionsFromFileSystem(this.como.fileWatcher.state.get('sessions'));

    if (this.como.server.config.como.preloadAudioFiles) {
      // this will preload all files of the project, so that sessions can just
      // pick their buffers in the audio-buffer-loader cache.
      this.state.set({ preloadAudioFiles: true });
    }
  }

  // -----------------------------------------------------------------------
  // SESSIONS
  // -----------------------------------------------------------------------
  async createSession(sessionName, graphPreset) {
    const overview = this.get('sessionsOverview');
    // @note - this could probably be more robust
    const id = slugify(sessionName);
    // find if a session w/ the same name or slug already exists
    const index = overview.findIndex(overview => {
      return overview.name === sessionName || overview.id === id;
    });

    if (index === -1) {
      const audioFiles = this.get('audioFiles');
      const graph = this.graphPresets.get(graphPreset);
      const session = await Session.create(this.como, id, sessionName, graph, audioFiles);

      this.sessions.set(id, session);
      this._updateSessionsOverview();

      return id;
    }

    // console.log(`> session "${sessionName}" already exists`);
    return null;
  }

  async deleteSession(id) {
    if (this.sessions.has(id)) {
      const session = this.sessions.get(id);
      const fullpath = session.directory;

      this.sessions.delete(id);
      await session.delete();

      // We can come from 2 paths here:
      // 1. if the file still exists, the method has been called programmatically so
      // we need to remove the file. This will trigger `_updateSessionsFromFileSystem`
      // but nothing should append there, that's why we update the
      // `sessionOverview` here.
      // 2. if the file has been removed manually we are called from
      // `_updateSessionsFromFileSystem` then we don't want to manipulate
      // the file system, nor update the `sessionsOverview`.
      if (fs.existsSync(session.directory)) {
        await db.delete(session.directory);
        this._updateSessionsOverview();
      }

      return true;
    }

    return false;
  }

  async _updateSessionsFromFileSystem(sessionFilesTree) {
    const inMemorySessions = Array.from(this.sessions.values());
    const fileTreeSessionsOverview = sessionFilesTree
      .children
      .filter(leaf => leaf.type === 'directory')
      .map(dir => {
        return {
          id: dir.name,
          configPath: dir.path,
        };
      });

    const {
      intersection,
      created,
      deleted
    } = diffArrays(inMemorySessions, fileTreeSessionsOverview, el => el.id);

    // not instanciated but present in file system
    for (let i = 0; i < created.length; i++) {
      const sessionOverview = created[i];

      try {
        const audioFiles = this.get('audioFiles');
        const session = await Session.fromFileSystem(this.como, sessionOverview.configPath, audioFiles);

        this.sessions.set(sessionOverview.id, session);
      } catch(err) {
        console.log(`> cannot instanciate session ${sessionOverview.id}`);
        console.error(err);
      }
    };

    // instanciated but absent from file system
    for (let i = 0; i < deleted.length; i++) {
      const id = deleted[i].id;
      await this.deleteSession(id);
    }

    // update overview if some sessions have been created or deleted
    if (created.length || deleted.length) {
      this._updateSessionsOverview();
    }
  }

  _updateSessionsOverview() {
    const sessionsOverview = Array.from(this.sessions.values())
      .map(session => {
        const stateId = session.state.id;
        const { id, name } = session.getValues();

        return { id, name, stateId };
      });

    this.set({ sessionsOverview });
  }

  // -----------------------------------------------------------------------
  // ROUTING
  // -----------------------------------------------------------------------

  /**
   * from - playerId - the logical client, CoMo player instance
   * to - nodeId - the physical client, soundworks client instance
   */
  async createStreamRoute(from, to) {
    const streamsRouting = this.get('streamsRouting');
    const index = streamsRouting.findIndex(r => r[0] === from && r[1] === to);

    if (index === -1) {
      const isSourceStreaming = streamsRouting.reduce((acc, r) => acc || r[0] === from, false);
      const created = [from, to];
      streamsRouting.push(created);

      // console.log('createStreamRoute', streamsRouting);
      this.set({ streamsRouting });
      // notify player that it should start to stream its source
      if (!isSourceStreaming) {
        const player = this.players.get(from);
        player.set({ streamSource: true });
      }

      return true;
    }

    return false;
  }

  async deleteStreamRoute(from, to) {
    const streamsRouting = this.get('streamsRouting');
    const index = streamsRouting.findIndex(r => r[0] === from && r[1] === to);

    if (index !== -1) {
      const deleted = streamsRouting[index];
      streamsRouting.splice(index, 1);

      await this.set({ streamsRouting });

      const isSourceStreaming = streamsRouting.reduce((acc, r) => acc || r[0] === from, false);

      // notify player that it should stop streaming its source
      if (!isSourceStreaming) {
        const player = this.players.get(from);
        player.set({ streamSource: false });
      }

      return true;
    }

    return false;
  }

  async clearStreamRouting(from = null, to = null) {
    const streamsRouting = this.get('streamsRouting');
    const deleted = [];

    for (let i = streamsRouting.length - 1; i >= 0; i--) {
      const route = streamsRouting[i];

      if (route[0] === from || route[1] === to) {
        deleted.push(route);
        streamsRouting.splice(i, 1);
      }
    }

    this.set({ streamsRouting });

    // notify possible sources that they should stop streaming
    this.players.forEach((player, key) => {
      const isSourceStreaming = streamsRouting.reduce((acc, r) => acc || r[0] === key, false);

      if (!isSourceStreaming && player.get('streamSource') === true) {
        player.set({ streamSource: false });
      }
    });
  }

  propagateStreamFrame(frame) {
    // @todo - we need to move this into `Projet` so that it can be called
    // directly from server side with an arbitrary frame...
    const routes = this.get('streamsRouting');
    const fromId = frame[0];

    for (let i = 0; i < routes.length; i++) {
      const route = routes[i];
      if (route[0] === fromId) {
        const targetClient = this.como.idClientMap.get(route[1]);

        // if we have a client with the right nodeId
        if (targetClient) {
          targetClient.socket.sendBinary('stream', frame);
        } else {
          // might be an OSC target client
          // osc.send('/stream/${route[1]}/${route[0]}', frame);
        }
      }
    }
  }

  // -----------------------------------------------------------------------
  // AUDIO FILES
  // -----------------------------------------------------------------------
  async _updateAudioFilesFromFileSystem(audioFilesTree) {
    // filter everythin that is not a .wav or a .mp3 file
    const audioFiles = audioFilesTree.children
      .filter(leaf => leaf.type === 'file' && ['.mp3', '.wav'].indexOf(leaf.extension) !== -1)
      .map(({ name, url, extension }) => { return { name, url, extension } });

    this.state.set({ audioFiles });

    // @todo - clean sessions
    for (let session of this.sessions.values()) {
      await session.updateAudioFilesFromFileSystem(audioFiles);;
    }
  }
}

export default Project;
