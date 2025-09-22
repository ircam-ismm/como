import {
  isBrowser
} from '@ircam/sc-utils';

import ProjectManager from './ProjectManager.js';

export default class ProjectManagerClient extends ProjectManager {
  async start() {
    await super.start();

    if (isBrowser()) {
      await import('./gui/como-project-manager.js');
    }
  }
};
