import BaseModule from './BaseModule.js';
import Ticker from '@ircam/ticker';
import { copyFrameData } from './helpers';

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
    const copy = {};
    const inputData = inputFrame.data;
    // copy inputFrame.data into new object as the source reuses the same instance
    copyFrameData(inputData, copy);

    // papre `outputFrame.data` structure to simplify logic in `proapgate`
    for (let name in inputData) {
      if (Array.isArray(inputData[name])) {
        if (!(name in this.outputFrame.data)) {
          this.outputFrame.data[name] = new Array(inputData[name].length);
        }
      } else if (Object.prototype.toString.call(inputData[name]) === '[object Object]') {
        if (!(name in this.outputFrame.data)) {
          this.outputFrame.data[name] = {};

          for (let key in inputData[name]) {
            this.outputFrame.data[name][key] = 0; // do we assume a source can only produce numbers ?
          }
        }
      } else {
        if (!(name in this.outputFrame.data)) {
          this.outputFrame.data[name] = 0;
        }
      }
    }

    this.stack[this.bufferedFrameIndex] = copy;
    this.bufferedFrameIndex += 1;

    if (this.ticker === null) {
      const period = this.options.resamplingPeriod * 1000; // to ms
      this.ticker = new Ticker(period, this.propagate);
      this.ticker.start();
    }
  }

  propagate() {
    if (this.bufferedFrameIndex === 0) {
      // update timetag and output last frame
      this.outputFrame.data.metas.time = this.graph.como.experience.plugins['sync'].getSyncTime();

      super.propagate(this.outputFrame);
    } else {
      const outputData = this.outputFrame.data;

      for (let name in outputData) {
        if (Array.isArray(outputData[name])) {
          const entryLength = outputData[name].length;
          // reset
          for (let i = 0; i < entryLength; i++) {
            outputData[name][i] = 0;
          }

          // sums
          for (let i = 0; i < this.bufferedFrameIndex; i++) {
            for (let j = 0; j < entryLength; j++) {
              outputData[name][j] += this.stack[i][name][j];
            }
          }

          // mean
          for (let i = 0; i < entryLength; i++) {
            outputData[name][i] /= this.bufferedFrameIndex;
          }
        } else if (Object.prototype.toString.call(outputData[name]) === '[object Object]') {
          // reset
          for (let key in outputData[name]) {
            outputData[name][key] = 0;
          }

          // sum
          for (let i = 0; i < this.bufferedFrameIndex; i++) {
            for (let key in outputData[name]) {
              outputData[name][key] += this.stack[i][name][key];
            }
          }

          // mean
          for (let key in outputData[name]) {
            outputData[name][key] /= this.bufferedFrameIndex;
          }
        } else {
          // reset
          outputData[name] = 0;

          // sum
          for (let i = 0; i < this.bufferedFrameIndex; i++) {
            outputData[name] += this.stack[i][name];
          }
          // mean
          outputData[name] /= this.bufferedFrameIndex;
        }
      }

      // override metas
      if (this.stack[0].metas) { // this condition is for testing purposes
        this.outputFrame.data.metas.id = this.stack[0].metas.id;
        this.outputFrame.data.metas.time = this.graph.como.experience.plugins['sync'].getSyncTime();
        this.outputFrame.data.metas.period = this.options.resamplingPeriod;
      }

      this.bufferedFrameIndex = 0;

      super.propagate(this.outputFrame);
    }
  }
}

export default InputResampler;

