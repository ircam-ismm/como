import BaseModule from './BaseModule.js';
import * as lfo from 'waves-lfo/common';

// @note - should be removed at some point
import Intensity from '../libs/lfo/Intensity';
import Orientation from '../libs/lfo/Orientation';


/**
 * @input - Stream[9]
 *   [id, time, period, accX, accY, accZ, gyroAlpha, gyroBeta, gyroGamma]
 * @output - Stream[11] [
 *   intensity
 *   enhancedIntensity
 *   orientation
 *   scaled gyro (deg / ms)
 * ]
 */
class MotionDescriptors extends BaseModule {
  constructor(graph, type, id, options) {
    options = Object.assign({ resamplingPeriod: 0.02 }, options);

    super(graph, type, id, options);

    this.outputFrame.data.intensity = [];
    this.outputFrame.data.accelerationBandpass5hz = [];
    this.outputFrame.data.orientation = [];
    this.outputFrame.data.rotationRateMs = [];

    this.propagate = this.propagate.bind(this);

    this.eventIn = new lfo.source.EventIn({
      frameType: 'vector',
      frameSize: 9,
      frameRate: 1, // dummy value updated on first received frame
    });

    this.accGyroSelect = new lfo.operator.Select({ indexes: [0, 1, 2, 3, 4, 5] });
    this.accSelect = new lfo.operator.Select({ indexes: [0, 1, 2] });
    this.gyroSelect = new lfo.operator.Select({ indexes: [3, 4, 5] });

    // intensity
    this.intensity = new Intensity({
      feedback: 0.7,
      gain: 0.07,
    });

    this.intensityNormSelect = new lfo.operator.Select({ index: 0 });

    // boost
    this.intensityClip = new lfo.operator.Clip({ min: 0, max: 1 });
    this.intensityPower = new lfo.operator.Power({ exponent: 0.25 });
    this.powerClip = new lfo.operator.Clip({ min: 0.15, max: 1 });
    this.powerScale = new lfo.operator.Scale({
      inputMin: 0.15,
      inputMax: 1,
      outputMin: 0,
      outputMax: 1,
    });

    // bandpass
    this.normalizeAcc = new lfo.operator.Multiplier({ factor: 1 / 9.81 });
    this.bandpass = new lfo.operator.Biquad({
      type: 'bandpass',
      q: 1,
      f0: 5,
    });

    this.bandpassGain = new lfo.operator.Multiplier({ factor: 1 });

    // orientation filter
    this.orientation = new Orientation();

    // gyroscopes scaling
    this.gyroScale = new lfo.operator.Multiplier({
      factor: [1/1000, 1/1000, 1/1000],
    });

    // merge and output
    this.merger = new lfo.operator.Merger({
      frameSizes: [1, 1, 3, 3, 3],
    });

    this.bridge = new lfo.sink.Bridge({
      processFrame: this.propagate,
      finalizeStream: this.propagate,
    });

    // intensity and bandpass
    this.eventIn.connect(this.accSelect);
    // intensity branch
    this.accSelect.connect(this.intensity);
    this.intensity.connect(this.intensityNormSelect);
    this.intensityNormSelect.connect(this.merger);
    // boost branch
    this.intensityNormSelect.connect(this.intensityClip);
    this.intensityClip.connect(this.intensityPower);
    this.intensityPower.connect(this.powerClip);
    this.powerClip.connect(this.powerScale);
    this.powerScale.connect(this.merger);
    // biquad branch
    this.accSelect.connect(this.normalizeAcc);
    this.normalizeAcc.connect(this.bandpass);
    this.bandpass.connect(this.bandpassGain);
    this.bandpassGain.connect(this.merger);

    // orientation
    this.eventIn.connect(this.accGyroSelect);
    this.accGyroSelect.connect(this.orientation);
    this.orientation.connect(this.merger);
    // gyroscpes
    this.eventIn.connect(this.gyroSelect);
    this.gyroSelect.connect(this.gyroScale);
    this.gyroScale.connect(this.merger);

    this.merger.connect(this.bridge);
  }

  async init() {
    this.eventIn.streamParams.frameRate = 1 / this.options.resamplingPeriod;
    await this.eventIn.init();
    await this.eventIn.start();
  }

  process(inputFrame) {
    // create a valid lfo frame
    const lfoFrame = {
      time: inputFrame[1],
      data: [],
    };

    for (let i = 0; i < inputFrame.data['accelerationIncludingGravity'].length; i++) {
      lfoFrame.data[i] = inputFrame.data['accelerationIncludingGravity'][i];
    }

    for (let i = 0; i < inputFrame.data['rotationRate'].length; i++) {
      lfoFrame.data[i + 3] = inputFrame.data['rotationRate'][i];
    }

    this.outputFrame.data.metas = inputFrame.data.metas;
    // pipe to lfo graph
    this.eventIn.processFrame(lfoFrame);
  }

  propagate(lfoFrame) {
    this.outputFrame.data.intensity[0] = lfoFrame.data[0];
    this.outputFrame.data.intensity[1] = lfoFrame.data[1];

    this.outputFrame.data.accelerationBandpass5hz[0] = lfoFrame.data[2];
    this.outputFrame.data.accelerationBandpass5hz[1] = lfoFrame.data[3];
    this.outputFrame.data.accelerationBandpass5hz[2] = lfoFrame.data[4];

    this.outputFrame.data.orientation[0] = lfoFrame.data[5];
    this.outputFrame.data.orientation[1] = lfoFrame.data[6];
    this.outputFrame.data.orientation[2] = lfoFrame.data[7];

    this.outputFrame.data.rotationRateMs[0] = lfoFrame.data[8];
    this.outputFrame.data.rotationRateMs[1] = lfoFrame.data[9];
    this.outputFrame.data.rotationRateMs[2] = lfoFrame.data[10];

    super.propagate(this.outputFrame);
  }
}

export default MotionDescriptors;
