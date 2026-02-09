export default SourceManager;
/**
 * The SourceManager component is responsible for creating and dispatching
 * sources of motion sensors.
 *
 * Como sources are represented as soundworks SharedState and act as
 * middlewares between the actual sources of data (e.g. hardware) and the application, e.g.:
 * ```
 * motion sensor -- [OSC] -> como source -- [websocket / SharedState] -> como application
 * ```
 * Hence, the como source can exists but be inactive due to its underlying motion
 * sensor being shutdown.
 *
 * Como source stream must output a stream that follows the specification defined
 * here: <https://github.com/ircam-ismm/sc-motion/blob/main/FORMAT.md>
 *
 * The shared state is defined by the following parameters:
 * - `id` - id of the source
 * - `type` - type of the "real" source of motion data
 * - `nodeId` - node who owns the source
 * - `infos` - information (e.g. OSC config) used to configure the source
 * - `frame` - motion data stream
 * - `active` - whether the underlying sensor is active or not
 * - `record` - if true record the source on the filesystem
 *
 * @example
 * import { Client } from '@soundworks/core/client.js';
 * import ComoClient from '@ircam/como/ComoClient.js';
 *
 * const client = new Client(config);
 * const como = new ComoClient(client);
 * await como.start();
 *
 * const sourceId = await como.sourceManager.createSource({
 *   type: 'riot',
 *   id: '0',
 *   port: 8081,
 *   verbose: false,
 * });
 */
declare class SourceManager extends ComoComponent {
    /**
     * The SourceManager component is automatically created by the {@link ComoNode} instance.
     *
     * _This constructor should never be called manually_
     * @param {ComoNode} como
     * @param {String} name
     */
    constructor(como: ComoNode, name: string);
    /**
     * Lightweight collection of all the sources on the network. The collection
     * only contains information that allows to monitor or control the sources,
     * but does not contain the actual stream of data.
     *
     * If a node is interested in a particular motion stream source, it should
     * explicity retrieve to the "full" source using {@link SourceManager#getSource}.
     *
     * @readonly
     * @type {SharedStateCollection}
     */
    readonly get sources(): SharedStateCollection;
    /**
     * List of current source ids.
     *
     * @readonly
     * @type {Array<String>}
     */
    readonly get list(): Array<string>;
    /**
     * SourceManagerServer requires access to the plugin
     * @private
     */
    private get recordingFilesystem();
    /**
     * Check whether the given source id correspond to an existing source
     *
     * @param {String} sourceId
     * @returns {Boolean}
     */
    sourceExists(sourceId: string): boolean;
    /**
     * Return the lightweight version of a source (i.e. without its stream) from its id.
     *
     * @param {String} sourceId
     * @returns {SharedState|undefined}
     */
    getSourceFiltered(sourceId: string): SharedState | undefined;
    /**
     * Retrieve the full version of a source (i.e. with its stream) from its id.
     *
     * If the node is the owner of the source, the retrieved source will be the owned
     * original instance of the shared state.
     *
     * @param {String} sourceId
     * @returns {SharedState|null}
     */
    getSource(sourceId: string): SharedState | null;
    /**
     * Create a new como source.
     *
     * @param {Object} config - The configuration object for the source.
     * @param {String} [nodeId=this.como.nodeId] - If given, creates the source on
     *  given como node.
     * @returns {String} The id of the created source
     */
    createSource(config: any, nodeId?: string): string;
    /**
     * _NOT IMPLEMENTED YET_
     *
     * Delete an existing source.
     */
    deleteSource(config: any, nodeId?: number): Promise<any>;
    /**
     * Returns the list of the existing recordings.
     *
     * @returns {Object} The file tree of the projects's recordings directory
     */
    listRecordings(): any;
    /**
     * Retrieve the content of a given recording.
     * @param {Filename} Filename - Filename of the recording
     * @returns {Blob}
     */
    readRecording(filename: any): Blob;
    /**
     * Delete a given recording.
     * @param {Filename} Filename - Filename of the recording
     */
    deleteRecording(filename: any): Promise<any>;
    #private;
}
import ComoComponent from '../../core/ComoComponent.js';
//# sourceMappingURL=SourceManager.d.ts.map