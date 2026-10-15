import path from 'node:path';

import ServerPluginFilesystem from '@soundworks/plugin-filesystem/server.js';

import SoundbankManager from './SoundbankManager.js';

/**
 * Server-side representation of the {@link SoundbankManager}
 *
 * @extends {SoundbankManager}
 */
class SoundbankManagerServer extends SoundbankManager {
  constructor(como, name) {
    super(como, name);

    this.como.pluginManager.register(`${this.name}:filesystem`, ServerPluginFilesystem);
  }

  async start() {
    await super.start();

    this.como.project.onUpdate(async ({ dirname }) => {
      if (dirname !== null) {
        const soundbankDirname = path.join(dirname, this.como.constants.PROJECT_SOUNDBANK_DIRNAME);

        await this.filesystem.switch({
          dirname: soundbankDirname,
          publicPath: soundbankDirname,
        });
      } else {
        await this.filesystem.switch({ dirname: null });
      }
    }, true);
  }
}

export default SoundbankManagerServer;
