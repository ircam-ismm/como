import {
  counter,
  isFunction,
  isString,
  getTime,
} from '@ircam/sc-utils';
import {
  Scheduler,
} from '@ircam/sc-scheduling';

import * as constants from './constants.js';

export default class ComoNode {
  #node; // soundworks node
  #config;
  #constants = Object.freeze({
    ...constants,
  });

  #plugins = [];
  #components = new Map();

  // global shared states
  #global;
  #rfcMessageBus;
  #rfcIdGenerator = counter();
  #rfcPendingStore = new Map();
  #rfcHandlers = new Map();
  #rfcResolverHooks = new Map();

  // schedulers
  #scheduler;
  #audioScheduler;
  #syncedScheduler;

  /**
   *
   * @param {Client|Server} node - Instance of soundworks client or server
   */
  constructor(node, options) {
    this.#node = node;
    this.#config = options;
  }

  get node() {
    return this.#node;
  }

  get options() {
    return this.options;
  }

  get constants() {
    return this.#constants;
  }

  get runtime() {
    return this.#node.runtime;
  }

  get nodeId() {
    return this.#node.id;
  }

  get plugins() {
    return this.#plugins;
  }

  get global() {
    return this.#global;
  }

  get components() {
    return this.#components;
  }

  get stateManager() {
    return this.#node.stateManager;
  }

  get pluginManager() {
    return this.#node.pluginManager;
  }

  get scheduler() {
    return this.#scheduler;
  }

  get audioScheduler() {
    throw new Error(`Cannot get "${audioScheduler}" on ComoNode: not implemented yet`);
  }

  get syncedScheduler() {
    throw new Error(`Cannot get "${syncedScheduler}" on ComoNode: not implemented yet`);
  }

  async init() {
    if (this.#node.status === 'idle') {
      await this.node.init();

      for (let component of this.#components.values()) {
        await component.init();
      }
    }
  }

  async start() {
    await this.init();
    await this.#node.start();

    // create / attach to global shared states
    const method = this.nodeId === -1 ? 'create' : 'attach';

    if (this.nodeId === this.constants.SERVER_ID) {
      this.#global = await this.stateManager.create('global', {
        ...this.#config,
      });
      // global command mechanism: send a command and await for its execution
      this.#rfcMessageBus = await this.stateManager.create('rfc');
      this.#rfcMessageBus.onUpdate(this.#handleRfc.bind(this));
    } else {
      this.#global = await this.stateManager.attach('global');
      // global command mechanism: send a command and await for its execution
      this.#rfcMessageBus = await this.stateManager.attach('rfc');
      this.#rfcMessageBus.onUpdate(this.#handleRfc.bind(this));
    }

    for (let component of this.#components.values()) {
      await component.start();
    }

    this.#scheduler = new Scheduler(getTime);
    // @todo
    // this.#audioScheduler;
    // this.#syncedScheduler;
  }

  async stop() {
    for (let component of this.#components.values()) {
      await component.stop();
    }

    await this.#node.stop();
  }

  async setProject(projectName) {
    throw new Error('@todo - implement ComoNode#setProject');
  }

  /**
   * Request a remote function call
   *
   * @todo
   * - We could just lazily attach to a per node owned state to minimize network load
   * - This could be integrated into soundworks
   *
   * @param {*} executorNodeId
   * @param {*} name
   * @param {*} [payload={}]
   * @returns
   */
  async requestRfc(executorNodeId, name, payload = {}) {
    if (!Number.isInteger(executorNodeId)) {
      throw new Error('Cannot execute "requestRfc" on ComoNode: argument 1 is not a valid node id');
    }

    if (!isString(name)) {
      throw new Error('Cannot execute "requestRfc" on ComoNode: argument 2 is not a valid remote function call name, must be a string');
    }

    try {
      JSON.stringify(payload);
    } catch(err) {
      throw new Error('Cannot execute "requestRfc" on ComoNode: argument 3 cannot be stringified to JSON');
    }

    const commandId = this.#rfcIdGenerator();

    this.#rfcMessageBus.set({
      name,
      sourceNodeId: this.nodeId,
      executorNodeId,
      commandId,
      payload,
    });

    return new Promise((resolve, reject) => {
      this.#rfcPendingStore.set(commandId, { resolve, reject });
    });
  }

  /**
   * Function to execute when a remote function call is requested on this node
   *
   * @todo
   * - We could just lazily attach to a per node owned state to minimize network load
   * - This could be integrated into soundworks
   *
   * @param {*} executorNodeId
   * @param {*} name
   * @param {*} payload
   * @returns
   */
  setRfcHandler(name, callback) {
    if (!isString(name)) {
      throw new Error('Cannot execute "setRfcHandler" on ComoNode: argument 1 is not a string');
    }

    if (!isFunction(callback)) {
      throw new Error('Cannot execute "setRfcHandler" on ComoNode: argument 2 is not a function');
    }

    this.#rfcHandlers.set(name, callback);
  }

  /**
   * Function executed by the requesting node when the rfc is settled to perform
   * additional logic before fulfilling the promise
   *
   * @param {*} name
   * @param {*} callback
   */
  setRfcResolverHook(name, callback) {
    if (!isString(name)) {
      throw new Error('Cannot execute "setRfcHandler" on ComoNode: argument 1 is not a string');
    }

    if (!isFunction(callback)) {
      throw new Error('Cannot execute "setRfcHandler" on ComoNode: argument 2 is not a function');
    }

    this.#rfcResolverHooks.set(name, callback);

  }

  async #handleRfc(infos) {
    if (infos.settled === true) {
      // check if node is initiator of command
      const { sourceNodeId, commandId, name } = infos;

      if (sourceNodeId === this.nodeId) {
        if (this.#rfcPendingStore.has(commandId)) {
          const { resolve, reject } = this.#rfcPendingStore.get(commandId);
          this.#rfcPendingStore.delete(commandId);

          // @note - maybe we would also like to override the return value
          if (this.#rfcResolverHooks.has(name)) {
            const hook = this.#rfcResolverHooks.get(name);
            await hook(infos.responseErr, infos.responseAck);
          }

          // this will resolve even if responseAck is undefined
          if ('responseErr' in infos) {
            reject(new Error(infos.responseErr));
          } else {
            resolve(infos.responseAck);
          }
        } else {
          throw new Error(`Cannot retrieve command resolvers from this.#rfcPendingStore for command id: ${commandId}`)
        }
      }
    } else {
      // check if this node should execute the command
      const { executorNodeId, name, payload } = infos;
      if (executorNodeId === this.nodeId) {
        try {
          if (!this.#rfcHandlers.has(name)) {
            throw new Error(`Cannot execute Rfc, no handler set for command ${name} (cf. CoMoNode#setRfcHandler)`);
          }

          const handler = this.#rfcHandlers.get(name);
          const responseAck = await handler(payload);
          const response = {
            settled: true,
            ...infos,
          }

          if (responseAck !== undefined || responseAck !== null) {
            response.responseAck = responseAck;
          }

          this.#rfcMessageBus.set(response);
        } catch (err) {
          // this crashes a pre-version script, no way this can be published
          if (this.constants.DEV_MODE) {
            console.log(err.stack);
          }

          this.#rfcMessageBus.set({
            settled: true,
            responseErr: err.message,
            ...infos
          });
        }
      }
    }
  }
}
