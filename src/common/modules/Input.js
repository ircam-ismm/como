import BaseModule from './BaseModule';
import { copyFrameData } from './helpers';

// `Input` is almost a pass through node in which `Sources` are connected.
// They just create module compliant frames from the given data.
class Input extends BaseModule {
  constructor(graph, type, id, options) {
    super(graph, type, id);
  }

  // format raw data to `frame` format to propagate into graph.
  execute(inputData) {
    const outputData = this.outputFrame.data;

    copyFrameData(inputData, outputData);

    return this.outputFrame;
  }
}

export default Input;
