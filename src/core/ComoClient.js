import CoMoNode from './ComoNode.js';

// import ClientPluginSync from '@soundworks/plugin-sync/client.js';
import ClientPluginPlatformInit from '@soundworks/plugin-platform-init/client.js';

// components
import SourceManagerClient from '../components/source-manager/SourceManagerClient.js';
import ProjectManagerClient from '../components/project-manager/ProjectManagerClient.js';
import ScriptManagerClient from '../components/script-manager/ScriptManagerClient.js';
import SoundbankManagerClient from '../components/soundbank-manager/SoundbankManagerClient.js';
import SessionManagerClient from '../components/session-manager/SessionManagerClient.js';
import PlayerManagerClient from '../components/player-manager/PlayerManagerClient.js';

import KeyValueStoreClient from '../components/key-value-store/KeyValueStoreClient.js';
// import RecordingManagerClient from '../components/recording-manager/RecordingManagerClient.js';

export default class ComoClient extends CoMoNode {
  /**
   *
   * @param {Client} node - Instance of soundworks client
   */
  constructor(node) {
    super(node);

    // do not register for now, more fluid in DEV
    // this.pluginManager.register('sync', ServerPluginSync);

    this.pluginManager.register('platform-init', ClientPluginPlatformInit, {
      audioContext: this.audioContext,
    });

    new SourceManagerClient(this, 'sourceManager');
    new ProjectManagerClient(this, 'projectManager');
    new ScriptManagerClient(this, 'scriptManager');
    new SoundbankManagerClient(this, 'soundbankManager');
    new SessionManagerClient(this, 'sessionManager');
    new PlayerManagerClient(this, 'playerManager'); // register last

    new KeyValueStoreClient(this, 'store');
    // new RecordingManagerClient(this);
  }
}
