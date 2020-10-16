import AudioModule from './AudioModule.js';
import helpers from '../helpers/index.js';
import JSON5 from 'json5';

// extend AudioModule
class ScriptAudio extends AudioModule {
  constructor(graph, type, id, options) {
    // @note - these defaults are weak, we must reinforce this
    options = Object.assign({ scriptName: 'default' }, options);
    super(graph, type, id, options);

    this.scriptService = this.graph.como.experience.plugins['scripts-audio'];

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

  async updateOptions(options) {
    super.updateOptions(options);

    if (!this.script || (this.options.scriptName !== this.script.name)) {
      await this.setScript(this.options.scriptName);
    }

    if (this.audioScriptModule && this.options.scriptParams) {
      if (typeof this.options.scriptParams === 'string') {
        try {
          this.options.scriptParams = JSON5.parse(this.options.scriptParams);
        } catch (err) {
          console.error(`Invalid script param, please provide a proper javascript object`);
          console.error(err);
        }
      }

      this.audioScriptModule.updateParams(this.options.scriptParams);
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
      this.audioScriptModule.destroy();
      this.audioScriptModule = null;
    });

    this.initScript();
  }

  initScript() {
    if (this.audioScriptModule) {
      this.audioScriptModule.destroy();
    }

    try {
      const audioScriptModule = this.script.execute(
        this.graph,
        helpers,
        this.passThroughInNode,
        this.passThroughOutNode,
        this.outputFrame
      );

      if (!('process' in audioScriptModule) || !('destroy' in audioScriptModule)) {
        throw new Error(`Invalid audioScriptModule "${scriptName}", should implement a \
"process" method and a "destroy" method`);
      }

      this.audioScriptModule = audioScriptModule;
    } catch(err) {
      console.log(err);
    }
  }

  execute(inputFrame) {
    if (this.audioScriptModule) {
      this.outputFrame = this.audioScriptModule.process(inputFrame, this.outputFrame);
    }

    return this.outputFrame;
  }
}

export default ScriptAudio;
