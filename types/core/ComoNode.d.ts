export default ComoNode;
/**
 * A Node in a como application
 */
declare class ComoNode {
    /**
     *
     * @param {Client|Server} host - Instance of soundworks client or server
     */
    constructor(host: Client | Server, options: any);
    get host(): any;
    get options(): any;
    get constants(): Readonly<{
        SERVER_ID: -n;
        PROJECT_INFOS_FILENAME: "project-infos.json";
        PROJECT_SCRIPTS_DIRNAME: "scripts";
        PROJECT_SOUNDBANK_DIRNAME: "soundbank";
        PROJECT_RECORDINGS_DIRNAME: "recordings";
        PROJECT_SESSIONS_DIRNAME: "sessions";
    }>;
    /** soundworks id, uniquely generated at runtime */
    get nodeId(): any;
    /** topological id - can be fixed between different restart */
    get id(): any;
    /** node | browser */
    get runtime(): any;
    /** as defined in soundworks */
    get role(): any;
    get nodes(): void;
    get global(): any;
    get project(): any;
    get components(): any;
    get stateManager(): any;
    get pluginManager(): any;
    get audioContext(): AudioContext;
    get audioBufferLoader(): any;
    get scheduler(): any;
    get audioScheduler(): void;
    get syncedScheduler(): void;
    init(): Promise<void>;
    start(): Promise<void>;
    stop(): Promise<void>;
    setProject(projectDirname: any): Promise<any>;
    /**
     * Request a remote function call
     *
     * @todo
     * - We could just lazily attach to a per node owned state to minimize network load
     * - This could be integrated into soundworks
     *
     * @param {*} executorNodeId - Id of the node that should execute the procedure
     * @param {*} name - Name of the procedure
     * @param {*} [payload={}] - Arguments of the procedure
     * @returns {Promise<any>} The return value of the remote procedure call
     */
    requestRfc(executorNodeId: any, name: any, payload?: any): Promise<any>;
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
     */
    setRfcHandler(name: any, callback: any): void;
    /**
     * Function executed by the requesting node when the rfc is settled to perform
     * additional logic before fulfilling the promise
     *
     * @param {*} name
     * @param {*} callback
     */
    setRfcResolverHook(name: any, callback: any): void;
    #private;
}
//# sourceMappingURL=ComoNode.d.ts.map