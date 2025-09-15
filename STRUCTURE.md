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

- Node:
  + a node / device in the network
- Project:
  + set of soundfiles, scripts and sessions,
  + only 1 project can run at a given time
- Session:
  + subset of project soundfile
  + default script
  + set of players
- Source:
  + a source of motion sensors
- Script:
  + dynamic script to process Sources and make sound
- Player:
  + tuple of Source + Script

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
