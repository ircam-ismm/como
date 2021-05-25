import BaseModule from './BaseModule.js';

// @note - should be replaced at some point
import Intensity from '../libs/lfo/Intensity';
import Orientation from '../libs/lfo/Orientation';
import Select from '../libs/lfo/Select';
import EventIn from '../libs/lfo/EventIn';
import Clip from '../libs/lfo/Clip';
import Power from '../libs/lfo/Power';
import Scale from '../libs/lfo/Scale';
import Multiplier from '../libs/lfo/Multiplier';
import Biquad from '../libs/lfo/Biquad';
import Merger from '../libs/lfo/Merger';
import Bridge from '../libs/lfo/Bridge';


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

    // @todo - review intensity naming
    this.outputFrame.data.intensity = { linear: 0, compressed: 0 };
    this.outputFrame.data.accelerationBandpass5hz = { x: 0, y: 0, z: 0 };
    this.outputFrame.data.orientation = { x: 0, y: 0, z: 0 };
    this.outputFrame.data.rotationRateMs = { alpha: 0, beta: 0, gamma: 0 };

    this.propagate = this.propagate.bind(this);

    this.eventIn = new EventIn({
      frameType: 'vector',
      frameSize: 9,
      frameRate: 1 / this.options.resamplingPeriod,
    });

    this.accGyroSelect = new Select({ indexes: [0, 1, 2, 3, 4, 5] });
    this.accSelect = new Select({ indexes: [0, 1, 2] });
    this.gyroSelect = new Select({ indexes: [3, 4, 5] });

    // intensity
    this.intensity = new Intensity({
      feedback: 0.7,
      gain: 0.07,
    });

    this.intensityNormSelect = new Select({ index: 0 });

    // boost
    this.intensityClip = new Clip({ min: 0, max: 1 });
    this.intensityPower = new Power({ exponent: 0.25 });
    this.powerClip = new Clip({ min: 0.15, max: 1 });
    this.powerScale = new Scale({
      inputMin: 0.15,
      inputMax: 1,
      outputMin: 0,
      outputMax: 1,
    });

    // bandpass
    this.normalizeAcc = new Multiplier({ factor: 1 / 9.81 });
    this.bandpass = new Biquad({
      type: 'bandpass',
      q: 1,
      f0: 5,
    });

    this.bandpassGain = new Multiplier({ factor: 1 });

    // orientation filter
    this.orientation = new Orientation();

    // gyroscopes scaling
    this.gyroScale = new Multiplier({
      factor: [1/1000, 1/1000, 1/1000],
    });

    // merge and output
    this.merger = new Merger({
      frameSizes: [1, 1, 3, 3, 3],
    });

    this.bridge = new Bridge({
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
    await this.eventIn.init();
    await this.eventIn.start();
  }

  process(inputFrame) {
    // create a valid lfo frame
    const lfoFrame = {
      time: inputFrame.data.metas.time,
      data: [],
    };

    lfoFrame.data[0] = inputFrame.data.accelerationIncludingGravity.x;
    lfoFrame.data[1] = inputFrame.data.accelerationIncludingGravity.y;
    lfoFrame.data[2] = inputFrame.data.accelerationIncludingGravity.z;
    lfoFrame.data[3] = inputFrame.data.rotationRate.alpha;
    lfoFrame.data[4] = inputFrame.data.rotationRate.beta;
    lfoFrame.data[5] = inputFrame.data.rotationRate.gamma;
    // pipe to lfo graph
    this.eventIn.processFrame(lfoFrame);
  }

  propagate(lfoFrame) {
    this.outputFrame.data.intensity.linear = lfoFrame.data[0];
    this.outputFrame.data.intensity.compressed = lfoFrame.data[1];

    this.outputFrame.data.accelerationBandpass5hz.x = lfoFrame.data[2];
    this.outputFrame.data.accelerationBandpass5hz.y = lfoFrame.data[3];
    this.outputFrame.data.accelerationBandpass5hz.z = lfoFrame.data[4];

    this.outputFrame.data.orientation.x = lfoFrame.data[5];
    this.outputFrame.data.orientation.y = lfoFrame.data[6];
    this.outputFrame.data.orientation.z = lfoFrame.data[7];

    this.outputFrame.data.rotationRateMs.alpha = lfoFrame.data[8];
    this.outputFrame.data.rotationRateMs.beta = lfoFrame.data[9];
    this.outputFrame.data.rotationRateMs.gamma = lfoFrame.data[10];

    super.propagate(this.outputFrame);
  }
}

export default MotionDescriptors;
