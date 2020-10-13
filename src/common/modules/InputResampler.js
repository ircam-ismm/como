import BaseModule from './BaseModule.js';
import Ticker from '@ircam/ticker';

/**
 * There is a problem w/ this node,
 * Module that naïvely resample an incomming vector frame at a given framerate.
 * If 0 frame has been received since last tick, output last values.
 * If more than 1 frame since last tick, output the mean of all buffered frames.
 *
 * @memberof operator
 *
 * @todo - add option for output type (i.e. mean, max, min, last, median, etc.)
 *
 * @param {Object} [options] - Override default options.
 * @param {Number} [options.frameRate=20] - output sampling rate (in Hz)
 *
 */
class InputResampler extends BaseModule {
  constructor(graph, type, id, options) {
    options = Object.assign({ resamplingPeriod: 0.02 }, options);
    super(graph, type, id, options);

    this.ticker = null;
    this.stack = [];
    this.bufferedFrameIndex = 0;

    this.propagate = this.propagate.bind(this);
  }

  destroy() {
    if (this.ticker !== null) {
      this.ticker.stop();
    }
  }

  process(inputFrame) {
    // copy inputFrame.data as the source may reuse the same instance
    const frameData = {};

    for (let name in inputFrame.data) {
      frameData[name] = [];

      for (let i = 0; i < inputFrame.data[name].length; i++) {
        frameData[name][i] = inputFrame.data[name][i];
      }

      // create `outputFrame.data[name]` array instance with proper length
      if (!(name in this.outputFrame.data)) {
        this.outputFrame.data[name] = new Array(inputFrame.data[name].length);
      }
    }

    // we keep a separate index pointer to reuse the stack and not allocate
    // a new Array on each `propagate` call
    this.stack[this.bufferedFrameIndex] = frameData;
    this.bufferedFrameIndex += 1;

    if (this.ticker === null) {
      const period = this.options.resamplingPeriod * 1000; // to ms
      this.ticker = new Ticker(period, this.propagate);
      this.ticker.start();
    }
  }

  propagate() {
    if (this.bufferedFrameIndex === 0) {
      // output last frame
      super.propagate(this.outputFrame);
    } else {
      const outputData = this.outputFrame.data;

      for (let name in outputData) {
        const entryLength = outputData[name].length;
        // reset
        for (let i = 0; i < entryLength; i++) {
          outputData[name][i] = 0;
        }

        // sums
        for (let i = 0; i < this.bufferedFrameIndex; i++) {
          // console.log(this.stack[i][name]);
          for (let j = 0; j < entryLength; j++) {
            outputData[name][j] += this.stack[i][name][j];
          }
        }

        // mean
        for (let i = 0; i < entryLength; i++) {
          outputData[name][i] /= this.bufferedFrameIndex;
        }
      }

      // override sourceId and period
      outputData.metas[0] = this.stack[0].metas[0];
      outputData.metas[2] = this.options.resamplingPeriod;

      this.bufferedFrameIndex = 0;

      super.propagate(this.outputFrame);
    }
  }
}

export default InputResampler;

