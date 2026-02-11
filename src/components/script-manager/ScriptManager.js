import ComoComponent from '../../core/ComoComponent.js';

/**
 * The ScriptManager component is responsible for creating and managing
 * dynamic scripts.
 *
 * Basically a wrapper around <https://github.com/collective-soundworks/soundworks-plugin-scripting/>
 */
class ScriptManager extends ComoComponent {
  #scripting;

  /**
   * @hideconstructor
   * @param {ComoNode} como
   * @param {String} name
   */
  constructor(como, name) {
    super(como, name);
  }

  /** @private */
  get scripting() {
    return this.#scripting;
  }

  /** @private */
  async start() {
    await super.start();

    this.#scripting = await this.como.pluginManager.get(`${this.name}:scripting`);
    this.#scripting.setGlobalScriptingContext({
      audioContext: this.como.audioContext,
      audioBufferLoader: this.como.audioBufferLoader,
      como: this.como,
    });
  }

  /**
   * Returns the list of all available scripts.
   * @returns {Array<String>}
   */
  getList() {
    return this.#scripting.getList();
  }

  /**
   * Return the SharedStateCollection of all the scripts underlying share states.
   * Provided for build and error monitoring purposes. Can also be used to maintain
   * a list of existing script, e.g. in a drop-down menu
   *
   * If you want a full featured / executable Script instance, use the attach instead.
   * @returns {Promise<SharedStateCollection>}
   */
  async getCollection() {
    return await this.#scripting.getCollection();
  }

  /**
   * Register callback to execute when a script is created or deleted.
   *
   * @param {Function} callback - Function to execute
   * @param {Boolean} [executeListener=false] - If true, execute the given callback immediately.
   */
  onUpdate(...args) {
    return this.#scripting.onUpdate(...args);
  }

  /**
   * Attach to a script.
   *
   * @param {String} name - Name of the script
   * @returns {Promise<SharedScript>}
   */
  async attach(...args) {
    return await this.#scripting.attach(...args);
  }
}

export default ScriptManager;
