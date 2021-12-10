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
    this.como.server.stateManager.registerUpdateHook('session', (updates, currentValues) => {
      for (let [name, values] of Object.entries(updates)) {
        switch (name) {
          case 'graphOptionsEvent':
            {
              const graphOptions = currentValues.graphOptions;

              for (let moduleId in values) {
                // delete scriptParams on scriptName change
                if ('scriptName' in values[moduleId]) {
                  delete graphOptions[moduleId].scriptParams; // @todo - update the model when a dataScript is updated...
                  // this.updateModel(this.state.get('examples'));
                }

                Object.assign(graphOptions[moduleId], values[moduleId]);
              } // forward event to players attached to the session


              Array.from(this.players.values()).filter(player => player.get('sessionId') === currentValues.id).forEach(player => player.set({
                graphOptionsEvent: values
              }));
              return { ...updates,
                graphOptions
              };
              break;
            }
        }
      }
    });
    this.como.server.stateManager.registerUpdateHook('player', (updates, currentValues) => {
      for (let [name, values] of Object.entries(updates)) {
        switch (name) {
          case 'sessionId':
            {
              const sessionId = values;

              if (sessionId !== null) {
                const session = this.sessions.get(sessionId);

                if (!session) {
                  console.warn(`[como] required session "${sessionId}" does not exists`);
                  return { ...updates,
                    sessionId: null
                  };
                }

                const labels = session.get('labels');
                let defaultLabel = '';

                if (labels.length) {
                  defaultLabel = labels[0];
                }

                const graphOptions = session.get('graphOptions');
                return { ...updates,
                  label: defaultLabel,
                  recordingState: 'idle',
                  graphOptions
                };
              } else {
                return { ...updates,
                  label: '',
                  recordingState: 'idle',
                  graphOptions: null
                };
              }

              break;
            }

          case 'graphOptionsEvent':
            {
              const optionsUpdates = values;
              const graphOptions = currentValues.graphOptions;

              for (let moduleId in optionsUpdates) {
                Object.assign(graphOptions[moduleId], optionsUpdates[moduleId]);
              }

              return { ...updates,
                graphOptions
              };
              break;
            }
        }
      }
    });
    this.como.server.stateManager.observe(async (schemaName, stateId, nodeId) => {
      // track players
      if (schemaName === 'player') {
        const playerState = await this.como.server.stateManager.attach(schemaName, stateId);
        const playerId = playerState.get('id');
        playerState.onDetach(() => {
          this.clearStreamRouting(playerId, null); // clear routing where player is the source

          this.players.delete(playerId);
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9zZXJ2ZXIvUHJvamVjdC5qcyJdLCJuYW1lcyI6WyJQcm9qZWN0IiwiY29uc3RydWN0b3IiLCJjb21vIiwic3RhdGUiLCJwbGF5ZXJzIiwiTWFwIiwic2Vzc2lvbnMiLCJzZXJ2ZXIiLCJzdGF0ZU1hbmFnZXIiLCJyZWdpc3RlclNjaGVtYSIsInByb2plY3RTY2hlbWEiLCJzZXNzaW9uU2NoZW1hIiwicGxheWVyU2NoZW1hIiwic3Vic2NyaWJlIiwiZnVuYyIsImdldFZhbHVlcyIsImdldCIsIm5hbWUiLCJzZXQiLCJ1cGRhdGVzIiwiaW5pdCIsImdyYXBoUHJlc2V0cyIsImxlYXJuaW5nUHJlc2V0cyIsImZpbGVUcmVlIiwiZmlsZVdhdGNoZXIiLCJpIiwiY2hpbGRyZW4iLCJsZW5ndGgiLCJsZWFmIiwidHlwZSIsInByZXNldE5hbWUiLCJkYXRhR3JhcGgiLCJkYiIsInJlYWQiLCJwYXRoIiwiam9pbiIsImF1ZGlvR3JhcGgiLCJwcmVzZXQiLCJkYXRhIiwiYXVkaW8iLCJjcmVhdGUiLCJBcnJheSIsImZyb20iLCJrZXlzIiwicmVnaXN0ZXJVcGRhdGVIb29rIiwiY3VycmVudFZhbHVlcyIsInZhbHVlcyIsIk9iamVjdCIsImVudHJpZXMiLCJncmFwaE9wdGlvbnMiLCJtb2R1bGVJZCIsInNjcmlwdFBhcmFtcyIsImFzc2lnbiIsImZpbHRlciIsInBsYXllciIsImlkIiwiZm9yRWFjaCIsImdyYXBoT3B0aW9uc0V2ZW50Iiwic2Vzc2lvbklkIiwic2Vzc2lvbiIsImNvbnNvbGUiLCJ3YXJuIiwibGFiZWxzIiwiZGVmYXVsdExhYmVsIiwibGFiZWwiLCJyZWNvcmRpbmdTdGF0ZSIsIm9wdGlvbnNVcGRhdGVzIiwib2JzZXJ2ZSIsInNjaGVtYU5hbWUiLCJzdGF0ZUlkIiwibm9kZUlkIiwicGxheWVyU3RhdGUiLCJhdHRhY2giLCJwbGF5ZXJJZCIsIm9uRGV0YWNoIiwiY2xlYXJTdHJlYW1Sb3V0aW5nIiwiZGVsZXRlIiwiX3VwZGF0ZUF1ZGlvRmlsZXNGcm9tRmlsZVN5c3RlbSIsIl91cGRhdGVTZXNzaW9uc0Zyb21GaWxlU3lzdGVtIiwiY29uZmlnIiwicHJlbG9hZEF1ZGlvRmlsZXMiLCJjcmVhdGVTZXNzaW9uIiwic2Vzc2lvbk5hbWUiLCJncmFwaFByZXNldCIsIm92ZXJ2aWV3IiwiaW5kZXgiLCJmaW5kSW5kZXgiLCJhdWRpb0ZpbGVzIiwiZ3JhcGgiLCJTZXNzaW9uIiwiX3VwZGF0ZVNlc3Npb25zT3ZlcnZpZXciLCJkZWxldGVTZXNzaW9uIiwiaGFzIiwiZnVsbHBhdGgiLCJkaXJlY3RvcnkiLCJmcyIsImV4aXN0c1N5bmMiLCJzZXNzaW9uRmlsZXNUcmVlIiwiaW5NZW1vcnlTZXNzaW9ucyIsImZpbGVUcmVlU2Vzc2lvbnNPdmVydmlldyIsIm1hcCIsImRpciIsImNvbmZpZ1BhdGgiLCJpbnRlcnNlY3Rpb24iLCJjcmVhdGVkIiwiZGVsZXRlZCIsImVsIiwic2Vzc2lvbk92ZXJ2aWV3IiwiZnJvbUZpbGVTeXN0ZW0iLCJlcnIiLCJsb2ciLCJlcnJvciIsInNlc3Npb25zT3ZlcnZpZXciLCJjcmVhdGVTdHJlYW1Sb3V0ZSIsInRvIiwic3RyZWFtc1JvdXRpbmciLCJyIiwiaXNTb3VyY2VTdHJlYW1pbmciLCJyZWR1Y2UiLCJhY2MiLCJwdXNoIiwic3RyZWFtU291cmNlIiwiZGVsZXRlU3RyZWFtUm91dGUiLCJzcGxpY2UiLCJyb3V0ZSIsImtleSIsInByb3BhZ2F0ZVN0cmVhbUZyYW1lIiwiZnJhbWUiLCJyb3V0ZXMiLCJmcm9tSWQiLCJ0YXJnZXRDbGllbnQiLCJpZENsaWVudE1hcCIsInNvY2tldCIsInNlbmRCaW5hcnkiLCJhdWRpb0ZpbGVzVHJlZSIsImluZGV4T2YiLCJleHRlbnNpb24iLCJ1cmwiLCJ1cGRhdGVBdWRpb0ZpbGVzRnJvbUZpbGVTeXN0ZW0iXSwibWFwcGluZ3MiOiI7Ozs7Ozs7QUFBQTs7QUFDQTs7QUFDQTs7QUFDQTs7QUFDQTs7QUFFQTs7QUFDQTs7QUFDQTs7QUFFQTs7QUFDQTs7QUFDQTs7OztBQUVBO0FB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U0FBOUIsTUFBNkMsQ0FBQyxDQURyRSxFQUVoQnBDLEdBRmdCLENBRVosQ0FBQztBQUFFbkYsTUFBQUEsSUFBRjtBQUFRd0gsTUFBQUEsR0FBUjtBQUFhRCxNQUFBQTtBQUFiLEtBQUQsS0FBOEI7QUFBRSxhQUFPO0FBQUV2SCxRQUFBQSxJQUFGO0FBQVF3SCxRQUFBQSxHQUFSO0FBQWFELFFBQUFBO0FBQWIsT0FBUDtBQUFpQyxLQUZyRCxDQUFuQjtBQUlBLFNBQUtySSxLQUFMLENBQVdlLEdBQVgsQ0FBZTtBQUFFcUUsTUFBQUE7QUFBRixLQUFmLEVBTm9ELENBUXBEOztBQUNBLFNBQUssSUFBSTVCLE9BQVQsSUFBb0IsS0FBS3JELFFBQUwsQ0FBY3dDLE1BQWQsRUFBcEIsRUFBNEM7QUFDMUMsWUFBTWEsT0FBTyxDQUFDK0UsOEJBQVIsQ0FBdUNuRCxVQUF2QyxDQUFOO0FBQXlEO0FBQzFEO0FBQ0Y7O0FBdmFXOztlQTBhQ3ZGLE8iLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCBmcyBmcm9tICdmcyc7XG5pbXBvcnQgSlNPTjUgZnJvbSAnanNvbjUnO1xuaW1wb3J0IHsgdjQgYXMgdXVpZHY0IH0gZnJvbSAndXVpZCc7XG5pbXBvcnQgc2x1Z2lmeSBmcm9tICdAc2luZHJlc29yaHVzL3NsdWdpZnknO1xuXG5pbXBvcnQgU2Vzc2lvbiBmcm9tICcuL1Nlc3Npb24nO1xuaW1wb3J0IGRiIGZyb20gJy4vdXRpbHMvZGInO1xuaW1wb3J0IGRpZmZBcnJheXMgZnJvbSAnLi4vY29tbW9uL3V0aWxzL2RpZmZBcnJheXMnO1xuXG5pbXBvcnQgcHJvamVjdFNjaGVtYSBmcm9tICcuL3NjaGVtYXMvcHJvamVjdC5qcyc7XG5pbXBvcnQgc2Vzc2lvblNjaGVtYSBmcm9tICcuL3NjaGVtYXMvc2Vzc2lvbi5qcyc7XG5pbXBvcnQgcGxheWVyU2NoZW1hIGZyb20gJy4vc2NoZW1hcy9wbGF5ZXIuanMnO1xuXG4vLyBjb25zdCBQUk9KRUNUX1ZFUlNJT04gPSAnMC4wLjAnO1xuXG5jbGFzcyBQcm9qZWN0IHtcbiAgY29uc3RydWN0b3IoY29tbykge1xuICAgIHRoaXMuY29tbyA9IGNvbW87XG5cbiAgICB0aGlzLnN0YXRlID0gbnVsbDtcbiAgICB0aGlzLnBsYXllcnMgPSBuZXcgTWFwKCk7XG4gICAgdGhpcy5zZXNzaW9ucyA9IG5ldyBNYXAoKTtcblxuICAgIHRoaXMuY29tby5zZXJ2ZXIuc3RhdGVNYW5hZ2VyLnJlZ2lzdGVyU2NoZW1hKCdwcm9qZWN0JywgcHJvamVjdFNjaGVtYSk7XG4gICAgdGhpcy5jb21vLnNlcnZlci5zdGF0ZU1hbmFnZXIucmVnaXN0ZXJTY2hlbWEoYHNlc3Npb25gLCBzZXNzaW9uU2NoZW1hKTtcbiAgICB0aGlzLmNvbW8uc2VydmVyLnN0YXRlTWFuYWdlci5yZWdpc3RlclNjaGVtYSgncGxheWVyJywgcGxheWVyU2NoZW1hKTtcbiAgfVxuXG4gIC8vIGBTdGF0ZWAgaW50ZXJmYWNlXG4gIHN1YnNjcmliZSgpIHtcbiAgICByZXR1cm4gdGhpcy5zdGF0ZS5zdWJzY3JpYmUoZnVuYyk7XG4gIH1cblxuICBnZXRWYWx1ZXMoKSB7XG4gICAgcmV0dXJuIHRoaXMuc3RhdGUuZ2V0VmFsdWVzKCk7XG4gIH1cblxuICBnZXQobmFtZSkge1xuICAgIHJldHVybiB0aGlzLnN0YXRlLmdldChuYW1lKTtcbiAgfVxuXG4gIHNldCh1cGRhdGVzKSB7XG4gICAgdGhpcy5zdGF0ZS5zZXQodXBkYXRlcyk7XG4gIH1cblxuICBhc3luYyBpbml0KCkge1xuICAgIC8vIHBhcnNlIGV4aXN0aW5nIHByZXNldHNcbiAgICB0aGlzLmdyYXBoUHJlc2V0cyA9IG5ldyBNYXAoKTtcbiAgICBsZXQgbGVhcm5pbmdQcmVzZXRzID0ge307XG5cbiAgICBjb25zdCBmaWxlVHJlZSA9IHRoaXMuY29tby5maWxlV2F0Y2hlci5zdGF0ZS5nZXQoJ3ByZXNldHMnKTtcblxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZmlsZVRyZWUuY2hpbGRyZW4ubGVuZ3RoOyBpKyspIHtcbiAgICAgIGNvbnN0IGxlYWYgPSBmaWxlVHJlZS5jaGlsZHJlbltpXTtcblxuICAgICAgLy8gZ3JhcGggcHJlc2V0c1xuICAgICAgaWYgKGxlYWYudHlwZSA9PT0gJ2RpcmVjdG9yeScpIHtcbiAgICAgICAgY29uc3QgcHJlc2V0TmFtZSA9IGxlYWYubmFtZTtcbiAgICAgICAgY29uc3QgZGF0YUdyYXBoID0gYXdhaXQgZGIucmVhZChwYXRoLmpvaW4obGVhZi5wYXRoLCAnZ3JhcGgtZGF0YS5qc29uJykpO1xuICAgICAgICBjb25zdCBhdWRpb0dyYXBoID0gYXdhaXQgZGIucmVhZChwYXRoLmpvaW4obGVhZi5wYXRoLCAnZ3JhcGgtYXVkaW8uanNvbicpKTtcbiAgICAgICAgY29uc3QgcHJlc2V0ID0geyBkYXRhOiBkYXRhR3JhcGgsIGF1ZGlvOiBhdWRpb0dyYXBoIH07XG4gICAgICAgIHRoaXMuZ3JhcGhQcmVzZXRzLnNldChwcmVzZXROYW1lLCBwcmVzZXQpO1xuICAgICAgfVxuXG4gICAgICAvLyBsZWFybmluZyBwcmVzZXRzXG4gICAgICBpZiAobGVhZi50eXBlID09PSAnZmlsZScgJiYgbGVhZi5uYW1lID09PSAnbGVhcm5pbmctcHJlc2V0cy5qc29uJykge1xuICAgICAgICBsZWFybmluZ1ByZXNldHMgPSBhd2FpdCBkYi5yZWFkKGxlYWYucGF0aCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgdGhpcy5zdGF0ZSA9IGF3YWl0IHRoaXMuY29tby5zZXJ2ZXIuc3RhdGVNYW5hZ2VyLmNyZWF0ZSgncHJvamVjdCcsIHtcbiAgICAgIGdyYXBoUHJlc2V0czogQXJyYXkuZnJvbSh0aGlzLmdyYXBoUHJlc2V0cy5rZXlzKCkpLFxuICAgICAgbGVhcm5pbmdQcmVzZXRzOiBsZWFybmluZ1ByZXNldHMsXG4gICAgfSk7XG5cbiAgICB0aGlzLmNvbW8uc2VydmVyLnN0YXRlTWFuYWdlci5yZWdpc3RlclVwZGF0ZUhvb2soJ3Nlc3Npb24nLCAodXBkYXRlcywgY3VycmVudFZhbHVlcykgPT4ge1xuICAgICAgZm9yIChsZXQgW25hbWUsIHZhbHVlc10gb2YgT2JqZWN0LmVudHJpZXModXBkYXRlcykpIHtcbiAgICAgICAgc3dpdGNoIChuYW1lKSB7XG4gICAgICAgICAgY2FzZSAnZ3JhcGhPcHRpb25zRXZlbnQnOiB7XG4gICAgICAgICAgICBjb25zdCBncmFwaE9wdGlvbnMgPSBjdXJyZW50VmFsdWVzLmdyYXBoT3B0aW9ucztcblxuICAgICAgICAgICAgZm9yIChsZXQgbW9kdWxlSWQgaW4gdmFsdWVzKSB7XG4gICAgICAgICAgICAgIC8vIGRlbGV0ZSBzY3JpcHRQYXJhbXMgb24gc2NyaXB0TmFtZSBjaGFuZ2VcbiAgICAgICAgICAgICAgaWYgKCdzY3JpcHROYW1lJyBpbiB2YWx1ZXNbbW9kdWxlSWRdKSB7XG4gICAgICAgICAgICAgICAgZGVsZXRlIGdyYXBoT3B0aW9uc1ttb2R1bGVJZF0uc2NyaXB0UGFyYW1zO1xuICAgICAgICAgICAgICAgIC8vIEB0b2RvIC0gdXBkYXRlIHRoZSBtb2RlbCB3aGVuIGEgZGF0YVNjcmlwdCBpcyB1cGRhdGVkLi4uXG4gICAgICAgICAgICAgICAgLy8gdGhpcy51cGRhdGVNb2RlbCh0aGlzLnN0YXRlLmdldCgnZXhhbXBsZXMnKSk7XG4gICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICBPYmplY3QuYXNzaWduKGdyYXBoT3B0aW9uc1ttb2R1bGVJZF0sIHZhbHVlc1ttb2R1bGVJZF0pO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBmb3J3YXJkIGV2ZW50IHRvIHBsYXllcnMgYXR0YWNoZWQgdG8gdGhlIHNlc3Npb25cbiAgICAgICAgICAgIEFycmF5LmZyb20odGhpcy5wbGF5ZXJzLnZhbHVlcygpKVxuICAgICAgICAgICAgICAuZmlsdGVyKHBsYXllciA9PiBwbGF5ZXIuZ2V0KCdzZXNzaW9uSWQnKSA9PT0gY3VycmVudFZhbHVlcy5pZClcbiAgICAgICAgICAgICAgLmZvckVhY2gocGxheWVyID0+IHBsYXllci5zZXQoeyBncmFwaE9wdGlvbnNFdmVudDogdmFsdWVzIH0pKTtcblxuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgLi4udXBkYXRlcyxcbiAgICAgICAgICAgICAgZ3JhcGhPcHRpb25zLFxuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICB0aGlzLmNvbW8uc2VydmVyLnN0YXRlTWFuYWdlci5yZWdpc3RlclVwZGF0ZUhvb2soJ3BsYXllcicsICh1cGRhdGVzLCBjdXJyZW50VmFsdWVzKSA9PiB7XG4gICAgICBmb3IgKGxldCBbbmFtZSwgdmFsdWVzXSBvZiBPYmplY3QuZW50cmllcyh1cGRhdGVzKSkge1xuICAgICAgICBzd2l0Y2ggKG5hbWUpIHtcbiAgICAgICAgICBjYXNlICdzZXNzaW9uSWQnOiB7XG4gICAgICAgICAgICBjb25zdCBzZXNzaW9uSWQgPSB2YWx1ZXM7XG5cbiAgICAgICAgICAgIGlmIChzZXNzaW9uSWQgIT09IG51bGwpIHtcbiAgICAgICAgICAgICAgY29uc3Qgc2Vzc2lvbiA9IHRoaXMuc2Vzc2lvbnMuZ2V0KHNlc3Npb25JZCk7XG5cbiAgICAgICAgICAgICAgaWYgKCFzZXNzaW9uKSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS53YXJuKGBbY29tb10gcmVxdWlyZWQgc2Vzc2lvbiBcIiR7c2Vzc2lvbklkfVwiIGRvZXMgbm90IGV4aXN0c2ApO1xuICAgICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgICAuLi51cGRhdGVzLFxuICAgICAgICAgICAgICAgICAgc2Vzc2lvbklkOiBudWxsXG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgIGNvbnN0IGxhYmVscyA9IHNlc3Npb24uZ2V0KCdsYWJlbHMnKTtcbiAgICAgICAgICAgICAgbGV0IGRlZmF1bHRMYWJlbCA9ICcnO1xuXG4gICAgICAgICAgICAgIGlmIChsYWJlbHMubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgZGVmYXVsdExhYmVsID0gbGFiZWxzWzBdO1xuICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgY29uc3QgZ3JhcGhPcHRpb25zID0gc2Vzc2lvbi5nZXQoJ2dyYXBoT3B0aW9ucycpO1xuXG4gICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgLi4udXBkYXRlcyxcbiAgICAgICAgICAgICAgICBsYWJlbDogZGVmYXVsdExhYmVsLFxuICAgICAgICAgICAgICAgIHJlY29yZGluZ1N0YXRlOiAnaWRsZScsXG4gICAgICAgICAgICAgICAgZ3JhcGhPcHRpb25zLFxuICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAuLi51cGRhdGVzLFxuICAgICAgICAgICAgICAgIGxhYmVsOiAnJyxcbiAgICAgICAgICAgICAgICByZWNvcmRpbmdTdGF0ZTogJ2lkbGUnLFxuICAgICAgICAgICAgICAgIGdyYXBoT3B0aW9uczogbnVsbCxcbiAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgY2FzZSAnZ3JhcGhPcHRpb25zRXZlbnQnOiB7XG4gICAgICAgICAgICBjb25zdCBvcHRpb25zVXBkYXRlcyA9IHZhbHVlcztcbiAgICAgICAgICAgIGNvbnN0IGdyYXBoT3B0aW9ucyA9IGN1cnJlbnRWYWx1ZXMuZ3JhcGhPcHRpb25zO1xuXG4gICAgICAgICAgICBmb3IgKGxldCBtb2R1bGVJZCBpbiBvcHRpb25zVXBkYXRlcykge1xuICAgICAgICAgICAgICBPYmplY3QuYXNzaWduKGdyYXBoT3B0aW9uc1ttb2R1bGVJZF0sIG9wdGlvbnNVcGRhdGVzW21vZHVsZUlkXSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgIC4uLnVwZGF0ZXMsXG4gICAgICAgICAgICAgIGdyYXBoT3B0aW9ucyxcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0pO1xuXG4gICAgdGhpcy5jb21vLnNlcnZlci5zdGF0ZU1hbmFnZXIub2JzZXJ2ZShhc3luYyAoc2NoZW1hTmFtZSwgc3RhdGVJZCwgbm9kZUlkKSA9PiB7XG4gICAgICAvLyB0cmFjayBwbGF5ZXJzXG4gICAgICBpZiAoc2NoZW1hTmFtZSA9PT0gJ3BsYXllcicpIHtcbiAgICAgICAgY29uc3QgcGxheWVyU3RhdGUgPSBhd2FpdCB0aGlzLmNvbW8uc2VydmVyLnN0YXRlTWFuYWdlci5hdHRhY2goc2NoZW1hTmFtZSwgc3RhdGVJZCk7XG4gICAgICAgIGNvbnN0IHBsYXllcklkID0gcGxheWVyU3RhdGUuZ2V0KCdpZCcpO1xuXG4gICAgICAgIHBsYXllclN0YXRlLm9uRGV0YWNoKCgpID0+IHtcbiAgICAgICAgICB0aGlzLmNsZWFyU3RyZWFtUm91dGluZyhwbGF5ZXJJZCwgbnVsbCk7IC8vIGNsZWFyIHJvdXRpbmcgd2hlcmUgcGxheWVyIGlzIHRoZSBzb3VyY2VcbiAgICAgICAgICB0aGlzLnBsYXllcnMuZGVsZXRlKHBsYXllcklkKVxuICAgICAgICB9KTtcblxuICAgICAgICB0aGlzLnBsYXllcnMuc2V0KHBsYXllcklkLCBwbGF5ZXJTdGF0ZSk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICAvLyB0cmFjayBmaWxlIHN5c3RlbVxuICAgIHRoaXMuY29tby5maWxlV2F0Y2hlci5zdGF0ZS5zdWJzY3JpYmUodXBkYXRlcyA9PiB7XG4gICAgICBmb3IgKGxldCBuYW1lIGluIHVwZGF0ZXMpIHtcbiAgICAgICAgc3dpdGNoIChuYW1lKSB7XG4gICAgICAgICAgY2FzZSAnYXVkaW8nOlxuICAgICAgICAgICAgdGhpcy5fdXBkYXRlQXVkaW9GaWxlc0Zyb21GaWxlU3lzdGVtKHVwZGF0ZXNbbmFtZV0pO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgY2FzZSAnc2Vzc2lvbnMnOlxuICAgICAgICAgICAgdGhpcy5fdXBkYXRlU2Vzc2lvbnNGcm9tRmlsZVN5c3RlbSh1cGRhdGVzW25hbWVdKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBhd2FpdCB0aGlzLl91cGRhdGVBdWRpb0ZpbGVzRnJvbUZpbGVTeXN0ZW0odGhpcy5jb21vLmZpbGVXYXRjaGVyLnN0YXRlLmdldCgnYXVkaW8nKSk7XG4gICAgYXdhaXQgdGhpcy5fdXBkYXRlU2Vzc2lvbnNGcm9tRmlsZVN5c3RlbSh0aGlzLmNvbW8uZmlsZVdhdGNoZXIuc3RhdGUuZ2V0KCdzZXNzaW9ucycpKTtcblxuICAgIGlmICh0aGlzLmNvbW8uc2VydmVyLmNvbmZpZy5jb21vLnByZWxvYWRBdWRpb0ZpbGVzKSB7XG4gICAgICAvLyB0aGlzIHdpbGwgcHJlbG9hZCBhbGwgZmlsZXMgb2YgdGhlIHByb2plY3QsIHNvIHRoYXQgc2Vzc2lvbnMgY2FuIGp1c3RcbiAgICAgIC8vIHBpY2sgdGhlaXIgYnVmZmVycyBpbiB0aGUgYXVkaW8tYnVmZmVyLWxvYWRlciBjYWNoZS5cbiAgICAgIHRoaXMuc3RhdGUuc2V0KHsgcHJlbG9hZEF1ZGlvRmlsZXM6IHRydWUgfSk7XG4gICAgfVxuICB9XG5cbiAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgLy8gU0VTU0lPTlNcbiAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgYXN5bmMgY3JlYXRlU2Vzc2lvbihzZXNzaW9uTmFtZSwgZ3JhcGhQcmVzZXQpIHtcbiAgICBjb25zdCBvdmVydmlldyA9IHRoaXMuZ2V0KCdzZXNzaW9uc092ZXJ2aWV3Jyk7XG4gICAgLy8gQG5vdGUgLSB0aGlzIGNvdWxkIHByb2JhYmx5IGJlIG1vcmUgcm9idXN0XG4gICAgY29uc3QgaWQgPSBzbHVnaWZ5KHNlc3Npb25OYW1lKTtcbiAgICAvLyBmaW5kIGlmIGEgc2Vzc2lvbiB3LyB0aGUgc2FtZSBuYW1lIG9yIHNsdWcgYWxyZWFkeSBleGlzdHNcbiAgICBjb25zdCBpbmRleCA9IG92ZXJ2aWV3LmZpbmRJbmRleChvdmVydmlldyA9PiB7XG4gICAgICByZXR1cm4gb3ZlcnZpZXcubmFtZSA9PT0gc2Vzc2lvbk5hbWUgfHwgb3ZlcnZpZXcuaWQgPT09IGlkO1xuICAgIH0pO1xuXG4gICAgaWYgKGluZGV4ID09PSAtMSkge1xuICAgICAgY29uc3QgYXVkaW9GaWxlcyA9IHRoaXMuZ2V0KCdhdWRpb0ZpbGVzJyk7XG4gICAgICBjb25zdCBncmFwaCA9IHRoaXMuZ3JhcGhQcmVzZXRzLmdldChncmFwaFByZXNldCk7XG4gICAgICBjb25zdCBzZXNzaW9uID0gYXdhaXQgU2Vzc2lvbi5jcmVhdGUodGhpcy5jb21vLCBpZCwgc2Vzc2lvbk5hbWUsIGdyYXBoLCBhdWRpb0ZpbGVzKTtcblxuICAgICAgdGhpcy5zZXNzaW9ucy5zZXQoaWQsIHNlc3Npb24pO1xuICAgICAgdGhpcy5fdXBkYXRlU2Vzc2lvbnNPdmVydmlldygpO1xuXG4gICAgICByZXR1cm4gaWQ7XG4gICAgfVxuXG4gICAgLy8gY29uc29sZS5sb2coYD4gc2Vzc2lvbiBcIiR7c2Vzc2lvbk5hbWV9XCIgYWxyZWFkeSBleGlzdHNgKTtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIGFzeW5jIGRlbGV0ZVNlc3Npb24oaWQpIHtcbiAgICBpZiAodGhpcy5zZXNzaW9ucy5oYXMoaWQpKSB7XG4gICAgICBjb25zdCBzZXNzaW9uID0gdGhpcy5zZXNzaW9ucy5nZXQoaWQpO1xuICAgICAgY29uc3QgZnVsbHBhdGggPSBzZXNzaW9uLmRpcmVjdG9yeTtcblxuICAgICAgdGhpcy5zZXNzaW9ucy5kZWxldGUoaWQpO1xuICAgICAgYXdhaXQgc2Vzc2lvbi5kZWxldGUoKTtcblxuICAgICAgLy8gV2UgY2FuIGNvbWUgZnJvbSAyIHBhdGhzIGhlcmU6XG4gICAgICAvLyAxLiBpZiB0aGUgZmlsZSBzdGlsbCBleGlzdHMsIHRoZSBtZXRob2QgaGFzIGJlZW4gY2FsbGVkIHByb2dyYW1tYXRpY2FsbHkgc29cbiAgICAgIC8vIHdlIG5lZWQgdG8gcmVtb3ZlIHRoZSBmaWxlLiBUaGlzIHdpbGwgdHJpZ2dlciBgX3VwZGF0ZVNlc3Npb25zRnJvbUZpbGVTeXN0ZW1gXG4gICAgICAvLyBidXQgbm90aGluZyBzaG91bGQgYXBwZW5kIHRoZXJlLCB0aGF0J3Mgd2h5IHdlIHVwZGF0ZSB0aGVcbiAgICAgIC8vIGBzZXNzaW9uT3ZlcnZpZXdgIGhlcmUuXG4gICAgICAvLyAyLiBpZiB0aGUgZmlsZSBoYXMgYmVlbiByZW1vdmVkIG1hbnVhbGx5IHdlIGFyZSBjYWxsZWQgZnJvbVxuICAgICAgLy8gYF91cGRhdGVTZXNzaW9uc0Zyb21GaWxlU3lzdGVtYCB0aGVuIHdlIGRvbid0IHdhbnQgdG8gbWFuaXB1bGF0ZVxuICAgICAgLy8gdGhlIGZpbGUgc3lzdGVtLCBub3IgdXBkYXRlIHRoZSBgc2Vzc2lvbnNPdmVydmlld2AuXG4gICAgICBpZiAoZnMuZXhpc3RzU3luYyhzZXNzaW9uLmRpcmVjdG9yeSkpIHtcbiAgICAgICAgYXdhaXQgZGIuZGVsZXRlKHNlc3Npb24uZGlyZWN0b3J5KTtcbiAgICAgICAgdGhpcy5fdXBkYXRlU2Vzc2lvbnNPdmVydmlldygpO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBhc3luYyBfdXBkYXRlU2Vzc2lvbnNGcm9tRmlsZVN5c3RlbShzZXNzaW9uRmlsZXNUcmVlKSB7XG4gICAgY29uc3QgaW5NZW1vcnlTZXNzaW9ucyA9IEFycmF5LmZyb20odGhpcy5zZXNzaW9ucy52YWx1ZXMoKSk7XG4gICAgY29uc3QgZmlsZVRyZWVTZXNzaW9uc092ZXJ2aWV3ID0gc2Vzc2lvbkZpbGVzVHJlZVxuICAgICAgLmNoaWxkcmVuXG4gICAgICAuZmlsdGVyKGxlYWYgPT4gbGVhZi50eXBlID09PSAnZGlyZWN0b3J5JylcbiAgICAgIC5tYXAoZGlyID0+IHtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICBpZDogZGlyLm5hbWUsXG4gICAgICAgICAgY29uZmlnUGF0aDogZGlyLnBhdGgsXG4gICAgICAgIH07XG4gICAgICB9KTtcblxuICAgIGNvbnN0IHtcbiAgICAgIGludGVyc2VjdGlvbixcbiAgICAgIGNyZWF0ZWQsXG4gICAgICBkZWxldGVkXG4gICAgfSA9IGRpZmZBcnJheXMoaW5NZW1vcnlTZXNzaW9ucywgZmlsZVRyZWVTZXNzaW9uc092ZXJ2aWV3LCBlbCA9PiBlbC5pZCk7XG5cbiAgICAvLyBub3QgaW5zdGFuY2lhdGVkIGJ1dCBwcmVzZW50IGluIGZpbGUgc3lzdGVtXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBjcmVhdGVkLmxlbmd0aDsgaSsrKSB7XG4gICAgICBjb25zdCBzZXNzaW9uT3ZlcnZpZXcgPSBjcmVhdGVkW2ldO1xuXG4gICAgICB0cnkge1xuICAgICAgICBjb25zdCBhdWRpb0ZpbGVzID0gdGhpcy5nZXQoJ2F1ZGlvRmlsZXMnKTtcbiAgICAgICAgY29uc3Qgc2Vzc2lvbiA9IGF3YWl0IFNlc3Npb24uZnJvbUZpbGVTeXN0ZW0odGhpcy5jb21vLCBzZXNzaW9uT3ZlcnZpZXcuY29uZmlnUGF0aCwgYXVkaW9GaWxlcyk7XG5cbiAgICAgICAgdGhpcy5zZXNzaW9ucy5zZXQoc2Vzc2lvbk92ZXJ2aWV3LmlkLCBzZXNzaW9uKTtcbiAgICAgIH0gY2F0Y2goZXJyKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKGA+IGNhbm5vdCBpbnN0YW5jaWF0ZSBzZXNzaW9uICR7c2Vzc2lvbk92ZXJ2aWV3LmlkfWApO1xuICAgICAgICBjb25zb2xlLmVycm9yKGVycik7XG4gICAgICB9XG4gICAgfTtcblxuICAgIC8vIGluc3RhbmNpYXRlZCBidXQgYWJzZW50IGZyb20gZmlsZSBzeXN0ZW1cbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGRlbGV0ZWQubGVuZ3RoOyBpKyspIHtcbiAgICAgIGNvbnN0IGlkID0gZGVsZXRlZFtpXS5pZDtcbiAgICAgIGF3YWl0IHRoaXMuZGVsZXRlU2Vzc2lvbihpZCk7XG4gICAgfVxuXG4gICAgLy8gdXBkYXRlIG92ZXJ2aWV3IGlmIHNvbWUgc2Vzc2lvbnMgaGF2ZSBiZWVuIGNyZWF0ZWQgb3IgZGVsZXRlZFxuICAgIGlmIChjcmVhdGVkLmxlbmd0aCB8fCBkZWxldGVkLmxlbmd0aCkge1xuICAgICAgdGhpcy5fdXBkYXRlU2Vzc2lvbnNPdmVydmlldygpO1xuICAgIH1cbiAgfVxuXG4gIF91cGRhdGVTZXNzaW9uc092ZXJ2aWV3KCkge1xuICAgIGNvbnN0IHNlc3Npb25zT3ZlcnZpZXcgPSBBcnJheS5mcm9tKHRoaXMuc2Vzc2lvbnMudmFsdWVzKCkpXG4gICAgICAubWFwKHNlc3Npb24gPT4ge1xuICAgICAgICBjb25zdCBzdGF0ZUlkID0gc2Vzc2lvbi5zdGF0ZS5pZDtcbiAgICAgICAgY29uc3QgeyBpZCwgbmFtZSB9ID0gc2Vzc2lvbi5nZXRWYWx1ZXMoKTtcblxuICAgICAgICByZXR1cm4geyBpZCwgbmFtZSwgc3RhdGVJZCB9O1xuICAgICAgfSk7XG5cbiAgICB0aGlzLnNldCh7IHNlc3Npb25zT3ZlcnZpZXcgfSk7XG4gIH1cblxuICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAvLyBST1VUSU5HXG4gIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbiAgLyoqXG4gICAqIGZyb20gLSBwbGF5ZXJJZCAtIHRoZSBsb2dpY2FsIGNsaWVudCwgQ29NbyBwbGF5ZXIgaW5zdGFuY2VcbiAgICogdG8gLSBub2RlSWQgLSB0aGUgcGh5c2ljYWwgY2xpZW50LCBzb3VuZHdvcmtzIGNsaWVudCBpbnN0YW5jZVxuICAgKi9cbiAgYXN5bmMgY3JlYXRlU3RyZWFtUm91dGUoZnJvbSwgdG8pIHtcbiAgICBjb25zdCBzdHJlYW1zUm91dGluZyA9IHRoaXMuZ2V0KCdzdHJlYW1zUm91dGluZycpO1xuICAgIGNvbnN0IGluZGV4ID0gc3RyZWFtc1JvdXRpbmcuZmluZEluZGV4KHIgPT4gclswXSA9PT0gZnJvbSAmJiByWzFdID09PSB0byk7XG5cbiAgICBpZiAoaW5kZXggPT09IC0xKSB7XG4gICAgICBjb25zdCBpc1NvdXJjZVN0cmVhbWluZyA9IHN0cmVhbXNSb3V0aW5nLnJlZHVjZSgoYWNjLCByKSA9PiBhY2MgfHwgclswXSA9PT0gZnJvbSwgZmFsc2UpO1xuICAgICAgY29uc3QgY3JlYXRlZCA9IFtmcm9tLCB0b107XG4gICAgICBzdHJlYW1zUm91dGluZy5wdXNoKGNyZWF0ZWQpO1xuXG4gICAgICAvLyBjb25zb2xlLmxvZygnY3JlYXRlU3RyZWFtUm91dGUnLCBzdHJlYW1zUm91dGluZyk7XG4gICAgICB0aGlzLnNldCh7IHN0cmVhbXNSb3V0aW5nIH0pO1xuICAgICAgLy8gbm90aWZ5IHBsYXllciB0aGF0IGl0IHNob3VsZCBzdGFydCB0byBzdHJlYW0gaXRzIHNvdXJjZVxuICAgICAgaWYgKCFpc1NvdXJjZVN0cmVhbWluZykge1xuICAgICAgICBjb25zdCBwbGF5ZXIgPSB0aGlzLnBsYXllcnMuZ2V0KGZyb20pO1xuICAgICAgICBwbGF5ZXIuc2V0KHsgc3RyZWFtU291cmNlOiB0cnVlIH0pO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBhc3luYyBkZWxldGVTdHJlYW1Sb3V0ZShmcm9tLCB0bykge1xuICAgIGNvbnN0IHN0cmVhbXNSb3V0aW5nID0gdGhpcy5nZXQoJ3N0cmVhbXNSb3V0aW5nJyk7XG4gICAgY29uc3QgaW5kZXggPSBzdHJlYW1zUm91dGluZy5maW5kSW5kZXgociA9PiByWzBdID09PSBmcm9tICYmIHJbMV0gPT09IHRvKTtcblxuICAgIGlmIChpbmRleCAhPT0gLTEpIHtcbiAgICAgIGNvbnN0IGRlbGV0ZWQgPSBzdHJlYW1zUm91dGluZ1tpbmRleF07XG4gICAgICBzdHJlYW1zUm91dGluZy5zcGxpY2UoaW5kZXgsIDEpO1xuXG4gICAgICBhd2FpdCB0aGlzLnNldCh7IHN0cmVhbXNSb3V0aW5nIH0pO1xuXG4gICAgICBjb25zdCBpc1NvdXJjZVN0cmVhbWluZyA9IHN0cmVhbXNSb3V0aW5nLnJlZHVjZSgoYWNjLCByKSA9PiBhY2MgfHwgclswXSA9PT0gZnJvbSwgZmFsc2UpO1xuXG4gICAgICAvLyBub3RpZnkgcGxheWVyIHRoYXQgaXQgc2hvdWxkIHN0b3Agc3RyZWFtaW5nIGl0cyBzb3VyY2VcbiAgICAgIGlmICghaXNTb3VyY2VTdHJlYW1pbmcpIHtcbiAgICAgICAgY29uc3QgcGxheWVyID0gdGhpcy5wbGF5ZXJzLmdldChmcm9tKTtcbiAgICAgICAgcGxheWVyLnNldCh7IHN0cmVhbVNvdXJjZTogZmFsc2UgfSk7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIGFzeW5jIGNsZWFyU3RyZWFtUm91dGluZyhmcm9tID0gbnVsbCwgdG8gPSBudWxsKSB7XG4gICAgY29uc3Qgc3RyZWFtc1JvdXRpbmcgPSB0aGlzLmdldCgnc3RyZWFtc1JvdXRpbmcnKTtcbiAgICBjb25zdCBkZWxldGVkID0gW107XG5cbiAgICBmb3IgKGxldCBpID0gc3RyZWFtc1JvdXRpbmcubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcbiAgICAgIGNvbnN0IHJvdXRlID0gc3RyZWFtc1JvdXRpbmdbaV07XG5cbiAgICAgIGlmIChyb3V0ZVswXSA9PT0gZnJvbSB8fCByb3V0ZVsxXSA9PT0gdG8pIHtcbiAgICAgICAgZGVsZXRlZC5wdXNoKHJvdXRlKTtcbiAgICAgICAgc3RyZWFtc1JvdXRpbmcuc3BsaWNlKGksIDEpO1xuICAgICAgfVxuICAgIH1cblxuICAgIHRoaXMuc2V0KHsgc3RyZWFtc1JvdXRpbmcgfSk7XG5cbiAgICAvLyBub3RpZnkgcG9zc2libGUgc291cmNlcyB0aGF0IHRoZXkgc2hvdWxkIHN0b3Agc3RyZWFtaW5nXG4gICAgdGhpcy5wbGF5ZXJzLmZvckVhY2goKHBsYXllciwga2V5KSA9PiB7XG4gICAgICBjb25zdCBpc1NvdXJjZVN0cmVhbWluZyA9IHN0cmVhbXNSb3V0aW5nLnJlZHVjZSgoYWNjLCByKSA9PiBhY2MgfHwgclswXSA9PT0ga2V5LCBmYWxzZSk7XG5cbiAgICAgIGlmICghaXNTb3VyY2VTdHJlYW1pbmcgJiYgcGxheWVyLmdldCgnc3RyZWFtU291cmNlJykgPT09IHRydWUpIHtcbiAgICAgICAgcGxheWVyLnNldCh7IHN0cmVhbVNvdXJjZTogZmFsc2UgfSk7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICBwcm9wYWdhdGVTdHJlYW1GcmFtZShmcmFtZSkge1xuICAgIC8vIEB0b2RvIC0gd2UgbmVlZCB0byBtb3ZlIHRoaXMgaW50byBgUHJvamV0YCBzbyB0aGF0IGl0IGNhbiBiZSBjYWxsZWRcbiAgICAvLyBkaXJlY3RseSBmcm9tIHNlcnZlciBzaWRlIHdpdGggYW4gYXJiaXRyYXJ5IGZyYW1lLi4uXG4gICAgY29uc3Qgcm91dGVzID0gdGhpcy5nZXQoJ3N0cmVhbXNSb3V0aW5nJyk7XG4gICAgY29uc3QgZnJvbUlkID0gZnJhbWVbMF07XG5cbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHJvdXRlcy5sZW5ndGg7IGkrKykge1xuICAgICAgY29uc3Qgcm91dGUgPSByb3V0ZXNbaV07XG4gICAgICBpZiAocm91dGVbMF0gPT09IGZyb21JZCkge1xuICAgICAgICBjb25zdCB0YXJnZXRDbGllbnQgPSB0aGlzLmNvbW8uaWRDbGllbnRNYXAuZ2V0KHJvdXRlWzFdKTtcblxuICAgICAgICAvLyBpZiB3ZSBoYXZlIGEgY2xpZW50IHdpdGggdGhlIHJpZ2h0IG5vZGVJZFxuICAgICAgICBpZiAodGFyZ2V0Q2xpZW50KSB7XG4gICAgICAgICAgdGFyZ2V0Q2xpZW50LnNvY2tldC5zZW5kQmluYXJ5KCdzdHJlYW0nLCBmcmFtZSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgLy8gbWlnaHQgYmUgYW4gT1NDIHRhcmdldCBjbGllbnRcbiAgICAgICAgICAvLyBvc2Muc2VuZCgnL3N0cmVhbS8ke3JvdXRlWzFdfS8ke3JvdXRlWzBdfScsIGZyYW1lKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gIC8vIEFVRElPIEZJTEVTXG4gIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gIGFzeW5jIF91cGRhdGVBdWRpb0ZpbGVzRnJvbUZpbGVTeXN0ZW0oYXVkaW9GaWxlc1RyZWUpIHtcbiAgICAvLyBmaWx0ZXIgZXZlcnl0aGluIHRoYXQgaXMgbm90IGEgLndhdiBvciBhIC5tcDMgZmlsZVxuICAgIGNvbnN0IGF1ZGlvRmlsZXMgPSBhdWRpb0ZpbGVzVHJlZS5jaGlsZHJlblxuICAgICAgLmZpbHRlcihsZWFmID0+IGxlYWYudHlwZSA9PT0gJ2ZpbGUnICYmIFsnLm1wMycsICcud2F2J10uaW5kZXhPZihsZWFmLmV4dGVuc2lvbikgIT09IC0xKVxuICAgICAgLm1hcCgoeyBuYW1lLCB1cmwsIGV4dGVuc2lvbiB9KSA9PiB7IHJldHVybiB7IG5hbWUsIHVybCwgZXh0ZW5zaW9uIH0gfSk7XG5cbiAgICB0aGlzLnN0YXRlLnNldCh7IGF1ZGlvRmlsZXMgfSk7XG5cbiAgICAvLyBAdG9kbyAtIGNsZWFuIHNlc3Npb25zXG4gICAgZm9yIChsZXQgc2Vzc2lvbiBvZiB0aGlzLnNlc3Npb25zLnZhbHVlcygpKSB7XG4gICAgICBhd2FpdCBzZXNzaW9uLnVwZGF0ZUF1ZGlvRmlsZXNGcm9tRmlsZVN5c3RlbShhdWRpb0ZpbGVzKTs7XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IFByb2plY3Q7XG4iXX0=