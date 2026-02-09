import path from 'node:path';

import ServerPluginLogger from '@soundworks/plugin-logger/server.js';
import ServerPluginFilesystem from '@soundworks/plugin-filesystem/server.js';

import SourceManager from './SourceManager.js';
import sourceDescription from './source-description.js';

/**
 * Server-side representation of the SourceManager;
 */
class SourceManagerServer extends SourceManager {
  #logger;
  #sync;
  #recordedSources = new Map();

  constructor(como, name) {
    super(como, name);

    this.como.pluginManager.register(`${this.name}:logger`, ServerPluginLogger);
    this.como.pluginManager.register(`${this.name}:filesystem`, ServerPluginFilesystem);

    this.como.stateManager.defineClass(`${this.name}:source`, sourceDescription);
    this.como.stateManager.registerUpdateHook(`${this.name}:source`, (updates, currentValues) => {
      // prevent recording of an inactive source
      // @note - are we sure this is the desired behavior
      // @note - this also create an issue on the GUI because the state does not
      // change, hence the GUI component is never set back to inactive
      // if (updates.record && !currentValues.active) {
      //   return { ...updates, record: false };
      // }
    });
  }

  /** @private */
  async start() {
    await super.start();

    this.#sync = await this.como.pluginManager.get('sync');
    this.#logger = await this.como.pluginManager.get(`${this.name}:logger`);

    this.sources.onUpdate(async (state, updates) => {
      if ('record' in updates) {
        const sourceId = state.get('id');

        if (this.#recordedSources.has(sourceId)) {
          const { source, writer } = this.#recordedSources.get(sourceId);
          // detach if not owned
          if (!source.isOwner) {
            await source.detach();
          }
          // close writer
          await writer.close();
          this.#recordedSources.delete(sourceId);
        }

        if (updates.record === true) {
          // create a clone that receive the motion stream
          const source = await this.getSource(sourceId);
          const writer = await this.#logger.createWriter(sourceId);

          source.onUpdate(updates => {
            if ('frame' in updates) {
              const { frame } = updates;
              // tag with synchronized time to realign several recordings
              frame.forEach(channel => channel.syncTime = this.#sync.getSyncTime());
              writer.write(frame);
            }
          });

          this.#recordedSources.set(sourceId, { source, writer });
        }
      }
    });
  }

  /** @private */
  async setProject(dirname) {
    const recordingsDirname = path.join(dirname, this.como.constants.PROJECT_RECORDINGS_DIRNAME);

    await this.#logger.switch(recordingsDirname);
    await this.recordingFilesystem.switch({
      dirname: recordingsDirname,
      publicPath: recordingsDirname,
    });
  }
}

export default SourceManagerServer;
