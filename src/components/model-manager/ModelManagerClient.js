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
      await import ('./gui/como-model-manager.js');
    }
  }
}

export default ModelManagerClient;
