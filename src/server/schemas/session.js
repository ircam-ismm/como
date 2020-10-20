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
