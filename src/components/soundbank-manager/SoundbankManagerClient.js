import ClientPluginFilesystem from '@soundworks/plugin-filesystem/client.js';

import {
  isBrowser
} from '@ircam/sc-utils';

import SoundbankManager from './SoundbankManager.js';

/**
 * Client-side representation of the {@link SoundbankManager}
 *
 * ```js
 * import { Client } from '@soundworks/core/client.js';
 * import { ComoClient } from '@ircam/como/client.js';
 *
 * const client = new Client(config);
 * const como = new ComoClient(client);
 * await como.start();
 *
 * const buffer = await como.soundbankManager.getBuffer('test.mp3');
 * ```
 *
 * On browser clients, the component automatically expose the `como-soundbank-manager` Web Component:
 *
 * ```html
 * <como-soundbank-manager
 *   .como=${como}
 * ></como-soundbank-manager>
 * <!-- or with optional session -->
 * <como-soundbank-manager
 *   .como=${como}
 *   session-id=${sessionId}
 * ></como-soundbank-manager>
 * ```
 *
 * @extends {SoundbankManager}
 */
class SoundbankManagerClient extends SoundbankManager {
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

export default SoundbankManagerClient;
