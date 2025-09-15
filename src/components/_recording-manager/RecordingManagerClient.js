import ClientPluginFilesystem from '@soundworks/plugin-filesystem/client.js';

import RecordingManager from './RecordingManager.js';

export default class RecordingManagerClient extends RecordingManager {
  #filesystem;

  constructor(como) {
    super(como);

    this.como.pluginManager.register(`${this.name}:filesystem`, ClientPluginFilesystem);
  }

  async start() {
    await super.start();

    this.#filesystem = await this.como.pluginManager.get(`${this.name}:filesystem`);
  }
}
