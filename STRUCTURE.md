## Project file structure

[project-slug]
  project-infos.json
  soundfiles/
  scripts/
  recordings/
  presets/
  sessions/
    [session-slug]
      soundfiles.json
      infos.json


## Ontology

- `ComoNode`:
  + a node / device in the network
- `Project`:
  + set of soundfiles, scripts and sessions,
  + only 1 project can run at a given time
- `Session`:
  + subset of project soundfiles (actual loading should be done by `Player`)
  + default script
  + set of players
  + placeholder for managers' data, e.g. xmm
- `Player`:
  + associated to a Node
  + link a Source with a Script
- `Source`:
  + a source of motion sensors
- `Script`:
  + dynamic script to process Sources and make noises
- `Topology`
  + associate devices (cf. como.id) to players and sessions
  + can be stored and recalled

## Scripts API

@todo - define where we should pass the session soundfiles (`process`?)

```js
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
  const { como, audioContext, sessionSoundFiles, scriptSharedState } = context;
}

export async function exit(context) {
  const { como, audioContext, sessionSoundFiles, scriptSharedState } = context;
}

export async function process(context, frame) {
  const { como, audioContext, sessionSoundFiles, scriptSharedState } = context;
}
```
