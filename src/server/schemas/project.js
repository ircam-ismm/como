export default {
  audioFiles: {
    type: 'any',
    default: [],
  },
  presetNames: {
    type: 'any',
    default: [], // populated in `Projet.constructor
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
  // to be implemented
  preloadAudioFiles: {
    type: 'any',
    default: [],
  }
}
