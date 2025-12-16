import ComoComponent from '../../core/ComoComponent.js';


export default class ScriptManager extends ComoComponent {
  #scripting;

  constructor(como, name) {
    super(como, name);
  }

  get scripting() {
    return this.#scripting;
  }

  async start() {
    await super.start();

    this.#scripting = await this.como.pluginManager.get(`${this.name}:scripting`);
    this.#scripting.setGlobalScriptingContext({
      audioContext: this.como.audioContext,
      audioBufferLoader: this.como.audioBufferLoader,
      como: this.como,
    });
  }

  // just expose plugin API
  getList() {
    return this.#scripting.getList();
  }

  getCollection() {
    return this.#scripting.getCollection();
  }

  onUpdate(...args) {
    return this.#scripting.onUpdate(...args);
  }

  async attach(...args) {
    return await this.#scripting.attach(...args);
  }

  // setGlobalScriptingContext() {}
}
