import CoMoNode from './ComoNode.js';
import { isString } from '@ircam/sc-utils';

// base class for component manager
class Manager {
  #como;
  #entityName;

  constructor(como, entityName) {
    if (!(como instanceof CoMoNode)) {
      throw new Error('Cannot construct Manager: argument 1 is not an instance of ComoNode');
    }

    if (!isString(entityName)) {
      throw new Error('Cannot construct Manager: argument 2 is not a valid entity name');
    }

    if (como.managers.has(entityName)) {
      throw new Error(`Cannot create Manager with name ${entityName}: a manager with this name already exists`);
    }

    this.#como = como;
    this.#entityName = entityName;

    this.#como.managers.set(entityName, this);
    // create a getter dynamically for convenience
    Object.defineProperty(this.#como, entityName, { get: () => this });
  }

  get name() {
    return this.#entityName;
  }

  get como() {
    return this.#como;
  }

  async init() {}
  async start() {}
  async stop() {}
}

export default Manager;
