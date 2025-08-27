import {
  counter,
  isFunction,
  isString,
  getTime,
} from '@ircam/sc-utils';

import { DEV_MODE } from './constants.js';

import { Scheduler } from '@ircam/sc-scheduling';

// @todo - create a global Scheduler and a global Synced Scheduler

export default class ComoNode {
  #node; // soundworks node

  #plugins = [];
  #managers = new Map();

  // global shared states
  #global;
  #command;
  #commandIdGenerator = counter();
  #commandPendingStore = new Map();
  #executeCommandHandlers = new Map();

  // schedulers
  #scheduler;
  #audioScheduler;
  #syncedScheduler;

  /**
   *
   * @param {Client} node - Instance of soundworks client
   */
  constructor(node) {
    // if (!(node instanceof Client)) {
    //   throw new Error('Cannot construct instance of Como: argument 1 is not an instance of soundworks Client');
    // }

    this.#node = node;
  }

  get node() {
    return this.#node;
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

  get managers() {
    return this.#managers;
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

      for (let manager of this.#managers.values()) {
        await manager.init();
      }
    }
  }

  async start() {
    await this.init();
    await this.#node.start();

    // create / attach to global shared states
    const method = this.nodeId === -1 ? 'create' : 'attach';

    this.#global = await this.stateManager[method]('global');
    // global command mechanism: send a command and await for its execution
    this.#command = await this.stateManager[method]('command');
    this.#command.onUpdate(this.#handleCommand.bind(this));

    for (let manager of this.#managers.values()) {
      await manager.start();
    }

    this.#scheduler = new Scheduler(getTime);
    // @todo
    // this.#audioScheduler;
    // this.#syncedScheduler;
  }

  async stop() {
    for (let manager of this.#managers.values()) {
      await manager.stop();
    }

    await this.#node.stop();
  }

  // @todo
  // - Rename these... cf. "remote function call" ?
  // - We could just lazily attach to a per node owned state to minimize network load
  // - This could be integrated into soundworks
  async requestCommand(executorNodeId, name, payload = {}) {
    if (!Number.isInteger(executorNodeId)) {
      throw new Error('Cannot execute "requestCommand" on ComoNode: argument 1 is a valid node id');
    }

    if (!isString(name)) {
      throw new Error('Cannot execute "requestCommand" on ComoNode: argument 2 is a valid command name, must be a string');
    }

    try {
      JSON.stringify(payload);
    } catch(err) {
      throw new Error('Cannot execute "requestCommand" on ComoNode: argument 3 cannot be stringified to JSON');
    }

    const commandId = this.#commandIdGenerator();

    this.#command.set({
      name,
      sourceNodeId: this.nodeId,
      executorNodeId,
      commandId,
      payload,
    });

    return new Promise((resolve, reject) => {
      this.#commandPendingStore.set(commandId, { resolve, reject });
    });
  }

  setCommandHandler(name, callback) {
    if (!isString(name)) {
      throw new Error('Cannot execute "setCommandHandler" on ComoNode: argument 1 is not a string');
    }

    if (!isFunction(callback)) {
      throw new Error('Cannot execute "setCommandHandler" on ComoNode: argument 2 is not a function');
    }

    this.#executeCommandHandlers.set(name, callback);
  }

  async #handleCommand(infos) {
    if (infos.settled === true) {
      // check if node is initiator of command
      const { sourceNodeId, commandId } = infos;

      if (sourceNodeId === this.nodeId) {
        if (this.#commandPendingStore.has(commandId)) {
          const { resolve, reject } = this.#commandPendingStore.get(commandId);
          this.#commandPendingStore.delete(commandId);

          // allow to resolve on undefined responseAck
          if ('responseErr' in infos) {
            reject(new Error(infos.responseErr));
          } else {
            resolve(infos.responseAck);
          }
        } else {
          throw new Error(`Cannot retrieve command resolvers from this.#commandPendingStore for command id: ${commandId}`)
        }
      }
    } else {
      // check if this node should execute the command
      const { executorNodeId, name, payload } = infos;
      if (executorNodeId === this.nodeId) {
        try {
          if (!this.#executeCommandHandlers.has(name)) {
            throw new Error(`Cannot execute command, no handler set for command ${name} (cf. CoMoNode#setCommandHandler)`);
          }

          const handler = this.#executeCommandHandlers.get(name);
          const responseAck = await handler(payload);
          const response = {
            settled: true,
            ...infos,
          }

          if (responseAck !== undefined || responseAck !== null) {
            response.responseAck = responseAck;
          }

          this.#command.set(response);
        } catch (err) {
          // this crashes a pre-version script, no way this can be published
          if (DEV_MODE) {
            console.log(err.stack);
          }

          this.#command.set({
            settled: true,
            responseErr: err.message,
            ...infos
          });
        }
      }
    }
  }
}
