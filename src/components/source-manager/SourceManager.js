import ComoComponent from '../../core/ComoComponent.js';

import {
  isPlainObject,
} from '@ircam/sc-utils';

import SourceFactory from '#sources/factory.js';

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
class SourceManager extends ComoComponent {
  #recordingFilesystem;
  #ownedSources = new Set(); // owned sources created on this node
  #sources;
  #factory;

  /**
   * The SourceManager component is automatically created by the {@link ComoNode} instance.
   *
   * _This constructor should never be called manually_
   * @param {ComoNode} como
   * @param {String} name
   */
  constructor(como, name) {
    super(como, name);

    this.#factory = new SourceFactory(como);
  }

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
  get sources() {
    return this.#sources;
  }

  /**
   * List of current source ids.
   *
   * @readonly
   * @type {Array<String>}
   */
  get list() {
    return this.#sources.get('id');
  }

  /**
   * SourceManagerServer requires access to the plugin
   * @private
   */
  get recordingFilesystem() {
    return this.#recordingFilesystem;
  }

  /** @private */
  async start() {
    await super.start();

    this.#recordingFilesystem = await this.como.pluginManager.get(`${this.name}:filesystem`);

    this.#sources = await this.como.stateManager.getCollection(`${this.name}:source`,
      // parameter whitelist - we really don't want the streams here
      // @todo - move to blacklist once implemented in soundworks
      ['id', 'type', 'infos', 'active', 'record', 'control']
    );

    this.como.setRfcHandler(`${this.name}:createSource`, this.#createSourceHandler);
    this.como.setRfcHandler(`${this.name}:deleteSource`, this.#deleteSourceHandler);

    this.como.setRfcResolverHook(`${this.name}:createSource`, this.#createSourceResolverHook);
  }

  /** @private */
  async stop() {
    await super.stop();

    await this.#sources.detach();

    for (let source of this.#ownedSources.values()) {
      await source.delete();
    }

    this.#factory.stop();
  }

  /**
   * Check whether the given source id correspond to an existing source
   *
   * @param {String} sourceId
   * @returns {Boolean}
   */
  sourceExists(sourceId) {
    return !!this.sources.find(s => s.get('id') === sourceId);
  }

  /**
   * Return the lightweight version of a source (i.e. without its stream) from its id.
   *
   * @param {String} sourceId
   * @returns {SharedState|undefined}
   */
  getSourceFiltered(sourceId) {
    return this.sources.find(source => source.get('id') === sourceId);
  }

  /**
   * Retrieve the full version of a source (i.e. with its stream) from its id.
   *
   * If the node is the owner of the source, the retrieved source will be the owned
   * original instance of the shared state.
   *
   * @param {String} sourceId
   * @returns {SharedState|null}
   */
  async getSource(sourceId) {
    // if the source has been created on this node, return the underlying owned source state
    const owned = Array.from(this.#ownedSources).find(source => source.id === sourceId);
    if (owned) {
      return owned.state;
    }

    // if the source has been created on another node, attach to the "real" source
    const notOwned = this.sources.find(s => s.get('id') === sourceId);
    if (notOwned) {
      return await this.como.stateManager.attach(`${this.name}:source`, notOwned.id);
    }

    // source does not exits
    return null;
  }

  /**
   * Create a new como source.
   *
   * @param {Object} config - The configuration object for the source.
   * @param {String} [nodeId=this.como.nodeId] - If given, creates the source on
   *  given como node.
   * @returns {String} The id of the created source
   */
  async createSource(config, nodeId = this.como.nodeId) {
    if (!isPlainObject(config)) {
      throw new Error(`Cannot execute "createSource" on SourceManager: argument 1 is not an object`);
    }

    if (!('id' in config)) {
      throw new Error(`Cannot execute "createSource" on SourceManager: config.id is not defined`);
    }

    const exists = this.#sources.find(source => source.get('id') === config.id);

    if (exists) {
      throw new Error(`Cannot execute "createSource" on SourceManager: a source with id "${config.id}" already exists`);
    }

    // always go though the rfc roundtrip, even if `nodeId = this.como.nodeId`,
    // to benefit from the hook logic
    // @note - this could be optimized within the Rfc logic
    return await this.como.requestRfc(nodeId, `${this.name}:createSource`, config);
  }

  /**
   * _NOT IMPLEMENTED YET_
   *
   * Delete an existing source.
   */
  async deleteSource(config, nodeId = this.como.nodeId) {
    // always go though the rfc roundtrip, even if `nodeId = this.como.nodeId`,
    // to benefit from the hook logic
    // @note - this could be optimized within the Rfc logic
    return await this.como.requestRfc(nodeId, `${this.name}:deleteSource`, config);
  }


  #createSourceHandler = async (config) => {
    const source = await this.#factory.createSource(config);
    this.#ownedSources.add(source);

    return source.id;
  }

  #createSourceResolverHook = async (err, sourceId) => {
    if (err) {
      return;
    }

    // make sure the new source is in the list before we resolve `createSource`
    // cf. https://github.com/collective-soundworks/soundworks/issues/118
    //
    // 1. check that the source is not already in list, this may happen server-side
    const source = this.como.sourceManager.sources.find(s => s.get('id') === sourceId);

    if (source !== undefined) {
      return Promise.resolve();
    }

    // 2. else, wait for the source to attach to the collection before resolving
    return new Promise(resolve => {
      // detach listener will be defined as we will be asynchronous
      //
      const detachListener = this.como.sourceManager.sources.onAttach(source => {
        // console.log(source.get('id'), sourceId);
        if (source.get('id') === sourceId) {
          detachListener();
          resolve();
        }
      });
    });
  }

  #deleteSourceHandler = async (config) => {
    return this.#factory.deleteSource(config);
  }

  // ----------------------------------------------------------------------
  // RECORDINGS MANAGEMENT
  // ----------------------------------------------------------------------

  /**
   * Returns the list of the existing recordings.
   *
   * @returns {Object} The file tree of the projects's recordings directory
   */
  listRecordings() {
    return this.#recordingFilesystem.getTree();
  }

  /**
   * Retrieve the content of a given recording.
   * @param {Filename} Filename - Filename of the recording
   * @returns {Blob}
   */
  async readRecording(filename) {
    return await this.#recordingFilesystem.readFile(filename);
  }

  /**
   * Delete a given recording.
   * @param {Filename} Filename - Filename of the recording
   */
  async deleteRecording(filename) {
    return await this.#recordingFilesystem.rm(filename);
  }
}

export default SourceManager;
