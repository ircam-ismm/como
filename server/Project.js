"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _path = _interopRequireDefault(require("path"));

var _fs = _interopRequireDefault(require("fs"));

var _json = _interopRequireDefault(require("json5"));

var _uuid = require("uuid");

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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9zZXJ2ZXIvUHJvamVjdC5qcyJdLCJuYW1lcyI6WyJQcm9qZWN0IiwiY29uc3RydWN0b3IiLCJjb21vIiwic3RhdGUiLCJwbGF5ZXJzIiwiTWFwIiwic2Vzc2lvbnMiLCJzZXJ2ZXIiLCJzdGF0ZU1hbmFnZXIiLCJyZWdpc3RlclNjaGVtYSIsInByb2plY3RTY2hlbWEiLCJzZXNzaW9uU2NoZW1hIiwicGxheWVyU2NoZW1hIiwic3Vic2NyaWJlIiwiZnVuYyIsImdldFZhbHVlcyIsImdldCIsIm5hbWUiLCJzZXQiLCJ1cGRhdGVzIiwiaW5pdCIsImdyYXBoUHJlc2V0cyIsImxlYXJuaW5nUHJlc2V0cyIsImZpbGVUcmVlIiwiZmlsZVdhdGNoZXIiLCJpIiwiY2hpbGRyZW4iLCJsZW5ndGgiLCJsZWFmIiwidHlwZSIsInByZXNldE5hbWUiLCJkYXRhR3JhcGgiLCJkYiIsInJlYWQiLCJwYXRoIiwiam9pbiIsImF1ZGlvR3JhcGgiLCJwcmVzZXQiLCJkYXRhIiwiYXVkaW8iLCJjcmVhdGUiLCJBcnJheSIsImZyb20iLCJrZXlzIiwib2JzZXJ2ZSIsInNjaGVtYU5hbWUiLCJzdGF0ZUlkIiwibm9kZUlkIiwicGxheWVyU3RhdGUiLCJhdHRhY2giLCJwbGF5ZXJJZCIsIm9uRGV0YWNoIiwiY2xlYXJTdHJlYW1Sb3V0aW5nIiwiZGVsZXRlIiwidmFsdWVzIiwiT2JqZWN0IiwiZW50cmllcyIsInNlc3Npb25JZCIsInNlc3Npb24iLCJjb25zb2xlIiwid2FybiIsImRlZmF1bHRMYWJlbCIsImdyYXBoT3B0aW9ucyIsImxhYmVsIiwicmVjb3JkaW5nU3RhdGUiLCJvcHRpb25zVXBkYXRlcyIsIm1vZHVsZUlkIiwiYXNzaWduIiwiX3VwZGF0ZUF1ZGlvRmlsZXNGcm9tRmlsZVN5c3RlbSIsIl91cGRhdGVTZXNzaW9uc0Zyb21GaWxlU3lzdGVtIiwiY3JlYXRlU2Vzc2lvbiIsInNlc3Npb25OYW1lIiwiZ3JhcGhQcmVzZXQiLCJvdmVydmlldyIsImlkIiwiaW5kZXgiLCJmaW5kSW5kZXgiLCJhdWRpb0ZpbGVzIiwiZ3JhcGgiLCJTZXNzaW9uIiwiX3VwZGF0ZVNlc3Npb25zT3ZlcnZpZXciLCJkZWxldGVTZXNzaW9uIiwiaGFzIiwiZnVsbHBhdGgiLCJkaXJlY3RvcnkiLCJmcyIsImV4aXN0c1N5bmMiLCJzZXNzaW9uRmlsZXNUcmVlIiwiaW5NZW1vcnlTZXNzaW9ucyIsImZpbGVUcmVlU2Vzc2lvbnNPdmVydmlldyIsImZpbHRlciIsIm1hcCIsImRpciIsImNvbmZpZ1BhdGgiLCJpbnRlcnNlY3Rpb24iLCJjcmVhdGVkIiwiZGVsZXRlZCIsImVsIiwic2Vzc2lvbk92ZXJ2aWV3IiwiZnJvbUZpbGVTeXN0ZW0iLCJlcnIiLCJsb2ciLCJlcnJvciIsInNlc3Npb25zT3ZlcnZpZXciLCJjcmVhdGVTdHJlYW1Sb3V0ZSIsInRvIiwic3RyZWFtc1JvdXRpbmciLCJyIiwiaXNTb3VyY2VTdHJlYW1pbmciLCJyZWR1Y2UiLCJhY2MiLCJwdXNoIiwicGxheWVyIiwic3RyZWFtU291cmNlIiwiZGVsZXRlU3RyZWFtUm91dGUiLCJzcGxpY2UiLCJyb3V0ZSIsImZvckVhY2giLCJrZXkiLCJwcm9wYWdhdGVTdHJlYW1GcmFtZSIsImZyYW1lIiwicm91dGVzIiwiZnJvbUlkIiwidGFyZ2V0Q2xpZW50IiwiaWRDbGllbnRNYXAiLCJzb2NrZXQiLCJzZW5kQmluYXJ5IiwiYXVkaW9GaWxlc1RyZWUiLCJpbmRleE9mIiwiZXh0ZW5zaW9uIiwidXJsIiwidXBkYXRlQXVkaW9GaWxlc0Zyb21GaWxlU3lzdGVtIl0sIm1hcHBpbmdzIjoiOzs7Ozs7O0FBQUE7O0FBQ0E7O0FBQ0E7O0FBQ0E7O0FBQ0E7O0FBRUE7O0FBQ0E7O0FBQ0E7O0FBRUE7O0FBQ0E7O0FBQ0E7Ozs7QUFFQTtBQUVBLE1BQU1BLE9BQU4sQ0FBYztBQUNaQyxFQUFBQSxXQUFXLENBQUNDLElBQUQsRUFBTztBQUNoQixTQUFLQSxJQUFMLEdBQVlBLElBQVo7QUFFQSxTQUFLQyxLQUFMLEdBQWEsSUFBYjtBQUNB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QUFLcEQsUUFBTCxDQUFjZ0QsTUFBZCxFQUFwQixFQUE0QztBQUMxQyxZQUFNSSxPQUFPLENBQUN5RSw4QkFBUixDQUF1Q3RELFVBQXZDLENBQU47QUFBeUQ7QUFDMUQ7QUFDRjs7QUF2WFc7O2VBMFhDN0UsTyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0IGZzIGZyb20gJ2ZzJztcbmltcG9ydCBKU09ONSBmcm9tICdqc29uNSc7XG5pbXBvcnQgeyB2NCBhcyB1dWlkdjQgfSBmcm9tICd1dWlkJztcbmltcG9ydCBzbHVnaWZ5IGZyb20gJ0BzaW5kcmVzb3JodXMvc2x1Z2lmeSc7XG5cbmltcG9ydCBTZXNzaW9uIGZyb20gJy4vU2Vzc2lvbic7XG5pbXBvcnQgZGIgZnJvbSAnLi91dGlscy9kYic7XG5pbXBvcnQgZGlmZkFycmF5cyBmcm9tICcuLi9jb21tb24vdXRpbHMvZGlmZkFycmF5cyc7XG5cbmltcG9ydCBwcm9qZWN0U2NoZW1hIGZyb20gJy4vc2NoZW1hcy9wcm9qZWN0LmpzJztcbmltcG9ydCBzZXNzaW9uU2NoZW1hIGZyb20gJy4vc2NoZW1hcy9zZXNzaW9uLmpzJztcbmltcG9ydCBwbGF5ZXJTY2hlbWEgZnJvbSAnLi9zY2hlbWFzL3BsYXllci5qcyc7XG5cbi8vIGNvbnN0IFBST0pFQ1RfVkVSU0lPTiA9ICcwLjAuMCc7XG5cbmNsYXNzIFByb2plY3Qge1xuICBjb25zdHJ1Y3Rvcihjb21vKSB7XG4gICAgdGhpcy5jb21vID0gY29tbztcblxuICAgIHRoaXMuc3RhdGUgPSBudWxsO1xuICAgIHRoaXMucGxheWVycyA9IG5ldyBNYXAoKTtcbiAgICB0aGlzLnNlc3Npb25zID0gbmV3IE1hcCgpO1xuXG4gICAgdGhpcy5jb21vLnNlcnZlci5zdGF0ZU1hbmFnZXIucmVnaXN0ZXJTY2hlbWEoJ3Byb2plY3QnLCBwcm9qZWN0U2NoZW1hKTtcbiAgICB0aGlzLmNvbW8uc2VydmVyLnN0YXRlTWFuYWdlci5yZWdpc3RlclNjaGVtYShgc2Vzc2lvbmAsIHNlc3Npb25TY2hlbWEpO1xuICAgIHRoaXMuY29tby5zZXJ2ZXIuc3RhdGVNYW5hZ2VyLnJlZ2lzdGVyU2NoZW1hKCdwbGF5ZXInLCBwbGF5ZXJTY2hlbWEpO1xuICB9XG5cbiAgLy8gYFN0YXRlYCBpbnRlcmZhY2VcbiAgc3Vic2NyaWJlKCkge1xuICAgIHJldHVybiB0aGlzLnN0YXRlLnN1YnNjcmliZShmdW5jKTtcbiAgfVxuXG4gIGdldFZhbHVlcygpIHtcbiAgICByZXR1cm4gdGhpcy5zdGF0ZS5nZXRWYWx1ZXMoKTtcbiAgfVxuXG4gIGdldChuYW1lKSB7XG4gICAgcmV0dXJuIHRoaXMuc3RhdGUuZ2V0KG5hbWUpO1xuICB9XG5cbiAgc2V0KHVwZGF0ZXMpIHtcbiAgICB0aGlzLnN0YXRlLnNldCh1cGRhdGVzKTtcbiAgfVxuXG4gIGFzeW5jIGluaXQoKSB7XG4gICAgLy8gcGFyc2UgZXhpc3RpbmcgcHJlc2V0c1xuICAgIHRoaXMuZ3JhcGhQcmVzZXRzID0gbmV3IE1hcCgpO1xuICAgIGxldCBsZWFybmluZ1ByZXNldHMgPSB7fTtcblxuICAgIGNvbnN0IGZpbGVUcmVlID0gdGhpcy5jb21vLmZpbGVXYXRjaGVyLnN0YXRlLmdldCgncHJlc2V0cycpO1xuXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBmaWxlVHJlZS5jaGlsZHJlbi5sZW5ndGg7IGkrKykge1xuICAgICAgY29uc3QgbGVhZiA9IGZpbGVUcmVlLmNoaWxkcmVuW2ldO1xuXG4gICAgICAvLyBncmFwaCBwcmVzZXRzXG4gICAgICBpZiAobGVhZi50eXBlID09PSAnZGlyZWN0b3J5Jykge1xuICAgICAgICBjb25zdCBwcmVzZXROYW1lID0gbGVhZi5uYW1lO1xuICAgICAgICBjb25zdCBkYXRhR3JhcGggPSBhd2FpdCBkYi5yZWFkKHBhdGguam9pbihsZWFmLnBhdGgsICdncmFwaC1kYXRhLmpzb24nKSk7XG4gICAgICAgIGNvbnN0IGF1ZGlvR3JhcGggPSBhd2FpdCBkYi5yZWFkKHBhdGguam9pbihsZWFmLnBhdGgsICdncmFwaC1hdWRpby5qc29uJykpO1xuICAgICAgICBjb25zdCBwcmVzZXQgPSB7IGRhdGE6IGRhdGFHcmFwaCwgYXVkaW86IGF1ZGlvR3JhcGggfTtcbiAgICAgICAgdGhpcy5ncmFwaFByZXNldHMuc2V0KHByZXNldE5hbWUsIHByZXNldCk7XG4gICAgICB9XG5cbiAgICAgIC8vIGxlYXJuaW5nIHByZXNldHNcbiAgICAgIGlmIChsZWFmLnR5cGUgPT09ICdmaWxlJyAmJiBsZWFmLm5hbWUgPT09ICdsZWFybmluZy1wcmVzZXRzLmpzb24nKSB7XG4gICAgICAgIGxlYXJuaW5nUHJlc2V0cyA9IGF3YWl0IGRiLnJlYWQobGVhZi5wYXRoKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICB0aGlzLnN0YXRlID0gYXdhaXQgdGhpcy5jb21vLnNlcnZlci5zdGF0ZU1hbmFnZXIuY3JlYXRlKCdwcm9qZWN0Jywge1xuICAgICAgZ3JhcGhQcmVzZXRzOiBBcnJheS5mcm9tKHRoaXMuZ3JhcGhQcmVzZXRzLmtleXMoKSksXG4gICAgICBsZWFybmluZ1ByZXNldHM6IGxlYXJuaW5nUHJlc2V0cyxcbiAgICB9KTtcblxuICAgIHRoaXMuY29tby5zZXJ2ZXIuc3RhdGVNYW5hZ2VyLm9ic2VydmUoYXN5bmMgKHNjaGVtYU5hbWUsIHN0YXRlSWQsIG5vZGVJZCkgPT4ge1xuICAgICAgLy8gdHJhY2sgcGxheWVyc1xuICAgICAgaWYgKHNjaGVtYU5hbWUgPT09ICdwbGF5ZXInKSB7XG4gICAgICAgIGNvbnN0IHBsYXllclN0YXRlID0gYXdhaXQgdGhpcy5jb21vLnNlcnZlci5zdGF0ZU1hbmFnZXIuYXR0YWNoKHNjaGVtYU5hbWUsIHN0YXRlSWQpO1xuICAgICAgICBjb25zdCBwbGF5ZXJJZCA9IHBsYXllclN0YXRlLmdldCgnaWQnKTtcblxuICAgICAgICBwbGF5ZXJTdGF0ZS5vbkRldGFjaCgoKSA9PiB7XG4gICAgICAgICAgdGhpcy5jbGVhclN0cmVhbVJvdXRpbmcocGxheWVySWQsIG51bGwpOyAvLyBjbGVhciByb3V0aW5nIHdoZXJlIHBsYXllciBpcyB0aGUgc291cmNlXG4gICAgICAgICAgdGhpcy5wbGF5ZXJzLmRlbGV0ZShwbGF5ZXJJZClcbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gbWF5YmUgbW92ZSB0aGlzIGluIFNlc3Npb24sIHdvdWxkIGJlIG1vcmUgbG9naWNhbC4uLlxuICAgICAgICBwbGF5ZXJTdGF0ZS5zdWJzY3JpYmUodXBkYXRlcyA9PiB7XG4gICAgICAgICAgZm9yIChsZXQgW25hbWUsIHZhbHVlc10gb2YgT2JqZWN0LmVudHJpZXModXBkYXRlcykpIHtcbiAgICAgICAgICAgIHN3aXRjaCAobmFtZSkge1xuICAgICAgICAgICAgICAvLyByZXNldCBwbGF5ZXIgc3RhdGUgd2hlbiBpdCBjaGFuZ2Ugc2Vzc2lvblxuICAgICAgICAgICAgICAvLyBAbm90ZSAtIHRoaXMgY291bGQgYmUgYSBraW5kIG9mIHJlZHVjZXIgcHJvdmlkZWQgYnlcbiAgICAgICAgICAgICAgLy8gdGhlIHN0YXRlTWFuYWdlciBpdHNlbGYgKHNvdW5kd29ya3MvY29yZSBpc3N1ZSlcbiAgICAgICAgICAgICAgY2FzZSAnc2Vzc2lvbklkJzoge1xuICAgICAgICAgICAgICAgIGNvbnN0IHNlc3Npb25JZCA9IHZhbHVlcztcblxuICAgICAgICAgICAgICAgIGlmIChzZXNzaW9uSWQgIT09IG51bGwpIHtcbiAgICAgICAgICAgICAgICAgIGNvbnN0IHNlc3Npb24gPSB0aGlzLnNlc3Npb25zLmdldChzZXNzaW9uSWQpO1xuXG4gICAgICAgICAgICAgICAgICBpZiAoIXNlc3Npb24pIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS53YXJuKGBbY29tb10gcmVxdWlyZWQgc2Vzc2lvbiBcIiR7c2Vzc2lvbklkfVwiIGRvZXMgbm90IGV4aXN0c2ApO1xuICAgICAgICAgICAgICAgICAgICBwbGF5ZXJTdGF0ZS5zZXQoeyBzZXNzaW9uSWQ6IG51bGwgfSk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgY29uc3QgZGVmYXVsdExhYmVsID0gc2Vzc2lvbi5nZXQoJ2xhYmVscycpWzBdO1xuICAgICAgICAgICAgICAgICAgY29uc3QgZ3JhcGhPcHRpb25zID0gc2Vzc2lvbi5nZXQoJ2dyYXBoT3B0aW9ucycpO1xuXG4gICAgICAgICAgICAgICAgICBwbGF5ZXJTdGF0ZS5zZXQoe1xuICAgICAgICAgICAgICAgICAgICBsYWJlbDogZGVmYXVsdExhYmVsLFxuICAgICAgICAgICAgICAgICAgICByZWNvcmRpbmdTdGF0ZTogJ2lkbGUnLFxuICAgICAgICAgICAgICAgICAgICBncmFwaE9wdGlvbnMsXG4gICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgcGxheWVyU3RhdGUuc2V0KHtcbiAgICAgICAgICAgICAgICAgICAgbGFiZWw6ICcnLFxuICAgICAgICAgICAgICAgICAgICByZWNvcmRpbmdTdGF0ZTogJ2lkbGUnLFxuICAgICAgICAgICAgICAgICAgICBncmFwaE9wdGlvbnM6IG51bGwsXG4gICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICBjYXNlICdncmFwaE9wdGlvbnNFdmVudCc6IHtcbiAgICAgICAgICAgICAgICBjb25zdCBvcHRpb25zVXBkYXRlcyA9IHZhbHVlcztcbiAgICAgICAgICAgICAgICBjb25zdCBncmFwaE9wdGlvbnMgPSBwbGF5ZXJTdGF0ZS5nZXQoJ2dyYXBoT3B0aW9ucycpO1xuXG4gICAgICAgICAgICAgICAgZm9yIChsZXQgbW9kdWxlSWQgaW4gb3B0aW9uc1VwZGF0ZXMpIHtcbiAgICAgICAgICAgICAgICAgIE9iamVjdC5hc3NpZ24oZ3JhcGhPcHRpb25zW21vZHVsZUlkXSwgb3B0aW9uc1VwZGF0ZXNbbW9kdWxlSWRdKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBwbGF5ZXJTdGF0ZS5zZXQoeyBncmFwaE9wdGlvbnMgfSk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHRoaXMucGxheWVycy5zZXQocGxheWVySWQsIHBsYXllclN0YXRlKTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIC8vIHRyYWNrIGZpbGUgc3lzdGVtXG4gICAgdGhpcy5jb21vLmZpbGVXYXRjaGVyLnN0YXRlLnN1YnNjcmliZSh1cGRhdGVzID0+IHtcbiAgICAgIGZvciAobGV0IG5hbWUgaW4gdXBkYXRlcykge1xuICAgICAgICBzd2l0Y2ggKG5hbWUpIHtcbiAgICAgICAgICBjYXNlICdhdWRpbyc6XG4gICAgICAgICAgICB0aGlzLl91cGRhdGVBdWRpb0ZpbGVzRnJvbUZpbGVTeXN0ZW0odXBkYXRlc1tuYW1lXSk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICBjYXNlICdzZXNzaW9ucyc6XG4gICAgICAgICAgICB0aGlzLl91cGRhdGVTZXNzaW9uc0Zyb21GaWxlU3lzdGVtKHVwZGF0ZXNbbmFtZV0pO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9KTtcblxuICAgIGF3YWl0IHRoaXMuX3VwZGF0ZUF1ZGlvRmlsZXNGcm9tRmlsZVN5c3RlbSh0aGlzLmNvbW8uZmlsZVdhdGNoZXIuc3RhdGUuZ2V0KCdhdWRpbycpKTtcbiAgICBhd2FpdCB0aGlzLl91cGRhdGVTZXNzaW9uc0Zyb21GaWxlU3lzdGVtKHRoaXMuY29tby5maWxlV2F0Y2hlci5zdGF0ZS5nZXQoJ3Nlc3Npb25zJykpO1xuICB9XG5cbiAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgLy8gU0VTU0lPTlNcbiAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgYXN5bmMgY3JlYXRlU2Vzc2lvbihzZXNzaW9uTmFtZSwgZ3JhcGhQcmVzZXQpIHtcbiAgICBjb25zdCBvdmVydmlldyA9IHRoaXMuZ2V0KCdzZXNzaW9uc092ZXJ2aWV3Jyk7XG4gICAgLy8gQG5vdGUgLSB0aGlzIGNvdWxkIHByb2JhYmx5IGJlIG1vcmUgcm9idXN0XG4gICAgY29uc3QgaWQgPSBzbHVnaWZ5KHNlc3Npb25OYW1lKTtcbiAgICAvLyBmaW5kIGlmIGEgc2Vzc2lvbiB3LyB0aGUgc2FtZSBuYW1lIG9yIHNsdWcgYWxyZWFkeSBleGlzdHNcbiAgICBjb25zdCBpbmRleCA9IG92ZXJ2aWV3LmZpbmRJbmRleChvdmVydmlldyA9PiB7XG4gICAgICByZXR1cm4gb3ZlcnZpZXcubmFtZSA9PT0gc2Vzc2lvbk5hbWUgfHwgb3ZlcnZpZXcuaWQgPT09IGlkO1xuICAgIH0pO1xuXG4gICAgaWYgKGluZGV4ID09PSAtMSkge1xuICAgICAgY29uc3QgYXVkaW9GaWxlcyA9IHRoaXMuZ2V0KCdhdWRpb0ZpbGVzJyk7XG4gICAgICBjb25zdCBncmFwaCA9IHRoaXMuZ3JhcGhQcmVzZXRzLmdldChncmFwaFByZXNldCk7XG4gICAgICBjb25zdCBzZXNzaW9uID0gYXdhaXQgU2Vzc2lvbi5jcmVhdGUodGhpcy5jb21vLCBpZCwgc2Vzc2lvbk5hbWUsIGdyYXBoLCBhdWRpb0ZpbGVzKTtcblxuICAgICAgdGhpcy5zZXNzaW9ucy5zZXQoaWQsIHNlc3Npb24pO1xuICAgICAgdGhpcy5fdXBkYXRlU2Vzc2lvbnNPdmVydmlldygpO1xuXG4gICAgICByZXR1cm4gaWQ7XG4gICAgfVxuXG4gICAgLy8gY29uc29sZS5sb2coYD4gc2Vzc2lvbiBcIiR7c2Vzc2lvbk5hbWV9XCIgYWxyZWFkeSBleGlzdHNgKTtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIGFzeW5jIGRlbGV0ZVNlc3Npb24oaWQpIHtcbiAgICBpZiAodGhpcy5zZXNzaW9ucy5oYXMoaWQpKSB7XG4gICAgICBjb25zdCBzZXNzaW9uID0gdGhpcy5zZXNzaW9ucy5nZXQoaWQpO1xuICAgICAgY29uc3QgZnVsbHBhdGggPSBzZXNzaW9uLmRpcmVjdG9yeTtcblxuICAgICAgdGhpcy5zZXNzaW9ucy5kZWxldGUoaWQpO1xuICAgICAgYXdhaXQgc2Vzc2lvbi5kZWxldGUoKTtcblxuICAgICAgLy8gV2UgY2FuIGNvbWUgZnJvbSAyIHBhdGhzIGhlcmU6XG4gICAgICAvLyAxLiBpZiB0aGUgZmlsZSBzdGlsbCBleGlzdHMsIHRoZSBtZXRob2QgaGFzIGJlZW4gY2FsbGVkIHByb2dyYW1tYXRpY2FsbHkgc29cbiAgICAgIC8vIHdlIG5lZWQgdG8gcmVtb3ZlIHRoZSBmaWxlLiBUaGlzIHdpbGwgdHJpZ2dlciBgX3VwZGF0ZVNlc3Npb25zRnJvbUZpbGVTeXN0ZW1gXG4gICAgICAvLyBidXQgbm90aGluZyBzaG91bGQgYXBwZW5kIHRoZXJlLCB0aGF0J3Mgd2h5IHdlIHVwZGF0ZSB0aGVcbiAgICAgIC8vIGBzZXNzaW9uT3ZlcnZpZXdgIGhlcmUuXG4gICAgICAvLyAyLiBpZiB0aGUgZmlsZSBoYXMgYmVlbiByZW1vdmVkIG1hbnVhbGx5IHdlIGFyZSBjYWxsZWQgZnJvbVxuICAgICAgLy8gYF91cGRhdGVTZXNzaW9uc0Zyb21GaWxlU3lzdGVtYCB0aGVuIHdlIGRvbid0IHdhbnQgdG8gbWFuaXB1bGF0ZVxuICAgICAgLy8gdGhlIGZpbGUgc3lzdGVtLCBub3IgdXBkYXRlIHRoZSBgc2Vzc2lvbnNPdmVydmlld2AuXG4gICAgICBpZiAoZnMuZXhpc3RzU3luYyhzZXNzaW9uLmRpcmVjdG9yeSkpIHtcbiAgICAgICAgYXdhaXQgZGIuZGVsZXRlKHNlc3Npb24uZGlyZWN0b3J5KTtcbiAgICAgICAgdGhpcy5fdXBkYXRlU2Vzc2lvbnNPdmVydmlldygpO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBhc3luYyBfdXBkYXRlU2Vzc2lvbnNGcm9tRmlsZVN5c3RlbShzZXNzaW9uRmlsZXNUcmVlKSB7XG4gICAgY29uc3QgaW5NZW1vcnlTZXNzaW9ucyA9IEFycmF5LmZyb20odGhpcy5zZXNzaW9ucy52YWx1ZXMoKSk7XG4gICAgY29uc3QgZmlsZVRyZWVTZXNzaW9uc092ZXJ2aWV3ID0gc2Vzc2lvbkZpbGVzVHJlZVxuICAgICAgLmNoaWxkcmVuXG4gICAgICAuZmlsdGVyKGxlYWYgPT4gbGVhZi50eXBlID09PSAnZGlyZWN0b3J5JylcbiAgICAgIC5tYXAoZGlyID0+IHtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICBpZDogZGlyLm5hbWUsXG4gICAgICAgICAgY29uZmlnUGF0aDogZGlyLnBhdGgsXG4gICAgICAgIH07XG4gICAgICB9KTtcblxuICAgIGNvbnN0IHtcbiAgICAgIGludGVyc2VjdGlvbixcbiAgICAgIGNyZWF0ZWQsXG4gICAgICBkZWxldGVkXG4gICAgfSA9IGRpZmZBcnJheXMoaW5NZW1vcnlTZXNzaW9ucywgZmlsZVRyZWVTZXNzaW9uc092ZXJ2aWV3LCBlbCA9PiBlbC5pZCk7XG5cbiAgICAvLyBub3QgaW5zdGFuY2lhdGVkIGJ1dCBwcmVzZW50IGluIGZpbGUgc3lzdGVtXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBjcmVhdGVkLmxlbmd0aDsgaSsrKSB7XG4gICAgICBjb25zdCBzZXNzaW9uT3ZlcnZpZXcgPSBjcmVhdGVkW2ldO1xuXG4gICAgICB0cnkge1xuICAgICAgICBjb25zdCBhdWRpb0ZpbGVzID0gdGhpcy5nZXQoJ2F1ZGlvRmlsZXMnKTtcbiAgICAgICAgY29uc3Qgc2Vzc2lvbiA9IGF3YWl0IFNlc3Npb24uZnJvbUZpbGVTeXN0ZW0odGhpcy5jb21vLCBzZXNzaW9uT3ZlcnZpZXcuY29uZmlnUGF0aCwgYXVkaW9GaWxlcyk7XG5cbiAgICAgICAgdGhpcy5zZXNzaW9ucy5zZXQoc2Vzc2lvbk92ZXJ2aWV3LmlkLCBzZXNzaW9uKTtcbiAgICAgIH0gY2F0Y2goZXJyKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKGA+IGNhbm5vdCBpbnN0YW5jaWF0ZSBzZXNzaW9uICR7c2Vzc2lvbk92ZXJ2aWV3LmlkfWApO1xuICAgICAgICBjb25zb2xlLmVycm9yKGVycik7XG4gICAgICB9XG4gICAgfTtcblxuICAgIC8vIGluc3RhbmNpYXRlZCBidXQgYWJzZW50IGZyb20gZmlsZSBzeXN0ZW1cbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGRlbGV0ZWQubGVuZ3RoOyBpKyspIHtcbiAgICAgIGNvbnN0IGlkID0gZGVsZXRlZFtpXS5pZDtcbiAgICAgIGF3YWl0IHRoaXMuZGVsZXRlU2Vzc2lvbihpZCk7XG4gICAgfVxuXG4gICAgLy8gdXBkYXRlIG92ZXJ2aWV3IGlmIHNvbWUgc2Vzc2lvbnMgaGF2ZSBiZWVuIGNyZWF0ZWQgb3IgZGVsZXRlZFxuICAgIGlmIChjcmVhdGVkLmxlbmd0aCB8fMKgZGVsZXRlZC5sZW5ndGgpIHtcbiAgICAgIHRoaXMuX3VwZGF0ZVNlc3Npb25zT3ZlcnZpZXcoKTtcbiAgICB9XG4gIH1cblxuICBfdXBkYXRlU2Vzc2lvbnNPdmVydmlldygpIHtcbiAgICBjb25zdCBzZXNzaW9uc092ZXJ2aWV3ID0gQXJyYXkuZnJvbSh0aGlzLnNlc3Npb25zLnZhbHVlcygpKVxuICAgICAgLm1hcChzZXNzaW9uID0+IHtcbiAgICAgICAgY29uc3Qgc3RhdGVJZCA9IHNlc3Npb24uc3RhdGUuaWQ7XG4gICAgICAgIGNvbnN0IHsgaWQsIG5hbWUgfSA9IHNlc3Npb24uc3RhdGUuZ2V0VmFsdWVzKCk7XG5cbiAgICAgICAgcmV0dXJuIHsgaWQsIG5hbWUsIHN0YXRlSWQgfTtcbiAgICAgIH0pO1xuXG4gICAgdGhpcy5zZXQoeyBzZXNzaW9uc092ZXJ2aWV3IH0pO1xuICB9XG5cbiAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgLy8gUk9VVElOR1xuICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4gIC8qKlxuICAgKiBmcm9tIC0gcGxheWVySWQgLSB0aGUgbG9naWNhbCBjbGllbnQsIENvTW8gcGxheWVyIGluc3RhbmNlXG4gICAqIHRvIC0gbm9kZUlkIC0gdGhlIHBoeXNpY2FsIGNsaWVudCwgc291bmR3b3JrcyBjbGllbnQgaW5zdGFuY2VcbiAgICovXG4gIGFzeW5jIGNyZWF0ZVN0cmVhbVJvdXRlKGZyb20sIHRvKSB7XG4gICAgY29uc3Qgc3RyZWFtc1JvdXRpbmcgPSB0aGlzLmdldCgnc3RyZWFtc1JvdXRpbmcnKTtcbiAgICBjb25zdCBpbmRleCA9IHN0cmVhbXNSb3V0aW5nLmZpbmRJbmRleChyID0+IHJbMF0gPT09IGZyb20gJiYgclsxXSA9PT0gdG8pO1xuXG4gICAgaWYgKGluZGV4ID09PSAtMSkge1xuICAgICAgY29uc3QgaXNTb3VyY2VTdHJlYW1pbmcgPSBzdHJlYW1zUm91dGluZy5yZWR1Y2UoKGFjYywgcikgPT4gYWNjIHx8IHJbMF0gPT09IGZyb20sIGZhbHNlKTtcbiAgICAgIGNvbnN0IGNyZWF0ZWQgPSBbZnJvbSwgdG9dO1xuICAgICAgc3RyZWFtc1JvdXRpbmcucHVzaChjcmVhdGVkKTtcblxuICAgICAgLy8gY29uc29sZS5sb2coJ2NyZWF0ZVN0cmVhbVJvdXRlJywgc3RyZWFtc1JvdXRpbmcpO1xuICAgICAgdGhpcy5zZXQoeyBzdHJlYW1zUm91dGluZyB9KTtcbiAgICAgIC8vIG5vdGlmeSBwbGF5ZXIgdGhhdCBpdCBzaG91bGQgc3RhcnQgdG8gc3RyZWFtIGl0cyBzb3VyY2VcbiAgICAgIGlmICghaXNTb3VyY2VTdHJlYW1pbmcpIHtcbiAgICAgICAgY29uc3QgcGxheWVyID0gdGhpcy5wbGF5ZXJzLmdldChmcm9tKTtcbiAgICAgICAgcGxheWVyLnNldCh7IHN0cmVhbVNvdXJjZTogdHJ1ZSB9KTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgYXN5bmMgZGVsZXRlU3RyZWFtUm91dGUoZnJvbSwgdG8pIHtcbiAgICBjb25zdCBzdHJlYW1zUm91dGluZyA9IHRoaXMuZ2V0KCdzdHJlYW1zUm91dGluZycpO1xuICAgIGNvbnN0IGluZGV4ID0gc3RyZWFtc1JvdXRpbmcuZmluZEluZGV4KHIgPT4gclswXSA9PT0gZnJvbSAmJiByWzFdID09PSB0byk7XG5cbiAgICBpZiAoaW5kZXggIT09IC0xKSB7XG4gICAgICBjb25zdCBkZWxldGVkID0gc3RyZWFtc1JvdXRpbmdbaW5kZXhdO1xuICAgICAgc3RyZWFtc1JvdXRpbmcuc3BsaWNlKGluZGV4LCAxKTtcblxuICAgICAgLy8gY29uc29sZS5sb2coJ2RlbGV0ZVN0cmVhbVJvdXRlJywgc3RyZWFtc1JvdXRpbmcpO1xuICAgICAgYXdhaXQgdGhpcy5zZXQoeyBzdHJlYW1zUm91dGluZyB9KTtcblxuICAgICAgY29uc3QgaXNTb3VyY2VTdHJlYW1pbmcgPSBzdHJlYW1zUm91dGluZy5yZWR1Y2UoKGFjYywgcikgPT4gYWNjIHx8IHJbMF0gPT09IGZyb20sIGZhbHNlKTtcblxuICAgICAgLy8gbm90aWZ5IHBsYXllciB0aGF0IGl0IHNob3VsZCBzdG9wIHN0cmVhbWluZyBpdHMgc291cmNlXG4gICAgICBpZiAoIWlzU291cmNlU3RyZWFtaW5nKSB7XG4gICAgICAgIGNvbnN0IHBsYXllciA9IHRoaXMucGxheWVycy5nZXQoZnJvbSk7XG4gICAgICAgIHBsYXllci5zZXQoeyBzdHJlYW1Tb3VyY2U6IGZhbHNlIH0pO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBhc3luYyBjbGVhclN0cmVhbVJvdXRpbmcoZnJvbSA9IG51bGwsIHRvID0gbnVsbCkge1xuICAgIGNvbnN0IHN0cmVhbXNSb3V0aW5nID0gdGhpcy5nZXQoJ3N0cmVhbXNSb3V0aW5nJyk7XG4gICAgY29uc3QgZGVsZXRlZCA9IFtdO1xuXG4gICAgZm9yIChsZXQgaSA9IHN0cmVhbXNSb3V0aW5nLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAgICBjb25zdCByb3V0ZSA9IHN0cmVhbXNSb3V0aW5nW2ldO1xuXG4gICAgICBpZiAocm91dGVbMF0gPT09IGZyb20gfHzCoHJvdXRlWzFdID09PSB0bykge1xuICAgICAgICBkZWxldGVkLnB1c2gocm91dGUpO1xuICAgICAgICBzdHJlYW1zUm91dGluZy5zcGxpY2UoaSwgMSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gY29uc29sZS5sb2coJ2NsZWFyU3RyZWFtUm91dGUnLCBzdHJlYW1zUm91dGluZyk7XG4gICAgdGhpcy5zZXQoeyBzdHJlYW1zUm91dGluZyB9KTtcblxuICAgIC8vIG5vdGlmeSBwb3NzaWJsZSBzb3VyY2VzIHRoYXQgdGhleSBzaG91bGQgc3RvcCBzdHJlYW1pbmdcbiAgICB0aGlzLnBsYXllcnMuZm9yRWFjaCgocGxheWVyLCBrZXkpID0+IHtcbiAgICAgIGNvbnN0IGlzU291cmNlU3RyZWFtaW5nID0gc3RyZWFtc1JvdXRpbmcucmVkdWNlKChhY2MsIHIpID0+IGFjYyB8fCByWzBdID09PSBrZXksIGZhbHNlKTtcblxuICAgICAgaWYgKCFpc1NvdXJjZVN0cmVhbWluZyAmJiBwbGF5ZXIuZ2V0KCdzdHJlYW1Tb3VyY2UnKSA9PT0gdHJ1ZSkge1xuICAgICAgICBwbGF5ZXIuc2V0KHsgc3RyZWFtU291cmNlOiBmYWxzZSB9KTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIHByb3BhZ2F0ZVN0cmVhbUZyYW1lKGZyYW1lKSB7XG4gICAgLy8gQHRvZG8gLSB3ZSBuZWVkIHRvIG1vdmUgdGhpcyBpbnRvIGBQcm9qZXRgIHNvIHRoYXQgaXQgY2FuIGJlIGNhbGxlZFxuICAgIC8vIGRpcmVjdGx5IGZyb20gc2VydmVyIHNpZGUgd2l0aCBhbiBhcmJpdHJhcnkgZnJhbWUuLi5cbiAgICBjb25zdCByb3V0ZXMgPSB0aGlzLmdldCgnc3RyZWFtc1JvdXRpbmcnKTtcbiAgICBjb25zdCBmcm9tSWQgPSBmcmFtZVswXTtcblxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgcm91dGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBjb25zdCByb3V0ZSA9IHJvdXRlc1tpXTtcbiAgICAgIGlmIChyb3V0ZVswXSA9PT0gZnJvbUlkKSB7XG4gICAgICAgIGNvbnN0IHRhcmdldENsaWVudCA9IHRoaXMuY29tby5pZENsaWVudE1hcC5nZXQocm91dGVbMV0pO1xuXG4gICAgICAgIC8vIGlmIHdlIGhhdmUgYSBjbGllbnQgd2l0aCB0aGUgcmlnaHQgbm9kZUlkXG4gICAgICAgIGlmICh0YXJnZXRDbGllbnQpIHtcbiAgICAgICAgICB0YXJnZXRDbGllbnQuc29ja2V0LnNlbmRCaW5hcnkoJ3N0cmVhbScsIGZyYW1lKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvLyBtaWdodCBiZSBhbiBPU0MgdGFyZ2V0IGNsaWVudFxuICAgICAgICAgIC8vIG9zYy5zZW5kKCcvc3RyZWFtLyR7cm91dGVbMV19LyR7cm91dGVbMF19JywgZnJhbWUpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgLy8gQVVESU8gRklMRVNcbiAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgYXN5bmMgX3VwZGF0ZUF1ZGlvRmlsZXNGcm9tRmlsZVN5c3RlbShhdWRpb0ZpbGVzVHJlZSkge1xuICAgIC8vIGZpbHRlciBldmVyeXRoaW4gdGhhdCBpcyBub3QgYSAud2F2IG9yIGEgLm1wMyBmaWxlXG4gICAgY29uc3QgYXVkaW9GaWxlcyA9IGF1ZGlvRmlsZXNUcmVlLmNoaWxkcmVuXG4gICAgICAuZmlsdGVyKGxlYWYgPT4gbGVhZi50eXBlID09PSAnZmlsZScgJiYgWycubXAzJywgJy53YXYnXS5pbmRleE9mKGxlYWYuZXh0ZW5zaW9uKSAhPT0gLTEpXG4gICAgICAubWFwKCh7IG5hbWUsIHVybCwgZXh0ZW5zaW9uIH0pID0+IHsgcmV0dXJuIHsgbmFtZSwgdXJsLCBleHRlbnNpb24gfSB9KTtcblxuICAgIHRoaXMuc3RhdGUuc2V0KHsgYXVkaW9GaWxlcyB9KTtcblxuICAgIC8vIEB0b2RvIC0gY2xlYW4gc2Vzc2lvbnNcbiAgICBmb3IgKGxldCBzZXNzaW9uIG9mIHRoaXMuc2Vzc2lvbnMudmFsdWVzKCkpIHtcbiAgICAgIGF3YWl0IHNlc3Npb24udXBkYXRlQXVkaW9GaWxlc0Zyb21GaWxlU3lzdGVtKGF1ZGlvRmlsZXMpOztcbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgUHJvamVjdDtcbiJdfQ==