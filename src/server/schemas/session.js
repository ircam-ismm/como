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
        modelType: 'hhmm',
        gaussians: 1,
        absoluteRegularization: 0.1, // 0.01
        relativeRegularization: 0.1, // 0.01
        covarianceMode: 'full',
        hierarchical: true,
        states: 4, // 1
        transitionMode: 'leftright',
        regressionEstimator: 'full',
        likelihoodWindow: 10,
      },
    },
  },
  // this should belong to the "encoder / decoder"
};
