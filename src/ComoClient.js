import CoMoNode from './ComoNode.js';
// common plugins
import ServerPluginSync from '@soundworks/plugin-sync/server.js';
// common plugins
import ClientPluginSync from '@soundworks/plugin-sync/client.js';
// managers
import SourceManagerClient from './sources/SourceManagerClient.js';
import RecordingManagerClient from './recordings/RecordingManagerClient.js';
import KeyValueStoreClient from './key-value-store/KeyValueStoreClient.js';

export default class ComoClient extends CoMoNode {
  /**
   *
   * @param {Client} node - Instance of soundworks client
   */
  constructor(node) {
    super(node);

    // do not register for now, more fluid in DEV
    // this.node.pluginManager.register('sync', ServerPluginSync);

    new SourceManagerClient(this);
    new RecordingManagerClient(this);
    new KeyValueStoreClient(this);
  }
}
