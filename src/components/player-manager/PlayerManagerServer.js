import { v4 as uuidv4 } from 'uuid';
import PlayerManager from './PlayerManager.js';

import playerDescription from './player-description.js';

/**
 * Server-side representation of the {@link PlayerManager}
 *
 * @extends {PlayerManager}
 */
export default class PlayerManagerServer extends PlayerManager {
  constructor(como, name) {
    super(como, name);

    this.como.stateManager.defineClass(`${this.name}:player`, playerDescription);
    this.como.stateManager.registerUpdateHook(`${this.name}:player`, updates => {
      // reset all script information so that we don't try to attach to
      // an nonexisting state based on information from previous session
      if ('sessionId' in updates) {
        return {
          scriptName: null,
          scriptSharedStateClassName: null,
          scriptSharedStateId: null,
          ...updates,
        }
      }
    });

    this.como.setRfcHandler(`${this.name}:defineSharedStateClass`, this.#defineSharedStateClass);
    this.como.setRfcHandler(`${this.name}:deleteSharedStateClass`, this.#deleteSharedStateClass);
  }

  #defineSharedStateClass = ({ scriptName, classDescription }) => {
    const className = `${scriptName}_${uuidv4()}`;
    this.como.stateManager.defineClass(className, classDescription);
    return className;
  }

  #deleteSharedStateClass = ({ scriptSharedStateClassName }) => {
    return this.como.stateManager.deleteClass(scriptSharedStateClassName);
  }
}
