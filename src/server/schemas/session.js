export default {
  name: {
    type: 'string',
    default: '',
  },
  id: {
    type: 'string',
    default: '',
  },
  audioFiles: {
    type: 'any',
    default: [],
  },
  labels: {
    type: 'any',
    default: [],
  },
  // @note - provide an abstraction to access that
  labelAudioFileTable: {
    type: 'any',
    default: [],
  },

  graph: {
    type: 'any',
    default: {},
  },

  // these two are not persisted, they are mixed in "graph"
  graphOptions: {
    type: 'any',
    default: {},
  },
  graphOptionsEvent: {
    type: 'any',
    default: {},
    event: true,
  },

  // this should belong to the "encoder / decoder"
  // this needs to be discussed further... what would be clean
  // architecture / strategy for that, e.g.
  // - we don't want to dispatch the examples everywhere,
  // - how to attach an example to a particular encoder / decoder instance,
  // - same for config, etc.
  //
  // @see also `player` schema
  model: {
    type: 'any',
    default: null,
    nullable: true,
  },
  examples: {
    type: 'any',
    default: {},
  },
  learningConfig: {
    type: 'any',
    // posture default for now...
    default: {
      target: {
        name: 'xmm',
      },
      payload: {
        modelType: 'gmm',
        gaussians: 1,
        absoluteRegularization: 0.01,
        relativeRegularization: 0.01,
        covarianceMode: 'full',
        states: 1,
        transitionMode: 'ergodic',
      },
    },
  },
  // ...
};
