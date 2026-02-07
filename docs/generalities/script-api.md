# Scripts API

```js
/**
 * Global objects that are passed to all script
 */
const {
  audioContext,
  audioBufferLoader,
  como,
} = getGlobalScriptingContext();

/**
 * Define a class description and init values for this script. Each script instance
 * (e.g. on different nodes) will create its own shared state instance.
 * cf. https://soundworks.dev/soundworks/SharedState.html
 */
export async function defineSharedState(como) {
  return {
    classDescription: {
      play: {
        type: 'boolean',
        event: true,
      },
      energy: {
        type: 'float',
        default: 0.5,
      },
    },
    // initValues:  { play: false },
  };
}

/**
 * Function executed when the script is created / initialized.
 * e.g. Initialize objects or logic that should live for the whole lifecycle of the script
 */
export async function enter(context) {
  const { output, state, soundbank, scriptName } = context;
  const buffer = await como.soundbankManager.getBuffer('10-shake.mp3');

  state.onUpdate(updates => {
    if ('play' in updates) {
      const now = audioContext.currentTime;
      const src = new AudioBufferSourceNode(audioContext, { buffer });
      src.connect(output);
      src.start(now);
      src.stop(now + 1);
    }
  });
}

/**
 * Function executed when the script is deleted.
 * e.g. clean schedulers, timers, etc.
 */
export async function exit(context) {
  const { output, state, soundbank, scriptName } = context;
  // ...
}

/**
 * Function executed when a new data frame from the associated is source is received.
 * e.g. process the frame and map to some output
 */
export async function process(context, frame) {
  const { output, state, soundbank, scriptName } = context;
  // ...
}
```
