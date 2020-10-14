import BaseSource from '../../common/sources/BaseSource';

// @todo - create a SineSource (probably more usefull for testing)
class RandomValues extends BaseSource {
  constructor(como, streamId = 0, { period = 0.05 } = {}) {
    super();

    this.como = como;
    this.streamId = streamId;
    this.period = period;

    this.buffer = new Float32Array(9);
    this.data = {
      metas: {},
      accelerationIncludingGravity: {},
      rotationRate: {},
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
    const syncTime = this.como.experience.plugins['sync'].getSyncTime();
    // metas
    this.data.metas.id = this.streamId;
    this.data.metas.time = syncTime;
    this.data.metas.period = this.period;
    // acceleration
    this.data.accelerationIncludingGravity.x = Math.random();
    this.data.accelerationIncludingGravity.y = Math.random();
    this.data.accelerationIncludingGravity.z = Math.random();
    // rotation
    this.data.rotationRate.alpha = Math.random();
    this.data.rotationRate.beta = Math.random();
    this.data.rotationRate.gamma = Math.random();

    this.emit(this.data);
  }
}

export default RandomValues;
