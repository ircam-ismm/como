import ComoNode from './ComoNode.js';

import ClientPluginPlatformInit from '@soundworks/plugin-platform-init/client.js';

// components
import SourceManagerClient from '../components/source-manager/SourceManagerClient.js';
import ProjectManagerClient from '../components/project-manager/ProjectManagerClient.js';
import ScriptManagerClient from '../components/script-manager/ScriptManagerClient.js';
import SoundbankManagerClient from '../components/soundbank-manager/SoundbankManagerClient.js';
import SessionManagerClient from '../components/session-manager/SessionManagerClient.js';
import PlayerManagerClient from '../components/player-manager/PlayerManagerClient.js';
import KeyValueStoreClient from '../components/key-value-store/KeyValueStoreClient.js';

/**
 * Server-side representation of a ComoNode
 *
 * @extends ComoNode
 * @example
 * import { Client } from '@soundworks/core/client.js';
 * import { ComoClient } from '@ircam/como/client.js';
 *
 * const client = new Client(config);
 * const como = new ComoClient(client);
 * await como.start();
 */
class ComoClient extends ComoNode {
  /**
   * Constructs a new ComoClient instance
   *
   * @param {Client} node - Instance of soundworks client
   */
  constructor(node) {
    super(node);

    this.pluginManager.register('platform-init', ClientPluginPlatformInit, {
      audioContext: this.audioContext,
    });

    /**
     * @member sourceManager
     * @memberof ComoClient#
     * @readonly
     * @type {SourceManagerClient}
     */
    new SourceManagerClient(this, 'sourceManager');
    /**
     * @member projectManager
     * @memberof ComoClient#
     * @readonly
     * @type {ProjectManagerClient}
     */
    new ProjectManagerClient(this, 'projectManager');
    /**
     * @member scriptManager
     * @memberof ComoClient#
     * @readonly
     * @type {ScriptManagerClient}
     */
    new ScriptManagerClient(this, 'scriptManager');
    /**
     * @member soundbankManager
     * @memberof ComoClient#
     * @readonly
     * @type {SoundbankManagerClient}
     */
    new SoundbankManagerClient(this, 'soundbankManager');
    /**
     * @member sessionManager
     * @memberof ComoClient#
     * @readonly
     * @type {SessionManagerClient}
     */
    new SessionManagerClient(this, 'sessionManager');
    /**
     * @member playerManager
     * @memberof ComoClient#
     * @readonly
     * @type {PlayerManagerClient}
     */
    new PlayerManagerClient(this, 'playerManager');
    /**
     * @member store
     * @memberof ComoClient#
     * @readonly
     * @type {KeyValueStoreClient}
     */
    new KeyValueStoreClient(this, 'store');
  }
}

export default ComoClient;
