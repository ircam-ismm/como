import BaseModule from './BaseModule';

class SelectAs extends BaseModule {
  constructor(graph, type, id, options) {
    options = Object.assign({ entries: [] }, options);
    super(graph, type, id, options);
  }

  execute(inputFrame) {
    // select and rename from options
    this.options.entries.forEach(entry => {
      const [src, dest] = entry;
      this.outputFrame.data[dest] = inputFrame.data[src];
    });

    return this.outputFrame;
  }
}

export default SelectAs;
