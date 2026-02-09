import {
  isBrowser
} from '@ircam/sc-utils';

import SessionManager from './SessionManager.js';

/**
 * Client-side representation of the {@link SessionManager}
 *
 * @extends {SessionManager}
 */
class SessionManagerClient extends SessionManager {
  constructor(como, name) {
    super(como, name);
  }

  async start() {
    await super.start();

    if (isBrowser()) {
      await import ('./gui/como-session-manager.js');
    }
  }
}

export default SessionManagerClient;
