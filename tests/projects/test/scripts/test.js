const {
  audioContext,
  audioBufferLoader,
  como,
} = getGlobalScriptingContext();

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
    },
    // initValues: presets.preset2,
  };
}

export async function enter(context) {
  const { output, state, soundbank, scriptName } = context;
}

export async function exit(context) {
  const { output, state, soundbank, scriptName } = context;
}

export async function process(context, frame) {
  const { output, state, soundbank, scriptName } = context;
  // propagate back source for comparison
  state.set({ frame });
}
