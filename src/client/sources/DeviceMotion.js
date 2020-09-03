import devicemotion from '@ircam/devicemotion';
import BaseSource from '../../common/sources/BaseSource';

class DeviceMotion extends BaseSource {
  constructor(como, streamId = null) {
    super();

    if (streamId === null) {
      throw new Error('DeviceMotion source requires a streamId');
    }

    if (!como.hasDeviceMotion) {
      throw new Error('DeviceMotion source requires access to deviceMotion');
    }

    this.como = como;
    this.streamId = streamId;

    this.data = {
      metas: [],
      accelerationIncludingGravity: [],
      rotationRate: [],
    };

    this.process = this.process.bind(this);
  }

  addListener(callback) {
    super.addListener(callback);

    if (this.listeners.size === 1) {
      devicemotion.addEventListener(this.process);
    }
  }

  removeListener(callback) {
    super.removeListener(callback);

    if (this.listeners.size === 0) {
      devicemotion.removeEventListener(this.process);
    }
  }

  process(e) {
    const syncTime = this.como.experience.plugins['sync'].getSyncTime();

    // metas
    this.data.metas[0] = this.streamId;
    this.data.metas[1] = syncTime;
    this.data.metas[2] = e.interval / 1000;
    // acceleration
    this.data.accelerationIncludingGravity[0] = e.accelerationIncludingGravity.x;
    this.data.accelerationIncludingGravity[1] = e.accelerationIncludingGravity.y;
    this.data.accelerationIncludingGravity[2] = e.accelerationIncludingGravity.z;
    // rotation
    this.data.rotationRate[0] = e.rotationRate.alpha;
    this.data.rotationRate[1] = e.rotationRate.beta;
    this.data.rotationRate[2] = e.rotationRate.gamma;

    this.emit(this.data);
  }
}

export default DeviceMotion;
