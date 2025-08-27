import CoMoNode from './ComoNode.js';
// global shared states
import globalDescription from './entities/global.js';
import commandDescription from './entities/command.js';
// common plugins
import ServerPluginSync from '@soundworks/plugin-sync/server.js';
// managers
import SourceManagerServer from './sources/SourceManagerServer.js';
import RecordingManagerServer from './recordings/RecordingManagerServer.js';

export default class ComoServer extends CoMoNode {
  /**
   *
   * @param {server} server - Instance of soundworks server
   */
  constructor(server) {
    super(server);

    this.node.pluginManager.register('sync', ServerPluginSync);
    // register como class descriptions
    this.node.stateManager.defineClass('global', globalDescription);
    this.node.stateManager.defineClass('command', commandDescription);

    new SourceManagerServer(this);
    new RecordingManagerServer(this);
  }

  // @todo - should be within soundworks
  get runtime() {
    return 'node'; // this.node.runtime
  }
}
