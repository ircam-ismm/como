import AudioModule from './AudioModule.js';
import helpers from '../helpers';

class AudioDestination extends AudioModule {
  constructor(graph, type, id, options) {
    options = Object.assign({ volume: 0, mute: false, pan: 0 }, options);

    super(graph, type, id, options);

    // const now = this.audioContext.currentTime;
    // const volumeGain = helpers.math.decibelToLinear(options.volume);
    // const muteGain = options.mute ? 0 : 1;

    this.audioOutNode.connect(this.graph.como.audioMaster);
    // recycle existing passThroughIn and passThroughOut nodes
    // @todo - panning, use splitter and merger for Safari
    this.mute = this.passThroughInNode;
    this.volume = this.passThroughOutNode;
    this.mute.connect(this.volume);

    this._updateVolume(this.options.volume);
    this._updateMute(this.options.mute);
  }

  destroy() {
    this.volume.disconnect();
    this.mute.disconnect();
  }

  connect() {
    // cannot be connected on another module
    throw new Error(`AudioDestination module cannot be connected to another module`);
  }

  updateOptions(options) {
    // do not call super to prevent default `AudioModule` bypass behavior
    this.options = Object.assign(this.options, options);

    this._updateVolume(this.options.volume);
    this._updateMute(this.options.mute);
  }

  _updateVolume(value) {
    const gain = helpers.math.decibelToLinear(value);
    const now = this.audioContext.currentTime;

    this.volume.gain.cancelScheduledValues(now);
    this.volume.gain.setTargetAtTime(gain, now, 0.001);
  }

  _updateMute(value) {
    const gain = value ? 0 : 1;
    const now = this.audioContext.currentTime;

    this.mute.gain.cancelScheduledValues(now);
    this.mute.gain.setTargetAtTime(gain, now, 0.005);
  }

}

export default AudioDestination;
