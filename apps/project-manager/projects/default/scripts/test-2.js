
export async function defineSharedState(como) {
  return {
    classDescription: {
      play: {
        type: 'boolean',
        default: true,
      },
      energy: {
        type: 'float',
        default: 0.5,
      },
      coucou: {
        type: 'float',
        default: 0,
      },
    },
    // initValues:  { play: false },
  };
}

let intervalId;
let gainNode;

export async function enter(context) {
  const { scriptName, audioContext, outputNode, sharedState, soundbank } = context;
  console.log('enter script', scriptName, soundbank);

  gainNode = audioContext.createGain();
  gainNode.connect(outputNode);

  sharedState.onUpdate(updates => {
    gainNode.gain.value = sharedState.get('energy');
  }, true);

  intervalId = setInterval(() => {
    if (sharedState.get('play') === false) {
      return;
    }

    const osc = audioContext.createOscillator();
    osc.frequency.value = Math.random() * 500 + 200;
    osc.connect(gainNode);
    osc.start();
    osc.stop(audioContext.currentTime + 0.1);

    sharedState.set('coucou', Math.random());
  }, 200);
}

export async function exit(context) {
  const { scriptName, audioContext, outputNode, sharedState, soundbank } = context;
  console.log('exit script', scriptName, soundbank);

  clearInterval(intervalId);
}

export async function process(context, frame) {
  const { audioContext, sharedState } = context;

  const G = 9.81;
  const { accelerometer } = frame[0];
  const { x, y, z } = accelerometer;
  const energy = Math.sqrt(Math.pow(x / G, 2) + Math.pow(y / G, 2) + Math.pow(z / G, 2)) - 1;

  sharedState.set({ energy });
  gainNode.gain.setTargetAtTime(energy, audioContext.currentTime, 0.003);
}
