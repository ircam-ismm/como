import {
  isBrowser
} from '@ircam/sc-utils';

import PlayerManager from './PlayerManager.js';

/**
 * Client-side representation of the {@link PlayerManager}
 *
 * @extends {PlayerManager}
 */
class PlayerManagerClient extends PlayerManager {
  async start() {
    await super.start();

    if (isBrowser()) {
      await import('./gui/como-player-manager.js');
      await import('./gui/como-player-script-shared-state.js');
    }
  }
}

export default PlayerManagerClient;
