import AudioModule from './AudioModule.js';
import helpers from '../helpers/index.js';

// extend AudioModule
class ScriptAudio extends AudioModule {
  constructor(graph, type, id, options) {
    // @note - these defaults are weak, we must reinforce this
    options = Object.assign({ scriptName: 'default' }, options);
    super(graph, type, id, options);

    this.scriptService = this.graph.como.experience.services['scripts-audio'];

    this.script = null;
    this.executeFunction = null;
  }

  async init() {
    await this.setScript(this.options.scriptName);
  }

  async destroy() {
    super.destroy();

    if (this.script !== null) {
      const script = this.script;
      this.script = null;
      // this will call the onDetach callback and thus destroy the script
      await script.detach();
    }
  }

  updateOptions(options) {
    super.updateOptions(options);

    if (!this.script || (this.options.scriptName !== this.script.name)) {
      this.setScript(this.options.scriptName);
    }
  }

  async setScript(scriptName) {
    if (this.script !== null) {
      await this.script.detach();
      this.script = null;
    }

    this.script = await this.scriptService.attach(scriptName);

    this.script.subscribe(() => this.initScript());

    this.script.onDetach(() => {
      this.audioScript.destroy();
      this.audioScript = null;
    });

    this.initScript();
  }

  initScript() {
    if (this.audioScript) {
      this.audioScript.destroy();
    }

    try {
      const audioScript = this.script.execute(
        this.graph,
        helpers,
        this.audioInNode,
        this.audioOutNode,
        this.outputFrame
      );

      if (!('process' in audioScript) || !('destroy' in audioScript)) {
        throw new Error(`Invalid audioScript "${scriptName}", should implement a \
"process" method and a "destroy" method`);
      }

      this.audioScript = audioScript;
    } catch(err) {
      console.log(err);
    }
  }

  execute(inputFrame) {
    if (this.audioScript) {
      this.outputFrame = this.audioScript.process(inputFrame, this.outputFrame);
    }

    return this.outputFrame;
  }
}

export default ScriptAudio;
