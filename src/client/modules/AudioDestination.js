import AudioModule from './AudioModule.js';
import helpers from '../helpers';

class AudioDestination extends AudioModule {
  constructor(graph, type, id, options) {
    options = Object.assign({ volume: 0, mute: false, pan: 0 }, options);
    super(graph, type, id, options);

    const now = this.audioContext.currentTime;
    const volumeGain = helpers.math.decibelToLinear(options.volume);
    const muteGain = options.mute ? 0 : 1;

    this.volume = this.audioContext.createGain();
    this.volume.connect(this.graph.como.audioMaster);
    this.volume.gain.value = volumeGain;
    // this.volume.gain.setValueAtTime(volumeGain, now);
    // this.currentVolume = volumeGain;

    this.mute = this.audioContext.createGain();
    this.mute.connect(this.volume);
    this.mute.gain.value = muteGain;
    this.mute.gain.setValueAtTime(muteGain, now);

    this.audioInNode.connect(this.mute);

    // @todo - implement panning
    // need to do something clean with splitter and merger because of Safari
    // or assume we use a modern API (so we use a polyfill...)
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
    super.updateOptions(options);

    this._updateVolume(this.options.volume);
    this._updateMute(this.options.mute);
  }

  _updateVolume(value) {
    const gain = helpers.math.decibelToLinear(value);
    // const now = this.audioContext.currentTime;

    // @todo - this is NOT clean...
    // this.volume.gain.cancelScheduledValues(now);
    // this.volume.gain.setValueAtTime(this.currentVolume, now);
    // this.volume.gain.linearRampToValueAtTime(gain, now + 0.005);

    // @note - // this is NOT clean neither... this is f****** insane...
    // this.volume.gain.cancelAndHoldAtTime(now);
    // this.volume.gain.linearRampToValueAtTime(gain, now + 0.01);
    // this.currentVolume = gain;

    // ok... this is the most clean at least on Android (to be tested on iOS)
    this.volume.gain.value = gain;
  }

  _updateMute(value) {
    const gain = value ? 0 : 1;
    const now = this.audioContext.currentTime;

    // this is clean
    this.mute.gain.cancelScheduledValues(now);
    this.mute.gain.setValueAtTime(1 - gain, now);
    this.mute.gain.linearRampToValueAtTime(gain, now + 0.005);
  }

}

export default AudioDestination;
