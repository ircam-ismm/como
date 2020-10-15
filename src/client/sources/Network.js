import BaseSource from '../../common/sources/BaseSource';

class Network extends BaseSource {
  constructor(como, streamId) {
    super();

    // this.data
    this.streamId = streamId;

    this.data = {
      metas: {},
      accelerationIncludingGravity: {},
      rotationRate: {},
    };

    this.process = this.process.bind(this);

    como.client.socket.addBinaryListener('stream', this.process);
  }

  process(frame) {
    if (frame[0] === this.streamId) {
      // how to generalize that (automatic binary codec) ?
      this.data.metas.id = frame[0];
      this.data.metas.time = frame[1];
      this.data.metas.period = frame[2];
      // acceleration
      this.data.accelerationIncludingGravity.x = frame[3];
      this.data.accelerationIncludingGravity.y = frame[4];
      this.data.accelerationIncludingGravity.z = frame[5];
      // rotation
      this.data.rotationRate.alpha = frame[6];
      this.data.rotationRate.beta = frame[7];
      this.data.rotationRate.gamma = frame[8];

      this.emit(this.data);
    }
  }
}

export default Network;
