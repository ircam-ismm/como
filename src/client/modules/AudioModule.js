import BaseModule from '../../common/modules/BaseModule.js';

class AudioModule extends BaseModule {
  constructor(graph, type, id, options) {
    // @todo - bypass is only a ScriptModule problem, should not be there...
    options = Object.assign({ bypass: false }, options);
    super(graph, type, id, options);

    this.audioContext = graph.como.audioContext;
 
    //                            (0|1)
    //               /----------o bypass ----------- \
    //              /                                 \
    //             /                                   o
    // audioInNode -o thruIn -o [process] -o thruOut -o audioOutNode
    //                (1|0)                  (1|0)
    //
    // we wan't both pass-through in, to fill [process] with zeros and hopefully save
    // some computations, and pass-through out, to allow bypassing synths.
    this.audioOutNode = this.audioContext.createGain();
    this.audioInNode = this.audioContext.createGain();
    this.passThroughInNode = this.audioContext.createGain();
    this.passThroughOutNode = this.audioContext.createGain();
    this.bypassNode = this.audioContext.createGain();

    // avoid clics when dynamically creating nodes
    this.passThroughInNode.gain.value = 0;
    this.passThroughOutNode.gain.value = 0;
    this.bypassNode.gain.value = 0;
    // connect everybody
    this.audioInNode.connect(this.passThroughInNode);
    this.audioInNode.connect(this.bypassNode);

    this.passThroughOutNode.connect(this.audioOutNode);
    this.bypassNode.connect(this.audioOutNode);

    this._bypass = this.options.bypass;
    this._updateAudioRouting();
  }

  connect(dest) {
    if (!(dest instanceof AudioModule)) {
      throw new Error(`can't connect "${this.id}" to "${dest.id}, destination is not of type AudioModule`);
    }
      
    this.audioOutNode.connect(dest.audioInNode);
  }

  disconnect(dest = null) {
    if (dest !== null) {
      if (!(dest instanceof AudioModule)) {
        throw new Error(`can't fromconnect "${this.id}" from "${dest.id}, destination is not of type AudioModule`);
      }

      this.audioOutNode.disconnect(dest.audioInNode);
    } else {
      this.audioOutNode.disconnect();
    }
  }

  updateOptions(options) {
    super.updateOptions(options);

    if (this.options.bypass !== this._bypass) {
      this._bypass = this.options.bypass;
      this._updateAudioRouting();
    }
  }

  _updateAudioRouting() {
    const timeConstant = 0.005; // @note - this could be user defined
    const now = this.graph.como.audioContext.currentTime;
    const passThroughGain = this._bypass ? 0 : 1;
    const bypassGain = this._bypass ? 1 : 0;

    this.passThroughInNode.gain.cancelScheduledValues(now);
    this.passThroughInNode.gain.setTargetAtTime(passThroughGain, now, timeConstant);

    this.passThroughOutNode.gain.cancelScheduledValues(now);
    this.passThroughOutNode.gain.setTargetAtTime(passThroughGain, now, timeConstant);

    this.bypassNode.gain.cancelScheduledValues(now);
    this.bypassNode.gain.setTargetAtTime(bypassGain, now, timeConstant);
  }
}

export default AudioModule;
