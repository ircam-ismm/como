export default {
  audioFiles: {
    type: 'any',
    default: [],
  },
  metas: {
    type: 'any',
    default: {}, // { name, title, version,  }
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


  // to be implemented
  // preloadAudioFiles: {
  //   type: 'any',
  //   default: [],
  // },
}
