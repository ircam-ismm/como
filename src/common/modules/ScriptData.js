import BaseModule from './BaseModule.js';
import helpers from '../helpers/index.js';

class ScriptData extends BaseModule {
  constructor(graph, type, id, options) {
    // @note - these defaults are weak, we must reinforce this
    options = Object.assign({ scriptName: 'default' }, options);
    super(graph, type, id, options);

    this.scriptService = this.graph.como.experience.plugins['scripts-data'];

    this.script = null;
    this.executeFunction = null;
  }

  async init() {
    await this.setScript(this.options.scriptName);
  }

  async destroy() {
    if (this.script !== null) {
      const script = this.script;
      this.script = null;

      await script.detach();
    }
  }

  updateOptions(options) {
    super.updateOptions(options);

    if (!this.script || (this.options.scriptName !== this.script.name)) {
      this.setScript(this.options.scriptName);
    }
  }

  async setScript(scriptName) {
    if (this.script !== null) {
      await this.script.detach();
      this.script = null;
    }

    this.script = await this.scriptService.attach(scriptName);

    this.script.subscribe((updates) => {
      if (!updates.error) {
        this.executeFunction = this.script.execute(this.graph, helpers, this.outputFrame);
      }
    });

    this.script.onDetach(() => this.executeFunction = null);

    this.executeFunction = this.script.execute(this.graph, helpers, this.outputFrame);
  }

  // @todo - define what should happen when the script is deleted
  execute(inputFrame) {
    if (this.executeFunction) {
      this.outputFrame = this.executeFunction(inputFrame, this.outputFrame);
    }

    return this.outputFrame;
  }
}

export default ScriptData;
