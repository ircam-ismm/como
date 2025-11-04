import ClientPluginFilesystem from '@soundworks/plugin-filesystem/client.js';

import {
  isBrowser
} from '@ircam/sc-utils';

import SoundbankManager from './SoundbankManager.js';

export default class SoundbankManagerClient extends SoundbankManager {
  constructor(como, name) {
    super(como, name);

    this.como.pluginManager.register(`${this.name}:filesystem`, ClientPluginFilesystem);
  }

  async start() {
    await super.start();

    if (isBrowser()) {
      await import ('./gui/como-soundbank-manager.js');
    }
  }
}
