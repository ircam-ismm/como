import BaseModule from './BaseModule';

class NetworkSend extends BaseModule {
  constructor(graph, type, id, options) {
    super(graph, type, id, options);

    this.data = new Float32Array(9);
    this.streamSource = false;

    this.unsubscribe = this.graph.player.subscribe(updates => {
      if ('streamSource' in updates) {
        this.streamSource = updates['streamSource'];
      }
    });
  }

  destroy() {
    this.unsubscribe();
  }

  // override process and not execute to make sure they is no further node
  // this is a deadend
  process(frame) {
    if (this.streamSource) {
      this.data[0] = frame.data.metas[0];
      this.data[1] = frame.data.metas[1];
      this.data[2] = frame.data.metas[2];

      this.data[3] = frame.data.accelerationIncludingGravity[0];
      this.data[4] = frame.data.accelerationIncludingGravity[1];
      this.data[5] = frame.data.accelerationIncludingGravity[2];

      this.data[6] = frame.data.rotationRate[0];
      this.data[7] = frame.data.rotationRate[1];
      this.data[8] = frame.data.rotationRate[2];

      this.graph.como.client.socket.sendBinary('stream', this.data);
    }
  }
}

export default NetworkSend;
