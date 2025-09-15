import path from 'node:path';

import ServerPluginSync from '@soundworks/plugin-sync/server.js';

import CoMoNode from './ComoNode.js';

import globalDescription from './entities/global-description.js';
import rfcDescription from './entities/rfc-description.js';

import SourceManagerServer from '../components/source-manager/SourceManagerServer.js';
import ProjectManagerServer from '../components/project-manager/ProjectManagerServer.js';
import KeyValueStoreServer from '../components/key-value-store/KeyValueStoreServer.js';
// import RecordingManagerServer from '../components/recording-manager/RecordingManagerServer.js';

export default class ComoServer extends CoMoNode {
  #projectsDirname;
  /**
   *
   * @param {Server} server - Instance of soundworks server
   * @param {Object} options
   * @param {String} [options.projectsDirname='projects'] - Directory in which the projects live
   */
  constructor(server, {
    // directory
    projectsDirname = path.join(process.cwd(), 'projects'),
  } = {}) {
    super(server, { projectsDirname });

    this.#projectsDirname = projectsDirname

    this.node.pluginManager.register('sync', ServerPluginSync);

    // register global shared states class descriptions
    this.node.stateManager.defineClass('global', globalDescription);
    this.node.stateManager.defineClass('rfc', rfcDescription);

    new SourceManagerServer(this);
    new ProjectManagerServer(this);
    new KeyValueStoreServer(this);
    // new RecordingManagerServer(this);
  }

  async start() {
    await super.start();
  }

  // @todo - should be within soundworks
  get runtime() {
    return 'node'; // this.node.runtime
  }
}
