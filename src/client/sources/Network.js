import BaseSource from './BaseSource';

class Network extends BaseSource {
  constructor(como, streamId) {
    super();

    // this.data
    this.streamId = streamId;

    this.data = {
      metas: [],
      accelerationIncludingGravity: [],
      rotationRate: [],
    };

    this.process = this.process.bind(this);

    como.client.socket.addBinaryListener('stream', this.process);
  }

  process(frame) {
    if (frame[0] === this.streamId) {
      this.data.metas[0] = frame[0];
      this.data.metas[1] = frame[1];
      this.data.metas[2] = frame[2];
      // acceleration
      this.data.accelerationIncludingGravity[0] = frame[3];
      this.data.accelerationIncludingGravity[1] = frame[4];
      this.data.accelerationIncludingGravity[2] = frame[5];
      // rotation
      this.data.rotationRate[0] = frame[6];
      this.data.rotationRate[1] = frame[7];
      this.data.rotationRate[2] = frame[8];

      this.emit(this.data);
    }
  }
}

export default Network;
