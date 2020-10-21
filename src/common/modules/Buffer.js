import BaseModule from './BaseModule';

// used by server.Session to record transformed stream
class Buffer extends BaseModule {
  constructor(graph, type, id, options) {
    super(graph, type, id, options);

    this.reset();
  }

  getData() {
    return this.data;
  }

  reset() {
    this.data = [];
  }

  process(inputFrame) {
    const frame = [];

    for (let i = 0; i < inputFrame.data.length; i++) {
      frame[i] = inputFrame.data[i];
    }

    this.data.push(frame);
  }
}

export default Buffer;
