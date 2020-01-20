import path from 'path';
import fs from 'fs';
import JSON5 from 'json5';
import { uuid as uuidv4 } from 'uuidv4';
import slugify from '@sindresorhus/slugify';

import Session from './Session';
import db from './utils/db';
import diffArrays from '../common/diffArrays';

import projectSchema from './schemas/project.js';
import sessionSchema from './schemas/session.js';
import playerSchema from './schemas/player.js';

// const PROJECT_VERSION = '0.0.0';

class Project {
  constructor(como) {
    this.como = como;

    // define existing presets
    this.presets = new Map();
    const fileTree = this.como.fileWatcher.state.get('presets');

    fileTree.children.forEach(leaf => {
      if (leaf.type === 'file') {
        const str = fs.readFileSync(leaf.path).toString();
        const preset = JSON5.parse(str);
        const basename = path.basename(leaf.name, '.json');
        this.presets.set(basename, preset);
      }
    });

    const presetNames = Array.from(this.presets.keys());
    projectSchema.presetNames.default = presetNames;

    this.como.server.stateManager.registerSchema('project', projectSchema);
    this.como.server.stateManager.registerSchema(`session`, sessionSchema);
    this.como.server.stateManager.registerSchema('player', playerSchema);

    this.state = null;
    this.players = new Map();
    this.sessions = new Map();
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
    this.state = await this.como.server.stateManager.create('project');

    this.como.server.stateManager.observe(async (schemaName, stateId, nodeId) => {
      // track players
      if (schemaName === 'player') {
        const playerState = await this.como.server.stateManager.attach(schemaName, stateId);
        const playerId = playerState.get('id');
        playerState.onDetach(() => {
          this.clearStreamRouting(playerId);
          this.players.delete(playerId)
        });

        playerState.subscribe(updates => {
          for (let name in updates) {
            // reset player state when it change session
            // @note - this could be a kind of reducer provided by
            // the stateManager itself
            if (name === 'sessionId') {
              const sessionId = updates[name];

              if (sessionId !== null) {
                const session = this.sessions.get(sessionId);
                // pick a default label for the new player
                // @todo - this should be updated on any `audioFiles.label` update
                const defaultLabel = session.state.get('audioFiles')
                  .map(file => file.label)
                  .filter((label, index, arr) => arr.indexOf(label) === index)
                  .sort()[0];

                playerState.set({
                  label: defaultLabel,
                  recordingState: 'idle',
                });
              } else {
                playerState.set({
                  label: '',
                  recordingState: 'idle',
                });
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
  }

  // -----------------------------------------------------------------------
  // SESSIONS
  // -----------------------------------------------------------------------
  async createSession(sessionName, sessionPreset) {
    const overview = this.get('sessionsOverview');
    // @note - this could probably be more robust
    const id = slugify(sessionName);
    // find if a session w/ the same name or slug already exists
    const index = overview.findIndex(overview => {
      return overview.name === sessionName || overview.id === id;
    });

    if (index === -1) {
      const audioFiles = this.get('audioFiles');
      const graph = this.presets.get(sessionPreset);
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

      // We can come from 2 path here:
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
          configPath: path.join(dir.path, 'config.json'),
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
        const json = await db.read(sessionOverview.configPath);
        const audioFiles = this.get('audioFiles');
        const session = await Session.fromData(this.como, json, audioFiles);

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
        const { id, name } = session.state.getValues();

        return { id, name, stateId };
      });

    this.set({ sessionsOverview });
  }

  // -----------------------------------------------------------------------
  // ROUTING
  // -----------------------------------------------------------------------

  // @todo - should should of form [fromPlayer, toPlayer] and not [fromPlayer, toNode]
  // the map [fromPlayer, toNode] should therefore be maintained from this list
  // because if I duplicate and control another player on the controller, the
  // route will be broken if one or the other is deleted.
  async createStreamRoute(from, to) {
    console.log('createStreamRoute', from, to);
    const streamsRouting = this.get('streamsRouting');
    const index = streamsRouting.findIndex(r => r[0] === from && r[1] === to);

    if (index === -1) {
      const isSourceStreaming = streamsRouting.reduce((acc, r) => acc || r[0] === from, false);
      const created = [from, to];
      streamsRouting.push(created);

      this.set({ streamsRouting });

      console.log(Array.from(this.players.keys()));
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

  async clearStreamRouting(playerId) {
    const streamsRouting = this.get('streamsRouting');
    const deleted = [];

    for (let i = streamsRouting.length - 1; i >= 0; i--) {
      const route = streamsRouting[i];

      if (route[0] === playerId || route[1] === playerId) {
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
