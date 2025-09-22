import ClientPluginScripting from '@soundworks/plugin-scripting/client.js';
import {
  isBrowser
} from '@ircam/sc-utils';

import ScriptManager from './ScriptManager.js';

export default class ScriptManagerClient extends ScriptManager {
  constructor(como, name) {
    super(como, name);

    this.como.pluginManager.register(`${this.name}:scripting`, ClientPluginScripting);
  }

  async start() {
    await super.start();

    if (isBrowser()) {
      await import('./gui/como-script-manager.js');
    }
  }
}


