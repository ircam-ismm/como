export default {
  name: {
    type: 'string',
    default: '',
  },

  audioFiles: {
    type: 'any',
    default: [],
  },

  sessionsOverview: {
    type: 'any',
    default: [],
  },

  streamsRouting: {
    type: 'any',
    default: [],
  },

   // @note - defaults presets are populated in `Projet.constructor
  graphPresets: {
    type: 'any',
    default: [],
  },

  learningPresets: {
    type: 'any',
    default: {},
  },

  // list of all active audio files at server startup, bypass loading between sessions
  // usefull for concert situations (cf. `config/project-*.json` files)
  preloadAudioFiles: {
    type: 'boolean',
    default: false,
  },

  // this is empty
  metas: {
    type: 'any',
    default: {}, // { name, title, version,  }
  },
};
