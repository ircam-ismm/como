import xmm from '#xmm.js';

export function getDecoder(config, parameters) {
  let decoder;
  switch (config.modelType) {
    case 'gmm': {
      decoder = xmm.MulticlassGMMPredictor(parameters);
      decoder.setLikelihoodWindow(config.likelihoodWindow);
      break;
    }
    case 'hhmm': {
      decoder = xmm.MulticlassHMMPredictor(parameters);
      decoder.setLikelihoodWindow(config.likelihoodWindow);
      break;
    }
    default: {
      throw new Error(`Cannot create xmm decoder: modelType "${config.modelType}" is not supported`);
    }
  }

  return {
    process(frame) {
      decoder.predict(frame);
      return decoder.results;
    }
  }
}

export function sanitizeConfig(config) {
  // @todo - make sure config is clean
  return config;
}

export const presets = {
  postures: {
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
      regressionEstimator: 'full',
      likelihoodWindow: 10,
    },
  },
  shortGestures: {
    target: {
      name: 'xmm',
    },
    payload: {
      modelType: 'hhmm',
      gaussians: 1,
      absoluteRegularization: 0.1,
      relativeRegularization: 0.1,
      covarianceMode: 'full',
      states: 4,
      transitionMode: 'leftright',
      regressionEstimator: 'full',
      likelihoodWindow: 10,
    },
  },
  longGestures: {
    target: {
      name: 'xmm',
    },
    payload: {
      modelType: 'hhmm',
      gaussians: 1,
      absoluteRegularization: 0.1,
      relativeRegularization: 0.1,
      covarianceMode: 'full',
      states: 10,
      transitionMode: 'leftright',
      regressionEstimator: 'full',
      likelihoodWindow: 10,
    },
  },
};
