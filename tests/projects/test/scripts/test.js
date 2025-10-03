const G = 9.81;

export async function defineSharedState(como) {
  return {
    classDescription: {
      myBoolean: {
        type: 'boolean',
        default: false,
      },
      // ...
      frame: {
        type: 'any',
        acknowledge: false,
        default: [],
      },
      intensity: {
        type: 'float',
        acknowledge: false,
        default: 0,
      },
    },
    // initValues: presets.preset2,
  };
}

export async function enter(context) {
  const { como, audioContext, sessionSoundFiles, sharedState } = context;
}

export async function exit(context) {
  const { como, audioContext, sessionSoundFiles, sharedState } = context;
}

export async function process(context, frame) {
  const { como, audioContext, sessionSoundFiles, sharedState } = context;

  const { x, y, z } = frame[0].accelerometer;
  const intensity = Math.sqrt(Math.pow(x / G, 2) * Math.pow(y / G, 2) + Math.pow(y / G, 2) / 3);
  sharedState.set({ frame, intensity });
}
