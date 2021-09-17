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
      const activeAudioFiles = [];

      for (let [id, session] of this.sessions.entries()) {
        const audioFiles = session.get('audioFiles');
        audioFiles.forEach(audioFile => {
          const index = activeAudioFiles.findIndex(a => a.url === audioFile.url);

          if (index === -1 && audioFile.active) {
            activeAudioFiles.push(audioFile);
          }
        });
      }

      this.state.set({
        preloadAudioFiles: true,
        activeAudioFiles
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9zZXJ2ZXIvUHJvamVjdC5qcyJdLCJuYW1lcyI6WyJQcm9qZWN0IiwiY29uc3RydWN0b3IiLCJjb21vIiwic3RhdGUiLCJwbGF5ZXJzIiwiTWFwIiwic2Vzc2lvbnMiLCJzZXJ2ZXIiLCJzdGF0ZU1hbmFnZXIiLCJyZWdpc3RlclNjaGVtYSIsInByb2plY3RTY2hlbWEiLCJzZXNzaW9uU2NoZW1hIiwicGxheWVyU2NoZW1hIiwic3Vic2NyaWJlIiwiZnVuYyIsImdldFZhbHVlcyIsImdldCIsIm5hbWUiLCJzZXQiLCJ1cGRhdGVzIiwiaW5pdCIsImdyYXBoUHJlc2V0cyIsImxlYXJuaW5nUHJlc2V0cyIsImZpbGVUcmVlIiwiZmlsZVdhdGNoZXIiLCJpIiwiY2hpbGRyZW4iLCJsZW5ndGgiLCJsZWFmIiwidHlwZSIsInByZXNldE5hbWUiLCJkYXRhR3JhcGgiLCJkYiIsInJlYWQiLCJwYXRoIiwiam9pbiIsImF1ZGlvR3JhcGgiLCJwcmVzZXQiLCJkYXRhIiwiYXVkaW8iLCJjcmVhdGUiLCJBcnJheSIsImZyb20iLCJrZXlzIiwib2JzZXJ2ZSIsInNjaGVtYU5hbWUiLCJzdGF0ZUlkIiwibm9kZUlkIiwicGxheWVyU3RhdGUiLCJhdHRhY2giLCJwbGF5ZXJJZCIsIm9uRGV0YWNoIiwiY2xlYXJTdHJlYW1Sb3V0aW5nIiwiZGVsZXRlIiwidmFsdWVzIiwiT2JqZWN0IiwiZW50cmllcyIsInNlc3Npb25JZCIsInNlc3Npb24iLCJjb25zb2xlIiwid2FybiIsImRlZmF1bHRMYWJlbCIsImdyYXBoT3B0aW9ucyIsImxhYmVsIiwicmVjb3JkaW5nU3RhdGUiLCJvcHRpb25zVXBkYXRlcyIsIm1vZHVsZUlkIiwiYXNzaWduIiwiX3VwZGF0ZUF1ZGlvRmlsZXNGcm9tRmlsZVN5c3RlbSIsIl91cGRhdGVTZXNzaW9uc0Zyb21GaWxlU3lzdGVtIiwiY29uZmlnIiwicHJlbG9hZEF1ZGlvRmlsZXMiLCJhY3RpdmVBdWRpb0ZpbGVzIiwiaWQiLCJhdWRpb0ZpbGVzIiwiZm9yRWFjaCIsImF1ZGlvRmlsZSIsImluZGV4IiwiZmluZEluZGV4IiwiYSIsInVybCIsImFjdGl2ZSIsInB1c2giLCJjcmVhdGVTZXNzaW9uIiwic2Vzc2lvbk5hbWUiLCJncmFwaFByZXNldCIsIm92ZXJ2aWV3IiwiZ3JhcGgiLCJTZXNzaW9uIiwiX3VwZGF0ZVNlc3Npb25zT3ZlcnZpZXciLCJkZWxldGVTZXNzaW9uIiwiaGFzIiwiZnVsbHBhdGgiLCJkaXJlY3RvcnkiLCJmcyIsImV4aXN0c1N5bmMiLCJzZXNzaW9uRmlsZXNUcmVlIiwiaW5NZW1vcnlTZXNzaW9ucyIsImZpbGVUcmVlU2Vzc2lvbnNPdmVydmlldyIsImZpbHRlciIsIm1hcCIsImRpciIsImNvbmZpZ1BhdGgiLCJpbnRlcnNlY3Rpb24iLCJjcmVhdGVkIiwiZGVsZXRlZCIsImVsIiwic2Vzc2lvbk92ZXJ2aWV3IiwiZnJvbUZpbGVTeXN0ZW0iLCJlcnIiLCJsb2ciLCJlcnJvciIsInNlc3Npb25zT3ZlcnZpZXciLCJjcmVhdGVTdHJlYW1Sb3V0ZSIsInRvIiwic3RyZWFtc1JvdXRpbmciLCJyIiwiaXNTb3VyY2VTdHJlYW1pbmciLCJyZWR1Y2UiLCJhY2MiLCJwbGF5ZXIiLCJzdHJlYW1Tb3VyY2UiLCJkZWxldGVTdHJlYW1Sb3V0ZSIsInNwbGljZSIsInJvdXRlIiwia2V5IiwicHJvcGFnYXRlU3RyZWFtRnJhbWUiLCJmcmFtZSIsInJvdXRlcyIsImZyb21JZCIsInRhcmdldENsaWVudCIsImlkQ2xpZW50TWFwIiwic29ja2V0Iiwic2VuZEJpbmFyeSIsImF1ZGlvRmlsZXNUcmVlIiwiaW5kZXhPZiIsImV4dGVuc2lvbiIsInVwZGF0ZUF1ZGlvRmlsZXNGcm9tRmlsZVN5c3RlbSJdLCJtYXBwaW5ncyI6Ijs7Ozs7OztBQUFBOztBQUNBOztBQUNBOztBQUNBOztBQUNBOztBQUVBOztBQUNBOztBQUNBOztBQUVBOztBQUNBOztBQUNBOzs7O0FBRUE7QUFFQSxNQUFNQSxPQUFOLENBQWM7QUFDWkMsRUFBQUEsV0FBVyxD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Q0FEdUIsQ0FHdkI7O0FBQ0EsWUFBSU0sWUFBSixFQUFrQjtBQUNoQkEsVUFBQUEsWUFBWSxDQUFDRSxNQUFiLENBQW9CQyxVQUFwQixDQUErQixRQUEvQixFQUF5Q04sS0FBekM7QUFDRCxTQUZELE1BRU8sQ0FDTDtBQUNBO0FBQ0Q7QUFDRjtBQUNGO0FBQ0YsR0F0WFcsQ0F3WFo7QUFDQTtBQUNBOzs7QUFDcUMsUUFBL0IzRCwrQkFBK0IsQ0FBQ2tFLGNBQUQsRUFBaUI7QUFDcEQ7QUFDQSxVQUFNNUQsVUFBVSxHQUFHNEQsY0FBYyxDQUFDNUcsUUFBZixDQUNoQnlFLE1BRGdCLENBQ1R2RSxJQUFJLElBQUlBLElBQUksQ0FBQ0MsSUFBTCxLQUFjLE1BQWQsSUFBd0IsQ0FBQyxNQUFELEVBQVMsTUFBVCxFQUFpQjBHLE9BQWpCLENBQXlCM0csSUFBSSxDQUFDNEcsU0FBOUIsTUFBNkMsQ0FBQyxDQURyRSxFQUVoQnBDLEdBRmdCLENBRVosQ0FBQztBQUFFbkYsTUFBQUEsSUFBRjtBQUFRK0QsTUFBQUEsR0FBUjtBQUFhd0QsTUFBQUE7QUFBYixLQUFELEtBQThCO0FBQUUsYUFBTztBQUFFdkgsUUFBQUEsSUFBRjtBQUFRK0QsUUFBQUEsR0FBUjtBQUFhd0QsUUFBQUE7QUFBYixPQUFQO0FBQWlDLEtBRnJELENBQW5CO0FBSUEsU0FBS3JJLEtBQUwsQ0FBV2UsR0FBWCxDQUFlO0FBQUV3RCxNQUFBQTtBQUFGLEtBQWYsRUFOb0QsQ0FRcEQ7O0FBQ0EsU0FBSyxJQUFJaEIsT0FBVCxJQUFvQixLQUFLcEQsUUFBTCxDQUFjZ0QsTUFBZCxFQUFwQixFQUE0QztBQUMxQyxZQUFNSSxPQUFPLENBQUMrRSw4QkFBUixDQUF1Qy9ELFVBQXZDLENBQU47QUFBeUQ7QUFDMUQ7QUFDRjs7QUF2WVc7O2VBMFlDMUUsTyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0IGZzIGZyb20gJ2ZzJztcbmltcG9ydCBKU09ONSBmcm9tICdqc29uNSc7XG5pbXBvcnQgeyB2NCBhcyB1dWlkdjQgfSBmcm9tICd1dWlkJztcbmltcG9ydCBzbHVnaWZ5IGZyb20gJ0BzaW5kcmVzb3JodXMvc2x1Z2lmeSc7XG5cbmltcG9ydCBTZXNzaW9uIGZyb20gJy4vU2Vzc2lvbic7XG5pbXBvcnQgZGIgZnJvbSAnLi91dGlscy9kYic7XG5pbXBvcnQgZGlmZkFycmF5cyBmcm9tICcuLi9jb21tb24vdXRpbHMvZGlmZkFycmF5cyc7XG5cbmltcG9ydCBwcm9qZWN0U2NoZW1hIGZyb20gJy4vc2NoZW1hcy9wcm9qZWN0LmpzJztcbmltcG9ydCBzZXNzaW9uU2NoZW1hIGZyb20gJy4vc2NoZW1hcy9zZXNzaW9uLmpzJztcbmltcG9ydCBwbGF5ZXJTY2hlbWEgZnJvbSAnLi9zY2hlbWFzL3BsYXllci5qcyc7XG5cbi8vIGNvbnN0IFBST0pFQ1RfVkVSU0lPTiA9ICcwLjAuMCc7XG5cbmNsYXNzIFByb2plY3Qge1xuICBjb25zdHJ1Y3Rvcihjb21vKSB7XG4gICAgdGhpcy5jb21vID0gY29tbztcblxuICAgIHRoaXMuc3RhdGUgPSBudWxsO1xuICAgIHRoaXMucGxheWVycyA9IG5ldyBNYXAoKTtcbiAgICB0aGlzLnNlc3Npb25zID0gbmV3IE1hcCgpO1xuXG4gICAgdGhpcy5jb21vLnNlcnZlci5zdGF0ZU1hbmFnZXIucmVnaXN0ZXJTY2hlbWEoJ3Byb2plY3QnLCBwcm9qZWN0U2NoZW1hKTtcbiAgICB0aGlzLmNvbW8uc2VydmVyLnN0YXRlTWFuYWdlci5yZWdpc3RlclNjaGVtYShgc2Vzc2lvbmAsIHNlc3Npb25TY2hlbWEpO1xuICAgIHRoaXMuY29tby5zZXJ2ZXIuc3RhdGVNYW5hZ2VyLnJlZ2lzdGVyU2NoZW1hKCdwbGF5ZXInLCBwbGF5ZXJTY2hlbWEpO1xuICB9XG5cbiAgLy8gYFN0YXRlYCBpbnRlcmZhY2VcbiAgc3Vic2NyaWJlKCkge1xuICAgIHJldHVybiB0aGlzLnN0YXRlLnN1YnNjcmliZShmdW5jKTtcbiAgfVxuXG4gIGdldFZhbHVlcygpIHtcbiAgICByZXR1cm4gdGhpcy5zdGF0ZS5nZXRWYWx1ZXMoKTtcbiAgfVxuXG4gIGdldChuYW1lKSB7XG4gICAgcmV0dXJuIHRoaXMuc3RhdGUuZ2V0KG5hbWUpO1xuICB9XG5cbiAgc2V0KHVwZGF0ZXMpIHtcbiAgICB0aGlzLnN0YXRlLnNldCh1cGRhdGVzKTtcbiAgfVxuXG4gIGFzeW5jIGluaXQoKSB7XG4gICAgLy8gcGFyc2UgZXhpc3RpbmcgcHJlc2V0c1xuICAgIHRoaXMuZ3JhcGhQcmVzZXRzID0gbmV3IE1hcCgpO1xuICAgIGxldCBsZWFybmluZ1ByZXNldHMgPSB7fTtcblxuICAgIGNvbnN0IGZpbGVUcmVlID0gdGhpcy5jb21vLmZpbGVXYXRjaGVyLnN0YXRlLmdldCgncHJlc2V0cycpO1xuXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBmaWxlVHJlZS5jaGlsZHJlbi5sZW5ndGg7IGkrKykge1xuICAgICAgY29uc3QgbGVhZiA9IGZpbGVUcmVlLmNoaWxkcmVuW2ldO1xuXG4gICAgICAvLyBncmFwaCBwcmVzZXRzXG4gICAgICBpZiAobGVhZi50eXBlID09PSAnZGlyZWN0b3J5Jykge1xuICAgICAgICBjb25zdCBwcmVzZXROYW1lID0gbGVhZi5uYW1lO1xuICAgICAgICBjb25zdCBkYXRhR3JhcGggPSBhd2FpdCBkYi5yZWFkKHBhdGguam9pbihsZWFmLnBhdGgsICdncmFwaC1kYXRhLmpzb24nKSk7XG4gICAgICAgIGNvbnN0IGF1ZGlvR3JhcGggPSBhd2FpdCBkYi5yZWFkKHBhdGguam9pbihsZWFmLnBhdGgsICdncmFwaC1hdWRpby5qc29uJykpO1xuICAgICAgICBjb25zdCBwcmVzZXQgPSB7IGRhdGE6IGRhdGFHcmFwaCwgYXVkaW86IGF1ZGlvR3JhcGggfTtcbiAgICAgICAgdGhpcy5ncmFwaFByZXNldHMuc2V0KHByZXNldE5hbWUsIHByZXNldCk7XG4gICAgICB9XG5cbiAgICAgIC8vIGxlYXJuaW5nIHByZXNldHNcbiAgICAgIGlmIChsZWFmLnR5cGUgPT09ICdmaWxlJyAmJiBsZWFmLm5hbWUgPT09ICdsZWFybmluZy1wcmVzZXRzLmpzb24nKSB7XG4gICAgICAgIGxlYXJuaW5nUHJlc2V0cyA9IGF3YWl0IGRiLnJlYWQobGVhZi5wYXRoKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICB0aGlzLnN0YXRlID0gYXdhaXQgdGhpcy5jb21vLnNlcnZlci5zdGF0ZU1hbmFnZXIuY3JlYXRlKCdwcm9qZWN0Jywge1xuICAgICAgZ3JhcGhQcmVzZXRzOiBBcnJheS5mcm9tKHRoaXMuZ3JhcGhQcmVzZXRzLmtleXMoKSksXG4gICAgICBsZWFybmluZ1ByZXNldHM6IGxlYXJuaW5nUHJlc2V0cyxcbiAgICB9KTtcblxuICAgIHRoaXMuY29tby5zZXJ2ZXIuc3RhdGVNYW5hZ2VyLm9ic2VydmUoYXN5bmMgKHNjaGVtYU5hbWUsIHN0YXRlSWQsIG5vZGVJZCkgPT4ge1xuICAgICAgLy8gdHJhY2sgcGxheWVyc1xuICAgICAgaWYgKHNjaGVtYU5hbWUgPT09ICdwbGF5ZXInKSB7XG4gICAgICAgIGNvbnN0IHBsYXllclN0YXRlID0gYXdhaXQgdGhpcy5jb21vLnNlcnZlci5zdGF0ZU1hbmFnZXIuYXR0YWNoKHNjaGVtYU5hbWUsIHN0YXRlSWQpO1xuICAgICAgICBjb25zdCBwbGF5ZXJJZCA9IHBsYXllclN0YXRlLmdldCgnaWQnKTtcblxuICAgICAgICBwbGF5ZXJTdGF0ZS5vbkRldGFjaCgoKSA9PiB7XG4gICAgICAgICAgdGhpcy5jbGVhclN0cmVhbVJvdXRpbmcocGxheWVySWQsIG51bGwpOyAvLyBjbGVhciByb3V0aW5nIHdoZXJlIHBsYXllciBpcyB0aGUgc291cmNlXG4gICAgICAgICAgdGhpcy5wbGF5ZXJzLmRlbGV0ZShwbGF5ZXJJZClcbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gbWF5YmUgbW92ZSB0aGlzIGluIFNlc3Npb24sIHdvdWxkIGJlIG1vcmUgbG9naWNhbC4uLlxuICAgICAgICBwbGF5ZXJTdGF0ZS5zdWJzY3JpYmUodXBkYXRlcyA9PiB7XG4gICAgICAgICAgZm9yIChsZXQgW25hbWUsIHZhbHVlc10gb2YgT2JqZWN0LmVudHJpZXModXBkYXRlcykpIHtcbiAgICAgICAgICAgIHN3aXRjaCAobmFtZSkge1xuICAgICAgICAgICAgICAvLyByZXNldCBwbGF5ZXIgc3RhdGUgd2hlbiBpdCBjaGFuZ2Ugc2Vzc2lvblxuICAgICAgICAgICAgICAvLyBAbm90ZSAtIHRoaXMgY291bGQgYmUgYSBraW5kIG9mIHJlZHVjZXIgcHJvdmlkZWQgYnlcbiAgICAgICAgICAgICAgLy8gdGhlIHN0YXRlTWFuYWdlciBpdHNlbGYgKHNvdW5kd29ya3MvY29yZSBpc3N1ZSlcbiAgICAgICAgICAgICAgY2FzZSAnc2Vzc2lvbklkJzoge1xuICAgICAgICAgICAgICAgIGNvbnN0IHNlc3Npb25JZCA9IHZhbHVlcztcblxuICAgICAgICAgICAgICAgIGlmIChzZXNzaW9uSWQgIT09IG51bGwpIHtcbiAgICAgICAgICAgICAgICAgIGNvbnN0IHNlc3Npb24gPSB0aGlzLnNlc3Npb25zLmdldChzZXNzaW9uSWQpO1xuXG4gICAgICAgICAgICAgICAgICBpZiAoIXNlc3Npb24pIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS53YXJuKGBbY29tb10gcmVxdWlyZWQgc2Vzc2lvbiBcIiR7c2Vzc2lvbklkfVwiIGRvZXMgbm90IGV4aXN0c2ApO1xuICAgICAgICAgICAgICAgICAgICBwbGF5ZXJTdGF0ZS5zZXQoeyBzZXNzaW9uSWQ6IG51bGwgfSk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgY29uc3QgZGVmYXVsdExhYmVsID0gc2Vzc2lvbi5nZXQoJ2xhYmVscycpWzBdO1xuICAgICAgICAgICAgICAgICAgY29uc3QgZ3JhcGhPcHRpb25zID0gc2Vzc2lvbi5nZXQoJ2dyYXBoT3B0aW9ucycpO1xuXG4gICAgICAgICAgICAgICAgICBwbGF5ZXJTdGF0ZS5zZXQoe1xuICAgICAgICAgICAgICAgICAgICBsYWJlbDogZGVmYXVsdExhYmVsLFxuICAgICAgICAgICAgICAgICAgICByZWNvcmRpbmdTdGF0ZTogJ2lkbGUnLFxuICAgICAgICAgICAgICAgICAgICBncmFwaE9wdGlvbnMsXG4gICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgcGxheWVyU3RhdGUuc2V0KHtcbiAgICAgICAgICAgICAgICAgICAgbGFiZWw6ICcnLFxuICAgICAgICAgICAgICAgICAgICByZWNvcmRpbmdTdGF0ZTogJ2lkbGUnLFxuICAgICAgICAgICAgICAgICAgICBncmFwaE9wdGlvbnM6IG51bGwsXG4gICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICBjYXNlICdncmFwaE9wdGlvbnNFdmVudCc6IHtcbiAgICAgICAgICAgICAgICBjb25zdCBvcHRpb25zVXBkYXRlcyA9IHZhbHVlcztcbiAgICAgICAgICAgICAgICBjb25zdCBncmFwaE9wdGlvbnMgPSBwbGF5ZXJTdGF0ZS5nZXQoJ2dyYXBoT3B0aW9ucycpO1xuXG4gICAgICAgICAgICAgICAgZm9yIChsZXQgbW9kdWxlSWQgaW4gb3B0aW9uc1VwZGF0ZXMpIHtcbiAgICAgICAgICAgICAgICAgIE9iamVjdC5hc3NpZ24oZ3JhcGhPcHRpb25zW21vZHVsZUlkXSwgb3B0aW9uc1VwZGF0ZXNbbW9kdWxlSWRdKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBwbGF5ZXJTdGF0ZS5zZXQoeyBncmFwaE9wdGlvbnMgfSk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHRoaXMucGxheWVycy5zZXQocGxheWVySWQsIHBsYXllclN0YXRlKTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIC8vIHRyYWNrIGZpbGUgc3lzdGVtXG4gICAgdGhpcy5jb21vLmZpbGVXYXRjaGVyLnN0YXRlLnN1YnNjcmliZSh1cGRhdGVzID0+IHtcbiAgICAgIGZvciAobGV0IG5hbWUgaW4gdXBkYXRlcykge1xuICAgICAgICBzd2l0Y2ggKG5hbWUpIHtcbiAgICAgICAgICBjYXNlICdhdWRpbyc6XG4gICAgICAgICAgICB0aGlzLl91cGRhdGVBdWRpb0ZpbGVzRnJvbUZpbGVTeXN0ZW0odXBkYXRlc1tuYW1lXSk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICBjYXNlICdzZXNzaW9ucyc6XG4gICAgICAgICAgICB0aGlzLl91cGRhdGVTZXNzaW9uc0Zyb21GaWxlU3lzdGVtKHVwZGF0ZXNbbmFtZV0pO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9KTtcblxuICAgIGF3YWl0IHRoaXMuX3VwZGF0ZUF1ZGlvRmlsZXNGcm9tRmlsZVN5c3RlbSh0aGlzLmNvbW8uZmlsZVdhdGNoZXIuc3RhdGUuZ2V0KCdhdWRpbycpKTtcbiAgICBhd2FpdCB0aGlzLl91cGRhdGVTZXNzaW9uc0Zyb21GaWxlU3lzdGVtKHRoaXMuY29tby5maWxlV2F0Y2hlci5zdGF0ZS5nZXQoJ3Nlc3Npb25zJykpO1xuXG4gICAgaWYgKHRoaXMuY29tby5zZXJ2ZXIuY29uZmlnLmNvbW8ucHJlbG9hZEF1ZGlvRmlsZXMpIHtcbiAgICAgIGNvbnN0IGFjdGl2ZUF1ZGlvRmlsZXMgPSBbXTtcblxuICAgICAgZm9yIChsZXQgW2lkLCBzZXNzaW9uXSBvZiB0aGlzLnNlc3Npb25zLmVudHJpZXMoKSkge1xuICAgICAgICBjb25zdCBhdWRpb0ZpbGVzID0gc2Vzc2lvbi5nZXQoJ2F1ZGlvRmlsZXMnKTtcblxuICAgICAgICBhdWRpb0ZpbGVzLmZvckVhY2goYXVkaW9GaWxlID0+IHtcbiAgICAgICAgICBjb25zdCBpbmRleCA9IGFjdGl2ZUF1ZGlvRmlsZXMuZmluZEluZGV4KGEgPT4gYS51cmwgPT09IGF1ZGlvRmlsZS51cmwpO1xuXG4gICAgICAgICAgaWYgKGluZGV4ID09PSAtMSAmJiBhdWRpb0ZpbGUuYWN0aXZlKSB7XG4gICAgICAgICAgICBhY3RpdmVBdWRpb0ZpbGVzLnB1c2goYXVkaW9GaWxlKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgfVxuXG4gICAgICB0aGlzLnN0YXRlLnNldCh7IHByZWxvYWRBdWRpb0ZpbGVzOiB0cnVlLCBhY3RpdmVBdWRpb0ZpbGVzIH0pO1xuICAgIH1cbiAgfVxuXG4gIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gIC8vIFNFU1NJT05TXG4gIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gIGFzeW5jIGNyZWF0ZVNlc3Npb24oc2Vzc2lvbk5hbWUsIGdyYXBoUHJlc2V0KSB7XG4gICAgY29uc3Qgb3ZlcnZpZXcgPSB0aGlzLmdldCgnc2Vzc2lvbnNPdmVydmlldycpO1xuICAgIC8vIEBub3RlIC0gdGhpcyBjb3VsZCBwcm9iYWJseSBiZSBtb3JlIHJvYnVzdFxuICAgIGNvbnN0IGlkID0gc2x1Z2lmeShzZXNzaW9uTmFtZSk7XG4gICAgLy8gZmluZCBpZiBhIHNlc3Npb24gdy8gdGhlIHNhbWUgbmFtZSBvciBzbHVnIGFscmVhZHkgZXhpc3RzXG4gICAgY29uc3QgaW5kZXggPSBvdmVydmlldy5maW5kSW5kZXgob3ZlcnZpZXcgPT4ge1xuICAgICAgcmV0dXJuIG92ZXJ2aWV3Lm5hbWUgPT09IHNlc3Npb25OYW1lIHx8IG92ZXJ2aWV3LmlkID09PSBpZDtcbiAgICB9KTtcblxuICAgIGlmIChpbmRleCA9PT0gLTEpIHtcbiAgICAgIGNvbnN0IGF1ZGlvRmlsZXMgPSB0aGlzLmdldCgnYXVkaW9GaWxlcycpO1xuICAgICAgY29uc3QgZ3JhcGggPSB0aGlzLmdyYXBoUHJlc2V0cy5nZXQoZ3JhcGhQcmVzZXQpO1xuICAgICAgY29uc3Qgc2Vzc2lvbiA9IGF3YWl0IFNlc3Npb24uY3JlYXRlKHRoaXMuY29tbywgaWQsIHNlc3Npb25OYW1lLCBncmFwaCwgYXVkaW9GaWxlcyk7XG5cbiAgICAgIHRoaXMuc2Vzc2lvbnMuc2V0KGlkLCBzZXNzaW9uKTtcbiAgICAgIHRoaXMuX3VwZGF0ZVNlc3Npb25zT3ZlcnZpZXcoKTtcblxuICAgICAgcmV0dXJuIGlkO1xuICAgIH1cblxuICAgIC8vIGNvbnNvbGUubG9nKGA+IHNlc3Npb24gXCIke3Nlc3Npb25OYW1lfVwiIGFscmVhZHkgZXhpc3RzYCk7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICBhc3luYyBkZWxldGVTZXNzaW9uKGlkKSB7XG4gICAgaWYgKHRoaXMuc2Vzc2lvbnMuaGFzKGlkKSkge1xuICAgICAgY29uc3Qgc2Vzc2lvbiA9IHRoaXMuc2Vzc2lvbnMuZ2V0KGlkKTtcbiAgICAgIGNvbnN0IGZ1bGxwYXRoID0gc2Vzc2lvbi5kaXJlY3Rvcnk7XG5cbiAgICAgIHRoaXMuc2Vzc2lvbnMuZGVsZXRlKGlkKTtcbiAgICAgIGF3YWl0IHNlc3Npb24uZGVsZXRlKCk7XG5cbiAgICAgIC8vIFdlIGNhbiBjb21lIGZyb20gMiBwYXRocyBoZXJlOlxuICAgICAgLy8gMS4gaWYgdGhlIGZpbGUgc3RpbGwgZXhpc3RzLCB0aGUgbWV0aG9kIGhhcyBiZWVuIGNhbGxlZCBwcm9ncmFtbWF0aWNhbGx5IHNvXG4gICAgICAvLyB3ZSBuZWVkIHRvIHJlbW92ZSB0aGUgZmlsZS4gVGhpcyB3aWxsIHRyaWdnZXIgYF91cGRhdGVTZXNzaW9uc0Zyb21GaWxlU3lzdGVtYFxuICAgICAgLy8gYnV0IG5vdGhpbmcgc2hvdWxkIGFwcGVuZCB0aGVyZSwgdGhhdCdzIHdoeSB3ZSB1cGRhdGUgdGhlXG4gICAgICAvLyBgc2Vzc2lvbk92ZXJ2aWV3YCBoZXJlLlxuICAgICAgLy8gMi4gaWYgdGhlIGZpbGUgaGFzIGJlZW4gcmVtb3ZlZCBtYW51YWxseSB3ZSBhcmUgY2FsbGVkIGZyb21cbiAgICAgIC8vIGBfdXBkYXRlU2Vzc2lvbnNGcm9tRmlsZVN5c3RlbWAgdGhlbiB3ZSBkb24ndCB3YW50IHRvIG1hbmlwdWxhdGVcbiAgICAgIC8vIHRoZSBmaWxlIHN5c3RlbSwgbm9yIHVwZGF0ZSB0aGUgYHNlc3Npb25zT3ZlcnZpZXdgLlxuICAgICAgaWYgKGZzLmV4aXN0c1N5bmMoc2Vzc2lvbi5kaXJlY3RvcnkpKSB7XG4gICAgICAgIGF3YWl0IGRiLmRlbGV0ZShzZXNzaW9uLmRpcmVjdG9yeSk7XG4gICAgICAgIHRoaXMuX3VwZGF0ZVNlc3Npb25zT3ZlcnZpZXcoKTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgYXN5bmMgX3VwZGF0ZVNlc3Npb25zRnJvbUZpbGVTeXN0ZW0oc2Vzc2lvbkZpbGVzVHJlZSkge1xuICAgIGNvbnN0IGluTWVtb3J5U2Vzc2lvbnMgPSBBcnJheS5mcm9tKHRoaXMuc2Vzc2lvbnMudmFsdWVzKCkpO1xuICAgIGNvbnN0IGZpbGVUcmVlU2Vzc2lvbnNPdmVydmlldyA9IHNlc3Npb25GaWxlc1RyZWVcbiAgICAgIC5jaGlsZHJlblxuICAgICAgLmZpbHRlcihsZWFmID0+IGxlYWYudHlwZSA9PT0gJ2RpcmVjdG9yeScpXG4gICAgICAubWFwKGRpciA9PiB7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgaWQ6IGRpci5uYW1lLFxuICAgICAgICAgIGNvbmZpZ1BhdGg6IGRpci5wYXRoLFxuICAgICAgICB9O1xuICAgICAgfSk7XG5cbiAgICBjb25zdCB7XG4gICAgICBpbnRlcnNlY3Rpb24sXG4gICAgICBjcmVhdGVkLFxuICAgICAgZGVsZXRlZFxuICAgIH0gPSBkaWZmQXJyYXlzKGluTWVtb3J5U2Vzc2lvbnMsIGZpbGVUcmVlU2Vzc2lvbnNPdmVydmlldywgZWwgPT4gZWwuaWQpO1xuXG4gICAgLy8gbm90IGluc3RhbmNpYXRlZCBidXQgcHJlc2VudCBpbiBmaWxlIHN5c3RlbVxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgY3JlYXRlZC5sZW5ndGg7IGkrKykge1xuICAgICAgY29uc3Qgc2Vzc2lvbk92ZXJ2aWV3ID0gY3JlYXRlZFtpXTtcblxuICAgICAgdHJ5IHtcbiAgICAgICAgY29uc3QgYXVkaW9GaWxlcyA9IHRoaXMuZ2V0KCdhdWRpb0ZpbGVzJyk7XG4gICAgICAgIGNvbnN0IHNlc3Npb24gPSBhd2FpdCBTZXNzaW9uLmZyb21GaWxlU3lzdGVtKHRoaXMuY29tbywgc2Vzc2lvbk92ZXJ2aWV3LmNvbmZpZ1BhdGgsIGF1ZGlvRmlsZXMpO1xuXG4gICAgICAgIHRoaXMuc2Vzc2lvbnMuc2V0KHNlc3Npb25PdmVydmlldy5pZCwgc2Vzc2lvbik7XG4gICAgICB9IGNhdGNoKGVycikge1xuICAgICAgICBjb25zb2xlLmxvZyhgPiBjYW5ub3QgaW5zdGFuY2lhdGUgc2Vzc2lvbiAke3Nlc3Npb25PdmVydmlldy5pZH1gKTtcbiAgICAgICAgY29uc29sZS5lcnJvcihlcnIpO1xuICAgICAgfVxuICAgIH07XG5cbiAgICAvLyBpbnN0YW5jaWF0ZWQgYnV0IGFic2VudCBmcm9tIGZpbGUgc3lzdGVtXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBkZWxldGVkLmxlbmd0aDsgaSsrKSB7XG4gICAgICBjb25zdCBpZCA9IGRlbGV0ZWRbaV0uaWQ7XG4gICAgICBhd2FpdCB0aGlzLmRlbGV0ZVNlc3Npb24oaWQpO1xuICAgIH1cblxuICAgIC8vIHVwZGF0ZSBvdmVydmlldyBpZiBzb21lIHNlc3Npb25zIGhhdmUgYmVlbiBjcmVhdGVkIG9yIGRlbGV0ZWRcbiAgICBpZiAoY3JlYXRlZC5sZW5ndGggfHzCoGRlbGV0ZWQubGVuZ3RoKSB7XG4gICAgICB0aGlzLl91cGRhdGVTZXNzaW9uc092ZXJ2aWV3KCk7XG4gICAgfVxuICB9XG5cbiAgX3VwZGF0ZVNlc3Npb25zT3ZlcnZpZXcoKSB7XG4gICAgY29uc3Qgc2Vzc2lvbnNPdmVydmlldyA9IEFycmF5LmZyb20odGhpcy5zZXNzaW9ucy52YWx1ZXMoKSlcbiAgICAgIC5tYXAoc2Vzc2lvbiA9PiB7XG4gICAgICAgIGNvbnN0IHN0YXRlSWQgPSBzZXNzaW9uLnN0YXRlLmlkO1xuICAgICAgICBjb25zdCB7IGlkLCBuYW1lIH0gPSBzZXNzaW9uLmdldFZhbHVlcygpO1xuXG4gICAgICAgIHJldHVybiB7IGlkLCBuYW1lLCBzdGF0ZUlkIH07XG4gICAgICB9KTtcblxuICAgIHRoaXMuc2V0KHsgc2Vzc2lvbnNPdmVydmlldyB9KTtcbiAgfVxuXG4gIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gIC8vIFJPVVRJTkdcbiAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuICAvKipcbiAgICogZnJvbSAtIHBsYXllcklkIC0gdGhlIGxvZ2ljYWwgY2xpZW50LCBDb01vIHBsYXllciBpbnN0YW5jZVxuICAgKiB0byAtIG5vZGVJZCAtIHRoZSBwaHlzaWNhbCBjbGllbnQsIHNvdW5kd29ya3MgY2xpZW50IGluc3RhbmNlXG4gICAqL1xuICBhc3luYyBjcmVhdGVTdHJlYW1Sb3V0ZShmcm9tLCB0bykge1xuICAgIGNvbnN0IHN0cmVhbXNSb3V0aW5nID0gdGhpcy5nZXQoJ3N0cmVhbXNSb3V0aW5nJyk7XG4gICAgY29uc3QgaW5kZXggPSBzdHJlYW1zUm91dGluZy5maW5kSW5kZXgociA9PiByWzBdID09PSBmcm9tICYmIHJbMV0gPT09IHRvKTtcblxuICAgIGlmIChpbmRleCA9PT0gLTEpIHtcbiAgICAgIGNvbnN0IGlzU291cmNlU3RyZWFtaW5nID0gc3RyZWFtc1JvdXRpbmcucmVkdWNlKChhY2MsIHIpID0+IGFjYyB8fCByWzBdID09PSBmcm9tLCBmYWxzZSk7XG4gICAgICBjb25zdCBjcmVhdGVkID0gW2Zyb20sIHRvXTtcbiAgICAgIHN0cmVhbXNSb3V0aW5nLnB1c2goY3JlYXRlZCk7XG5cbiAgICAgIC8vIGNvbnNvbGUubG9nKCdjcmVhdGVTdHJlYW1Sb3V0ZScsIHN0cmVhbXNSb3V0aW5nKTtcbiAgICAgIHRoaXMuc2V0KHsgc3RyZWFtc1JvdXRpbmcgfSk7XG4gICAgICAvLyBub3RpZnkgcGxheWVyIHRoYXQgaXQgc2hvdWxkIHN0YXJ0IHRvIHN0cmVhbSBpdHMgc291cmNlXG4gICAgICBpZiAoIWlzU291cmNlU3RyZWFtaW5nKSB7XG4gICAgICAgIGNvbnN0IHBsYXllciA9IHRoaXMucGxheWVycy5nZXQoZnJvbSk7XG4gICAgICAgIHBsYXllci5zZXQoeyBzdHJlYW1Tb3VyY2U6IHRydWUgfSk7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIGFzeW5jIGRlbGV0ZVN0cmVhbVJvdXRlKGZyb20sIHRvKSB7XG4gICAgY29uc3Qgc3RyZWFtc1JvdXRpbmcgPSB0aGlzLmdldCgnc3RyZWFtc1JvdXRpbmcnKTtcbiAgICBjb25zdCBpbmRleCA9IHN0cmVhbXNSb3V0aW5nLmZpbmRJbmRleChyID0+IHJbMF0gPT09IGZyb20gJiYgclsxXSA9PT0gdG8pO1xuXG4gICAgaWYgKGluZGV4ICE9PSAtMSkge1xuICAgICAgY29uc3QgZGVsZXRlZCA9IHN0cmVhbXNSb3V0aW5nW2luZGV4XTtcbiAgICAgIHN0cmVhbXNSb3V0aW5nLnNwbGljZShpbmRleCwgMSk7XG5cbiAgICAgIGF3YWl0IHRoaXMuc2V0KHsgc3RyZWFtc1JvdXRpbmcgfSk7XG5cbiAgICAgIGNvbnN0IGlzU291cmNlU3RyZWFtaW5nID0gc3RyZWFtc1JvdXRpbmcucmVkdWNlKChhY2MsIHIpID0+IGFjYyB8fCByWzBdID09PSBmcm9tLCBmYWxzZSk7XG5cbiAgICAgIC8vIG5vdGlmeSBwbGF5ZXIgdGhhdCBpdCBzaG91bGQgc3RvcCBzdHJlYW1pbmcgaXRzIHNvdXJjZVxuICAgICAgaWYgKCFpc1NvdXJjZVN0cmVhbWluZykge1xuICAgICAgICBjb25zdCBwbGF5ZXIgPSB0aGlzLnBsYXllcnMuZ2V0KGZyb20pO1xuICAgICAgICBwbGF5ZXIuc2V0KHsgc3RyZWFtU291cmNlOiBmYWxzZSB9KTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgYXN5bmMgY2xlYXJTdHJlYW1Sb3V0aW5nKGZyb20gPSBudWxsLCB0byA9IG51bGwpIHtcbiAgICBjb25zdCBzdHJlYW1zUm91dGluZyA9IHRoaXMuZ2V0KCdzdHJlYW1zUm91dGluZycpO1xuICAgIGNvbnN0IGRlbGV0ZWQgPSBbXTtcblxuICAgIGZvciAobGV0IGkgPSBzdHJlYW1zUm91dGluZy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuICAgICAgY29uc3Qgcm91dGUgPSBzdHJlYW1zUm91dGluZ1tpXTtcblxuICAgICAgaWYgKHJvdXRlWzBdID09PSBmcm9tIHx8wqByb3V0ZVsxXSA9PT0gdG8pIHtcbiAgICAgICAgZGVsZXRlZC5wdXNoKHJvdXRlKTtcbiAgICAgICAgc3RyZWFtc1JvdXRpbmcuc3BsaWNlKGksIDEpO1xuICAgICAgfVxuICAgIH1cblxuICAgIHRoaXMuc2V0KHsgc3RyZWFtc1JvdXRpbmcgfSk7XG5cbiAgICAvLyBub3RpZnkgcG9zc2libGUgc291cmNlcyB0aGF0IHRoZXkgc2hvdWxkIHN0b3Agc3RyZWFtaW5nXG4gICAgdGhpcy5wbGF5ZXJzLmZvckVhY2goKHBsYXllciwga2V5KSA9PiB7XG4gICAgICBjb25zdCBpc1NvdXJjZVN0cmVhbWluZyA9IHN0cmVhbXNSb3V0aW5nLnJlZHVjZSgoYWNjLCByKSA9PiBhY2MgfHwgclswXSA9PT0ga2V5LCBmYWxzZSk7XG5cbiAgICAgIGlmICghaXNTb3VyY2VTdHJlYW1pbmcgJiYgcGxheWVyLmdldCgnc3RyZWFtU291cmNlJykgPT09IHRydWUpIHtcbiAgICAgICAgcGxheWVyLnNldCh7IHN0cmVhbVNvdXJjZTogZmFsc2UgfSk7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICBwcm9wYWdhdGVTdHJlYW1GcmFtZShmcmFtZSkge1xuICAgIC8vIEB0b2RvIC0gd2UgbmVlZCB0byBtb3ZlIHRoaXMgaW50byBgUHJvamV0YCBzbyB0aGF0IGl0IGNhbiBiZSBjYWxsZWRcbiAgICAvLyBkaXJlY3RseSBmcm9tIHNlcnZlciBzaWRlIHdpdGggYW4gYXJiaXRyYXJ5IGZyYW1lLi4uXG4gICAgY29uc3Qgcm91dGVzID0gdGhpcy5nZXQoJ3N0cmVhbXNSb3V0aW5nJyk7XG4gICAgY29uc3QgZnJvbUlkID0gZnJhbWVbMF07XG5cbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHJvdXRlcy5sZW5ndGg7IGkrKykge1xuICAgICAgY29uc3Qgcm91dGUgPSByb3V0ZXNbaV07XG4gICAgICBpZiAocm91dGVbMF0gPT09IGZyb21JZCkge1xuICAgICAgICBjb25zdCB0YXJnZXRDbGllbnQgPSB0aGlzLmNvbW8uaWRDbGllbnRNYXAuZ2V0KHJvdXRlWzFdKTtcblxuICAgICAgICAvLyBpZiB3ZSBoYXZlIGEgY2xpZW50IHdpdGggdGhlIHJpZ2h0IG5vZGVJZFxuICAgICAgICBpZiAodGFyZ2V0Q2xpZW50KSB7XG4gICAgICAgICAgdGFyZ2V0Q2xpZW50LnNvY2tldC5zZW5kQmluYXJ5KCdzdHJlYW0nLCBmcmFtZSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgLy8gbWlnaHQgYmUgYW4gT1NDIHRhcmdldCBjbGllbnRcbiAgICAgICAgICAvLyBvc2Muc2VuZCgnL3N0cmVhbS8ke3JvdXRlWzFdfS8ke3JvdXRlWzBdfScsIGZyYW1lKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gIC8vIEFVRElPIEZJTEVTXG4gIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gIGFzeW5jIF91cGRhdGVBdWRpb0ZpbGVzRnJvbUZpbGVTeXN0ZW0oYXVkaW9GaWxlc1RyZWUpIHtcbiAgICAvLyBmaWx0ZXIgZXZlcnl0aGluIHRoYXQgaXMgbm90IGEgLndhdiBvciBhIC5tcDMgZmlsZVxuICAgIGNvbnN0IGF1ZGlvRmlsZXMgPSBhdWRpb0ZpbGVzVHJlZS5jaGlsZHJlblxuICAgICAgLmZpbHRlcihsZWFmID0+IGxlYWYudHlwZSA9PT0gJ2ZpbGUnICYmIFsnLm1wMycsICcud2F2J10uaW5kZXhPZihsZWFmLmV4dGVuc2lvbikgIT09IC0xKVxuICAgICAgLm1hcCgoeyBuYW1lLCB1cmwsIGV4dGVuc2lvbiB9KSA9PiB7IHJldHVybiB7IG5hbWUsIHVybCwgZXh0ZW5zaW9uIH0gfSk7XG5cbiAgICB0aGlzLnN0YXRlLnNldCh7IGF1ZGlvRmlsZXMgfSk7XG5cbiAgICAvLyBAdG9kbyAtIGNsZWFuIHNlc3Npb25zXG4gICAgZm9yIChsZXQgc2Vzc2lvbiBvZiB0aGlzLnNlc3Npb25zLnZhbHVlcygpKSB7XG4gICAgICBhd2FpdCBzZXNzaW9uLnVwZGF0ZUF1ZGlvRmlsZXNGcm9tRmlsZVN5c3RlbShhdWRpb0ZpbGVzKTs7XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IFByb2plY3Q7XG4iXX0=