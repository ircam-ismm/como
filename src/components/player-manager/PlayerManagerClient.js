import {
  isBrowser
} from '@ircam/sc-utils';

import PlayerManager from './PlayerManager.js';

export default class PlayerManagerClient extends PlayerManager {
  async start() {
    await super.start();

    if (isBrowser()) {
      await import('./gui/como-player-manager.js');
    }
  }
}
