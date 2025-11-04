import {
  counter,
  isFunction,
  isString,
  getTime,
} from '@ircam/sc-utils';
import {
  Scheduler,
} from '@ircam/sc-scheduling';
import {
  serializeError,
  deserializeError,
} from 'serialize-error';
import {
  AudioContext,
} from 'isomorphic-web-audio-api';

import * as constants from './constants.js';
import { getId } from '#isomorphic-utils.js';

export default class ComoNode {
  #host; // soundworks node
  #config;
  #constants = Object.freeze({
    ...constants,
  });

  #node;
  #nodes; // collection of node-infos

  // #plugins = [];
  #components = new Map();

  // global shared states
  #global; // @todo - rename to config
  #project;
  #rfcMessageBus;
  #rfcIdGenerator = counter();
  #rfcPendingStore = new Map();
  #rfcHandlers = new Map();
  #rfcResolverHooks = new Map();

  // audio / schedulers
  #audioContext;
  #scheduler;
  #audioScheduler;
  #syncedScheduler;

  /**
   *
   * @param {Client|Server} host - Instance of soundworks client or server
   */
  constructor(host, options) {
    this.#host = host;
    this.#config = options;
    this.#audioContext = new AudioContext();
  }

  get host() {
    return this.#host;
  }

  get options() {
    return this.options;
  }

  get constants() {
    return this.#constants;
  }

  /** soundworks id, uniquely generated at runtime */
  get nodeId() {
    return this.#node.get('nodeId');
  }

  /** topological id - can be fixed between different restart */
  get id() {
    return this.#node.get('id');
  }

  /** node | browser */
  get runtime() {
    return this.#node.get('runtime');
  }

  /** as defined in soundworks */
  get role() {
    return this.#node.get('role');
  }

  get nodes() {

  }

  // get plugins() {
  //   return this.#plugins;
  // }

  get global() {
    return this.#global;
  }

  get project() {
    return this.#project;
  }

  get components() {
    return this.#components;
  }

  get stateManager() {
    return this.#host.stateManager;
  }

  get pluginManager() {
    return this.#host.pluginManager;
  }

  get audioContext() {
    return this.#audioContext;
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
    if (this.#host.status === 'idle') {
      await this.host.init();

      for (let component of this.#components.values()) {
        await component.init();
      }
    }
  }

  async start() {
    await this.init();
    await this.#host.start();

    // node own state
    this.#node = await this.stateManager.create('como:node', {
      nodeId: this.host.id,
      id: getId(this.host.id),
      runtime: this.host.id === this.constants.SERVER_ID ? 'node' : this.host.runtime,
      role: this.host.id === this.constants.SERVER_ID ? 'server' : this.host.role,
    });

    // create / attach to global shared states
    if (this.nodeId === this.constants.SERVER_ID) {
      // @todo - rename to config
      this.#global = await this.stateManager.create('como:global', {
        ...this.#config,
      });
      this.#project = await this.stateManager.create('como:project');
      // global command mechanism: send a command and await for its execution
      this.#rfcMessageBus = await this.stateManager.create('como:rfc');
      this.#rfcMessageBus.onUpdate(this.#handleRfc.bind(this));
    } else {
      this.#global = await this.stateManager.attach('como:global');
      this.#project = await this.stateManager.attach('como:project');
      // global command mechanism: send a command and await for its execution
      this.#rfcMessageBus = await this.stateManager.attach('como:rfc');
      this.#rfcMessageBus.onUpdate(this.#handleRfc.bind(this));
    }

    this.#nodes = await this.stateManager.getCollection('como:node');

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

    await this.#host.stop();
  }

  async setProject(projectDirname) {
    return await this.requestRfc(this.constants.SERVER_ID, 'como:setProject', { projectDirname });
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
            reject(deserializeError(infos.responseErr));
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
          this.#rfcMessageBus.set({
            settled: true,
            responseErr: serializeError(err),
            ...infos
          });
        }
      }
    }
  }
}
