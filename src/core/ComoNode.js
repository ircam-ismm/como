import {
  counter,
  isFunction,
  isString,
  getTime,
  isBrowser,
} from '@ircam/sc-utils';
import {
  Scheduler,
} from '@ircam/sc-scheduling';
import {
  AudioBufferLoader,
} from '@ircam/sc-loader';
import {
  serializeError,
  deserializeError,
} from 'serialize-error';
import * as webaudio from 'isomorphic-web-audio-api';

import * as constants from './constants.js';
import { getId } from '#isomorphic-utils.js';

// register webaudio globally on node clients
if (!isBrowser()) {
  Object.assign(globalThis, webaudio);
}

/**
 * A Node in a como application.
 *
 * A ComoNode is a wrapper around a soundworks node (Client or Server) with dedicated functionality.
 *
 * @see {@link https://soundworks.dev/}
 * @see {@link https://soundworks.dev/soundworks/Client.html}
 * @see {@link https://soundworks.dev/soundworks/Server.html}
 */
class ComoNode {
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
  #audioBufferLoader;
  #scheduler;
  #audioScheduler;
  #syncedScheduler;

  /**
   * @param {Client|Server} host - Instance of soundworks client or server
   */
  constructor(host, options) {
    this.#host = host;
    this.#config = options;
    this.#audioContext = new AudioContext();
    this.#audioBufferLoader = new AudioBufferLoader(this.#audioContext);
  }

  /**
   * The underlying soundworks client or server instance.
   * @readonly
   * @see {@link https://soundworks.dev/soundworks/Client.html}
   * @see {@link https://soundworks.dev/soundworks/Server.html}
   */
  get host() {
    return this.#host;
  }

  /** @private */
  get options() {
    return this.options;
  }

  /** @private */
  get constants() {
    return this.#constants;
  }

  /**
   * Soundworks id, uniquely generated at runtime
   * @type {Number}
   * @readonly
   */
  get nodeId() {
    return this.#node.get('nodeId');
  }

  /**
   * Topological id (can be fixed between different restarts):
   * - For browser clients: generated from soundworks node id, or user defined
   * through query parameter, i.e. http://host.local?id=my-client-id
   * - For node clients: hostname
   * - For server: 'server' constant
   *
   * @type {String}
   * @readonly
   */
  get id() {
    return this.#node.get('id');
  }

  /**
   * Runtime in which the node is running
   * @type {'node'|'browser'}
   * @readonly
   */
  get runtime() {
    return this.#node.get('runtime');
  }

  /**
   * Role of the node, as defined in soundworks config
   * @type {String}
   * @readonly
   */
  get role() {
    return this.#node.get('role');
  }

  /** @private */
  get nodes() {

  }

  /** @private */
  get global() {
    return this.#global;
  }

  /** @private */
  get project() {
    return this.#project;
  }

  /**
   * List of registered components
   * @type {Map<String, ComoComponent>}
   * @readonly
   */
  get components() {
    return this.#components;
  }

  /**
   * Accessor to the soundworks `StateManager`
   * @readonly
   * @see {@link https://soundworks.dev/soundworks/ClientStateManager.html}
   * @see {@link https://soundworks.dev/soundworks/ServerStateManager.html}
   */
  get stateManager() {
    return this.#host.stateManager;
  }

  /**
   * Accessor to the soundworks `PluginManager`
   * @readonly
   * @see {@link https://soundworks.dev/soundworks/ClientPluginManager.html}
   * @see {@link https://soundworks.dev/soundworks/ServerPluginManager.html}
   */
  get pluginManager() {
    return this.#host.pluginManager;
  }

  /**
   * Instance of `AudioContext`
   * @readonly
   * @see {@link https://developer.mozilla.org/fr/docs/Web/API/AudioContext}
   */
  get audioContext() {
    return this.#audioContext;
  }

  /**
   * Instance of `AudioBufferLoader`
   * @readonly
   * @see {@link https://github.com/ircam-ismm/sc-loader?tab=readme-ov-file#audiobufferloader}
   */
  get audioBufferLoader() {
    return this.#audioBufferLoader;
  }

  /**
   * Instance of Scheduler, running in arbitrary timeline
   * @readonly
   * @see {@link https://github.com/ircam-ismm/sc-scheduling/?tab=readme-ov-file#scheduler}
   * @see {@link https://github.com/ircam-ismm/sc-utils?tab=readme-ov-file#gettime}
   */
  get scheduler() {
    return this.#scheduler;
  }

  /**
   * Instance of Scheduler, running in AudioContext timeline
   * @readonly
   * @see {@link https://github.com/ircam-ismm/sc-scheduling/?tab=readme-ov-file#scheduler}
   */
  get audioScheduler() {
    return this.#audioScheduler;
  }

  /** @private */
  get syncedScheduler() {
    throw new Error(`Cannot get "${syncedScheduler}" on ComoNode: not implemented yet`);
  }

  /**
   * The init method is part of the initialization lifecycle of the como node.
   * Most of the time, this method will be implicitly executed by the `{@link ComoNode#start}` method.
   *
   * Note that will automatically call the `init` method of the soundworks host as well.
   *
   * In some situations you might want to call this method manually, in such cases the method
   * should be called before the `{@link ComoNode#start}` method.`.
   *
   * @example
   * import { Client } from '@soundworks/core/client.js';
   * import { ComoClient } from '@ircam/como';
   *
   * const client = new Client(config);
   * const como = new ComoClient(client);
   * // optional explicit call of `init` before `start`
   * await como.init();
   * await como.start();
   */
  async init() {
    if (this.#host.status === 'idle') {
      await this.host.init();

      for (let component of this.#components.values()) {
        await component.init();
      }
    }
  }

  /**
   * The start method is part of the initialization lifecycle of the como node.
   * This method will implicitly execute {@link ComoNode#init} method if it has not been called manually.
   *
   * Note that will automatically call the `start` method of the soundworks host as well.
   *
   * @example
   * import { Client } from '@soundworks/core/client.js';
   * import { ComoClient } from '@ircam/como';
   *
   * const client = new Client(config);
   * const como = new ComoClient(client);
   * // implicit execution of `init` method
   * await como.start();
   */
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
    this.#audioScheduler = new Scheduler(() => this.#audioContext.currentTime);
    // @todo
    // this.#syncedScheduler;
  }

  /**
   * The stop method is part of the lifecycle of the como node.
   * Notes:
   * - will automatically call the `stop` method of the soundworks host as well.
   * - most of the time, you should not have to call this method manually, mainly
   * meant for testing purposes.
   *
   * @example
   * import { Client } from '@soundworks/core/client.js';
   * import { ComoClient } from '@ircam/como';
   *
   * const client = new Client(config);
   * const como = new ComoClient(client);
   * await como.start();
   * // ...
   * await como.stop();
   */
  async stop() {
    for (let component of this.#components.values()) {
      await component.stop();
    }

    await this.#host.stop();
  }

  /**
   * Change the current project of the whole Como application.
   *
   * - **Important** Calling this method method on any node will change the project for all connected nodes.
   * - **Unstable** The signature of this method is subject to change
   *
   * @unstable
   *
   * @param {String} projectDirname - Dirname of the project
   */
  async setProject(projectDirname) {
    return await this.requestRfc(this.constants.SERVER_ID, 'como:setProject', { projectDirname });
  }

  /**
   * Request a remote function call on a given node.
   *
   * **Warning** - This method should be considered protected and may be subject to change,
   * use at your own risk.
   *
   * @unstable
   * @todo
   * - Lazily attach to a peer node owned state to minimize network load
   * - This could be integrated into soundworks
   *
   * @param {Number} executorNodeId - Id of the node that should execute the procedure
   * @param {String} name - Name of the procedure
   * @param {Object} [payload={}] - Arguments of the procedure
   * @returns {Promise<any>} The return value of the remote procedure call
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
   * **Warning** - This method should be considered protected and may be subject to change,
   * use at your own risk.
   *
   * @unstable
   * @param {String} name - Name of the procedure
   * @param {Function} callback - Function to be executed
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
   * additional logic on rfc result before fulfilling the promise.
   *
   * **Warning** - This method should be considered protected and may be subject to change,
   * use at your own risk.
   *
   * @unstable
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

  /** @private */
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

export default ComoNode;
