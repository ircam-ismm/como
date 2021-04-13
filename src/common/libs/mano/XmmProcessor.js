import * as Xmm from 'xmm-client';
import rapidMixAdapters from 'rapid-mix-adapters';

const knownTargets = [ 'gmm', 'gmr', 'hhmm', 'hhmr' ];

const defaultXmmConfig = {
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
};

/**
 * Representation of a gesture model. A instance of `XmmProcessor` can
 * train a model from examples and can perform classification and/or
 * regression depending on the chosen algorithm.
 *
 * The training is currently based on the presence of a remote server-side
 * API, that must be able to process rapidMix compliant JSON formats.
 *
 * @param {Object} options - Override default parameters
 * @param {String} [options.url='https://como.ircam.fr/api/v1/train'] - Url
 *  of the training end point.
 *
 * @example
 * import * as mano from 'mano-js/client';
 *
 * const processedSensors = new mano.ProcessedSensors();
 * const example = new mano.Example();
 * const trainingSet = new mano.TrainingSet();
 * const xmmProcessor = new mano.XmmProcesssor();
 *
 * example.setLabel('test');
 * processedSensors.addListener(example.addElement);
 *
 * // later
 * processedSensors.removeListener(example.addElement);
 * const rapidMixJsonExample = example.toJSON();
 *
 * trainingSet.addExample(rapidMixJsonExample);
 * const rapidMixJsonTrainingSet = trainingSet.toJSON();
 *
 * xmmProcessor
 *   .train(rapidMixJsonTrainingSet)
 *   .then(() => {
 *     // start decoding
 *     processedSensors.addListener(data => {
 *       const results = xmmProcessor.run(data);
 *       console.log(results);
 *     });
 *   });
 */
class XmmProcessor {
  constructor() {
    this._config = {};
    this._decoder = null;
    this._model = null;
    this._modelType = null;
    this._likelihoodWindow = null;

    this.setConfig(defaultXmmConfig);
    this._setDecoder();
  }

  _setDecoder() {
    switch (this._modelType) {
      case 'hhmm':
        this._decoder = new Xmm.HhmmDecoder(this._likelihoodWindow);
        break;
      case 'gmm':
      default:
        this._decoder = new Xmm.GmmDecoder(this._likelihoodWindow);
        break;
    }
  }

  /**
   * Reset the model's temporal decoding state. Is only valid on `hhmm` decoder.
   */
  reset() {
    if (this._decoder.reset) {
      this._decoder.reset();
    }
  }

  /**
   * Perform the calssification or the regression of the given vector.
   *
   * @param {Float32Array|Array} vector - Input vector for the decoding.
   * @return {Object} results - Object containing the decoding results.
   */
  run(vector) {
    if (vector instanceof Float32Array || vector instanceof Float64Array) {
      vector = Array.from(vector);
    }

    return this._decoder.filter(vector);
  }

  /**
   * RapidMix compliant configuration object.
   *
   * @return {Object} - RapidMix Configuration object.
   */
  getConfig() {
    return rapidMixAdapters.xmmToRapidMixConfig(Object.assign({}, this._config, {
      modelType: this._modelType
    }));
  }

  /**
   * Set the model configuration parameters (or a subset of them).
   *
   * @param {Object} config - RapidMix JSON configuration object or subset of parameters.
   */
  setConfig(config = {}) {
    if (!config)
      return;

    if (config.docType === 'rapid-mix:ml-configuration' &&
        config.docVersion &&
        config.payload &&
        config.target &&
        config.target.name === 'xmm'
    ) {
      config = config.payload;
    }

    if (config.modelType && knownTargets.indexOf(config.modelType) > -1) {
      const modelType = config.modelType;
      let newModelType = null;

      switch (modelType) {
        case 'gmm':
        case 'gmr':
          newModelType = 'gmm';
          break;
        case 'hhmm':
        case 'hhmr':
          newModelType = 'hhmm';
          break;
      }

      if (newModelType !== this._modelType) {
        this._modelType = newModelType;
        this._setDecoder();
      }
    }

    for (let key of Object.keys(config)) {
      const val = config[key];

      if ((key === 'gaussians' && Number.isInteger(val) && val > 0) ||
          (key === 'absoluteRegularization' && Number.isFinite(val) && val > 0) ||
          (key === 'relativeRegularization' && Number.isFinite(val) && val > 0) ||
          (key === 'covarianceMode' && ['full', 'diagonal'].indexOf(val) > -1) ||
          (key === 'hierarchical' && typeof val === 'boolean') ||
          (key === 'states' && Number.isInteger(val) && val > 0) ||
          (key === 'transitionMode' && ['leftright', 'ergodic'].indexOf(val) > -1) ||
          (key === 'regressionEstimator' && ['full', 'windowed', 'likeliest'].indexOf(val) > -1) ||
          (key === 'multiClassRegressionEstimator' && ['likeliest', 'mixture'].indexOf(val) > -1)) {
        this._config[key] = val;
      } else if (key === 'likelihoodWindow' && Number.isInteger(val) && val > 0) {
        this._likelihoodWindow = val;

        if (this._decoder !== null) {
          this._decoder.setLikelihoodWindow(this._likelihoodWindow);
        }
      }
    }

  }

  /**
   * Retrieve the model in RapidMix model format.
   *
   * @return {Object} - Current RapidMix Model object.
   */
  getModel() {
    return this._model;
  }

  /**
   * Use the given RapidMix model object for the decoding.
   *
   * @param {Object} model - RapidMix Model object.
   */
  setModel(model) {
    if (!model) {
      this.model = null;
      this._decoder.setModel(null);
      return;
    }

    if (model.target.name === 'xmm') {
      this._modelType = model.payload.modelType;
      this._model = model;
      const xmmModel = rapidMixAdapters.rapidMixToXmmModel(model);

      this._setDecoder();
      this._decoder.setModel(xmmModel);
    } else {
      throw new Error(`Invalid target name`);
    }
  }
}

export default XmmProcessor;

