import BaseSource from './BaseSource';

// @todo - create a SineSource (probably more usefull for testing)
class RandomValues extends BaseSource {
  constructor(como, streamId = 0, period = 0.05) {
    super();

    this.como = como;
    this.streamId = streamId;
    this.period = period;

    this.buffer = new Float32Array(9);
    this.data = {
      metas: [],
      accelerationIncludingGravity: [],
      rotationRate: [],
    };

    this.intervalId = null;
  }

  addListener(callback) {
    super.addListener(callback);

    if (this.listeners.size === 1) {
      this.intervalId = setInterval(() => this.process(), this.period * 1000);
    }
  }

  removeListener(callback) {
    super.removeListener(callback);

    if (this.listeners.size === 0) {
      clearInterval(this.intervalId);
    }
  }

  process() {
    // @note - using audio time as a synced clock source is not very accurate
    // on Android phones
    const syncTime = this.como.experience.services['sync'].getSyncTime();
    // metas
    this.data.metas[0] = this.streamId;
    this.data.metas[1] = syncTime;
    this.data.metas[2] = this.period;
    // acceleration
    this.data.accelerationIncludingGravity[0] = Math.random();
    this.data.accelerationIncludingGravity[1] = Math.random();
    this.data.accelerationIncludingGravity[2] = Math.random();
    // rotation
    this.data.rotationRate[0] = Math.random();
    this.data.rotationRate[1] = Math.random();
    this.data.rotationRate[2] = Math.random();

    this.emit(this.data);
  }
}

export default RandomValues;
