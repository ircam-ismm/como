export default ComoNode;
/**
 * A Node in a como application.
 *
 * A ComoNode is a wrapper around a soundworks node (Client or Server) with dedicated functionality.
 *
 * @see {@link https://soundworks.dev/}
 * @see {@link https://soundworks.dev/soundworks/Client.html}
 * @see {@link https://soundworks.dev/soundworks/Server.html}
 */
declare class ComoNode {
    /**
     * @param {Client|Server} host - Instance of soundworks client or server
     */
    constructor(host: Client | Server, options: any);
    /**
     * The underlying soundworks client or server instance.
     * @readonly
     * @see {@link https://soundworks.dev/soundworks/Client.html}
     * @see {@link https://soundworks.dev/soundworks/Server.html}
     */
    readonly get host(): any;
    /** @private */
    private get options();
    /** @private */
    private get constants();
    /**
     * Soundworks id, uniquely generated at runtime
     * @type {Number}
     * @readonly
     */
    readonly get nodeId(): number;
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
    readonly get id(): string;
    /**
     * Runtime in which the node is running
     * @type {'node'|'browser'}
     * @readonly
     */
    readonly get runtime(): "node" | "browser";
    /**
     * Role of the node, as defined in soundworks config
     * @type {String}
     * @readonly
     */
    readonly get role(): string;
    /** @private */
    private get nodes();
    /** @private */
    private get global();
    /** @private */
    private get project();
    /**
     * List of registered components
     * @type {Map<String, ComoComponent}
     * @readonly
     */
    readonly get components(): Map<string, ComoComponent>;
    /**
     * Accessor to the soundworks `StateManager`
     * @readonly
     * @see {@link https://soundworks.dev/soundworks/ClientStateManager.html}
     * @see {@link https://soundworks.dev/soundworks/ServerStateManager.html}
     */
    readonly get stateManager(): any;
    /**
     * Accessor to the soundworks `PluginManager`
     * @readonly
     * @see {@link https://soundworks.dev/soundworks/ClientPluginManager.html}
     * @see {@link https://soundworks.dev/soundworks/ServerPluginManager.html}
     */
    readonly get pluginManager(): any;
    /**
     * Instance of `AudioContext`
     * @readonly
     * @see {@link https://developer.mozilla.org/fr/docs/Web/API/AudioContext}
     */
    readonly get audioContext(): AudioContext;
    /**
     * Instance of `AudioBufferLoader`
     * @readonly
     * @see {@link https://github.com/ircam-ismm/sc-loader?tab=readme-ov-file#audiobufferloader}
     */
    readonly get audioBufferLoader(): any;
    /**
     * Instance of Scheduler, running in arbitrary timeline
     * @readonly
     * @see {@link https://github.com/ircam-ismm/sc-scheduling/?tab=readme-ov-file#scheduler}
     * @see {@link https://github.com/ircam-ismm/sc-utils?tab=readme-ov-file#gettime}
     */
    readonly get scheduler(): any;
    /**
     * Instance of Scheduler, running in AudioContext timeline
     * @readonly
     * @see {@link https://github.com/ircam-ismm/sc-scheduling/?tab=readme-ov-file#scheduler}
     */
    readonly get audioScheduler(): any;
    /** @private */
    private get syncedScheduler();
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
    init(): Promise<void>;
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
    start(): Promise<void>;
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
    stop(): Promise<void>;
    /**
     * Change the current project of the whole Como application.
     *
     * - **Important** Calling this method method on any node will change the project for all connected nodes.
     * - **Unstable** The signature of this method is subject to change
     *
     * @param {String} projectDirname - Dirname of the project
     */
    setProject(projectDirname: string): Promise<any>;
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
    requestRfc(executorNodeId: number, name: string, payload?: any): Promise<any>;
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
    setRfcHandler(name: string, callback: Function): void;
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
    setRfcResolverHook(name: any, callback: any): void;
    #private;
}
//# sourceMappingURL=ComoNode.d.ts.map