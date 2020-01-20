
// algos
import MovingAverage from './algo/MovingAverage.js';

// math
import decibelToLinear from './math/decibelToLinear.js';
import decibelToPower from './math/decibelToPower.js';
import linearToDecibel from './math/linearToDecibel.js';
import powerToDecibel from './math/powerToDecibel.js';
import scale from './math/scale.js';

// fx


// synths
import BufferPlayer from './synth/BufferPlayer.js';

export default {
  algo: {
    MovingAverage,
  },
  math: {
    decibelToLinear,
    decibelToPower,
    linearToDecibel,
    powerToDecibel,
    scale,
  },
  fx: {

  },
  synth: {
    BufferPlayer,
  },
};

