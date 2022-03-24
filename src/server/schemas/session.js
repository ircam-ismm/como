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

  labelAudioFileTable: {
    type: 'any',
    default: [],
  },

  graph: {
    type: 'any',
    default: {},
  },

  // these two are not persisted as is, they are mixed in the "graph"
  // @todo - document this behavior, this is hard to understand
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
  // raw sensors examples
  examples: {
    type: 'any',
    default: {},
  },
  // processed examples
  processedExamples: {
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
        absoluteRegularization: 0.1,
        relativeRegularization: 0.1,
        covarianceMode: 'full',
        hierarchical: true,
        states: 4,
        transitionMode: 'leftright',
        regressionEstimator: 'full',
        likelihoodWindow: 10,
      },
    },
  },
  // ...
};
