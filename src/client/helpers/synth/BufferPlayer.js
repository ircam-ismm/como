
class BufferPlayer {
  constructor(audioContext) {
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
    const now = this.audioContext.currentTime;

    const env = this.audioContext.createGain();
    env.connect(this.output);
    env.gain.value = 0;
    env.gain.setValueAtTime(0, now);
    env.gain.linearRampToValueAtTime(1, now + fadeInDuration);

    const src = this.audioContext.createBufferSource();
    src.connect(env);
    src.buffer = buffer;
    src.loop = loop;
    src.start(now);

    this.src = src;
    this.env = env;
  }

  stop({
    fadeOutDuration = 1,
  } = options) {
    if (this.src && this.env) {
      const now = this.audioContext.currentTime;

      this.env.gain.cancelScheduledValues(now);
      this.env.gain.setValueAtTime(1, now);
      this.env.gain.linearRampToValueAtTime(0, now + fadeOutDuration);
      this.src.stop(now + fadeOutDuration);

      this.src = null;
      this.env = null;
    }
  }
}

export default BufferPlayer;
