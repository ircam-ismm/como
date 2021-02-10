import AudioModule from './AudioModule.js';
import JSON5 from 'json5';

// extend AudioModule to have the bypass node
// @note - the implmentation is mostly the same as ScriptData, but we can't
// derive 2 parents... maybe mixin would help
class ScriptAudio extends AudioModule {
  constructor(graph, type, id, options) {
    // @note - these defaults are weak, we must reinforce this
    options = Object.assign({ scriptName: 'default' }, options);
    super(graph, type, id, options);

    this.scriptService = this.graph.como.experience.plugins['scripts-audio'];

    this.script = null;
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

    if (this.scriptModule && this.options.scriptParams) {
      if (typeof this.options.scriptParams === 'string') {
        try {
          this.options.scriptParams = JSON5.parse(this.options.scriptParams);
        } catch (err) {
          console.error(`Invalid script param, please provide a proper javascript object`);
          console.error(err);
        }
      }

      this.scriptModule.updateParams(this.options.scriptParams);
    }
  }

  async setScript(scriptName) {
    if (this.script !== null) {
      await this.script.detach();
      this.script = null;
    }

    this.script = await this.scriptService.attach(scriptName);

    this.script.subscribe(updates => {
      if (!updates.error) {
        this.initScript();
      }
    });

    this.script.onDetach(() => {
      this.scriptModule.destroy();
      this.scriptModule = null;
    });

    this.initScript();
  }

  initScript() {
    if (this.scriptModule) {
      this.scriptModule.destroy();
    }

    try {
      const scriptModule = this.script.execute(
        this.graph,
        this.graph.como.helpers,
        this.passThroughInNode,
        this.passThroughOutNode,
        this.outputFrame
      );

      if (!('process' in scriptModule) ||
          !('destroy' in scriptModule) ||
          !('updateParams' in scriptModule)
      ) {
        throw new Error(`Invalid scriptModule "${this.script.name}", the script should return an object { updateParams, process, destroy }`);
      }

      this.scriptModule = scriptModule;
    } catch(err) {
      console.log(err);
    }
  }

  execute(inputFrame) {
    if (this.scriptModule) {
      this.outputFrame = this.scriptModule.process(inputFrame, this.outputFrame);
    }

    return this.outputFrame;
  }
}

export default ScriptAudio;
