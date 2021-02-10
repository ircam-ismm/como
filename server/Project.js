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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9zZXJ2ZXIvUHJvamVjdC5qcyJdLCJuYW1lcyI6WyJQcm9qZWN0IiwiY29uc3RydWN0b3IiLCJjb21vIiwic3RhdGUiLCJwbGF5ZXJzIiwiTWFwIiwic2Vzc2lvbnMiLCJzZXJ2ZXIiLCJzdGF0ZU1hbmFnZXIiLCJyZWdpc3RlclNjaGVtYSIsInByb2plY3RTY2hlbWEiLCJzZXNzaW9uU2NoZW1hIiwicGxheWVyU2NoZW1hIiwic3Vic2NyaWJlIiwiZnVuYyIsImdldFZhbHVlcyIsImdldCIsIm5hbWUiLCJzZXQiLCJ1cGRhdGVzIiwiaW5pdCIsImdyYXBoUHJlc2V0cyIsImxlYXJuaW5nUHJlc2V0cyIsImZpbGVUcmVlIiwiZmlsZVdhdGNoZXIiLCJpIiwiY2hpbGRyZW4iLCJsZW5ndGgiLCJsZWFmIiwidHlwZSIsInByZXNldE5hbWUiLCJkYXRhR3JhcGgiLCJkYiIsInJlYWQiLCJwYXRoIiwiam9pbiIsImF1ZGlvR3JhcGgiLCJwcmVzZXQiLCJkYXRhIiwiYXVkaW8iLCJjcmVhdGUiLCJBcnJheSIsImZyb20iLCJrZXlzIiwib2JzZXJ2ZSIsInNjaGVtYU5hbWUiLCJzdGF0ZUlkIiwibm9kZUlkIiwicGxheWVyU3RhdGUiLCJhdHRhY2giLCJwbGF5ZXJJZCIsIm9uRGV0YWNoIiwiY2xlYXJTdHJlYW1Sb3V0aW5nIiwiZGVsZXRlIiwidmFsdWVzIiwiT2JqZWN0IiwiZW50cmllcyIsInNlc3Npb25JZCIsInNlc3Npb24iLCJjb25zb2xlIiwid2FybiIsImRlZmF1bHRMYWJlbCIsImdyYXBoT3B0aW9ucyIsImxhYmVsIiwicmVjb3JkaW5nU3RhdGUiLCJvcHRpb25zVXBkYXRlcyIsIm1vZHVsZUlkIiwiYXNzaWduIiwiX3VwZGF0ZUF1ZGlvRmlsZXNGcm9tRmlsZVN5c3RlbSIsIl91cGRhdGVTZXNzaW9uc0Zyb21GaWxlU3lzdGVtIiwiY3JlYXRlU2Vzc2lvbiIsInNlc3Npb25OYW1lIiwiZ3JhcGhQcmVzZXQiLCJvdmVydmlldyIsImlkIiwiaW5kZXgiLCJmaW5kSW5kZXgiLCJhdWRpb0ZpbGVzIiwiZ3JhcGgiLCJTZXNzaW9uIiwiX3VwZGF0ZVNlc3Npb25zT3ZlcnZpZXciLCJkZWxldGVTZXNzaW9uIiwiaGFzIiwiZnVsbHBhdGgiLCJkaXJlY3RvcnkiLCJmcyIsImV4aXN0c1N5bmMiLCJzZXNzaW9uRmlsZXNUcmVlIiwiaW5NZW1vcnlTZXNzaW9ucyIsImZpbGVUcmVlU2Vzc2lvbnNPdmVydmlldyIsImZpbHRlciIsIm1hcCIsImRpciIsImNvbmZpZ1BhdGgiLCJpbnRlcnNlY3Rpb24iLCJjcmVhdGVkIiwiZGVsZXRlZCIsImVsIiwic2Vzc2lvbk92ZXJ2aWV3IiwiZnJvbUZpbGVTeXN0ZW0iLCJlcnIiLCJsb2ciLCJlcnJvciIsInNlc3Npb25zT3ZlcnZpZXciLCJjcmVhdGVTdHJlYW1Sb3V0ZSIsInRvIiwic3RyZWFtc1JvdXRpbmciLCJyIiwiaXNTb3VyY2VTdHJlYW1pbmciLCJyZWR1Y2UiLCJhY2MiLCJwdXNoIiwicGxheWVyIiwic3RyZWFtU291cmNlIiwiZGVsZXRlU3RyZWFtUm91dGUiLCJzcGxpY2UiLCJyb3V0ZSIsImZvckVhY2giLCJrZXkiLCJwcm9wYWdhdGVTdHJlYW1GcmFtZSIsImZyYW1lIiwicm91dGVzIiwiZnJvbUlkIiwidGFyZ2V0Q2xpZW50IiwiaWRDbGllbnRNYXAiLCJzb2NrZXQiLCJzZW5kQmluYXJ5IiwiYXVkaW9GaWxlc1RyZWUiLCJpbmRleE9mIiwiZXh0ZW5zaW9uIiwidXJsIiwidXBkYXRlQXVkaW9GaWxlc0Zyb21GaWxlU3lzdGVtIl0sIm1hcHBpbmdzIjoiOzs7Ozs7O0FBQUE7O0FBQ0E7O0FBQ0E7O0FBQ0E7O0FBQ0E7O0FBRUE7O0FBQ0E7O0FBQ0E7O0FBRUE7O0FBQ0E7O0FBQ0E7Ozs7QUFFQTtBQUVBLE1BQU1BLE9BQU4sQ0FBYztBQUNaQyxFQUFBQSxXQUFXLENBQUNDLElBQUQsRUFBTztBQUNoQixTQUFLQSxJQUFMLEdBQVlBLElBQVo7QUFFQSxTQUFLQyxLQUFMLEdBQWEsSUFBYjtBQUNB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QUFLcEQsUUFBTCxDQUFjZ0QsTUFBZCxFQUFwQixFQUE0QztBQUMxQyxZQUFNSSxPQUFPLENBQUN5RSw4QkFBUixDQUF1Q3RELFVBQXZDLENBQU47QUFBeUQ7QUFDMUQ7QUFDRjs7QUF2WFc7O2VBMFhDN0UsTyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0IGZzIGZyb20gJ2ZzJztcbmltcG9ydCBKU09ONSBmcm9tICdqc29uNSc7XG5pbXBvcnQgeyB1dWlkIGFzIHV1aWR2NCB9IGZyb20gJ3V1aWR2NCc7XG5pbXBvcnQgc2x1Z2lmeSBmcm9tICdAc2luZHJlc29yaHVzL3NsdWdpZnknO1xuXG5pbXBvcnQgU2Vzc2lvbiBmcm9tICcuL1Nlc3Npb24nO1xuaW1wb3J0IGRiIGZyb20gJy4vdXRpbHMvZGInO1xuaW1wb3J0IGRpZmZBcnJheXMgZnJvbSAnLi4vY29tbW9uL3V0aWxzL2RpZmZBcnJheXMnO1xuXG5pbXBvcnQgcHJvamVjdFNjaGVtYSBmcm9tICcuL3NjaGVtYXMvcHJvamVjdC5qcyc7XG5pbXBvcnQgc2Vzc2lvblNjaGVtYSBmcm9tICcuL3NjaGVtYXMvc2Vzc2lvbi5qcyc7XG5pbXBvcnQgcGxheWVyU2NoZW1hIGZyb20gJy4vc2NoZW1hcy9wbGF5ZXIuanMnO1xuXG4vLyBjb25zdCBQUk9KRUNUX1ZFUlNJT04gPSAnMC4wLjAnO1xuXG5jbGFzcyBQcm9qZWN0IHtcbiAgY29uc3RydWN0b3IoY29tbykge1xuICAgIHRoaXMuY29tbyA9IGNvbW87XG5cbiAgICB0aGlzLnN0YXRlID0gbnVsbDtcbiAgICB0aGlzLnBsYXllcnMgPSBuZXcgTWFwKCk7XG4gICAgdGhpcy5zZXNzaW9ucyA9IG5ldyBNYXAoKTtcblxuICAgIHRoaXMuY29tby5zZXJ2ZXIuc3RhdGVNYW5hZ2VyLnJlZ2lzdGVyU2NoZW1hKCdwcm9qZWN0JywgcHJvamVjdFNjaGVtYSk7XG4gICAgdGhpcy5jb21vLnNlcnZlci5zdGF0ZU1hbmFnZXIucmVnaXN0ZXJTY2hlbWEoYHNlc3Npb25gLCBzZXNzaW9uU2NoZW1hKTtcbiAgICB0aGlzLmNvbW8uc2VydmVyLnN0YXRlTWFuYWdlci5yZWdpc3RlclNjaGVtYSgncGxheWVyJywgcGxheWVyU2NoZW1hKTtcbiAgfVxuXG4gIC8vIGBTdGF0ZWAgaW50ZXJmYWNlXG4gIHN1YnNjcmliZSgpIHtcbiAgICByZXR1cm4gdGhpcy5zdGF0ZS5zdWJzY3JpYmUoZnVuYyk7XG4gIH1cblxuICBnZXRWYWx1ZXMoKSB7XG4gICAgcmV0dXJuIHRoaXMuc3RhdGUuZ2V0VmFsdWVzKCk7XG4gIH1cblxuICBnZXQobmFtZSkge1xuICAgIHJldHVybiB0aGlzLnN0YXRlLmdldChuYW1lKTtcbiAgfVxuXG4gIHNldCh1cGRhdGVzKSB7XG4gICAgdGhpcy5zdGF0ZS5zZXQodXBkYXRlcyk7XG4gIH1cblxuICBhc3luYyBpbml0KCkge1xuICAgIC8vIHBhcnNlIGV4aXN0aW5nIHByZXNldHNcbiAgICB0aGlzLmdyYXBoUHJlc2V0cyA9IG5ldyBNYXAoKTtcbiAgICBsZXQgbGVhcm5pbmdQcmVzZXRzID0ge307XG5cbiAgICBjb25zdCBmaWxlVHJlZSA9IHRoaXMuY29tby5maWxlV2F0Y2hlci5zdGF0ZS5nZXQoJ3ByZXNldHMnKTtcblxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZmlsZVRyZWUuY2hpbGRyZW4ubGVuZ3RoOyBpKyspIHtcbiAgICAgIGNvbnN0IGxlYWYgPSBmaWxlVHJlZS5jaGlsZHJlbltpXTtcblxuICAgICAgLy8gZ3JhcGggcHJlc2V0c1xuICAgICAgaWYgKGxlYWYudHlwZSA9PT0gJ2RpcmVjdG9yeScpIHtcbiAgICAgICAgY29uc3QgcHJlc2V0TmFtZSA9IGxlYWYubmFtZTtcbiAgICAgICAgY29uc3QgZGF0YUdyYXBoID0gYXdhaXQgZGIucmVhZChwYXRoLmpvaW4obGVhZi5wYXRoLCAnZ3JhcGgtZGF0YS5qc29uJykpO1xuICAgICAgICBjb25zdCBhdWRpb0dyYXBoID0gYXdhaXQgZGIucmVhZChwYXRoLmpvaW4obGVhZi5wYXRoLCAnZ3JhcGgtYXVkaW8uanNvbicpKTtcbiAgICAgICAgY29uc3QgcHJlc2V0ID0geyBkYXRhOiBkYXRhR3JhcGgsIGF1ZGlvOiBhdWRpb0dyYXBoIH07XG4gICAgICAgIHRoaXMuZ3JhcGhQcmVzZXRzLnNldChwcmVzZXROYW1lLCBwcmVzZXQpO1xuICAgICAgfVxuXG4gICAgICAvLyBsZWFybmluZyBwcmVzZXRzXG4gICAgICBpZiAobGVhZi50eXBlID09PSAnZmlsZScgJiYgbGVhZi5uYW1lID09PSAnbGVhcm5pbmctcHJlc2V0cy5qc29uJykge1xuICAgICAgICBsZWFybmluZ1ByZXNldHMgPSBhd2FpdCBkYi5yZWFkKGxlYWYucGF0aCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgdGhpcy5zdGF0ZSA9IGF3YWl0IHRoaXMuY29tby5zZXJ2ZXIuc3RhdGVNYW5hZ2VyLmNyZWF0ZSgncHJvamVjdCcsIHtcbiAgICAgIGdyYXBoUHJlc2V0czogQXJyYXkuZnJvbSh0aGlzLmdyYXBoUHJlc2V0cy5rZXlzKCkpLFxuICAgICAgbGVhcm5pbmdQcmVzZXRzOiBsZWFybmluZ1ByZXNldHMsXG4gICAgfSk7XG5cbiAgICB0aGlzLmNvbW8uc2VydmVyLnN0YXRlTWFuYWdlci5vYnNlcnZlKGFzeW5jIChzY2hlbWFOYW1lLCBzdGF0ZUlkLCBub2RlSWQpID0+IHtcbiAgICAgIC8vIHRyYWNrIHBsYXllcnNcbiAgICAgIGlmIChzY2hlbWFOYW1lID09PSAncGxheWVyJykge1xuICAgICAgICBjb25zdCBwbGF5ZXJTdGF0ZSA9IGF3YWl0IHRoaXMuY29tby5zZXJ2ZXIuc3RhdGVNYW5hZ2VyLmF0dGFjaChzY2hlbWFOYW1lLCBzdGF0ZUlkKTtcbiAgICAgICAgY29uc3QgcGxheWVySWQgPSBwbGF5ZXJTdGF0ZS5nZXQoJ2lkJyk7XG5cbiAgICAgICAgcGxheWVyU3RhdGUub25EZXRhY2goKCkgPT4ge1xuICAgICAgICAgIHRoaXMuY2xlYXJTdHJlYW1Sb3V0aW5nKHBsYXllcklkLCBudWxsKTsgLy8gY2xlYXIgcm91dGluZyB3aGVyZSBwbGF5ZXIgaXMgdGhlIHNvdXJjZVxuICAgICAgICAgIHRoaXMucGxheWVycy5kZWxldGUocGxheWVySWQpXG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIG1heWJlIG1vdmUgdGhpcyBpbiBTZXNzaW9uLCB3b3VsZCBiZSBtb3JlIGxvZ2ljYWwuLi5cbiAgICAgICAgcGxheWVyU3RhdGUuc3Vic2NyaWJlKHVwZGF0ZXMgPT4ge1xuICAgICAgICAgIGZvciAobGV0IFtuYW1lLCB2YWx1ZXNdIG9mIE9iamVjdC5lbnRyaWVzKHVwZGF0ZXMpKSB7XG4gICAgICAgICAgICBzd2l0Y2ggKG5hbWUpIHtcbiAgICAgICAgICAgICAgLy8gcmVzZXQgcGxheWVyIHN0YXRlIHdoZW4gaXQgY2hhbmdlIHNlc3Npb25cbiAgICAgICAgICAgICAgLy8gQG5vdGUgLSB0aGlzIGNvdWxkIGJlIGEga2luZCBvZiByZWR1Y2VyIHByb3ZpZGVkIGJ5XG4gICAgICAgICAgICAgIC8vIHRoZSBzdGF0ZU1hbmFnZXIgaXRzZWxmIChzb3VuZHdvcmtzL2NvcmUgaXNzdWUpXG4gICAgICAgICAgICAgIGNhc2UgJ3Nlc3Npb25JZCc6IHtcbiAgICAgICAgICAgICAgICBjb25zdCBzZXNzaW9uSWQgPSB2YWx1ZXM7XG5cbiAgICAgICAgICAgICAgICBpZiAoc2Vzc2lvbklkICE9PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgICBjb25zdCBzZXNzaW9uID0gdGhpcy5zZXNzaW9ucy5nZXQoc2Vzc2lvbklkKTtcblxuICAgICAgICAgICAgICAgICAgaWYgKCFzZXNzaW9uKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUud2FybihgW2NvbW9dIHJlcXVpcmVkIHNlc3Npb24gXCIke3Nlc3Npb25JZH1cIiBkb2VzIG5vdCBleGlzdHNgKTtcbiAgICAgICAgICAgICAgICAgICAgcGxheWVyU3RhdGUuc2V0KHsgc2Vzc2lvbklkOiBudWxsIH0pO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgIGNvbnN0IGRlZmF1bHRMYWJlbCA9IHNlc3Npb24uZ2V0KCdsYWJlbHMnKVswXTtcbiAgICAgICAgICAgICAgICAgIGNvbnN0IGdyYXBoT3B0aW9ucyA9IHNlc3Npb24uZ2V0KCdncmFwaE9wdGlvbnMnKTtcblxuICAgICAgICAgICAgICAgICAgcGxheWVyU3RhdGUuc2V0KHtcbiAgICAgICAgICAgICAgICAgICAgbGFiZWw6IGRlZmF1bHRMYWJlbCxcbiAgICAgICAgICAgICAgICAgICAgcmVjb3JkaW5nU3RhdGU6ICdpZGxlJyxcbiAgICAgICAgICAgICAgICAgICAgZ3JhcGhPcHRpb25zLFxuICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgIHBsYXllclN0YXRlLnNldCh7XG4gICAgICAgICAgICAgICAgICAgIGxhYmVsOiAnJyxcbiAgICAgICAgICAgICAgICAgICAgcmVjb3JkaW5nU3RhdGU6ICdpZGxlJyxcbiAgICAgICAgICAgICAgICAgICAgZ3JhcGhPcHRpb25zOiBudWxsLFxuICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgY2FzZSAnZ3JhcGhPcHRpb25zRXZlbnQnOiB7XG4gICAgICAgICAgICAgICAgY29uc3Qgb3B0aW9uc1VwZGF0ZXMgPSB2YWx1ZXM7XG4gICAgICAgICAgICAgICAgY29uc3QgZ3JhcGhPcHRpb25zID0gcGxheWVyU3RhdGUuZ2V0KCdncmFwaE9wdGlvbnMnKTtcblxuICAgICAgICAgICAgICAgIGZvciAobGV0IG1vZHVsZUlkIGluIG9wdGlvbnNVcGRhdGVzKSB7XG4gICAgICAgICAgICAgICAgICBPYmplY3QuYXNzaWduKGdyYXBoT3B0aW9uc1ttb2R1bGVJZF0sIG9wdGlvbnNVcGRhdGVzW21vZHVsZUlkXSk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgcGxheWVyU3RhdGUuc2V0KHsgZ3JhcGhPcHRpb25zIH0pO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcblxuICAgICAgICB0aGlzLnBsYXllcnMuc2V0KHBsYXllcklkLCBwbGF5ZXJTdGF0ZSk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICAvLyB0cmFjayBmaWxlIHN5c3RlbVxuICAgIHRoaXMuY29tby5maWxlV2F0Y2hlci5zdGF0ZS5zdWJzY3JpYmUodXBkYXRlcyA9PiB7XG4gICAgICBmb3IgKGxldCBuYW1lIGluIHVwZGF0ZXMpIHtcbiAgICAgICAgc3dpdGNoIChuYW1lKSB7XG4gICAgICAgICAgY2FzZSAnYXVkaW8nOlxuICAgICAgICAgICAgdGhpcy5fdXBkYXRlQXVkaW9GaWxlc0Zyb21GaWxlU3lzdGVtKHVwZGF0ZXNbbmFtZV0pO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgY2FzZSAnc2Vzc2lvbnMnOlxuICAgICAgICAgICAgdGhpcy5fdXBkYXRlU2Vzc2lvbnNGcm9tRmlsZVN5c3RlbSh1cGRhdGVzW25hbWVdKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBhd2FpdCB0aGlzLl91cGRhdGVBdWRpb0ZpbGVzRnJvbUZpbGVTeXN0ZW0odGhpcy5jb21vLmZpbGVXYXRjaGVyLnN0YXRlLmdldCgnYXVkaW8nKSk7XG4gICAgYXdhaXQgdGhpcy5fdXBkYXRlU2Vzc2lvbnNGcm9tRmlsZVN5c3RlbSh0aGlzLmNvbW8uZmlsZVdhdGNoZXIuc3RhdGUuZ2V0KCdzZXNzaW9ucycpKTtcbiAgfVxuXG4gIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gIC8vIFNFU1NJT05TXG4gIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gIGFzeW5jIGNyZWF0ZVNlc3Npb24oc2Vzc2lvbk5hbWUsIGdyYXBoUHJlc2V0KSB7XG4gICAgY29uc3Qgb3ZlcnZpZXcgPSB0aGlzLmdldCgnc2Vzc2lvbnNPdmVydmlldycpO1xuICAgIC8vIEBub3RlIC0gdGhpcyBjb3VsZCBwcm9iYWJseSBiZSBtb3JlIHJvYnVzdFxuICAgIGNvbnN0IGlkID0gc2x1Z2lmeShzZXNzaW9uTmFtZSk7XG4gICAgLy8gZmluZCBpZiBhIHNlc3Npb24gdy8gdGhlIHNhbWUgbmFtZSBvciBzbHVnIGFscmVhZHkgZXhpc3RzXG4gICAgY29uc3QgaW5kZXggPSBvdmVydmlldy5maW5kSW5kZXgob3ZlcnZpZXcgPT4ge1xuICAgICAgcmV0dXJuIG92ZXJ2aWV3Lm5hbWUgPT09IHNlc3Npb25OYW1lIHx8IG92ZXJ2aWV3LmlkID09PSBpZDtcbiAgICB9KTtcblxuICAgIGlmIChpbmRleCA9PT0gLTEpIHtcbiAgICAgIGNvbnN0IGF1ZGlvRmlsZXMgPSB0aGlzLmdldCgnYXVkaW9GaWxlcycpO1xuICAgICAgY29uc3QgZ3JhcGggPSB0aGlzLmdyYXBoUHJlc2V0cy5nZXQoZ3JhcGhQcmVzZXQpO1xuICAgICAgY29uc3Qgc2Vzc2lvbiA9IGF3YWl0IFNlc3Npb24uY3JlYXRlKHRoaXMuY29tbywgaWQsIHNlc3Npb25OYW1lLCBncmFwaCwgYXVkaW9GaWxlcyk7XG5cbiAgICAgIHRoaXMuc2Vzc2lvbnMuc2V0KGlkLCBzZXNzaW9uKTtcbiAgICAgIHRoaXMuX3VwZGF0ZVNlc3Npb25zT3ZlcnZpZXcoKTtcblxuICAgICAgcmV0dXJuIGlkO1xuICAgIH1cblxuICAgIC8vIGNvbnNvbGUubG9nKGA+IHNlc3Npb24gXCIke3Nlc3Npb25OYW1lfVwiIGFscmVhZHkgZXhpc3RzYCk7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICBhc3luYyBkZWxldGVTZXNzaW9uKGlkKSB7XG4gICAgaWYgKHRoaXMuc2Vzc2lvbnMuaGFzKGlkKSkge1xuICAgICAgY29uc3Qgc2Vzc2lvbiA9IHRoaXMuc2Vzc2lvbnMuZ2V0KGlkKTtcbiAgICAgIGNvbnN0IGZ1bGxwYXRoID0gc2Vzc2lvbi5kaXJlY3Rvcnk7XG5cbiAgICAgIHRoaXMuc2Vzc2lvbnMuZGVsZXRlKGlkKTtcbiAgICAgIGF3YWl0IHNlc3Npb24uZGVsZXRlKCk7XG5cbiAgICAgIC8vIFdlIGNhbiBjb21lIGZyb20gMiBwYXRocyBoZXJlOlxuICAgICAgLy8gMS4gaWYgdGhlIGZpbGUgc3RpbGwgZXhpc3RzLCB0aGUgbWV0aG9kIGhhcyBiZWVuIGNhbGxlZCBwcm9ncmFtbWF0aWNhbGx5IHNvXG4gICAgICAvLyB3ZSBuZWVkIHRvIHJlbW92ZSB0aGUgZmlsZS4gVGhpcyB3aWxsIHRyaWdnZXIgYF91cGRhdGVTZXNzaW9uc0Zyb21GaWxlU3lzdGVtYFxuICAgICAgLy8gYnV0IG5vdGhpbmcgc2hvdWxkIGFwcGVuZCB0aGVyZSwgdGhhdCdzIHdoeSB3ZSB1cGRhdGUgdGhlXG4gICAgICAvLyBgc2Vzc2lvbk92ZXJ2aWV3YCBoZXJlLlxuICAgICAgLy8gMi4gaWYgdGhlIGZpbGUgaGFzIGJlZW4gcmVtb3ZlZCBtYW51YWxseSB3ZSBhcmUgY2FsbGVkIGZyb21cbiAgICAgIC8vIGBfdXBkYXRlU2Vzc2lvbnNGcm9tRmlsZVN5c3RlbWAgdGhlbiB3ZSBkb24ndCB3YW50IHRvIG1hbmlwdWxhdGVcbiAgICAgIC8vIHRoZSBmaWxlIHN5c3RlbSwgbm9yIHVwZGF0ZSB0aGUgYHNlc3Npb25zT3ZlcnZpZXdgLlxuICAgICAgaWYgKGZzLmV4aXN0c1N5bmMoc2Vzc2lvbi5kaXJlY3RvcnkpKSB7XG4gICAgICAgIGF3YWl0IGRiLmRlbGV0ZShzZXNzaW9uLmRpcmVjdG9yeSk7XG4gICAgICAgIHRoaXMuX3VwZGF0ZVNlc3Npb25zT3ZlcnZpZXcoKTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgYXN5bmMgX3VwZGF0ZVNlc3Npb25zRnJvbUZpbGVTeXN0ZW0oc2Vzc2lvbkZpbGVzVHJlZSkge1xuICAgIGNvbnN0IGluTWVtb3J5U2Vzc2lvbnMgPSBBcnJheS5mcm9tKHRoaXMuc2Vzc2lvbnMudmFsdWVzKCkpO1xuICAgIGNvbnN0IGZpbGVUcmVlU2Vzc2lvbnNPdmVydmlldyA9IHNlc3Npb25GaWxlc1RyZWVcbiAgICAgIC5jaGlsZHJlblxuICAgICAgLmZpbHRlcihsZWFmID0+IGxlYWYudHlwZSA9PT0gJ2RpcmVjdG9yeScpXG4gICAgICAubWFwKGRpciA9PiB7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgaWQ6IGRpci5uYW1lLFxuICAgICAgICAgIGNvbmZpZ1BhdGg6IGRpci5wYXRoLFxuICAgICAgICB9O1xuICAgICAgfSk7XG5cbiAgICBjb25zdCB7XG4gICAgICBpbnRlcnNlY3Rpb24sXG4gICAgICBjcmVhdGVkLFxuICAgICAgZGVsZXRlZFxuICAgIH0gPSBkaWZmQXJyYXlzKGluTWVtb3J5U2Vzc2lvbnMsIGZpbGVUcmVlU2Vzc2lvbnNPdmVydmlldywgZWwgPT4gZWwuaWQpO1xuXG4gICAgLy8gbm90IGluc3RhbmNpYXRlZCBidXQgcHJlc2VudCBpbiBmaWxlIHN5c3RlbVxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgY3JlYXRlZC5sZW5ndGg7IGkrKykge1xuICAgICAgY29uc3Qgc2Vzc2lvbk92ZXJ2aWV3ID0gY3JlYXRlZFtpXTtcblxuICAgICAgdHJ5IHtcbiAgICAgICAgY29uc3QgYXVkaW9GaWxlcyA9IHRoaXMuZ2V0KCdhdWRpb0ZpbGVzJyk7XG4gICAgICAgIGNvbnN0IHNlc3Npb24gPSBhd2FpdCBTZXNzaW9uLmZyb21GaWxlU3lzdGVtKHRoaXMuY29tbywgc2Vzc2lvbk92ZXJ2aWV3LmNvbmZpZ1BhdGgsIGF1ZGlvRmlsZXMpO1xuXG4gICAgICAgIHRoaXMuc2Vzc2lvbnMuc2V0KHNlc3Npb25PdmVydmlldy5pZCwgc2Vzc2lvbik7XG4gICAgICB9IGNhdGNoKGVycikge1xuICAgICAgICBjb25zb2xlLmxvZyhgPiBjYW5ub3QgaW5zdGFuY2lhdGUgc2Vzc2lvbiAke3Nlc3Npb25PdmVydmlldy5pZH1gKTtcbiAgICAgICAgY29uc29sZS5lcnJvcihlcnIpO1xuICAgICAgfVxuICAgIH07XG5cbiAgICAvLyBpbnN0YW5jaWF0ZWQgYnV0IGFic2VudCBmcm9tIGZpbGUgc3lzdGVtXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBkZWxldGVkLmxlbmd0aDsgaSsrKSB7XG4gICAgICBjb25zdCBpZCA9IGRlbGV0ZWRbaV0uaWQ7XG4gICAgICBhd2FpdCB0aGlzLmRlbGV0ZVNlc3Npb24oaWQpO1xuICAgIH1cblxuICAgIC8vIHVwZGF0ZSBvdmVydmlldyBpZiBzb21lIHNlc3Npb25zIGhhdmUgYmVlbiBjcmVhdGVkIG9yIGRlbGV0ZWRcbiAgICBpZiAoY3JlYXRlZC5sZW5ndGggfHzCoGRlbGV0ZWQubGVuZ3RoKSB7XG4gICAgICB0aGlzLl91cGRhdGVTZXNzaW9uc092ZXJ2aWV3KCk7XG4gICAgfVxuICB9XG5cbiAgX3VwZGF0ZVNlc3Npb25zT3ZlcnZpZXcoKSB7XG4gICAgY29uc3Qgc2Vzc2lvbnNPdmVydmlldyA9IEFycmF5LmZyb20odGhpcy5zZXNzaW9ucy52YWx1ZXMoKSlcbiAgICAgIC5tYXAoc2Vzc2lvbiA9PiB7XG4gICAgICAgIGNvbnN0IHN0YXRlSWQgPSBzZXNzaW9uLnN0YXRlLmlkO1xuICAgICAgICBjb25zdCB7IGlkLCBuYW1lIH0gPSBzZXNzaW9uLnN0YXRlLmdldFZhbHVlcygpO1xuXG4gICAgICAgIHJldHVybiB7IGlkLCBuYW1lLCBzdGF0ZUlkIH07XG4gICAgICB9KTtcblxuICAgIHRoaXMuc2V0KHsgc2Vzc2lvbnNPdmVydmlldyB9KTtcbiAgfVxuXG4gIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gIC8vIFJPVVRJTkdcbiAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuICAvKipcbiAgICogZnJvbSAtIHBsYXllcklkIC0gdGhlIGxvZ2ljYWwgY2xpZW50LCBDb01vIHBsYXllciBpbnN0YW5jZVxuICAgKiB0byAtIG5vZGVJZCAtIHRoZSBwaHlzaWNhbCBjbGllbnQsIHNvdW5kd29ya3MgY2xpZW50IGluc3RhbmNlXG4gICAqL1xuICBhc3luYyBjcmVhdGVTdHJlYW1Sb3V0ZShmcm9tLCB0bykge1xuICAgIGNvbnN0IHN0cmVhbXNSb3V0aW5nID0gdGhpcy5nZXQoJ3N0cmVhbXNSb3V0aW5nJyk7XG4gICAgY29uc3QgaW5kZXggPSBzdHJlYW1zUm91dGluZy5maW5kSW5kZXgociA9PiByWzBdID09PSBmcm9tICYmIHJbMV0gPT09IHRvKTtcblxuICAgIGlmIChpbmRleCA9PT0gLTEpIHtcbiAgICAgIGNvbnN0IGlzU291cmNlU3RyZWFtaW5nID0gc3RyZWFtc1JvdXRpbmcucmVkdWNlKChhY2MsIHIpID0+IGFjYyB8fCByWzBdID09PSBmcm9tLCBmYWxzZSk7XG4gICAgICBjb25zdCBjcmVhdGVkID0gW2Zyb20sIHRvXTtcbiAgICAgIHN0cmVhbXNSb3V0aW5nLnB1c2goY3JlYXRlZCk7XG5cbiAgICAgIC8vIGNvbnNvbGUubG9nKCdjcmVhdGVTdHJlYW1Sb3V0ZScsIHN0cmVhbXNSb3V0aW5nKTtcbiAgICAgIHRoaXMuc2V0KHsgc3RyZWFtc1JvdXRpbmcgfSk7XG4gICAgICAvLyBub3RpZnkgcGxheWVyIHRoYXQgaXQgc2hvdWxkIHN0YXJ0IHRvIHN0cmVhbSBpdHMgc291cmNlXG4gICAgICBpZiAoIWlzU291cmNlU3RyZWFtaW5nKSB7XG4gICAgICAgIGNvbnN0IHBsYXllciA9IHRoaXMucGxheWVycy5nZXQoZnJvbSk7XG4gICAgICAgIHBsYXllci5zZXQoeyBzdHJlYW1Tb3VyY2U6IHRydWUgfSk7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIGFzeW5jIGRlbGV0ZVN0cmVhbVJvdXRlKGZyb20sIHRvKSB7XG4gICAgY29uc3Qgc3RyZWFtc1JvdXRpbmcgPSB0aGlzLmdldCgnc3RyZWFtc1JvdXRpbmcnKTtcbiAgICBjb25zdCBpbmRleCA9IHN0cmVhbXNSb3V0aW5nLmZpbmRJbmRleChyID0+IHJbMF0gPT09IGZyb20gJiYgclsxXSA9PT0gdG8pO1xuXG4gICAgaWYgKGluZGV4ICE9PSAtMSkge1xuICAgICAgY29uc3QgZGVsZXRlZCA9IHN0cmVhbXNSb3V0aW5nW2luZGV4XTtcbiAgICAgIHN0cmVhbXNSb3V0aW5nLnNwbGljZShpbmRleCwgMSk7XG5cbiAgICAgIC8vIGNvbnNvbGUubG9nKCdkZWxldGVTdHJlYW1Sb3V0ZScsIHN0cmVhbXNSb3V0aW5nKTtcbiAgICAgIGF3YWl0IHRoaXMuc2V0KHsgc3RyZWFtc1JvdXRpbmcgfSk7XG5cbiAgICAgIGNvbnN0IGlzU291cmNlU3RyZWFtaW5nID0gc3RyZWFtc1JvdXRpbmcucmVkdWNlKChhY2MsIHIpID0+IGFjYyB8fCByWzBdID09PSBmcm9tLCBmYWxzZSk7XG5cbiAgICAgIC8vIG5vdGlmeSBwbGF5ZXIgdGhhdCBpdCBzaG91bGQgc3RvcCBzdHJlYW1pbmcgaXRzIHNvdXJjZVxuICAgICAgaWYgKCFpc1NvdXJjZVN0cmVhbWluZykge1xuICAgICAgICBjb25zdCBwbGF5ZXIgPSB0aGlzLnBsYXllcnMuZ2V0KGZyb20pO1xuICAgICAgICBwbGF5ZXIuc2V0KHsgc3RyZWFtU291cmNlOiBmYWxzZSB9KTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgYXN5bmMgY2xlYXJTdHJlYW1Sb3V0aW5nKGZyb20gPSBudWxsLCB0byA9IG51bGwpIHtcbiAgICBjb25zdCBzdHJlYW1zUm91dGluZyA9IHRoaXMuZ2V0KCdzdHJlYW1zUm91dGluZycpO1xuICAgIGNvbnN0IGRlbGV0ZWQgPSBbXTtcblxuICAgIGZvciAobGV0IGkgPSBzdHJlYW1zUm91dGluZy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuICAgICAgY29uc3Qgcm91dGUgPSBzdHJlYW1zUm91dGluZ1tpXTtcblxuICAgICAgaWYgKHJvdXRlWzBdID09PSBmcm9tIHx8wqByb3V0ZVsxXSA9PT0gdG8pIHtcbiAgICAgICAgZGVsZXRlZC5wdXNoKHJvdXRlKTtcbiAgICAgICAgc3RyZWFtc1JvdXRpbmcuc3BsaWNlKGksIDEpO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIGNvbnNvbGUubG9nKCdjbGVhclN0cmVhbVJvdXRlJywgc3RyZWFtc1JvdXRpbmcpO1xuICAgIHRoaXMuc2V0KHsgc3RyZWFtc1JvdXRpbmcgfSk7XG5cbiAgICAvLyBub3RpZnkgcG9zc2libGUgc291cmNlcyB0aGF0IHRoZXkgc2hvdWxkIHN0b3Agc3RyZWFtaW5nXG4gICAgdGhpcy5wbGF5ZXJzLmZvckVhY2goKHBsYXllciwga2V5KSA9PiB7XG4gICAgICBjb25zdCBpc1NvdXJjZVN0cmVhbWluZyA9IHN0cmVhbXNSb3V0aW5nLnJlZHVjZSgoYWNjLCByKSA9PiBhY2MgfHwgclswXSA9PT0ga2V5LCBmYWxzZSk7XG5cbiAgICAgIGlmICghaXNTb3VyY2VTdHJlYW1pbmcgJiYgcGxheWVyLmdldCgnc3RyZWFtU291cmNlJykgPT09IHRydWUpIHtcbiAgICAgICAgcGxheWVyLnNldCh7IHN0cmVhbVNvdXJjZTogZmFsc2UgfSk7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICBwcm9wYWdhdGVTdHJlYW1GcmFtZShmcmFtZSkge1xuICAgIC8vIEB0b2RvIC0gd2UgbmVlZCB0byBtb3ZlIHRoaXMgaW50byBgUHJvamV0YCBzbyB0aGF0IGl0IGNhbiBiZSBjYWxsZWRcbiAgICAvLyBkaXJlY3RseSBmcm9tIHNlcnZlciBzaWRlIHdpdGggYW4gYXJiaXRyYXJ5IGZyYW1lLi4uXG4gICAgY29uc3Qgcm91dGVzID0gdGhpcy5nZXQoJ3N0cmVhbXNSb3V0aW5nJyk7XG4gICAgY29uc3QgZnJvbUlkID0gZnJhbWVbMF07XG5cbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHJvdXRlcy5sZW5ndGg7IGkrKykge1xuICAgICAgY29uc3Qgcm91dGUgPSByb3V0ZXNbaV07XG4gICAgICBpZiAocm91dGVbMF0gPT09IGZyb21JZCkge1xuICAgICAgICBjb25zdCB0YXJnZXRDbGllbnQgPSB0aGlzLmNvbW8uaWRDbGllbnRNYXAuZ2V0KHJvdXRlWzFdKTtcblxuICAgICAgICAvLyBpZiB3ZSBoYXZlIGEgY2xpZW50IHdpdGggdGhlIHJpZ2h0IG5vZGVJZFxuICAgICAgICBpZiAodGFyZ2V0Q2xpZW50KSB7XG4gICAgICAgICAgdGFyZ2V0Q2xpZW50LnNvY2tldC5zZW5kQmluYXJ5KCdzdHJlYW0nLCBmcmFtZSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgLy8gbWlnaHQgYmUgYW4gT1NDIHRhcmdldCBjbGllbnRcbiAgICAgICAgICAvLyBvc2Muc2VuZCgnL3N0cmVhbS8ke3JvdXRlWzFdfS8ke3JvdXRlWzBdfScsIGZyYW1lKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gIC8vIEFVRElPIEZJTEVTXG4gIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gIGFzeW5jIF91cGRhdGVBdWRpb0ZpbGVzRnJvbUZpbGVTeXN0ZW0oYXVkaW9GaWxlc1RyZWUpIHtcbiAgICAvLyBmaWx0ZXIgZXZlcnl0aGluIHRoYXQgaXMgbm90IGEgLndhdiBvciBhIC5tcDMgZmlsZVxuICAgIGNvbnN0IGF1ZGlvRmlsZXMgPSBhdWRpb0ZpbGVzVHJlZS5jaGlsZHJlblxuICAgICAgLmZpbHRlcihsZWFmID0+IGxlYWYudHlwZSA9PT0gJ2ZpbGUnICYmIFsnLm1wMycsICcud2F2J10uaW5kZXhPZihsZWFmLmV4dGVuc2lvbikgIT09IC0xKVxuICAgICAgLm1hcCgoeyBuYW1lLCB1cmwsIGV4dGVuc2lvbiB9KSA9PiB7IHJldHVybiB7IG5hbWUsIHVybCwgZXh0ZW5zaW9uIH0gfSk7XG5cbiAgICB0aGlzLnN0YXRlLnNldCh7IGF1ZGlvRmlsZXMgfSk7XG5cbiAgICAvLyBAdG9kbyAtIGNsZWFuIHNlc3Npb25zXG4gICAgZm9yIChsZXQgc2Vzc2lvbiBvZiB0aGlzLnNlc3Npb25zLnZhbHVlcygpKSB7XG4gICAgICBhd2FpdCBzZXNzaW9uLnVwZGF0ZUF1ZGlvRmlsZXNGcm9tRmlsZVN5c3RlbShhdWRpb0ZpbGVzKTs7XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IFByb2plY3Q7XG4iXX0=