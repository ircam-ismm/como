import path from 'node:path';

import ServerPluginScripting from '@soundworks/plugin-scripting/server.js';

import ScriptManager from './ScriptManager.js';

export default class ScriptManagerServer extends ScriptManager {
  constructor(como, name) {
    super(como, name);

    this.como.pluginManager.register(`${this.name}:scripting`, ServerPluginScripting);
  }

  async start() {
    await super.start();

    this.como.project.onUpdate(({ dirname }) => {
      if (dirname !== null) {
        const scriptDirname = path.join(dirname, this.como.constants.PROJECT_SCRIPTS_DIRNAME);
        this.scripting.switch(scriptDirname);
      } else {
        this.scripting.switch(null);
      }
    }, true);
  }
}
