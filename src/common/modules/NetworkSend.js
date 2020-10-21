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

    // init with current strema value
    this.streamSource = this.graph.player.get('streamSource');
  }

  destroy() {
    this.unsubscribe();
  }

  // override process and not execute to make sure they is no further node
  // this is a deadend
  process(frame) {
    if (this.streamSource) {
      // how to generalize that (automatic binary codec) ?
      this.data[0] = frame.data.metas.id;
      this.data[1] = frame.data.metas.time;
      this.data[2] = frame.data.metas.period;

      this.data[3] = frame.data.accelerationIncludingGravity.x;
      this.data[4] = frame.data.accelerationIncludingGravity.y;
      this.data[5] = frame.data.accelerationIncludingGravity.z;

      this.data[6] = frame.data.rotationRate.alpha;
      this.data[7] = frame.data.rotationRate.beta;
      this.data[8] = frame.data.rotationRate.gamma;

      this.graph.como.client.socket.sendBinary('stream', this.data);
    }
  }
}

export default NetworkSend;
