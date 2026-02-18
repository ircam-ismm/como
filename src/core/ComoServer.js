import path from 'node:path';
import fs from 'node:fs';
import fsPromises from 'node:fs/promises';

import ServerPluginPlatformInit from '@soundworks/plugin-platform-init/server.js';
import ServerPluginSync from '@soundworks/plugin-sync/server.js';
import { isString } from '@ircam/sc-utils';

import ComoNode from './ComoNode.js';

import globalDescription from './entities/global-description.js';
import projectDescription from './entities/project-description.js';
import nodeDescription from './entities/node-description.js';
import rfcDescription from './entities/rfc-description.js';

import SourceManagerServer from '../components/source-manager/SourceManagerServer.js';
import ProjectManagerServer from '../components/project-manager/ProjectManagerServer.js';
import ScriptManagerServer from '../components/script-manager/ScriptManagerServer.js';
import SoundbankManagerServer from '../components/soundbank-manager/SoundbankManagerServer.js';
import SessionManagerServer from '../components/session-manager/SessionManagerServer.js';
import PlayerManagerServer from '../components/player-manager/PlayerManagerServer.js';

import KeyValueStoreServer from '../components/key-value-store/KeyValueStoreServer.js';

/**
 * Server-side representation of a ComoNode
 *
 * @extends ComoNode
 * @example
 * import { Server } from '@soundworks/core/server.js';
 * import { ComoServer } from '@ircam/como/server.js';
 *
 * const server = new Server(config);
 * const como = new ComoServer(server);
 * await como.start();
 */
class ComoServer extends ComoNode {
  #projectsDirname;

  /**
   * Constructs a new ComoServer instance
   *
   * @param {Server} server - Instance of soundworks server
   * @param {Object} options
   * @param {String} [options.projectsDirname='projects'] - Directory in which the projects live (unstable)
   */
  constructor(server, {
    // directory
    projectsDirname = 'projects',
  } = {}) {
    super(server, { projectsDirname });

    this.#projectsDirname = projectsDirname

    this.pluginManager.register('platform-init', ServerPluginPlatformInit);
    this.pluginManager.register('sync', ServerPluginSync);

    // register global shared states class descriptions
    this.stateManager.defineClass('como:global', globalDescription);
    this.stateManager.defineClass('como:project', projectDescription);
    this.stateManager.defineClass('como:node', nodeDescription);
    this.stateManager.defineClass('como:rfc', rfcDescription);

    /**
     * @member sourceManager
     * @memberof ComoServer#
     * @readonly
     * @type {SourceManagerServer}
     */
    new SourceManagerServer(this, 'sourceManager');
    /**
     * @member projectManager
     * @memberof ComoServer#
     * @readonly
     * @type {ProjectManagerServer}
     */
    new ProjectManagerServer(this, 'projectManager');
    /**
     * @member scriptManager
     * @memberof ComoServer#
     * @readonly
     * @type {ScriptManagerServer}
     */
    new ScriptManagerServer(this, 'scriptManager');
    /**
     * @member soundbankManager
     * @memberof ComoServer#
     * @readonly
     * @type {SoundbankManagerServer}
     */
    new SoundbankManagerServer(this, 'soundbankManager');
    /**
     * @member sessionManager
     * @memberof ComoServer#
     * @readonly
     * @type {SessionManagerServer}
     */
    new SessionManagerServer(this, 'sessionManager');
    /**
     * @member playerManager
     * @memberof ComoServer#
     * @readonly
     * @type {PlayerManagerServer}
     */
    new PlayerManagerServer(this, 'playerManager');
    /**
     * @member keyValueStore
     * @memberof ComoServer#
     * @readonly
     * @type {KeyValueStoreServer}
     */
    new KeyValueStoreServer(this, 'keyValueStore');

    this.setRfcHandler('como:setProject', this.#setProject);
  }

  async start() {
    await super.start();
    await this.audioContext.resume();
  }

  #setProject = async ({ projectDirname }) => {
    // allow to go to idle state
    if (projectDirname === null) {
      await this.project.set({ name: null, dirname: null });
    } else {
      if (!isString(projectDirname)) {
        throw new Error(`Cannot execute "setProject" on ComoServer: project directory (${projectDirname}) is not a string`);
      }

      if (!fs.existsSync(projectDirname)) {
        throw new Error(`Cannot execute "setProject" on ComoServer: project directory (${projectDirname}) does not exists`);
      }

      const infosPathname = path.join(projectDirname, this.constants.PROJECT_INFOS_FILENAME);

      if (!fs.existsSync(infosPathname)) {
        throw new Error(`Cannot execute "setProject" on ComoServer: project directory (${projectDirname}) does not contain a ${this.constants.PROJECT_INFOS_FILENAME} file`);
      }

      let infos;

      try {
        const blob = await fsPromises.readFile(infosPathname);
        infos = JSON.parse(blob.toString());
      } catch (err) {
        throw new Error(`Cannot execute "setProject" on ComoServer: ${err.message}`);
      }

      await this.project.set({
        name: infos.name,
        dirname: projectDirname,
      });
    }

    for (let component of this.components.values()) {
      await component.setProject(projectDirname);
    }

    return true;
  }
}

export default ComoServer;
