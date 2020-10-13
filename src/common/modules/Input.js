import BaseModule from './BaseModule';

// `Input` is almost a pass through node in which `Sources` are connected.
// They just create module compliant frames from the given data.
class Input extends BaseModule {
  constructor(graph, type, id, options) {
    super(graph, type, id);
  }

  // format raw data to `frame` format to propagate into graph.
  execute(inputData) {
    const outputData = this.outputFrame.data;

    for (let name in inputData) {
      if (Array.isArray(inputData[name])) {
        if (!outputData[name]) {
          outputData[name] = [];
        }

        for (let i = 0; i < inputData[name].length; i++) {
          outputData[name][i] = inputData[name][i];
        }
      // handle objects
      } else if (Object.prototype.toString.call(inputData[name]) === '[object Object]') {
        if (!outputData[name]) {
          outputData[name] = {};
        }

        for (let key in inputData[name]) {
          outputData[name][key] = inputData[name][key];
        }
      // consider everything else as a scalar
      } else {
        outputData[name] = inputData[name];
      }
    }

    return this.outputFrame;
  }
}

export default Input;
