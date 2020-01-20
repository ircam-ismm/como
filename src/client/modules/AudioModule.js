import BaseModule from './BaseModule.js';

class AudioModule extends BaseModule {
  constructor(graph, type, id, options) {
    // @todo - bypass is only a ScriptModule problem, should not be there...
    options = Object.assign({ bypass: false }, options);
    super(graph, type, id, options);

    this.audioContext = graph.como.audioContext;

    this.audioOutNode = this.audioContext.createGain();

    this.audioInNode = this.audioContext.createGain();
    this.audioInNode.gain.value = 0;
    // we store the value here because node.gain.value does not retrieve a
    // usable value, as the node is in automation mode.
    this.lastAudioInGain = 0;

    this.bypassNode = this.audioContext.createGain();
    this.bypassNode.connect(this.audioOutNode);
    this.bypassNode.gain.value = 0;
    this.lastBypassGain = 0;

    this.bypass = this.options.bypass;
    this.updateAudioRouting();
  }

  connect(dest) {
    // @todo - review to enable bypassing synths scripts, this implies to
    // manipulate `audioOutNode` and `bypassNode` instead of `audioOutNode`,
    // however bypass at `audioInNode` level probably save some computations.
    // @todo - bypass should only belong to script node, `AudioDestination`
    // module cannot be bypassed
    if (dest instanceof AudioModule) {
      this.audioOutNode.connect(dest.audioInNode);
      this.audioOutNode.connect(dest.bypassNode);
    } else {
      // can behave like a "normal" data node
      super.connect(dest);
    }
  }

  disconnect(dest = null) {
    if (dest !== null) {
      if (dest instanceof AudioModule) {
        this.audioOutNode.disconnect(dest.audioInNode);
        this.audioOutNode.disconnect(dest.bypassNode);
      } else {
        // can behave like a "normal" data node
        super.disconnect(dest);
      }
    } else {
      this.audioOutNode.disconnect();
      super.disconnect();
    }
  }

  updateOptions(options) {
    super.updateOptions(options);

    if (this.options.bypass !== this.bypass) {
      this.bypass = this.options.bypass;
      this.updateAudioRouting();
    }
  }

  updateAudioRouting() {
    const bypassGain = this.bypass ? 1 : 0;
    const audioInGain = this.bypass ? 0 : 1;
    const rampDuration = 0.05; // @note - this could be user defined
    const now = this.graph.como.audioContext.currentTime;

    if (this.lastBypassGain !== bypassGain) {
      this.bypassNode.gain.setValueAtTime(1 - bypassGain, now);
      this.bypassNode.gain.linearRampToValueAtTime(bypassGain, now + rampDuration);
      this.lastBypassGain = bypassGain;
    }

    if (this.lastAudioInGain !== audioInGain) {
      this.audioInNode.gain.setValueAtTime(1 - audioInGain, now);
      this.audioInNode.gain.linearRampToValueAtTime(audioInGain, now + rampDuration);
      this.lastAudioInGain = audioInGain;
    }
  }
}

export default AudioModule;
