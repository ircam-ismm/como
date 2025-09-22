import { v4 as uuidv4 } from 'uuid';
import PlayerManager from './PlayerManager.js';

import playerDescription from './player-description.js';

export default class PlayerManagerServer extends PlayerManager {
  constructor(como, name) {
    super(como, name);

    this.como.stateManager.defineClass(`${this.name}:player`, playerDescription);

    this.como.setRfcHandler(`${this.name}:defineSharedStateClass`, this.#defineSharedStateClass);
    this.como.setRfcHandler(`${this.name}:deleteSharedStateClass`, this.#deleteSharedStateClass);
  }

  #defineSharedStateClass = ({ scriptName, classDescription }) => {
    const className = `${scriptName}_${uuidv4()}`;
    this.como.stateManager.defineClass(className, classDescription);
    return className;
  }

  #deleteSharedStateClass = ({ className }) => {
    return this.como.deleteClass(className);
  }
}
