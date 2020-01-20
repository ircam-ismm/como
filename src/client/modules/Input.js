import BaseModule from './BaseModule';

// `Input` is almost a pass through node in which `Sources` are connected.
// They just create module compliant frames from the given data.
class Input extends BaseModule {
  constructor(graph, type, id, options) {
    super(graph, type, id);
  }

  // format raw data to `frame` format to propagate into graph.
  execute(data) {
    for (let name in data) {
      if (!(name in this.outputFrame.data)) {
        this.outputFrame.data[name] = [];
      }

      for (let i = 0; i < data[name].length; i++) {
        this.outputFrame.data[name][i] = data[name][i];
      }
    }

    return this.outputFrame;
  }
}

export default Input;
