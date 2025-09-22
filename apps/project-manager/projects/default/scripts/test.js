const presets = {
  preset1: {
    myBoolean: false,
  },
  preset2: {
    myBoolean: true,
  },
}

export async function defineSharedState(como) {
  return {
    description: {
      myBoolean: {
        type: 'boolean',
        default: false,
      }
      // ...
    },
    initValues: presets.preset2,
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
}