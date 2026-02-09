import SourceManager from './SourceManager.js';
import ClientPluginFilesystem from '@soundworks/plugin-filesystem/client.js';

import {
  isBrowser
} from '@ircam/sc-utils';

/**
 * Client-side representation of the {@link SourceManager}
 * @extends SourceManager
 */
class SourceManagerClient extends SourceManager {
  constructor(como, name) {
    super(como, name);

    this.como.pluginManager.register(`${this.name}:filesystem`, ClientPluginFilesystem);
  }

  async start() {
    await super.start();

    if (isBrowser()) {
      // @todo - rename these files
      // await import ('./gui/como-sensor-3d.js');
      // await import ('./gui/como-sensor-plot.js');
      await import ('./gui/como-sensor.js');
      await import ('./gui/como-source.js');
      await import ('./gui/como-source-manager.js');
    }
  }
}

export default SourceManagerClient;
