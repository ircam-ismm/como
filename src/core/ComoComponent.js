import CoMoNode from './ComoNode.js';
import { isString } from '@ircam/sc-utils';

export default class ComoComponent {
  #como;
  #name;

  constructor(como, name) {
    if (!(como instanceof CoMoNode)) {
      throw new Error('Cannot construct ComoComponent: argument 1 is not an instance of ComoNode');
    }

    if (!isString(name)) {
      throw new Error('Cannot construct ComoComponent: argument 2 is not a valid component name');
    }

    if (como.components.has(name)) {
      throw new Error(`Cannot construct ComoComponent with name ${name}: a component with same name already exists`);
    }

    this.#como = como;
    this.#name = name;

    this.#como.components.set(name, this);
    // create a getter dynamically for convenience
    Object.defineProperty(this.#como, name, {
      get: () => this,
    });
  }

  get name() {
    return this.#name;
  }

  get como() {
    return this.#como;
  }

  // lifecycle method - binded to soundworks lifecycle
  async init() {}
  async start() {}
  async stop() {}

}

