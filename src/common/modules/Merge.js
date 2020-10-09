import BaseModule from './BaseModule';

/**
 * Merge two stream without making assumptions on how to merge them
 * outputs only when all stream have been received at least once, if a stream
 * is received before other streams are received, its values are simply replaced
 *
 * At the différence of other streams, this objet output an array of all received
 * frames.
 *
 * Should be use mainly before a user defined script
 *
 * output.data = [inputFrame1, inputFrame2]
 */
class Merge extends BaseModule {
  constructor(graph, type, id, options) {
    super(graph, type, id, options);

    this.inputIds = null;

    this._inputs = new Set();
    this.inputs = {
      add: (value) => {
        this._inputs.add(value);
        this._resetStack();
      },
      delete: (value) => {
        this._inputs.delete(value);
        this._resetStack();
      },
      clear: () => {
        this._inputs.clear();
        this._resetStack();
      },
    };

    this._resetStack();
  }

  _resetStack() {
    // reset output frame
    this.inputIds = Array.from(this._inputs).map(i => i.id);
    this.stack = [];
  }

  process(inputFrame) {
    const inputIndex = this.inputIds.indexOf(inputFrame.id);
    // console.log(inputFrame.id, inputIndex);
    this.stack[inputIndex] = inputFrame;

    let propagate = true;

    for (let i = 0; i < this.inputIds.length; i++) {
      if (!this.stack[i]) {
        propagate = false;
      }
    }

    if (propagate) {
      const outputData = this.outputFrame.data;
      // merge every entries in stack[n].data in outputFrame.data
      for (let i = 0; i < this.inputIds.length; i++) {
        const inputData = this.stack[i].data;

        for (let name in inputData) {
          // handle arrays
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
      }

      super.propagate(this.outputFrame);

      // reset stack for next call
      for (let i = 0; i < this.inputIds.length; i++) {
        this.stack[i] = undefined;
      }
    }
  }
}

export default Merge;
