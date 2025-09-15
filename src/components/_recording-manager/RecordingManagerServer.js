import ServerPluginLogger from '@soundworks/plugin-logger/server.js';
import ServerPluginFilesystem from '@soundworks/plugin-filesystem/server.js';

import RecordingManager from './RecordingManager.js';

const recordingsDirname = 'data/recordings';

export default class RecordingManagerServer extends RecordingManager {
  #filesystem;
  #logger;

  constructor(como) {
    super(como, 'recordingManager');

    // this requires the sourceManager to be set-up
    if (como.sourceManager === undefined) {
      throw new Error('Cannot construct RecordingManagerServer: relies on the SourceManager to exist');
    }

    this.como.pluginManager.register(`${this.name}:logger`, ServerPluginLogger, {
      dirname: recordingsDirname,
    });
    this.como.pluginManager.register(`${this.name}:filesystem`, ServerPluginFilesystem, {
      dirname: recordingsDirname,
      publicPath: recordingsDirname,
    });
  }

  async start() {
    super.start();

    const sync = await this.como.pluginManager.get('sync');

    this.#logger = await this.como.pluginManager.get(`${this.name}:logger`);
    this.#filesystem = await this.como.pluginManager.get(`${this.name}:filesystem`);

    const recordedSources = new Map();

    this.como.sourceManager.sources.onUpdate(async (state, updates) => {
      if ('record' in updates) {
        if (recordedSources.has(state.id)) {
          const clonedSource = recordedSources.get(state.id);
          await clonedSource.detach(); // will just clean itself
        }

        if (updates.record === true) {
          // create a clone that receive the motion stream
          const clonedSource = await this.como.stateManager.attach('source', state.id);
          const filename = state.get('id');
          const writer = await this.#logger.createWriter(filename);

          clonedSource.onUpdate(updates => {
            if ('frame' in updates) {
              const { frame } = updates;
              // tag with synchronized time to realign several recordings
              frame.forEach(channel => channel.syncTime = sync.getSyncTime());
              writer.write(frame);
            }
          });

          clonedSource.onDetach(() => {
            recordedSources.delete(state.id);
            writer.close();
          });

          recordedSources.set(state.id, clonedSource);
        }
      }
    });
  }

  async stop() {
    // nothing to do here
  }
}
