"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _path = _interopRequireDefault(require("path"));

var _fs = _interopRequireDefault(require("fs"));

var _json = _interopRequireDefault(require("json5"));

var _uuidv = require("uuidv4");

var _slugify = _interopRequireDefault(require("@sindresorhus/slugify"));

var _Session = _interopRequireDefault(require("./Session"));

var _db = _interopRequireDefault(require("./utils/db"));

var _diffArrays = _interopRequireDefault(require("../common/utils/diffArrays"));

var _project = _interopRequireDefault(require("./schemas/project.js"));

var _session = _interopRequireDefault(require("./schemas/session.js"));

var _player = _interopRequireDefault(require("./schemas/player.js"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// const PROJECT_VERSION = '0.0.0';
class Project {
  constructor(como) {
    this.como = como;
    this.state = null;
    this.players = new Map();
    this.sessions = new Map();
    this.como.server.stateManager.registerSchema('project', _project.default);
    this.como.server.stateManager.registerSchema(`session`, _session.default);
    this.como.server.stateManager.registerSchema('player', _player.default);
  } // `State` interface


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
      const leaf = fileTree.children[i]; // graph presets

      if (leaf.type === 'directory') {
        const presetName = leaf.name;
        const dataGraph = await _db.default.read(_path.default.join(leaf.path, 'graph-data.json'));
        const audioGraph = await _db.default.read(_path.default.join(leaf.path, 'graph-audio.json'));
        const preset = {
          data: dataGraph,
          audio: audioGraph
        };
        this.graphPresets.set(presetName, preset);
      } // learning presets


      if (leaf.type === 'file' && leaf.name === 'learning-presets.json') {
        learningPresets = await _db.default.read(leaf.path);
      }
    }

    this.state = await this.como.server.stateManager.create('project', {
      graphPresets: Array.from(this.graphPresets.keys()),
      learningPresets: learningPresets
    });
    this.como.server.stateManager.observe(async (schemaName, stateId, nodeId) => {
      // track players
      if (schemaName === 'player') {
        const playerState = await this.como.server.stateManager.attach(schemaName, stateId);
        const playerId = playerState.get('id');
        playerState.onDetach(() => {
          this.clearStreamRouting(playerId, null); // clear routing where player is the source

          this.players.delete(playerId);
        }); // maybe move this in Session, would be more logical...

        playerState.subscribe(updates => {
          for (let [name, values] of Object.entries(updates)) {
            switch (name) {
              // reset player state when it change session
              // @note - this could be a kind of reducer provided by
              // the stateManager itself (soundworks/core issue)
              case 'sessionId':
                {
                  const sessionId = values;

                  if (sessionId !== null) {
                    const session = this.sessions.get(sessionId);

                    if (!session) {
                      console.warn(`[como] required session "${sessionId}" does not exists`);
                      playerState.set({
                        sessionId: null
                      });
                      return;
                    }

                    const defaultLabel = session.get('labels')[0];
                    const graphOptions = session.get('graphOptions');
                    playerState.set({
                      label: defaultLabel,
                      recordingState: 'idle',
                      graphOptions
                    });
                  } else {
                    playerState.set({
                      label: '',
                      recordingState: 'idle',
                      graphOptions: null
                    });
                  }

                  break;
                }

              case 'graphOptionsEvent':
                {
                  const optionsUpdates = values;
                  const graphOptions = playerState.get('graphOptions');

                  for (let moduleId in optionsUpdates) {
                    Object.assign(graphOptions[moduleId], optionsUpdates[moduleId]);
                  }

                  playerState.set({
                    graphOptions
                  });
                  break;
                }
            }
          }
        });
        this.players.set(playerId, playerState);
      }
    }); // track file system

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
  } // -----------------------------------------------------------------------
  // SESSIONS
  // -----------------------------------------------------------------------


  async createSession(sessionName, graphPreset) {
    const overview = this.get('sessionsOverview'); // @note - this could probably be more robust

    const id = (0, _slugify.default)(sessionName); // find if a session w/ the same name or slug already exists

    const index = overview.findIndex(overview => {
      return overview.name === sessionName || overview.id === id;
    });

    if (index === -1) {
      const audioFiles = this.get('audioFiles');
      const graph = this.graphPresets.get(graphPreset);
      const session = await _Session.default.create(this.como, id, sessionName, graph, audioFiles);
      this.sessions.set(id, session);

      this._updateSessionsOverview();

      return id;
    } // console.log(`> session "${sessionName}" already exists`);


    return null;
  }

  async deleteSession(id) {
    if (this.sessions.has(id)) {
      const session = this.sessions.get(id);
      const fullpath = session.directory;
      this.sessions.delete(id);
      await session.delete(); // We can come from 2 paths here:
      // 1. if the file still exists, the method has been called programmatically so
      // we need to remove the file. This will trigger `_updateSessionsFromFileSystem`
      // but nothing should append there, that's why we update the
      // `sessionOverview` here.
      // 2. if the file has been removed manually we are called from
      // `_updateSessionsFromFileSystem` then we don't want to manipulate
      // the file system, nor update the `sessionsOverview`.

      if (_fs.default.existsSync(session.directory)) {
        await _db.default.delete(session.directory);

        this._updateSessionsOverview();
      }

      return true;
    }

    return false;
  }

  async _updateSessionsFromFileSystem(sessionFilesTree) {
    const inMemorySessions = Array.from(this.sessions.values());
    const fileTreeSessionsOverview = sessionFilesTree.children.filter(leaf => leaf.type === 'directory').map(dir => {
      return {
        id: dir.name,
        configPath: dir.path
      };
    });
    const {
      intersection,
      created,
      deleted
    } = (0, _diffArrays.default)(inMemorySessions, fileTreeSessionsOverview, el => el.id); // not instanciated but present in file system

    for (let i = 0; i < created.length; i++) {
      const sessionOverview = created[i];

      try {
        const audioFiles = this.get('audioFiles');
        const session = await _Session.default.fromFileSystem(this.como, sessionOverview.configPath, audioFiles);
        this.sessions.set(sessionOverview.id, session);
      } catch (err) {
        console.log(`> cannot instanciate session ${sessionOverview.id}`);
        console.error(err);
      }
    }

    ; // instanciated but absent from file system

    for (let i = 0; i < deleted.length; i++) {
      const id = deleted[i].id;
      await this.deleteSession(id);
    } // update overview if some sessions have been created or deleted


    if (created.length || deleted.length) {
      this._updateSessionsOverview();
    }
  }

  _updateSessionsOverview() {
    const sessionsOverview = Array.from(this.sessions.values()).map(session => {
      const stateId = session.state.id;
      const {
        id,
        name
      } = session.state.getValues();
      return {
        id,
        name,
        stateId
      };
    });
    this.set({
      sessionsOverview
    });
  } // -----------------------------------------------------------------------
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
      streamsRouting.push(created); // console.log('createStreamRoute', streamsRouting);

      this.set({
        streamsRouting
      }); // notify player that it should start to stream its source

      if (!isSourceStreaming) {
        const player = this.players.get(from);
        player.set({
          streamSource: true
        });
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
      streamsRouting.splice(index, 1); // console.log('deleteStreamRoute', streamsRouting);

      await this.set({
        streamsRouting
      });
      const isSourceStreaming = streamsRouting.reduce((acc, r) => acc || r[0] === from, false); // notify player that it should stop streaming its source

      if (!isSourceStreaming) {
        const player = this.players.get(from);
        player.set({
          streamSource: false
        });
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

      if (route[0] === from || route[1] === to) {
        deleted.push(route);
        streamsRouting.splice(i, 1);
      }
    } // console.log('clearStreamRoute', streamsRouting);


    this.set({
      streamsRouting
    }); // notify possible sources that they should stop streaming

    this.players.forEach((player, key) => {
      const isSourceStreaming = streamsRouting.reduce((acc, r) => acc || r[0] === key, false);

      if (!isSourceStreaming && player.get('streamSource') === true) {
        player.set({
          streamSource: false
        });
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
        const targetClient = this.como.idClientMap.get(route[1]); // if we have a client with the right nodeId

        if (targetClient) {
          targetClient.socket.sendBinary('stream', frame);
        } else {// might be an OSC target client
          // osc.send('/stream/${route[1]}/${route[0]}', frame);
        }
      }
    }
  } // -----------------------------------------------------------------------
  // AUDIO FILES
  // -----------------------------------------------------------------------


  async _updateAudioFilesFromFileSystem(audioFilesTree) {
    // filter everythin that is not a .wav or a .mp3 file
    const audioFiles = audioFilesTree.children.filter(leaf => leaf.type === 'file' && ['.mp3', '.wav'].indexOf(leaf.extension) !== -1).map(({
      name,
      url,
      extension
    }) => {
      return {
        name,
        url,
        extension
      };
    });
    this.state.set({
      audioFiles
    }); // @todo - clean sessions

    for (let session of this.sessions.values()) {
      await session.updateAudioFilesFromFileSystem(audioFiles);
      ;
    }
  }

}

var _default = Project;
exports.default = _default;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9zZXJ2ZXIvUHJvamVjdC5qcyJdLCJuYW1lcyI6WyJQcm9qZWN0IiwiY29uc3RydWN0b3IiLCJjb21vIiwic3RhdGUiLCJwbGF5ZXJzIiwiTWFwIiwic2Vzc2lvbnMiLCJzZXJ2ZXIiLCJzdGF0ZU1hbmFnZXIiLCJyZWdpc3RlclNjaGVtYSIsInByb2plY3RTY2hlbWEiLCJzZXNzaW9uU2NoZW1hIiwicGxheWVyU2NoZW1hIiwic3Vic2NyaWJlIiwiZnVuYyIsImdldFZhbHVlcyIsImdldCIsIm5hbWUiLCJzZXQiLCJ1cGRhdGVzIiwiaW5pdCIsImdyYXBoUHJlc2V0cyIsImxlYXJuaW5nUHJlc2V0cyIsImZpbGVUcmVlIiwiZmlsZVdhdGNoZXIiLCJpIiwiY2hpbGRyZW4iLCJsZW5ndGgiLCJsZWFmIiwidHlwZSIsInByZXNldE5hbWUiLCJkYXRhR3JhcGgiLCJkYiIsInJlYWQiLCJwYXRoIiwiam9pbiIsImF1ZGlvR3JhcGgiLCJwcmVzZXQiLCJkYXRhIiwiYXVkaW8iLCJjcmVhdGUiLCJBcnJheSIsImZyb20iLCJrZXlzIiwib2JzZXJ2ZSIsInNjaGVtYU5hbWUiLCJzdGF0ZUlkIiwibm9kZUlkIiwicGxheWVyU3RhdGUiLCJhdHRhY2giLCJwbGF5ZXJJZCIsIm9uRGV0YWNoIiwiY2xlYXJTdHJlYW1Sb3V0aW5nIiwiZGVsZXRlIiwidmFsdWVzIiwiT2JqZWN0IiwiZW50cmllcyIsInNlc3Npb25JZCIsInNlc3Npb24iLCJjb25zb2xlIiwid2FybiIsImRlZmF1bHRMYWJlbCIsImdyYXBoT3B0aW9ucyIsImxhYmVsIiwicmVjb3JkaW5nU3RhdGUiLCJvcHRpb25zVXBkYXRlcyIsIm1vZHVsZUlkIiwiYXNzaWduIiwiX3VwZGF0ZUF1ZGlvRmlsZXNGcm9tRmlsZVN5c3RlbSIsIl91cGRhdGVTZXNzaW9uc0Zyb21GaWxlU3lzdGVtIiwiY3JlYXRlU2Vzc2lvbiIsInNlc3Npb25OYW1lIiwiZ3JhcGhQcmVzZXQiLCJvdmVydmlldyIsImlkIiwiaW5kZXgiLCJmaW5kSW5kZXgiLCJhdWRpb0ZpbGVzIiwiZ3JhcGgiLCJTZXNzaW9uIiwiX3VwZGF0ZVNlc3Npb25zT3ZlcnZpZXciLCJkZWxldGVTZXNzaW9uIiwiaGFzIiwiZnVsbHBhdGgiLCJkaXJlY3RvcnkiLCJmcyIsImV4aXN0c1N5bmMiLCJzZXNzaW9uRmlsZXNUcmVlIiwiaW5NZW1vcnlTZXNzaW9ucyIsImZpbGVUcmVlU2Vzc2lvbnNPdmVydmlldyIsImZpbHRlciIsIm1hcCIsImRpciIsImNvbmZpZ1BhdGgiLCJpbnRlcnNlY3Rpb24iLCJjcmVhdGVkIiwiZGVsZXRlZCIsImVsIiwic2Vzc2lvbk92ZXJ2aWV3IiwiZnJvbUZpbGVTeXN0ZW0iLCJlcnIiLCJsb2ciLCJlcnJvciIsInNlc3Npb25zT3ZlcnZpZXciLCJjcmVhdGVTdHJlYW1Sb3V0ZSIsInRvIiwic3RyZWFtc1JvdXRpbmciLCJyIiwiaXNTb3VyY2VTdHJlYW1pbmciLCJyZWR1Y2UiLCJhY2MiLCJwdXNoIiwicGxheWVyIiwic3RyZWFtU291cmNlIiwiZGVsZXRlU3RyZWFtUm91dGUiLCJzcGxpY2UiLCJyb3V0ZSIsImZvckVhY2giLCJrZXkiLCJwcm9wYWdhdGVTdHJlYW1GcmFtZSIsImZyYW1lIiwicm91dGVzIiwiZnJvbUlkIiwidGFyZ2V0Q2xpZW50IiwiaWRDbGllbnRNYXAiLCJzb2NrZXQiLCJzZW5kQmluYXJ5IiwiYXVkaW9GaWxlc1RyZWUiLCJpbmRleE9mIiwiZXh0ZW5zaW9uIiwidXJsIiwidXBkYXRlQXVkaW9GaWxlc0Zyb21GaWxlU3lzdGVtIl0sIm1hcHBpbmdzIjoiOzs7Ozs7O0FBQUE7O0FBQ0E7O0FBQ0E7O0FBQ0E7O0FBQ0E7O0FBRUE7O0FBQ0E7O0FBQ0E7O0FBRUE7O0FBQ0E7O0FBQ0E7Ozs7QUFFQTtBQUVBLE1BQU1BLE9BQU4sQ0FBYztBQUNaQyxFQUFBQSxXQUFXLENBQUNDLElBQUQsRUFBTztBQUNoQixTQUFLQSxJQUFMLEdBQVlBLElBQVo7QUFFQSxTQUFLQyxLQUFMLEdBQWEsSUFBYjtBQUNB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SUFBb0IsS0FBS3BELFFBQUwsQ0FBY2dELE1BQWQsRUFBcEIsRUFBNEM7QUFDMUMsWUFBTUksT0FBTyxDQUFDeUUsOEJBQVIsQ0FBdUN0RCxVQUF2QyxDQUFOO0FBQXlEO0FBQzFEO0FBQ0Y7O0FBdlhXOztlQTBYQzdFLE8iLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCBmcyBmcm9tICdmcyc7XG5pbXBvcnQgSlNPTjUgZnJvbSAnanNvbjUnO1xuaW1wb3J0IHsgdXVpZCBhcyB1dWlkdjQgfSBmcm9tICd1dWlkdjQnO1xuaW1wb3J0IHNsdWdpZnkgZnJvbSAnQHNpbmRyZXNvcmh1cy9zbHVnaWZ5JztcblxuaW1wb3J0IFNlc3Npb24gZnJvbSAnLi9TZXNzaW9uJztcbmltcG9ydCBkYiBmcm9tICcuL3V0aWxzL2RiJztcbmltcG9ydCBkaWZmQXJyYXlzIGZyb20gJy4uL2NvbW1vbi91dGlscy9kaWZmQXJyYXlzJztcblxuaW1wb3J0IHByb2plY3RTY2hlbWEgZnJvbSAnLi9zY2hlbWFzL3Byb2plY3QuanMnO1xuaW1wb3J0IHNlc3Npb25TY2hlbWEgZnJvbSAnLi9zY2hlbWFzL3Nlc3Npb24uanMnO1xuaW1wb3J0IHBsYXllclNjaGVtYSBmcm9tICcuL3NjaGVtYXMvcGxheWVyLmpzJztcblxuLy8gY29uc3QgUFJPSkVDVF9WRVJTSU9OID0gJzAuMC4wJztcblxuY2xhc3MgUHJvamVjdCB7XG4gIGNvbnN0cnVjdG9yKGNvbW8pIHtcbiAgICB0aGlzLmNvbW8gPSBjb21vO1xuXG4gICAgdGhpcy5zdGF0ZSA9IG51bGw7XG4gICAgdGhpcy5wbGF5ZXJzID0gbmV3IE1hcCgpO1xuICAgIHRoaXMuc2Vzc2lvbnMgPSBuZXcgTWFwKCk7XG5cbiAgICB0aGlzLmNvbW8uc2VydmVyLnN0YXRlTWFuYWdlci5yZWdpc3RlclNjaGVtYSgncHJvamVjdCcsIHByb2plY3RTY2hlbWEpO1xuICAgIHRoaXMuY29tby5zZXJ2ZXIuc3RhdGVNYW5hZ2VyLnJlZ2lzdGVyU2NoZW1hKGBzZXNzaW9uYCwgc2Vzc2lvblNjaGVtYSk7XG4gICAgdGhpcy5jb21vLnNlcnZlci5zdGF0ZU1hbmFnZXIucmVnaXN0ZXJTY2hlbWEoJ3BsYXllcicsIHBsYXllclNjaGVtYSk7XG4gIH1cblxuICAvLyBgU3RhdGVgIGludGVyZmFjZVxuICBzdWJzY3JpYmUoKSB7XG4gICAgcmV0dXJuIHRoaXMuc3RhdGUuc3Vic2NyaWJlKGZ1bmMpO1xuICB9XG5cbiAgZ2V0VmFsdWVzKCkge1xuICAgIHJldHVybiB0aGlzLnN0YXRlLmdldFZhbHVlcygpO1xuICB9XG5cbiAgZ2V0KG5hbWUpIHtcbiAgICByZXR1cm4gdGhpcy5zdGF0ZS5nZXQobmFtZSk7XG4gIH1cblxuICBzZXQodXBkYXRlcykge1xuICAgIHRoaXMuc3RhdGUuc2V0KHVwZGF0ZXMpO1xuICB9XG5cbiAgYXN5bmMgaW5pdCgpIHtcbiAgICAvLyBwYXJzZSBleGlzdGluZyBwcmVzZXRzXG4gICAgdGhpcy5ncmFwaFByZXNldHMgPSBuZXcgTWFwKCk7XG4gICAgbGV0IGxlYXJuaW5nUHJlc2V0cyA9IHt9O1xuXG4gICAgY29uc3QgZmlsZVRyZWUgPSB0aGlzLmNvbW8uZmlsZVdhdGNoZXIuc3RhdGUuZ2V0KCdwcmVzZXRzJyk7XG5cbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGZpbGVUcmVlLmNoaWxkcmVuLmxlbmd0aDsgaSsrKSB7XG4gICAgICBjb25zdCBsZWFmID0gZmlsZVRyZWUuY2hpbGRyZW5baV07XG5cbiAgICAgIC8vIGdyYXBoIHByZXNldHNcbiAgICAgIGlmIChsZWFmLnR5cGUgPT09ICdkaXJlY3RvcnknKSB7XG4gICAgICAgIGNvbnN0IHByZXNldE5hbWUgPSBsZWFmLm5hbWU7XG4gICAgICAgIGNvbnN0IGRhdGFHcmFwaCA9IGF3YWl0IGRiLnJlYWQocGF0aC5qb2luKGxlYWYucGF0aCwgJ2dyYXBoLWRhdGEuanNvbicpKTtcbiAgICAgICAgY29uc3QgYXVkaW9HcmFwaCA9IGF3YWl0IGRiLnJlYWQocGF0aC5qb2luKGxlYWYucGF0aCwgJ2dyYXBoLWF1ZGlvLmpzb24nKSk7XG4gICAgICAgIGNvbnN0IHByZXNldCA9IHsgZGF0YTogZGF0YUdyYXBoLCBhdWRpbzogYXVkaW9HcmFwaCB9O1xuICAgICAgICB0aGlzLmdyYXBoUHJlc2V0cy5zZXQocHJlc2V0TmFtZSwgcHJlc2V0KTtcbiAgICAgIH1cblxuICAgICAgLy8gbGVhcm5pbmcgcHJlc2V0c1xuICAgICAgaWYgKGxlYWYudHlwZSA9PT0gJ2ZpbGUnICYmIGxlYWYubmFtZSA9PT0gJ2xlYXJuaW5nLXByZXNldHMuanNvbicpIHtcbiAgICAgICAgbGVhcm5pbmdQcmVzZXRzID0gYXdhaXQgZGIucmVhZChsZWFmLnBhdGgpO1xuICAgICAgfVxuICAgIH1cblxuICAgIHRoaXMuc3RhdGUgPSBhd2FpdCB0aGlzLmNvbW8uc2VydmVyLnN0YXRlTWFuYWdlci5jcmVhdGUoJ3Byb2plY3QnLCB7XG4gICAgICBncmFwaFByZXNldHM6IEFycmF5LmZyb20odGhpcy5ncmFwaFByZXNldHMua2V5cygpKSxcbiAgICAgIGxlYXJuaW5nUHJlc2V0czogbGVhcm5pbmdQcmVzZXRzLFxuICAgIH0pO1xuXG4gICAgdGhpcy5jb21vLnNlcnZlci5zdGF0ZU1hbmFnZXIub2JzZXJ2ZShhc3luYyAoc2NoZW1hTmFtZSwgc3RhdGVJZCwgbm9kZUlkKSA9PiB7XG4gICAgICAvLyB0cmFjayBwbGF5ZXJzXG4gICAgICBpZiAoc2NoZW1hTmFtZSA9PT0gJ3BsYXllcicpIHtcbiAgICAgICAgY29uc3QgcGxheWVyU3RhdGUgPSBhd2FpdCB0aGlzLmNvbW8uc2VydmVyLnN0YXRlTWFuYWdlci5hdHRhY2goc2NoZW1hTmFtZSwgc3RhdGVJZCk7XG4gICAgICAgIGNvbnN0IHBsYXllcklkID0gcGxheWVyU3RhdGUuZ2V0KCdpZCcpO1xuXG4gICAgICAgIHBsYXllclN0YXRlLm9uRGV0YWNoKCgpID0+IHtcbiAgICAgICAgICB0aGlzLmNsZWFyU3RyZWFtUm91dGluZyhwbGF5ZXJJZCwgbnVsbCk7IC8vIGNsZWFyIHJvdXRpbmcgd2hlcmUgcGxheWVyIGlzIHRoZSBzb3VyY2VcbiAgICAgICAgICB0aGlzLnBsYXllcnMuZGVsZXRlKHBsYXllcklkKVxuICAgICAgICB9KTtcblxuICAgICAgICAvLyBtYXliZSBtb3ZlIHRoaXMgaW4gU2Vzc2lvbiwgd291bGQgYmUgbW9yZSBsb2dpY2FsLi4uXG4gICAgICAgIHBsYXllclN0YXRlLnN1YnNjcmliZSh1cGRhdGVzID0+IHtcbiAgICAgICAgICBmb3IgKGxldCBbbmFtZSwgdmFsdWVzXSBvZiBPYmplY3QuZW50cmllcyh1cGRhdGVzKSkge1xuICAgICAgICAgICAgc3dpdGNoIChuYW1lKSB7XG4gICAgICAgICAgICAgIC8vIHJlc2V0IHBsYXllciBzdGF0ZSB3aGVuIGl0IGNoYW5nZSBzZXNzaW9uXG4gICAgICAgICAgICAgIC8vIEBub3RlIC0gdGhpcyBjb3VsZCBiZSBhIGtpbmQgb2YgcmVkdWNlciBwcm92aWRlZCBieVxuICAgICAgICAgICAgICAvLyB0aGUgc3RhdGVNYW5hZ2VyIGl0c2VsZiAoc291bmR3b3Jrcy9jb3JlIGlzc3VlKVxuICAgICAgICAgICAgICBjYXNlICdzZXNzaW9uSWQnOiB7XG4gICAgICAgICAgICAgICAgY29uc3Qgc2Vzc2lvbklkID0gdmFsdWVzO1xuXG4gICAgICAgICAgICAgICAgaWYgKHNlc3Npb25JZCAhPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgICAgY29uc3Qgc2Vzc2lvbiA9IHRoaXMuc2Vzc2lvbnMuZ2V0KHNlc3Npb25JZCk7XG5cbiAgICAgICAgICAgICAgICAgIGlmICghc2Vzc2lvbikge1xuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLndhcm4oYFtjb21vXSByZXF1aXJlZCBzZXNzaW9uIFwiJHtzZXNzaW9uSWR9XCIgZG9lcyBub3QgZXhpc3RzYCk7XG4gICAgICAgICAgICAgICAgICAgIHBsYXllclN0YXRlLnNldCh7IHNlc3Npb25JZDogbnVsbCB9KTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICBjb25zdCBkZWZhdWx0TGFiZWwgPSBzZXNzaW9uLmdldCgnbGFiZWxzJylbMF07XG4gICAgICAgICAgICAgICAgICBjb25zdCBncmFwaE9wdGlvbnMgPSBzZXNzaW9uLmdldCgnZ3JhcGhPcHRpb25zJyk7XG5cbiAgICAgICAgICAgICAgICAgIHBsYXllclN0YXRlLnNldCh7XG4gICAgICAgICAgICAgICAgICAgIGxhYmVsOiBkZWZhdWx0TGFiZWwsXG4gICAgICAgICAgICAgICAgICAgIHJlY29yZGluZ1N0YXRlOiAnaWRsZScsXG4gICAgICAgICAgICAgICAgICAgIGdyYXBoT3B0aW9ucyxcbiAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICBwbGF5ZXJTdGF0ZS5zZXQoe1xuICAgICAgICAgICAgICAgICAgICBsYWJlbDogJycsXG4gICAgICAgICAgICAgICAgICAgIHJlY29yZGluZ1N0YXRlOiAnaWRsZScsXG4gICAgICAgICAgICAgICAgICAgIGdyYXBoT3B0aW9uczogbnVsbCxcbiAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgIGNhc2UgJ2dyYXBoT3B0aW9uc0V2ZW50Jzoge1xuICAgICAgICAgICAgICAgIGNvbnN0IG9wdGlvbnNVcGRhdGVzID0gdmFsdWVzO1xuICAgICAgICAgICAgICAgIGNvbnN0IGdyYXBoT3B0aW9ucyA9IHBsYXllclN0YXRlLmdldCgnZ3JhcGhPcHRpb25zJyk7XG5cbiAgICAgICAgICAgICAgICBmb3IgKGxldCBtb2R1bGVJZCBpbiBvcHRpb25zVXBkYXRlcykge1xuICAgICAgICAgICAgICAgICAgT2JqZWN0LmFzc2lnbihncmFwaE9wdGlvbnNbbW9kdWxlSWRdLCBvcHRpb25zVXBkYXRlc1ttb2R1bGVJZF0pO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHBsYXllclN0YXRlLnNldCh7IGdyYXBoT3B0aW9ucyB9KTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cbiAgICAgICAgdGhpcy5wbGF5ZXJzLnNldChwbGF5ZXJJZCwgcGxheWVyU3RhdGUpO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgLy8gdHJhY2sgZmlsZSBzeXN0ZW1cbiAgICB0aGlzLmNvbW8uZmlsZVdhdGNoZXIuc3RhdGUuc3Vic2NyaWJlKHVwZGF0ZXMgPT4ge1xuICAgICAgZm9yIChsZXQgbmFtZSBpbiB1cGRhdGVzKSB7XG4gICAgICAgIHN3aXRjaCAobmFtZSkge1xuICAgICAgICAgIGNhc2UgJ2F1ZGlvJzpcbiAgICAgICAgICAgIHRoaXMuX3VwZGF0ZUF1ZGlvRmlsZXNGcm9tRmlsZVN5c3RlbSh1cGRhdGVzW25hbWVdKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIGNhc2UgJ3Nlc3Npb25zJzpcbiAgICAgICAgICAgIHRoaXMuX3VwZGF0ZVNlc3Npb25zRnJvbUZpbGVTeXN0ZW0odXBkYXRlc1tuYW1lXSk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0pO1xuXG4gICAgYXdhaXQgdGhpcy5fdXBkYXRlQXVkaW9GaWxlc0Zyb21GaWxlU3lzdGVtKHRoaXMuY29tby5maWxlV2F0Y2hlci5zdGF0ZS5nZXQoJ2F1ZGlvJykpO1xuICAgIGF3YWl0IHRoaXMuX3VwZGF0ZVNlc3Npb25zRnJvbUZpbGVTeXN0ZW0odGhpcy5jb21vLmZpbGVXYXRjaGVyLnN0YXRlLmdldCgnc2Vzc2lvbnMnKSk7XG4gIH1cblxuICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAvLyBTRVNTSU9OU1xuICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICBhc3luYyBjcmVhdGVTZXNzaW9uKHNlc3Npb25OYW1lLCBncmFwaFByZXNldCkge1xuICAgIGNvbnN0IG92ZXJ2aWV3ID0gdGhpcy5nZXQoJ3Nlc3Npb25zT3ZlcnZpZXcnKTtcbiAgICAvLyBAbm90ZSAtIHRoaXMgY291bGQgcHJvYmFibHkgYmUgbW9yZSByb2J1c3RcbiAgICBjb25zdCBpZCA9IHNsdWdpZnkoc2Vzc2lvbk5hbWUpO1xuICAgIC8vIGZpbmQgaWYgYSBzZXNzaW9uIHcvIHRoZSBzYW1lIG5hbWUgb3Igc2x1ZyBhbHJlYWR5IGV4aXN0c1xuICAgIGNvbnN0IGluZGV4ID0gb3ZlcnZpZXcuZmluZEluZGV4KG92ZXJ2aWV3ID0+IHtcbiAgICAgIHJldHVybiBvdmVydmlldy5uYW1lID09PSBzZXNzaW9uTmFtZSB8fCBvdmVydmlldy5pZCA9PT0gaWQ7XG4gICAgfSk7XG5cbiAgICBpZiAoaW5kZXggPT09IC0xKSB7XG4gICAgICBjb25zdCBhdWRpb0ZpbGVzID0gdGhpcy5nZXQoJ2F1ZGlvRmlsZXMnKTtcbiAgICAgIGNvbnN0IGdyYXBoID0gdGhpcy5ncmFwaFByZXNldHMuZ2V0KGdyYXBoUHJlc2V0KTtcbiAgICAgIGNvbnN0IHNlc3Npb24gPSBhd2FpdCBTZXNzaW9uLmNyZWF0ZSh0aGlzLmNvbW8sIGlkLCBzZXNzaW9uTmFtZSwgZ3JhcGgsIGF1ZGlvRmlsZXMpO1xuXG4gICAgICB0aGlzLnNlc3Npb25zLnNldChpZCwgc2Vzc2lvbik7XG4gICAgICB0aGlzLl91cGRhdGVTZXNzaW9uc092ZXJ2aWV3KCk7XG5cbiAgICAgIHJldHVybiBpZDtcbiAgICB9XG5cbiAgICAvLyBjb25zb2xlLmxvZyhgPiBzZXNzaW9uIFwiJHtzZXNzaW9uTmFtZX1cIiBhbHJlYWR5IGV4aXN0c2ApO1xuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgYXN5bmMgZGVsZXRlU2Vzc2lvbihpZCkge1xuICAgIGlmICh0aGlzLnNlc3Npb25zLmhhcyhpZCkpIHtcbiAgICAgIGNvbnN0IHNlc3Npb24gPSB0aGlzLnNlc3Npb25zLmdldChpZCk7XG4gICAgICBjb25zdCBmdWxscGF0aCA9IHNlc3Npb24uZGlyZWN0b3J5O1xuXG4gICAgICB0aGlzLnNlc3Npb25zLmRlbGV0ZShpZCk7XG4gICAgICBhd2FpdCBzZXNzaW9uLmRlbGV0ZSgpO1xuXG4gICAgICAvLyBXZSBjYW4gY29tZSBmcm9tIDIgcGF0aHMgaGVyZTpcbiAgICAgIC8vIDEuIGlmIHRoZSBmaWxlIHN0aWxsIGV4aXN0cywgdGhlIG1ldGhvZCBoYXMgYmVlbiBjYWxsZWQgcHJvZ3JhbW1hdGljYWxseSBzb1xuICAgICAgLy8gd2UgbmVlZCB0byByZW1vdmUgdGhlIGZpbGUuIFRoaXMgd2lsbCB0cmlnZ2VyIGBfdXBkYXRlU2Vzc2lvbnNGcm9tRmlsZVN5c3RlbWBcbiAgICAgIC8vIGJ1dCBub3RoaW5nIHNob3VsZCBhcHBlbmQgdGhlcmUsIHRoYXQncyB3aHkgd2UgdXBkYXRlIHRoZVxuICAgICAgLy8gYHNlc3Npb25PdmVydmlld2AgaGVyZS5cbiAgICAgIC8vIDIuIGlmIHRoZSBmaWxlIGhhcyBiZWVuIHJlbW92ZWQgbWFudWFsbHkgd2UgYXJlIGNhbGxlZCBmcm9tXG4gICAgICAvLyBgX3VwZGF0ZVNlc3Npb25zRnJvbUZpbGVTeXN0ZW1gIHRoZW4gd2UgZG9uJ3Qgd2FudCB0byBtYW5pcHVsYXRlXG4gICAgICAvLyB0aGUgZmlsZSBzeXN0ZW0sIG5vciB1cGRhdGUgdGhlIGBzZXNzaW9uc092ZXJ2aWV3YC5cbiAgICAgIGlmIChmcy5leGlzdHNTeW5jKHNlc3Npb24uZGlyZWN0b3J5KSkge1xuICAgICAgICBhd2FpdCBkYi5kZWxldGUoc2Vzc2lvbi5kaXJlY3RvcnkpO1xuICAgICAgICB0aGlzLl91cGRhdGVTZXNzaW9uc092ZXJ2aWV3KCk7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIGFzeW5jIF91cGRhdGVTZXNzaW9uc0Zyb21GaWxlU3lzdGVtKHNlc3Npb25GaWxlc1RyZWUpIHtcbiAgICBjb25zdCBpbk1lbW9yeVNlc3Npb25zID0gQXJyYXkuZnJvbSh0aGlzLnNlc3Npb25zLnZhbHVlcygpKTtcbiAgICBjb25zdCBmaWxlVHJlZVNlc3Npb25zT3ZlcnZpZXcgPSBzZXNzaW9uRmlsZXNUcmVlXG4gICAgICAuY2hpbGRyZW5cbiAgICAgIC5maWx0ZXIobGVhZiA9PiBsZWFmLnR5cGUgPT09ICdkaXJlY3RvcnknKVxuICAgICAgLm1hcChkaXIgPT4ge1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIGlkOiBkaXIubmFtZSxcbiAgICAgICAgICBjb25maWdQYXRoOiBkaXIucGF0aCxcbiAgICAgICAgfTtcbiAgICAgIH0pO1xuXG4gICAgY29uc3Qge1xuICAgICAgaW50ZXJzZWN0aW9uLFxuICAgICAgY3JlYXRlZCxcbiAgICAgIGRlbGV0ZWRcbiAgICB9ID0gZGlmZkFycmF5cyhpbk1lbW9yeVNlc3Npb25zLCBmaWxlVHJlZVNlc3Npb25zT3ZlcnZpZXcsIGVsID0+IGVsLmlkKTtcblxuICAgIC8vIG5vdCBpbnN0YW5jaWF0ZWQgYnV0IHByZXNlbnQgaW4gZmlsZSBzeXN0ZW1cbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGNyZWF0ZWQubGVuZ3RoOyBpKyspIHtcbiAgICAgIGNvbnN0IHNlc3Npb25PdmVydmlldyA9IGNyZWF0ZWRbaV07XG5cbiAgICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IGF1ZGlvRmlsZXMgPSB0aGlzLmdldCgnYXVkaW9GaWxlcycpO1xuICAgICAgICBjb25zdCBzZXNzaW9uID0gYXdhaXQgU2Vzc2lvbi5mcm9tRmlsZVN5c3RlbSh0aGlzLmNvbW8sIHNlc3Npb25PdmVydmlldy5jb25maWdQYXRoLCBhdWRpb0ZpbGVzKTtcblxuICAgICAgICB0aGlzLnNlc3Npb25zLnNldChzZXNzaW9uT3ZlcnZpZXcuaWQsIHNlc3Npb24pO1xuICAgICAgfSBjYXRjaChlcnIpIHtcbiAgICAgICAgY29uc29sZS5sb2coYD4gY2Fubm90IGluc3RhbmNpYXRlIHNlc3Npb24gJHtzZXNzaW9uT3ZlcnZpZXcuaWR9YCk7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoZXJyKTtcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgLy8gaW5zdGFuY2lhdGVkIGJ1dCBhYnNlbnQgZnJvbSBmaWxlIHN5c3RlbVxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZGVsZXRlZC5sZW5ndGg7IGkrKykge1xuICAgICAgY29uc3QgaWQgPSBkZWxldGVkW2ldLmlkO1xuICAgICAgYXdhaXQgdGhpcy5kZWxldGVTZXNzaW9uKGlkKTtcbiAgICB9XG5cbiAgICAvLyB1cGRhdGUgb3ZlcnZpZXcgaWYgc29tZSBzZXNzaW9ucyBoYXZlIGJlZW4gY3JlYXRlZCBvciBkZWxldGVkXG4gICAgaWYgKGNyZWF0ZWQubGVuZ3RoIHx8wqBkZWxldGVkLmxlbmd0aCkge1xuICAgICAgdGhpcy5fdXBkYXRlU2Vzc2lvbnNPdmVydmlldygpO1xuICAgIH1cbiAgfVxuXG4gIF91cGRhdGVTZXNzaW9uc092ZXJ2aWV3KCkge1xuICAgIGNvbnN0IHNlc3Npb25zT3ZlcnZpZXcgPSBBcnJheS5mcm9tKHRoaXMuc2Vzc2lvbnMudmFsdWVzKCkpXG4gICAgICAubWFwKHNlc3Npb24gPT4ge1xuICAgICAgICBjb25zdCBzdGF0ZUlkID0gc2Vzc2lvbi5zdGF0ZS5pZDtcbiAgICAgICAgY29uc3QgeyBpZCwgbmFtZSB9ID0gc2Vzc2lvbi5zdGF0ZS5nZXRWYWx1ZXMoKTtcblxuICAgICAgICByZXR1cm4geyBpZCwgbmFtZSwgc3RhdGVJZCB9O1xuICAgICAgfSk7XG5cbiAgICB0aGlzLnNldCh7IHNlc3Npb25zT3ZlcnZpZXcgfSk7XG4gIH1cblxuICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAvLyBST1VUSU5HXG4gIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbiAgLyoqXG4gICAqIGZyb20gLSBwbGF5ZXJJZCAtIHRoZSBsb2dpY2FsIGNsaWVudCwgQ29NbyBwbGF5ZXIgaW5zdGFuY2VcbiAgICogdG8gLSBub2RlSWQgLSB0aGUgcGh5c2ljYWwgY2xpZW50LCBzb3VuZHdvcmtzIGNsaWVudCBpbnN0YW5jZVxuICAgKi9cbiAgYXN5bmMgY3JlYXRlU3RyZWFtUm91dGUoZnJvbSwgdG8pIHtcbiAgICBjb25zdCBzdHJlYW1zUm91dGluZyA9IHRoaXMuZ2V0KCdzdHJlYW1zUm91dGluZycpO1xuICAgIGNvbnN0IGluZGV4ID0gc3RyZWFtc1JvdXRpbmcuZmluZEluZGV4KHIgPT4gclswXSA9PT0gZnJvbSAmJiByWzFdID09PSB0byk7XG5cbiAgICBpZiAoaW5kZXggPT09IC0xKSB7XG4gICAgICBjb25zdCBpc1NvdXJjZVN0cmVhbWluZyA9IHN0cmVhbXNSb3V0aW5nLnJlZHVjZSgoYWNjLCByKSA9PiBhY2MgfHwgclswXSA9PT0gZnJvbSwgZmFsc2UpO1xuICAgICAgY29uc3QgY3JlYXRlZCA9IFtmcm9tLCB0b107XG4gICAgICBzdHJlYW1zUm91dGluZy5wdXNoKGNyZWF0ZWQpO1xuXG4gICAgICAvLyBjb25zb2xlLmxvZygnY3JlYXRlU3RyZWFtUm91dGUnLCBzdHJlYW1zUm91dGluZyk7XG4gICAgICB0aGlzLnNldCh7IHN0cmVhbXNSb3V0aW5nIH0pO1xuICAgICAgLy8gbm90aWZ5IHBsYXllciB0aGF0IGl0IHNob3VsZCBzdGFydCB0byBzdHJlYW0gaXRzIHNvdXJjZVxuICAgICAgaWYgKCFpc1NvdXJjZVN0cmVhbWluZykge1xuICAgICAgICBjb25zdCBwbGF5ZXIgPSB0aGlzLnBsYXllcnMuZ2V0KGZyb20pO1xuICAgICAgICBwbGF5ZXIuc2V0KHsgc3RyZWFtU291cmNlOiB0cnVlIH0pO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBhc3luYyBkZWxldGVTdHJlYW1Sb3V0ZShmcm9tLCB0bykge1xuICAgIGNvbnN0IHN0cmVhbXNSb3V0aW5nID0gdGhpcy5nZXQoJ3N0cmVhbXNSb3V0aW5nJyk7XG4gICAgY29uc3QgaW5kZXggPSBzdHJlYW1zUm91dGluZy5maW5kSW5kZXgociA9PiByWzBdID09PSBmcm9tICYmIHJbMV0gPT09IHRvKTtcblxuICAgIGlmIChpbmRleCAhPT0gLTEpIHtcbiAgICAgIGNvbnN0IGRlbGV0ZWQgPSBzdHJlYW1zUm91dGluZ1tpbmRleF07XG4gICAgICBzdHJlYW1zUm91dGluZy5zcGxpY2UoaW5kZXgsIDEpO1xuXG4gICAgICAvLyBjb25zb2xlLmxvZygnZGVsZXRlU3RyZWFtUm91dGUnLCBzdHJlYW1zUm91dGluZyk7XG4gICAgICBhd2FpdCB0aGlzLnNldCh7IHN0cmVhbXNSb3V0aW5nIH0pO1xuXG4gICAgICBjb25zdCBpc1NvdXJjZVN0cmVhbWluZyA9IHN0cmVhbXNSb3V0aW5nLnJlZHVjZSgoYWNjLCByKSA9PiBhY2MgfHwgclswXSA9PT0gZnJvbSwgZmFsc2UpO1xuXG4gICAgICAvLyBub3RpZnkgcGxheWVyIHRoYXQgaXQgc2hvdWxkIHN0b3Agc3RyZWFtaW5nIGl0cyBzb3VyY2VcbiAgICAgIGlmICghaXNTb3VyY2VTdHJlYW1pbmcpIHtcbiAgICAgICAgY29uc3QgcGxheWVyID0gdGhpcy5wbGF5ZXJzLmdldChmcm9tKTtcbiAgICAgICAgcGxheWVyLnNldCh7IHN0cmVhbVNvdXJjZTogZmFsc2UgfSk7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIGFzeW5jIGNsZWFyU3RyZWFtUm91dGluZyhmcm9tID0gbnVsbCwgdG8gPSBudWxsKSB7XG4gICAgY29uc3Qgc3RyZWFtc1JvdXRpbmcgPSB0aGlzLmdldCgnc3RyZWFtc1JvdXRpbmcnKTtcbiAgICBjb25zdCBkZWxldGVkID0gW107XG5cbiAgICBmb3IgKGxldCBpID0gc3RyZWFtc1JvdXRpbmcubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcbiAgICAgIGNvbnN0IHJvdXRlID0gc3RyZWFtc1JvdXRpbmdbaV07XG5cbiAgICAgIGlmIChyb3V0ZVswXSA9PT0gZnJvbSB8fMKgcm91dGVbMV0gPT09IHRvKSB7XG4gICAgICAgIGRlbGV0ZWQucHVzaChyb3V0ZSk7XG4gICAgICAgIHN0cmVhbXNSb3V0aW5nLnNwbGljZShpLCAxKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBjb25zb2xlLmxvZygnY2xlYXJTdHJlYW1Sb3V0ZScsIHN0cmVhbXNSb3V0aW5nKTtcbiAgICB0aGlzLnNldCh7IHN0cmVhbXNSb3V0aW5nIH0pO1xuXG4gICAgLy8gbm90aWZ5IHBvc3NpYmxlIHNvdXJjZXMgdGhhdCB0aGV5IHNob3VsZCBzdG9wIHN0cmVhbWluZ1xuICAgIHRoaXMucGxheWVycy5mb3JFYWNoKChwbGF5ZXIsIGtleSkgPT4ge1xuICAgICAgY29uc3QgaXNTb3VyY2VTdHJlYW1pbmcgPSBzdHJlYW1zUm91dGluZy5yZWR1Y2UoKGFjYywgcikgPT4gYWNjIHx8IHJbMF0gPT09IGtleSwgZmFsc2UpO1xuXG4gICAgICBpZiAoIWlzU291cmNlU3RyZWFtaW5nICYmIHBsYXllci5nZXQoJ3N0cmVhbVNvdXJjZScpID09PSB0cnVlKSB7XG4gICAgICAgIHBsYXllci5zZXQoeyBzdHJlYW1Tb3VyY2U6IGZhbHNlIH0pO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgcHJvcGFnYXRlU3RyZWFtRnJhbWUoZnJhbWUpIHtcbiAgICAvLyBAdG9kbyAtIHdlIG5lZWQgdG8gbW92ZSB0aGlzIGludG8gYFByb2pldGAgc28gdGhhdCBpdCBjYW4gYmUgY2FsbGVkXG4gICAgLy8gZGlyZWN0bHkgZnJvbSBzZXJ2ZXIgc2lkZSB3aXRoIGFuIGFyYml0cmFyeSBmcmFtZS4uLlxuICAgIGNvbnN0IHJvdXRlcyA9IHRoaXMuZ2V0KCdzdHJlYW1zUm91dGluZycpO1xuICAgIGNvbnN0IGZyb21JZCA9IGZyYW1lWzBdO1xuXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCByb3V0ZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgIGNvbnN0IHJvdXRlID0gcm91dGVzW2ldO1xuICAgICAgaWYgKHJvdXRlWzBdID09PSBmcm9tSWQpIHtcbiAgICAgICAgY29uc3QgdGFyZ2V0Q2xpZW50ID0gdGhpcy5jb21vLmlkQ2xpZW50TWFwLmdldChyb3V0ZVsxXSk7XG5cbiAgICAgICAgLy8gaWYgd2UgaGF2ZSBhIGNsaWVudCB3aXRoIHRoZSByaWdodCBub2RlSWRcbiAgICAgICAgaWYgKHRhcmdldENsaWVudCkge1xuICAgICAgICAgIHRhcmdldENsaWVudC5zb2NrZXQuc2VuZEJpbmFyeSgnc3RyZWFtJywgZnJhbWUpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vIG1pZ2h0IGJlIGFuIE9TQyB0YXJnZXQgY2xpZW50XG4gICAgICAgICAgLy8gb3NjLnNlbmQoJy9zdHJlYW0vJHtyb3V0ZVsxXX0vJHtyb3V0ZVswXX0nLCBmcmFtZSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAvLyBBVURJTyBGSUxFU1xuICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICBhc3luYyBfdXBkYXRlQXVkaW9GaWxlc0Zyb21GaWxlU3lzdGVtKGF1ZGlvRmlsZXNUcmVlKSB7XG4gICAgLy8gZmlsdGVyIGV2ZXJ5dGhpbiB0aGF0IGlzIG5vdCBhIC53YXYgb3IgYSAubXAzIGZpbGVcbiAgICBjb25zdCBhdWRpb0ZpbGVzID0gYXVkaW9GaWxlc1RyZWUuY2hpbGRyZW5cbiAgICAgIC5maWx0ZXIobGVhZiA9PiBsZWFmLnR5cGUgPT09ICdmaWxlJyAmJiBbJy5tcDMnLCAnLndhdiddLmluZGV4T2YobGVhZi5leHRlbnNpb24pICE9PSAtMSlcbiAgICAgIC5tYXAoKHsgbmFtZSwgdXJsLCBleHRlbnNpb24gfSkgPT4geyByZXR1cm4geyBuYW1lLCB1cmwsIGV4dGVuc2lvbiB9IH0pO1xuXG4gICAgdGhpcy5zdGF0ZS5zZXQoeyBhdWRpb0ZpbGVzIH0pO1xuXG4gICAgLy8gQHRvZG8gLSBjbGVhbiBzZXNzaW9uc1xuICAgIGZvciAobGV0IHNlc3Npb24gb2YgdGhpcy5zZXNzaW9ucy52YWx1ZXMoKSkge1xuICAgICAgYXdhaXQgc2Vzc2lvbi51cGRhdGVBdWRpb0ZpbGVzRnJvbUZpbGVTeXN0ZW0oYXVkaW9GaWxlcyk7O1xuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBQcm9qZWN0O1xuIl19