
class SyncedBufferPlayer {
  constructor(pluginSync, audioContext) {
    this.pluginSync = pluginSync;
    this.audioContext = audioContext;
    this.src = null;
    this.env = null;

    this.output = audioContext.createGain();
  }

  connect(dest) {
    this.output.connect(dest);
  }

  disconnect(dest) {
    this.output.disconnect();
  }

  start(buffer, {
    fadeInDuration = 1,
    loop = true,
  } = options) {
    const syncTime = this.pluginSync.getSyncTime();
    const audioTime = this.audioContext.currentTime;
    // we just compute offset according to sync origin
    const offset = syncTime % buffer.duration;

    const env = this.audioContext.createGain();
    env.connect(this.output);
    env.gain.value = 0;
    env.gain.setValueAtTime(0, audioTime);
    env.gain.linearRampToValueAtTime(1, audioTime + fadeInDuration);

    const src = this.audioContext.createBufferSource();
    src.connect(env);
    src.buffer = buffer;
    src.loop = loop;
    src.start(audioTime, offset);

    this.src = src;
    this.env = env;
  }

  stop({
    fadeOutDuration = 1,
  } = options) {
    if (this.src && this.env) {
      const audioTime = this.audioContext.currentTime;

      this.env.gain.cancelScheduledValues(audioTime);
      this.env.gain.setValueAtTime(1, audioTime);
      this.env.gain.linearRampToValueAtTime(0, audioTime + fadeOutDuration);
      this.src.stop(audioTime + fadeOutDuration);

      this.src = null;
      this.env = null;
    }
  }
}

export default SyncedBufferPlayer;

