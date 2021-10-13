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

    if (this.como.server.config.como.preloadAudioFiles) {
      // this will preload all files of the project, so that sessions can just
      // pick their buffers in the audio-buffer-loader cache.
      this.state.set({
        preloadAudioFiles: true
      });
    }
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
      } = session.getValues();
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
      streamsRouting.splice(index, 1);
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
    }

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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9zZXJ2ZXIvUHJvamVjdC5qcyJdLCJuYW1lcyI6WyJQcm9qZWN0IiwiY29uc3RydWN0b3IiLCJjb21vIiwic3RhdGUiLCJwbGF5ZXJzIiwiTWFwIiwic2Vzc2lvbnMiLCJzZXJ2ZXIiLCJzdGF0ZU1hbmFnZXIiLCJyZWdpc3RlclNjaGVtYSIsInByb2plY3RTY2hlbWEiLCJzZXNzaW9uU2NoZW1hIiwicGxheWVyU2NoZW1hIiwic3Vic2NyaWJlIiwiZnVuYyIsImdldFZhbHVlcyIsImdldCIsIm5hbWUiLCJzZXQiLCJ1cGRhdGVzIiwiaW5pdCIsImdyYXBoUHJlc2V0cyIsImxlYXJuaW5nUHJlc2V0cyIsImZpbGVUcmVlIiwiZmlsZVdhdGNoZXIiLCJpIiwiY2hpbGRyZW4iLCJsZW5ndGgiLCJsZWFmIiwidHlwZSIsInByZXNldE5hbWUiLCJkYXRhR3JhcGgiLCJkYiIsInJlYWQiLCJwYXRoIiwiam9pbiIsImF1ZGlvR3JhcGgiLCJwcmVzZXQiLCJkYXRhIiwiYXVkaW8iLCJjcmVhdGUiLCJBcnJheSIsImZyb20iLCJrZXlzIiwib2JzZXJ2ZSIsInNjaGVtYU5hbWUiLCJzdGF0ZUlkIiwibm9kZUlkIiwicGxheWVyU3RhdGUiLCJhdHRhY2giLCJwbGF5ZXJJZCIsIm9uRGV0YWNoIiwiY2xlYXJTdHJlYW1Sb3V0aW5nIiwiZGVsZXRlIiwidmFsdWVzIiwiT2JqZWN0IiwiZW50cmllcyIsInNlc3Npb25JZCIsInNlc3Npb24iLCJjb25zb2xlIiwid2FybiIsImRlZmF1bHRMYWJlbCIsImdyYXBoT3B0aW9ucyIsImxhYmVsIiwicmVjb3JkaW5nU3RhdGUiLCJvcHRpb25zVXBkYXRlcyIsIm1vZHVsZUlkIiwiYXNzaWduIiwiX3VwZGF0ZUF1ZGlvRmlsZXNGcm9tRmlsZVN5c3RlbSIsIl91cGRhdGVTZXNzaW9uc0Zyb21GaWxlU3lzdGVtIiwiY29uZmlnIiwicHJlbG9hZEF1ZGlvRmlsZXMiLCJjcmVhdGVTZXNzaW9uIiwic2Vzc2lvbk5hbWUiLCJncmFwaFByZXNldCIsIm92ZXJ2aWV3IiwiaWQiLCJpbmRleCIsImZpbmRJbmRleCIsImF1ZGlvRmlsZXMiLCJncmFwaCIsIlNlc3Npb24iLCJfdXBkYXRlU2Vzc2lvbnNPdmVydmlldyIsImRlbGV0ZVNlc3Npb24iLCJoYXMiLCJmdWxscGF0aCIsImRpcmVjdG9yeSIsImZzIiwiZXhpc3RzU3luYyIsInNlc3Npb25GaWxlc1RyZWUiLCJpbk1lbW9yeVNlc3Npb25zIiwiZmlsZVRyZWVTZXNzaW9uc092ZXJ2aWV3IiwiZmlsdGVyIiwibWFwIiwiZGlyIiwiY29uZmlnUGF0aCIsImludGVyc2VjdGlvbiIsImNyZWF0ZWQiLCJkZWxldGVkIiwiZWwiLCJzZXNzaW9uT3ZlcnZpZXciLCJmcm9tRmlsZVN5c3RlbSIsImVyciIsImxvZyIsImVycm9yIiwic2Vzc2lvbnNPdmVydmlldyIsImNyZWF0ZVN0cmVhbVJvdXRlIiwidG8iLCJzdHJlYW1zUm91dGluZyIsInIiLCJpc1NvdXJjZVN0cmVhbWluZyIsInJlZHVjZSIsImFjYyIsInB1c2giLCJwbGF5ZXIiLCJzdHJlYW1Tb3VyY2UiLCJkZWxldGVTdHJlYW1Sb3V0ZSIsInNwbGljZSIsInJvdXRlIiwiZm9yRWFjaCIsImtleSIsInByb3BhZ2F0ZVN0cmVhbUZyYW1lIiwiZnJhbWUiLCJyb3V0ZXMiLCJmcm9tSWQiLCJ0YXJnZXRDbGllbnQiLCJpZENsaWVudE1hcCIsInNvY2tldCIsInNlbmRCaW5hcnkiLCJhdWRpb0ZpbGVzVHJlZSIsImluZGV4T2YiLCJleHRlbnNpb24iLCJ1cmwiLCJ1cGRhdGVBdWRpb0ZpbGVzRnJvbUZpbGVTeXN0ZW0iXSwibWFwcGluZ3MiOiI7Ozs7Ozs7QUFBQTs7QUFDQTs7QUFDQTs7QUFDQTs7QUFDQTs7QUFFQTs7QUFDQTs7QUFDQTs7QUFFQTs7QUFDQTs7QUFDQTs7OztBQUVBO0FBRUEsTUFBTUEsT0FBTixDQUFjO0FBQ1pDLEVBQUFBLFdBQVcsQ0FBQ0MsSUFBRCxFQUFPO0FBQ2hCLFNBQUtBLElBQUwsR0FBWUEsSUFBWjtB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QUY7QUFBUW1ILFFBQUFBLEdBQVI7QUFBYUQsUUFBQUE7QUFBYixPQUFQO0FBQWlDLEtBRnJELENBQW5CO0FBSUEsU0FBS2hJLEtBQUwsQ0FBV2UsR0FBWCxDQUFlO0FBQUU2RCxNQUFBQTtBQUFGLEtBQWYsRUFOb0QsQ0FRcEQ7O0FBQ0EsU0FBSyxJQUFJckIsT0FBVCxJQUFvQixLQUFLcEQsUUFBTCxDQUFjZ0QsTUFBZCxFQUFwQixFQUE0QztBQUMxQyxZQUFNSSxPQUFPLENBQUMyRSw4QkFBUixDQUF1Q3RELFVBQXZDLENBQU47QUFBeUQ7QUFDMUQ7QUFDRjs7QUEzWFc7O2VBOFhDL0UsTyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0IGZzIGZyb20gJ2ZzJztcbmltcG9ydCBKU09ONSBmcm9tICdqc29uNSc7XG5pbXBvcnQgeyB2NCBhcyB1dWlkdjQgfSBmcm9tICd1dWlkJztcbmltcG9ydCBzbHVnaWZ5IGZyb20gJ0BzaW5kcmVzb3JodXMvc2x1Z2lmeSc7XG5cbmltcG9ydCBTZXNzaW9uIGZyb20gJy4vU2Vzc2lvbic7XG5pbXBvcnQgZGIgZnJvbSAnLi91dGlscy9kYic7XG5pbXBvcnQgZGlmZkFycmF5cyBmcm9tICcuLi9jb21tb24vdXRpbHMvZGlmZkFycmF5cyc7XG5cbmltcG9ydCBwcm9qZWN0U2NoZW1hIGZyb20gJy4vc2NoZW1hcy9wcm9qZWN0LmpzJztcbmltcG9ydCBzZXNzaW9uU2NoZW1hIGZyb20gJy4vc2NoZW1hcy9zZXNzaW9uLmpzJztcbmltcG9ydCBwbGF5ZXJTY2hlbWEgZnJvbSAnLi9zY2hlbWFzL3BsYXllci5qcyc7XG5cbi8vIGNvbnN0IFBST0pFQ1RfVkVSU0lPTiA9ICcwLjAuMCc7XG5cbmNsYXNzIFByb2plY3Qge1xuICBjb25zdHJ1Y3Rvcihjb21vKSB7XG4gICAgdGhpcy5jb21vID0gY29tbztcblxuICAgIHRoaXMuc3RhdGUgPSBudWxsO1xuICAgIHRoaXMucGxheWVycyA9IG5ldyBNYXAoKTtcbiAgICB0aGlzLnNlc3Npb25zID0gbmV3IE1hcCgpO1xuXG4gICAgdGhpcy5jb21vLnNlcnZlci5zdGF0ZU1hbmFnZXIucmVnaXN0ZXJTY2hlbWEoJ3Byb2plY3QnLCBwcm9qZWN0U2NoZW1hKTtcbiAgICB0aGlzLmNvbW8uc2VydmVyLnN0YXRlTWFuYWdlci5yZWdpc3RlclNjaGVtYShgc2Vzc2lvbmAsIHNlc3Npb25TY2hlbWEpO1xuICAgIHRoaXMuY29tby5zZXJ2ZXIuc3RhdGVNYW5hZ2VyLnJlZ2lzdGVyU2NoZW1hKCdwbGF5ZXInLCBwbGF5ZXJTY2hlbWEpO1xuICB9XG5cbiAgLy8gYFN0YXRlYCBpbnRlcmZhY2VcbiAgc3Vic2NyaWJlKCkge1xuICAgIHJldHVybiB0aGlzLnN0YXRlLnN1YnNjcmliZShmdW5jKTtcbiAgfVxuXG4gIGdldFZhbHVlcygpIHtcbiAgICByZXR1cm4gdGhpcy5zdGF0ZS5nZXRWYWx1ZXMoKTtcbiAgfVxuXG4gIGdldChuYW1lKSB7XG4gICAgcmV0dXJuIHRoaXMuc3RhdGUuZ2V0KG5hbWUpO1xuICB9XG5cbiAgc2V0KHVwZGF0ZXMpIHtcbiAgICB0aGlzLnN0YXRlLnNldCh1cGRhdGVzKTtcbiAgfVxuXG4gIGFzeW5jIGluaXQoKSB7XG4gICAgLy8gcGFyc2UgZXhpc3RpbmcgcHJlc2V0c1xuICAgIHRoaXMuZ3JhcGhQcmVzZXRzID0gbmV3IE1hcCgpO1xuICAgIGxldCBsZWFybmluZ1ByZXNldHMgPSB7fTtcblxuICAgIGNvbnN0IGZpbGVUcmVlID0gdGhpcy5jb21vLmZpbGVXYXRjaGVyLnN0YXRlLmdldCgncHJlc2V0cycpO1xuXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBmaWxlVHJlZS5jaGlsZHJlbi5sZW5ndGg7IGkrKykge1xuICAgICAgY29uc3QgbGVhZiA9IGZpbGVUcmVlLmNoaWxkcmVuW2ldO1xuXG4gICAgICAvLyBncmFwaCBwcmVzZXRzXG4gICAgICBpZiAobGVhZi50eXBlID09PSAnZGlyZWN0b3J5Jykge1xuICAgICAgICBjb25zdCBwcmVzZXROYW1lID0gbGVhZi5uYW1lO1xuICAgICAgICBjb25zdCBkYXRhR3JhcGggPSBhd2FpdCBkYi5yZWFkKHBhdGguam9pbihsZWFmLnBhdGgsICdncmFwaC1kYXRhLmpzb24nKSk7XG4gICAgICAgIGNvbnN0IGF1ZGlvR3JhcGggPSBhd2FpdCBkYi5yZWFkKHBhdGguam9pbihsZWFmLnBhdGgsICdncmFwaC1hdWRpby5qc29uJykpO1xuICAgICAgICBjb25zdCBwcmVzZXQgPSB7IGRhdGE6IGRhdGFHcmFwaCwgYXVkaW86IGF1ZGlvR3JhcGggfTtcbiAgICAgICAgdGhpcy5ncmFwaFByZXNldHMuc2V0KHByZXNldE5hbWUsIHByZXNldCk7XG4gICAgICB9XG5cbiAgICAgIC8vIGxlYXJuaW5nIHByZXNldHNcbiAgICAgIGlmIChsZWFmLnR5cGUgPT09ICdmaWxlJyAmJiBsZWFmLm5hbWUgPT09ICdsZWFybmluZy1wcmVzZXRzLmpzb24nKSB7XG4gICAgICAgIGxlYXJuaW5nUHJlc2V0cyA9IGF3YWl0IGRiLnJlYWQobGVhZi5wYXRoKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICB0aGlzLnN0YXRlID0gYXdhaXQgdGhpcy5jb21vLnNlcnZlci5zdGF0ZU1hbmFnZXIuY3JlYXRlKCdwcm9qZWN0Jywge1xuICAgICAgZ3JhcGhQcmVzZXRzOiBBcnJheS5mcm9tKHRoaXMuZ3JhcGhQcmVzZXRzLmtleXMoKSksXG4gICAgICBsZWFybmluZ1ByZXNldHM6IGxlYXJuaW5nUHJlc2V0cyxcbiAgICB9KTtcblxuICAgIHRoaXMuY29tby5zZXJ2ZXIuc3RhdGVNYW5hZ2VyLm9ic2VydmUoYXN5bmMgKHNjaGVtYU5hbWUsIHN0YXRlSWQsIG5vZGVJZCkgPT4ge1xuICAgICAgLy8gdHJhY2sgcGxheWVyc1xuICAgICAgaWYgKHNjaGVtYU5hbWUgPT09ICdwbGF5ZXInKSB7XG4gICAgICAgIGNvbnN0IHBsYXllclN0YXRlID0gYXdhaXQgdGhpcy5jb21vLnNlcnZlci5zdGF0ZU1hbmFnZXIuYXR0YWNoKHNjaGVtYU5hbWUsIHN0YXRlSWQpO1xuICAgICAgICBjb25zdCBwbGF5ZXJJZCA9IHBsYXllclN0YXRlLmdldCgnaWQnKTtcblxuICAgICAgICBwbGF5ZXJTdGF0ZS5vbkRldGFjaCgoKSA9PiB7XG4gICAgICAgICAgdGhpcy5jbGVhclN0cmVhbVJvdXRpbmcocGxheWVySWQsIG51bGwpOyAvLyBjbGVhciByb3V0aW5nIHdoZXJlIHBsYXllciBpcyB0aGUgc291cmNlXG4gICAgICAgICAgdGhpcy5wbGF5ZXJzLmRlbGV0ZShwbGF5ZXJJZClcbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gbWF5YmUgbW92ZSB0aGlzIGluIFNlc3Npb24sIHdvdWxkIGJlIG1vcmUgbG9naWNhbC4uLlxuICAgICAgICBwbGF5ZXJTdGF0ZS5zdWJzY3JpYmUodXBkYXRlcyA9PiB7XG4gICAgICAgICAgZm9yIChsZXQgW25hbWUsIHZhbHVlc10gb2YgT2JqZWN0LmVudHJpZXModXBkYXRlcykpIHtcbiAgICAgICAgICAgIHN3aXRjaCAobmFtZSkge1xuICAgICAgICAgICAgICAvLyByZXNldCBwbGF5ZXIgc3RhdGUgd2hlbiBpdCBjaGFuZ2Ugc2Vzc2lvblxuICAgICAgICAgICAgICAvLyBAbm90ZSAtIHRoaXMgY291bGQgYmUgYSBraW5kIG9mIHJlZHVjZXIgcHJvdmlkZWQgYnlcbiAgICAgICAgICAgICAgLy8gdGhlIHN0YXRlTWFuYWdlciBpdHNlbGYgKHNvdW5kd29ya3MvY29yZSBpc3N1ZSlcbiAgICAgICAgICAgICAgY2FzZSAnc2Vzc2lvbklkJzoge1xuICAgICAgICAgICAgICAgIGNvbnN0IHNlc3Npb25JZCA9IHZhbHVlcztcblxuICAgICAgICAgICAgICAgIGlmIChzZXNzaW9uSWQgIT09IG51bGwpIHtcbiAgICAgICAgICAgICAgICAgIGNvbnN0IHNlc3Npb24gPSB0aGlzLnNlc3Npb25zLmdldChzZXNzaW9uSWQpO1xuXG4gICAgICAgICAgICAgICAgICBpZiAoIXNlc3Npb24pIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS53YXJuKGBbY29tb10gcmVxdWlyZWQgc2Vzc2lvbiBcIiR7c2Vzc2lvbklkfVwiIGRvZXMgbm90IGV4aXN0c2ApO1xuICAgICAgICAgICAgICAgICAgICBwbGF5ZXJTdGF0ZS5zZXQoeyBzZXNzaW9uSWQ6IG51bGwgfSk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgY29uc3QgZGVmYXVsdExhYmVsID0gc2Vzc2lvbi5nZXQoJ2xhYmVscycpWzBdO1xuICAgICAgICAgICAgICAgICAgY29uc3QgZ3JhcGhPcHRpb25zID0gc2Vzc2lvbi5nZXQoJ2dyYXBoT3B0aW9ucycpO1xuXG4gICAgICAgICAgICAgICAgICBwbGF5ZXJTdGF0ZS5zZXQoe1xuICAgICAgICAgICAgICAgICAgICBsYWJlbDogZGVmYXVsdExhYmVsLFxuICAgICAgICAgICAgICAgICAgICByZWNvcmRpbmdTdGF0ZTogJ2lkbGUnLFxuICAgICAgICAgICAgICAgICAgICBncmFwaE9wdGlvbnMsXG4gICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgcGxheWVyU3RhdGUuc2V0KHtcbiAgICAgICAgICAgICAgICAgICAgbGFiZWw6ICcnLFxuICAgICAgICAgICAgICAgICAgICByZWNvcmRpbmdTdGF0ZTogJ2lkbGUnLFxuICAgICAgICAgICAgICAgICAgICBncmFwaE9wdGlvbnM6IG51bGwsXG4gICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICBjYXNlICdncmFwaE9wdGlvbnNFdmVudCc6IHtcbiAgICAgICAgICAgICAgICBjb25zdCBvcHRpb25zVXBkYXRlcyA9IHZhbHVlcztcbiAgICAgICAgICAgICAgICBjb25zdCBncmFwaE9wdGlvbnMgPSBwbGF5ZXJTdGF0ZS5nZXQoJ2dyYXBoT3B0aW9ucycpO1xuXG4gICAgICAgICAgICAgICAgZm9yIChsZXQgbW9kdWxlSWQgaW4gb3B0aW9uc1VwZGF0ZXMpIHtcbiAgICAgICAgICAgICAgICAgIE9iamVjdC5hc3NpZ24oZ3JhcGhPcHRpb25zW21vZHVsZUlkXSwgb3B0aW9uc1VwZGF0ZXNbbW9kdWxlSWRdKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBwbGF5ZXJTdGF0ZS5zZXQoeyBncmFwaE9wdGlvbnMgfSk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHRoaXMucGxheWVycy5zZXQocGxheWVySWQsIHBsYXllclN0YXRlKTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIC8vIHRyYWNrIGZpbGUgc3lzdGVtXG4gICAgdGhpcy5jb21vLmZpbGVXYXRjaGVyLnN0YXRlLnN1YnNjcmliZSh1cGRhdGVzID0+IHtcbiAgICAgIGZvciAobGV0IG5hbWUgaW4gdXBkYXRlcykge1xuICAgICAgICBzd2l0Y2ggKG5hbWUpIHtcbiAgICAgICAgICBjYXNlICdhdWRpbyc6XG4gICAgICAgICAgICB0aGlzLl91cGRhdGVBdWRpb0ZpbGVzRnJvbUZpbGVTeXN0ZW0odXBkYXRlc1tuYW1lXSk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICBjYXNlICdzZXNzaW9ucyc6XG4gICAgICAgICAgICB0aGlzLl91cGRhdGVTZXNzaW9uc0Zyb21GaWxlU3lzdGVtKHVwZGF0ZXNbbmFtZV0pO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9KTtcblxuICAgIGF3YWl0IHRoaXMuX3VwZGF0ZUF1ZGlvRmlsZXNGcm9tRmlsZVN5c3RlbSh0aGlzLmNvbW8uZmlsZVdhdGNoZXIuc3RhdGUuZ2V0KCdhdWRpbycpKTtcbiAgICBhd2FpdCB0aGlzLl91cGRhdGVTZXNzaW9uc0Zyb21GaWxlU3lzdGVtKHRoaXMuY29tby5maWxlV2F0Y2hlci5zdGF0ZS5nZXQoJ3Nlc3Npb25zJykpO1xuXG4gICAgaWYgKHRoaXMuY29tby5zZXJ2ZXIuY29uZmlnLmNvbW8ucHJlbG9hZEF1ZGlvRmlsZXMpIHtcbiAgICAgIC8vIHRoaXMgd2lsbCBwcmVsb2FkIGFsbCBmaWxlcyBvZiB0aGUgcHJvamVjdCwgc28gdGhhdCBzZXNzaW9ucyBjYW4ganVzdFxuICAgICAgLy8gcGljayB0aGVpciBidWZmZXJzIGluIHRoZSBhdWRpby1idWZmZXItbG9hZGVyIGNhY2hlLlxuICAgICAgdGhpcy5zdGF0ZS5zZXQoeyBwcmVsb2FkQXVkaW9GaWxlczogdHJ1ZSB9KTtcbiAgICB9XG4gIH1cblxuICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAvLyBTRVNTSU9OU1xuICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICBhc3luYyBjcmVhdGVTZXNzaW9uKHNlc3Npb25OYW1lLCBncmFwaFByZXNldCkge1xuICAgIGNvbnN0IG92ZXJ2aWV3ID0gdGhpcy5nZXQoJ3Nlc3Npb25zT3ZlcnZpZXcnKTtcbiAgICAvLyBAbm90ZSAtIHRoaXMgY291bGQgcHJvYmFibHkgYmUgbW9yZSByb2J1c3RcbiAgICBjb25zdCBpZCA9IHNsdWdpZnkoc2Vzc2lvbk5hbWUpO1xuICAgIC8vIGZpbmQgaWYgYSBzZXNzaW9uIHcvIHRoZSBzYW1lIG5hbWUgb3Igc2x1ZyBhbHJlYWR5IGV4aXN0c1xuICAgIGNvbnN0IGluZGV4ID0gb3ZlcnZpZXcuZmluZEluZGV4KG92ZXJ2aWV3ID0+IHtcbiAgICAgIHJldHVybiBvdmVydmlldy5uYW1lID09PSBzZXNzaW9uTmFtZSB8fCBvdmVydmlldy5pZCA9PT0gaWQ7XG4gICAgfSk7XG5cbiAgICBpZiAoaW5kZXggPT09IC0xKSB7XG4gICAgICBjb25zdCBhdWRpb0ZpbGVzID0gdGhpcy5nZXQoJ2F1ZGlvRmlsZXMnKTtcbiAgICAgIGNvbnN0IGdyYXBoID0gdGhpcy5ncmFwaFByZXNldHMuZ2V0KGdyYXBoUHJlc2V0KTtcbiAgICAgIGNvbnN0IHNlc3Npb24gPSBhd2FpdCBTZXNzaW9uLmNyZWF0ZSh0aGlzLmNvbW8sIGlkLCBzZXNzaW9uTmFtZSwgZ3JhcGgsIGF1ZGlvRmlsZXMpO1xuXG4gICAgICB0aGlzLnNlc3Npb25zLnNldChpZCwgc2Vzc2lvbik7XG4gICAgICB0aGlzLl91cGRhdGVTZXNzaW9uc092ZXJ2aWV3KCk7XG5cbiAgICAgIHJldHVybiBpZDtcbiAgICB9XG5cbiAgICAvLyBjb25zb2xlLmxvZyhgPiBzZXNzaW9uIFwiJHtzZXNzaW9uTmFtZX1cIiBhbHJlYWR5IGV4aXN0c2ApO1xuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgYXN5bmMgZGVsZXRlU2Vzc2lvbihpZCkge1xuICAgIGlmICh0aGlzLnNlc3Npb25zLmhhcyhpZCkpIHtcbiAgICAgIGNvbnN0IHNlc3Npb24gPSB0aGlzLnNlc3Npb25zLmdldChpZCk7XG4gICAgICBjb25zdCBmdWxscGF0aCA9IHNlc3Npb24uZGlyZWN0b3J5O1xuXG4gICAgICB0aGlzLnNlc3Npb25zLmRlbGV0ZShpZCk7XG4gICAgICBhd2FpdCBzZXNzaW9uLmRlbGV0ZSgpO1xuXG4gICAgICAvLyBXZSBjYW4gY29tZSBmcm9tIDIgcGF0aHMgaGVyZTpcbiAgICAgIC8vIDEuIGlmIHRoZSBmaWxlIHN0aWxsIGV4aXN0cywgdGhlIG1ldGhvZCBoYXMgYmVlbiBjYWxsZWQgcHJvZ3JhbW1hdGljYWxseSBzb1xuICAgICAgLy8gd2UgbmVlZCB0byByZW1vdmUgdGhlIGZpbGUuIFRoaXMgd2lsbCB0cmlnZ2VyIGBfdXBkYXRlU2Vzc2lvbnNGcm9tRmlsZVN5c3RlbWBcbiAgICAgIC8vIGJ1dCBub3RoaW5nIHNob3VsZCBhcHBlbmQgdGhlcmUsIHRoYXQncyB3aHkgd2UgdXBkYXRlIHRoZVxuICAgICAgLy8gYHNlc3Npb25PdmVydmlld2AgaGVyZS5cbiAgICAgIC8vIDIuIGlmIHRoZSBmaWxlIGhhcyBiZWVuIHJlbW92ZWQgbWFudWFsbHkgd2UgYXJlIGNhbGxlZCBmcm9tXG4gICAgICAvLyBgX3VwZGF0ZVNlc3Npb25zRnJvbUZpbGVTeXN0ZW1gIHRoZW4gd2UgZG9uJ3Qgd2FudCB0byBtYW5pcHVsYXRlXG4gICAgICAvLyB0aGUgZmlsZSBzeXN0ZW0sIG5vciB1cGRhdGUgdGhlIGBzZXNzaW9uc092ZXJ2aWV3YC5cbiAgICAgIGlmIChmcy5leGlzdHNTeW5jKHNlc3Npb24uZGlyZWN0b3J5KSkge1xuICAgICAgICBhd2FpdCBkYi5kZWxldGUoc2Vzc2lvbi5kaXJlY3RvcnkpO1xuICAgICAgICB0aGlzLl91cGRhdGVTZXNzaW9uc092ZXJ2aWV3KCk7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIGFzeW5jIF91cGRhdGVTZXNzaW9uc0Zyb21GaWxlU3lzdGVtKHNlc3Npb25GaWxlc1RyZWUpIHtcbiAgICBjb25zdCBpbk1lbW9yeVNlc3Npb25zID0gQXJyYXkuZnJvbSh0aGlzLnNlc3Npb25zLnZhbHVlcygpKTtcbiAgICBjb25zdCBmaWxlVHJlZVNlc3Npb25zT3ZlcnZpZXcgPSBzZXNzaW9uRmlsZXNUcmVlXG4gICAgICAuY2hpbGRyZW5cbiAgICAgIC5maWx0ZXIobGVhZiA9PiBsZWFmLnR5cGUgPT09ICdkaXJlY3RvcnknKVxuICAgICAgLm1hcChkaXIgPT4ge1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIGlkOiBkaXIubmFtZSxcbiAgICAgICAgICBjb25maWdQYXRoOiBkaXIucGF0aCxcbiAgICAgICAgfTtcbiAgICAgIH0pO1xuXG4gICAgY29uc3Qge1xuICAgICAgaW50ZXJzZWN0aW9uLFxuICAgICAgY3JlYXRlZCxcbiAgICAgIGRlbGV0ZWRcbiAgICB9ID0gZGlmZkFycmF5cyhpbk1lbW9yeVNlc3Npb25zLCBmaWxlVHJlZVNlc3Npb25zT3ZlcnZpZXcsIGVsID0+IGVsLmlkKTtcblxuICAgIC8vIG5vdCBpbnN0YW5jaWF0ZWQgYnV0IHByZXNlbnQgaW4gZmlsZSBzeXN0ZW1cbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGNyZWF0ZWQubGVuZ3RoOyBpKyspIHtcbiAgICAgIGNvbnN0IHNlc3Npb25PdmVydmlldyA9IGNyZWF0ZWRbaV07XG5cbiAgICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IGF1ZGlvRmlsZXMgPSB0aGlzLmdldCgnYXVkaW9GaWxlcycpO1xuICAgICAgICBjb25zdCBzZXNzaW9uID0gYXdhaXQgU2Vzc2lvbi5mcm9tRmlsZVN5c3RlbSh0aGlzLmNvbW8sIHNlc3Npb25PdmVydmlldy5jb25maWdQYXRoLCBhdWRpb0ZpbGVzKTtcblxuICAgICAgICB0aGlzLnNlc3Npb25zLnNldChzZXNzaW9uT3ZlcnZpZXcuaWQsIHNlc3Npb24pO1xuICAgICAgfSBjYXRjaChlcnIpIHtcbiAgICAgICAgY29uc29sZS5sb2coYD4gY2Fubm90IGluc3RhbmNpYXRlIHNlc3Npb24gJHtzZXNzaW9uT3ZlcnZpZXcuaWR9YCk7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoZXJyKTtcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgLy8gaW5zdGFuY2lhdGVkIGJ1dCBhYnNlbnQgZnJvbSBmaWxlIHN5c3RlbVxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZGVsZXRlZC5sZW5ndGg7IGkrKykge1xuICAgICAgY29uc3QgaWQgPSBkZWxldGVkW2ldLmlkO1xuICAgICAgYXdhaXQgdGhpcy5kZWxldGVTZXNzaW9uKGlkKTtcbiAgICB9XG5cbiAgICAvLyB1cGRhdGUgb3ZlcnZpZXcgaWYgc29tZSBzZXNzaW9ucyBoYXZlIGJlZW4gY3JlYXRlZCBvciBkZWxldGVkXG4gICAgaWYgKGNyZWF0ZWQubGVuZ3RoIHx8wqBkZWxldGVkLmxlbmd0aCkge1xuICAgICAgdGhpcy5fdXBkYXRlU2Vzc2lvbnNPdmVydmlldygpO1xuICAgIH1cbiAgfVxuXG4gIF91cGRhdGVTZXNzaW9uc092ZXJ2aWV3KCkge1xuICAgIGNvbnN0IHNlc3Npb25zT3ZlcnZpZXcgPSBBcnJheS5mcm9tKHRoaXMuc2Vzc2lvbnMudmFsdWVzKCkpXG4gICAgICAubWFwKHNlc3Npb24gPT4ge1xuICAgICAgICBjb25zdCBzdGF0ZUlkID0gc2Vzc2lvbi5zdGF0ZS5pZDtcbiAgICAgICAgY29uc3QgeyBpZCwgbmFtZSB9ID0gc2Vzc2lvbi5nZXRWYWx1ZXMoKTtcblxuICAgICAgICByZXR1cm4geyBpZCwgbmFtZSwgc3RhdGVJZCB9O1xuICAgICAgfSk7XG5cbiAgICB0aGlzLnNldCh7IHNlc3Npb25zT3ZlcnZpZXcgfSk7XG4gIH1cblxuICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAvLyBST1VUSU5HXG4gIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbiAgLyoqXG4gICAqIGZyb20gLSBwbGF5ZXJJZCAtIHRoZSBsb2dpY2FsIGNsaWVudCwgQ29NbyBwbGF5ZXIgaW5zdGFuY2VcbiAgICogdG8gLSBub2RlSWQgLSB0aGUgcGh5c2ljYWwgY2xpZW50LCBzb3VuZHdvcmtzIGNsaWVudCBpbnN0YW5jZVxuICAgKi9cbiAgYXN5bmMgY3JlYXRlU3RyZWFtUm91dGUoZnJvbSwgdG8pIHtcbiAgICBjb25zdCBzdHJlYW1zUm91dGluZyA9IHRoaXMuZ2V0KCdzdHJlYW1zUm91dGluZycpO1xuICAgIGNvbnN0IGluZGV4ID0gc3RyZWFtc1JvdXRpbmcuZmluZEluZGV4KHIgPT4gclswXSA9PT0gZnJvbSAmJiByWzFdID09PSB0byk7XG5cbiAgICBpZiAoaW5kZXggPT09IC0xKSB7XG4gICAgICBjb25zdCBpc1NvdXJjZVN0cmVhbWluZyA9IHN0cmVhbXNSb3V0aW5nLnJlZHVjZSgoYWNjLCByKSA9PiBhY2MgfHwgclswXSA9PT0gZnJvbSwgZmFsc2UpO1xuICAgICAgY29uc3QgY3JlYXRlZCA9IFtmcm9tLCB0b107XG4gICAgICBzdHJlYW1zUm91dGluZy5wdXNoKGNyZWF0ZWQpO1xuXG4gICAgICAvLyBjb25zb2xlLmxvZygnY3JlYXRlU3RyZWFtUm91dGUnLCBzdHJlYW1zUm91dGluZyk7XG4gICAgICB0aGlzLnNldCh7IHN0cmVhbXNSb3V0aW5nIH0pO1xuICAgICAgLy8gbm90aWZ5IHBsYXllciB0aGF0IGl0IHNob3VsZCBzdGFydCB0byBzdHJlYW0gaXRzIHNvdXJjZVxuICAgICAgaWYgKCFpc1NvdXJjZVN0cmVhbWluZykge1xuICAgICAgICBjb25zdCBwbGF5ZXIgPSB0aGlzLnBsYXllcnMuZ2V0KGZyb20pO1xuICAgICAgICBwbGF5ZXIuc2V0KHsgc3RyZWFtU291cmNlOiB0cnVlIH0pO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBhc3luYyBkZWxldGVTdHJlYW1Sb3V0ZShmcm9tLCB0bykge1xuICAgIGNvbnN0IHN0cmVhbXNSb3V0aW5nID0gdGhpcy5nZXQoJ3N0cmVhbXNSb3V0aW5nJyk7XG4gICAgY29uc3QgaW5kZXggPSBzdHJlYW1zUm91dGluZy5maW5kSW5kZXgociA9PiByWzBdID09PSBmcm9tICYmIHJbMV0gPT09IHRvKTtcblxuICAgIGlmIChpbmRleCAhPT0gLTEpIHtcbiAgICAgIGNvbnN0IGRlbGV0ZWQgPSBzdHJlYW1zUm91dGluZ1tpbmRleF07XG4gICAgICBzdHJlYW1zUm91dGluZy5zcGxpY2UoaW5kZXgsIDEpO1xuXG4gICAgICBhd2FpdCB0aGlzLnNldCh7IHN0cmVhbXNSb3V0aW5nIH0pO1xuXG4gICAgICBjb25zdCBpc1NvdXJjZVN0cmVhbWluZyA9IHN0cmVhbXNSb3V0aW5nLnJlZHVjZSgoYWNjLCByKSA9PiBhY2MgfHwgclswXSA9PT0gZnJvbSwgZmFsc2UpO1xuXG4gICAgICAvLyBub3RpZnkgcGxheWVyIHRoYXQgaXQgc2hvdWxkIHN0b3Agc3RyZWFtaW5nIGl0cyBzb3VyY2VcbiAgICAgIGlmICghaXNTb3VyY2VTdHJlYW1pbmcpIHtcbiAgICAgICAgY29uc3QgcGxheWVyID0gdGhpcy5wbGF5ZXJzLmdldChmcm9tKTtcbiAgICAgICAgcGxheWVyLnNldCh7IHN0cmVhbVNvdXJjZTogZmFsc2UgfSk7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIGFzeW5jIGNsZWFyU3RyZWFtUm91dGluZyhmcm9tID0gbnVsbCwgdG8gPSBudWxsKSB7XG4gICAgY29uc3Qgc3RyZWFtc1JvdXRpbmcgPSB0aGlzLmdldCgnc3RyZWFtc1JvdXRpbmcnKTtcbiAgICBjb25zdCBkZWxldGVkID0gW107XG5cbiAgICBmb3IgKGxldCBpID0gc3RyZWFtc1JvdXRpbmcubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcbiAgICAgIGNvbnN0IHJvdXRlID0gc3RyZWFtc1JvdXRpbmdbaV07XG5cbiAgICAgIGlmIChyb3V0ZVswXSA9PT0gZnJvbSB8fMKgcm91dGVbMV0gPT09IHRvKSB7XG4gICAgICAgIGRlbGV0ZWQucHVzaChyb3V0ZSk7XG4gICAgICAgIHN0cmVhbXNSb3V0aW5nLnNwbGljZShpLCAxKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICB0aGlzLnNldCh7IHN0cmVhbXNSb3V0aW5nIH0pO1xuXG4gICAgLy8gbm90aWZ5IHBvc3NpYmxlIHNvdXJjZXMgdGhhdCB0aGV5IHNob3VsZCBzdG9wIHN0cmVhbWluZ1xuICAgIHRoaXMucGxheWVycy5mb3JFYWNoKChwbGF5ZXIsIGtleSkgPT4ge1xuICAgICAgY29uc3QgaXNTb3VyY2VTdHJlYW1pbmcgPSBzdHJlYW1zUm91dGluZy5yZWR1Y2UoKGFjYywgcikgPT4gYWNjIHx8IHJbMF0gPT09IGtleSwgZmFsc2UpO1xuXG4gICAgICBpZiAoIWlzU291cmNlU3RyZWFtaW5nICYmIHBsYXllci5nZXQoJ3N0cmVhbVNvdXJjZScpID09PSB0cnVlKSB7XG4gICAgICAgIHBsYXllci5zZXQoeyBzdHJlYW1Tb3VyY2U6IGZhbHNlIH0pO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgcHJvcGFnYXRlU3RyZWFtRnJhbWUoZnJhbWUpIHtcbiAgICAvLyBAdG9kbyAtIHdlIG5lZWQgdG8gbW92ZSB0aGlzIGludG8gYFByb2pldGAgc28gdGhhdCBpdCBjYW4gYmUgY2FsbGVkXG4gICAgLy8gZGlyZWN0bHkgZnJvbSBzZXJ2ZXIgc2lkZSB3aXRoIGFuIGFyYml0cmFyeSBmcmFtZS4uLlxuICAgIGNvbnN0IHJvdXRlcyA9IHRoaXMuZ2V0KCdzdHJlYW1zUm91dGluZycpO1xuICAgIGNvbnN0IGZyb21JZCA9IGZyYW1lWzBdO1xuXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCByb3V0ZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgIGNvbnN0IHJvdXRlID0gcm91dGVzW2ldO1xuICAgICAgaWYgKHJvdXRlWzBdID09PSBmcm9tSWQpIHtcbiAgICAgICAgY29uc3QgdGFyZ2V0Q2xpZW50ID0gdGhpcy5jb21vLmlkQ2xpZW50TWFwLmdldChyb3V0ZVsxXSk7XG5cbiAgICAgICAgLy8gaWYgd2UgaGF2ZSBhIGNsaWVudCB3aXRoIHRoZSByaWdodCBub2RlSWRcbiAgICAgICAgaWYgKHRhcmdldENsaWVudCkge1xuICAgICAgICAgIHRhcmdldENsaWVudC5zb2NrZXQuc2VuZEJpbmFyeSgnc3RyZWFtJywgZnJhbWUpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vIG1pZ2h0IGJlIGFuIE9TQyB0YXJnZXQgY2xpZW50XG4gICAgICAgICAgLy8gb3NjLnNlbmQoJy9zdHJlYW0vJHtyb3V0ZVsxXX0vJHtyb3V0ZVswXX0nLCBmcmFtZSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAvLyBBVURJTyBGSUxFU1xuICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICBhc3luYyBfdXBkYXRlQXVkaW9GaWxlc0Zyb21GaWxlU3lzdGVtKGF1ZGlvRmlsZXNUcmVlKSB7XG4gICAgLy8gZmlsdGVyIGV2ZXJ5dGhpbiB0aGF0IGlzIG5vdCBhIC53YXYgb3IgYSAubXAzIGZpbGVcbiAgICBjb25zdCBhdWRpb0ZpbGVzID0gYXVkaW9GaWxlc1RyZWUuY2hpbGRyZW5cbiAgICAgIC5maWx0ZXIobGVhZiA9PiBsZWFmLnR5cGUgPT09ICdmaWxlJyAmJiBbJy5tcDMnLCAnLndhdiddLmluZGV4T2YobGVhZi5leHRlbnNpb24pICE9PSAtMSlcbiAgICAgIC5tYXAoKHsgbmFtZSwgdXJsLCBleHRlbnNpb24gfSkgPT4geyByZXR1cm4geyBuYW1lLCB1cmwsIGV4dGVuc2lvbiB9IH0pO1xuXG4gICAgdGhpcy5zdGF0ZS5zZXQoeyBhdWRpb0ZpbGVzIH0pO1xuXG4gICAgLy8gQHRvZG8gLSBjbGVhbiBzZXNzaW9uc1xuICAgIGZvciAobGV0IHNlc3Npb24gb2YgdGhpcy5zZXNzaW9ucy52YWx1ZXMoKSkge1xuICAgICAgYXdhaXQgc2Vzc2lvbi51cGRhdGVBdWRpb0ZpbGVzRnJvbUZpbGVTeXN0ZW0oYXVkaW9GaWxlcyk7O1xuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBQcm9qZWN0O1xuIl19