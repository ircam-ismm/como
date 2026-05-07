import {
  isBrowser,
} from '@ircam/sc-utils';

import ModelManager from './ModelManager.js';

/**
 * Client-side representation of the {@link ModelManager}
 *
 * @extends {ModelManager}
 */
class ModelManagerClient extends ModelManager {
  /** @private */
  async init() {
    await super.init();

    if (isBrowser()) {
      // await import ('./gui/como-session-manager.js');
    }
  }
}

export default ModelManagerClient;
