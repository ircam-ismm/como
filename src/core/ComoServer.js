import path from 'node:path';
import fs from 'node:fs';
import fsPromises from 'node:fs/promises';

import ServerPluginPlatformInit from '@soundworks/plugin-platform-init/server.js';
import ServerPluginSync from '@soundworks/plugin-sync/server.js';
import {
  isString,
  isFunction,
} from '@ircam/sc-utils';

import CoMoNode from './ComoNode.js';

// @todo - rename to config
import globalDescription from './entities/global-description.js';
import projectDescription from './entities/project-description.js';
import nodeDescription from './entities/node-description.js';
import rfcDescription from './entities/rfc-description.js';

import SourceManagerServer from '../components/source-manager/SourceManagerServer.js';
import ProjectManagerServer from '../components/project-manager/ProjectManagerServer.js';
import ScriptManagerServer from '../components/script-manager/ScriptManagerServer.js';
import SessionManagerServer from '../components/session-manager/SessionManagerServer.js';
import PlayerManagerServer from '../components/player-manager/PlayerManagerServer.js';

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

    new SourceManagerServer(this, 'sourceManager');
    new ProjectManagerServer(this, 'projectManager');
    new ScriptManagerServer(this, 'scriptManager');
    new SessionManagerServer(this, 'sessionManager');
    new PlayerManagerServer(this, 'playerManager');

    new KeyValueStoreServer(this, 'store');
    // new RecordingManagerServer(this);

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
