"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var Xmm = _interopRequireWildcard(require("xmm-client"));

var _rapidMixAdapters = _interopRequireDefault(require("rapid-mix-adapters"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _getRequireWildcardCache() { if (typeof WeakMap !== "function") return null; var cache = new WeakMap(); _getRequireWildcardCache = function () { return cache; }; return cache; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } if (obj === null || typeof obj !== "object" && typeof obj !== "function") { return { default: obj }; } var cache = _getRequireWildcardCache(); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; }

const knownTargets = ['gmm', 'gmr', 'hhmm', 'hhmr'];
const defaultXmmConfig = {
  modelType: 'gmm',
  gaussians: 1,
  absoluteRegularization: 0.01,
  relativeRegularization: 0.01,
  covarianceMode: 'full',
  hierarchical: true,
  states: 1,
  transitionMode: 'leftright',
  regressionEstimator: 'full',
  likelihoodWindow: 10
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
    return _rapidMixAdapters.default.xmmToRapidMixConfig(Object.assign({}, this._config, {
      modelType: this._modelType
    }));
  }
  /**
   * Set the model configuration parameters (or a subset of them).
   *
   * @param {Object} config - RapidMix JSON configuration object or subset of parameters.
   */


  setConfig(config = {}) {
    if (!config) return;

    if (config.docType === 'rapid-mix:ml-configuration' && config.docVersion && config.payload && config.target && config.target.name === 'xmm') {
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

      if (key === 'gaussians' && Number.isInteger(val) && val > 0 || key === 'absoluteRegularization' && Number.isFinite(val) && val > 0 || key === 'relativeRegularization' && Number.isFinite(val) && val > 0 || key === 'covarianceMode' && ['full', 'diagonal'].indexOf(val) > -1 || key === 'hierarchical' && typeof val === 'boolean' || key === 'states' && Number.isInteger(val) && val > 0 || key === 'transitionMode' && ['leftright', 'ergodic'].indexOf(val) > -1 || key === 'regressionEstimator' && ['full', 'windowed', 'likeliest'].indexOf(val) > -1 || key === 'multiClassRegressionEstimator' && ['likeliest', 'mixture'].indexOf(val) > -1) {
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

      const xmmModel = _rapidMixAdapters.default.rapidMixToXmmModel(model);

      this._setDecoder();

      this._decoder.setModel(xmmModel);
    } else {
      throw new Error(`Invalid target name`);
    }
  }

}

var _default = XmmProcessor;
exports.default = _default;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9jb21tb24vbGlicy9tYW5vL1htbVByb2Nlc3Nvci5qcyJdLCJuYW1lcyI6WyJrbm93blRhcmdldHMiLCJkZWZhdWx0WG1tQ29uZmlnIiwibW9kZWxUeXBlIiwiZ2F1c3NpYW5zIiwiYWJzb2x1dGVSZWd1bGFyaXphdGlvbiIsInJlbGF0aXZlUmVndWxhcml6YXRpb24iLCJjb3ZhcmlhbmNlTW9kZSIsImhpZXJhcmNoaWNhbCIsInN0YXRlcyIsInRyYW5zaXRpb25Nb2RlIiwicmVncmVzc2lvbkVzdGltYXRvciIsImxpa2VsaWhvb2RXaW5kb3ciLCJYbW1Qcm9jZXNzb3IiLCJjb25zdHJ1Y3RvciIsIl9jb25maWciLCJfZGVjb2RlciIsIl9tb2RlbCIsIl9tb2RlbFR5cGUiLCJfbGlrZWxpaG9vZFdpbmRvdyIsInNldENvbmZpZyIsIl9zZXREZWNvZGVyIiwiWG1tIiwiSGhtbURlY29kZXIiLCJHbW1EZWNvZGVyIiwicmVzZXQiLCJydW4iLCJ2ZWN0b3IiLCJGbG9hdDMyQXJyYXkiLCJGbG9hdDY0QXJyYXkiLCJBcnJheSIsImZyb20iLCJmaWx0ZXIiLCJnZXRDb25maWciLCJyYXBpZE1peEFkYXB0ZXJzIiwieG1tVG9SYXBpZE1peENvbmZpZyIsIk9iamVjdCIsImFzc2lnbiIsImNvbmZpZyIsImRvY1R5cGUiLCJkb2NWZXJzaW9uIiwicGF5bG9hZCIsInRhcmdldCIsIm5hbWUiLCJpbmRleE9mIiwibmV3TW9kZWxUeXBlIiwia2V5Iiwia2V5cyIsInZhbCIsIk51bWJlciIsImlzSW50ZWdlciIsImlzRmluaXRlIiwic2V0TGlrZWxpaG9vZFdpbmRvdyIsImdldE1vZGVsIiwic2V0TW9kZWwiLCJtb2RlbCIsInhtbU1vZGVsIiwicmFwaWRNaXhUb1htbU1vZGVsIiwiRXJyb3IiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7QUFBQTs7QUFDQTs7Ozs7Ozs7QUFFQSxNQUFNQSxZQUFZLEdBQUcsQ0FBRSxLQUFGLEVBQVMsS0FBVCxFQUFnQixN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S0FBRCxFQUFRO0FBQ2QsUUFBSSxDQUFDQSxLQUFMLEVBQVk7QUFDVixXQUFLQSxLQUFMLEdBQWEsSUFBYjs7QUFDQSxXQUFLdkMsUUFBTCxDQUFjc0MsUUFBZCxDQUF1QixJQUF2Qjs7QUFDQTtBQUNEOztBQUVELFFBQUlDLEtBQUssQ0FBQ2IsTUFBTixDQUFhQyxJQUFiLEtBQXNCLEtBQTFCLEVBQWlDO0FBQy9CLFdBQUt6QixVQUFMLEdBQWtCcUMsS0FBSyxDQUFDZCxPQUFOLENBQWN0QyxTQUFoQztBQUNBLFdBQUtjLE1BQUwsR0FBY3NDLEtBQWQ7O0FBQ0EsWUFBTUMsUUFBUSxHQUFHdEIsMEJBQWlCdUIsa0JBQWpCLENBQW9DRixLQUFwQyxDQUFqQjs7QUFFQSxXQUFLbEMsV0FBTDs7QUFDQSxXQUFLTCxRQUFMLENBQWNzQyxRQUFkLENBQXVCRSxRQUF2QjtBQUNELEtBUEQsTUFPTztBQUNMLFlBQU0sSUFBSUUsS0FBSixDQUFXLHFCQUFYLENBQU47QUFDRDtBQUNGOztBQXhKZ0I7O2VBMkpKN0MsWSIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIFhtbSBmcm9tICd4bW0tY2xpZW50JztcbmltcG9ydCByYXBpZE1peEFkYXB0ZXJzIGZyb20gJ3JhcGlkLW1peC1hZGFwdGVycyc7XG5cbmNvbnN0IGtub3duVGFyZ2V0cyA9IFsgJ2dtbScsICdnbXInLCAnaGhtbScsICdoaG1yJyBdO1xuXG5jb25zdCBkZWZhdWx0WG1tQ29uZmlnID0ge1xuICBtb2RlbFR5cGU6ICdnbW0nLFxuICBnYXVzc2lhbnM6IDEsXG4gIGFic29sdXRlUmVndWxhcml6YXRpb246IDAuMDEsXG4gIHJlbGF0aXZlUmVndWxhcml6YXRpb246IDAuMDEsXG4gIGNvdmFyaWFuY2VNb2RlOiAnZnVsbCcsXG4gIGhpZXJhcmNoaWNhbDogdHJ1ZSxcbiAgc3RhdGVzOiAxLFxuICB0cmFuc2l0aW9uTW9kZTogJ2xlZnRyaWdodCcsXG4gIHJlZ3Jlc3Npb25Fc3RpbWF0b3I6ICdmdWxsJyxcbiAgbGlrZWxpaG9vZFdpbmRvdzogMTAsXG59O1xuXG4vKipcbiAqIFJlcHJlc2VudGF0aW9uIG9mIGEgZ2VzdHVyZSBtb2RlbC4gQSBpbnN0YW5jZSBvZiBgWG1tUHJvY2Vzc29yYCBjYW5cbiAqIHRyYWluIGEgbW9kZWwgZnJvbSBleGFtcGxlcyBhbmQgY2FuIHBlcmZvcm0gY2xhc3NpZmljYXRpb24gYW5kL29yXG4gKiByZWdyZXNzaW9uIGRlcGVuZGluZyBvbiB0aGUgY2hvc2VuIGFsZ29yaXRobS5cbiAqXG4gKiBUaGUgdHJhaW5pbmcgaXMgY3VycmVudGx5IGJhc2VkIG9uIHRoZSBwcmVzZW5jZSBvZiBhIHJlbW90ZSBzZXJ2ZXItc2lkZVxuICogQVBJLCB0aGF0IG11c3QgYmUgYWJsZSB0byBwcm9jZXNzIHJhcGlkTWl4IGNvbXBsaWFudCBKU09OIGZvcm1hdHMuXG4gKlxuICogQHBhcmFtIHtPYmplY3R9IG9wdGlvbnMgLSBPdmVycmlkZSBkZWZhdWx0IHBhcmFtZXRlcnNcbiAqIEBwYXJhbSB7U3RyaW5nfSBbb3B0aW9ucy51cmw9J2h0dHBzOi8vY29tby5pcmNhbS5mci9hcGkvdjEvdHJhaW4nXSAtIFVybFxuICogIG9mIHRoZSB0cmFpbmluZyBlbmQgcG9pbnQuXG4gKlxuICogQGV4YW1wbGVcbiAqIGltcG9ydCAqIGFzIG1hbm8gZnJvbSAnbWFuby1qcy9jbGllbnQnO1xuICpcbiAqIGNvbnN0IHByb2Nlc3NlZFNlbnNvcnMgPSBuZXcgbWFuby5Qcm9jZXNzZWRTZW5zb3JzKCk7XG4gKiBjb25zdCBleGFtcGxlID0gbmV3IG1hbm8uRXhhbXBsZSgpO1xuICogY29uc3QgdHJhaW5pbmdTZXQgPSBuZXcgbWFuby5UcmFpbmluZ1NldCgpO1xuICogY29uc3QgeG1tUHJvY2Vzc29yID0gbmV3IG1hbm8uWG1tUHJvY2Vzc3NvcigpO1xuICpcbiAqIGV4YW1wbGUuc2V0TGFiZWwoJ3Rlc3QnKTtcbiAqIHByb2Nlc3NlZFNlbnNvcnMuYWRkTGlzdGVuZXIoZXhhbXBsZS5hZGRFbGVtZW50KTtcbiAqXG4gKiAvLyBsYXRlclxuICogcHJvY2Vzc2VkU2Vuc29ycy5yZW1vdmVMaXN0ZW5lcihleGFtcGxlLmFkZEVsZW1lbnQpO1xuICogY29uc3QgcmFwaWRNaXhKc29uRXhhbXBsZSA9IGV4YW1wbGUudG9KU09OKCk7XG4gKlxuICogdHJhaW5pbmdTZXQuYWRkRXhhbXBsZShyYXBpZE1peEpzb25FeGFtcGxlKTtcbiAqIGNvbnN0IHJhcGlkTWl4SnNvblRyYWluaW5nU2V0ID0gdHJhaW5pbmdTZXQudG9KU09OKCk7XG4gKlxuICogeG1tUHJvY2Vzc29yXG4gKiAgIC50cmFpbihyYXBpZE1peEpzb25UcmFpbmluZ1NldClcbiAqICAgLnRoZW4oKCkgPT4ge1xuICogICAgIC8vIHN0YXJ0IGRlY29kaW5nXG4gKiAgICAgcHJvY2Vzc2VkU2Vuc29ycy5hZGRMaXN0ZW5lcihkYXRhID0+IHtcbiAqICAgICAgIGNvbnN0IHJlc3VsdHMgPSB4bW1Qcm9jZXNzb3IucnVuKGRhdGEpO1xuICogICAgICAgY29uc29sZS5sb2cocmVzdWx0cyk7XG4gKiAgICAgfSk7XG4gKiAgIH0pO1xuICovXG5jbGFzcyBYbW1Qcm9jZXNzb3Ige1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICB0aGlzLl9jb25maWcgPSB7fTtcbiAgICB0aGlzLl9kZWNvZGVyID0gbnVsbDtcbiAgICB0aGlzLl9tb2RlbCA9IG51bGw7XG4gICAgdGhpcy5fbW9kZWxUeXBlID0gbnVsbDtcbiAgICB0aGlzLl9saWtlbGlob29kV2luZG93ID0gbnVsbDtcblxuICAgIHRoaXMuc2V0Q29uZmlnKGRlZmF1bHRYbW1Db25maWcpO1xuICAgIHRoaXMuX3NldERlY29kZXIoKTtcbiAgfVxuXG4gIF9zZXREZWNvZGVyKCkge1xuICAgIHN3aXRjaCAodGhpcy5fbW9kZWxUeXBlKSB7XG4gICAgICBjYXNlICdoaG1tJzpcbiAgICAgICAgdGhpcy5fZGVjb2RlciA9IG5ldyBYbW0uSGhtbURlY29kZXIodGhpcy5fbGlrZWxpaG9vZFdpbmRvdyk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAnZ21tJzpcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIHRoaXMuX2RlY29kZXIgPSBuZXcgWG1tLkdtbURlY29kZXIodGhpcy5fbGlrZWxpaG9vZFdpbmRvdyk7XG4gICAgICAgIGJyZWFrO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBSZXNldCB0aGUgbW9kZWwncyB0ZW1wb3JhbCBkZWNvZGluZyBzdGF0ZS4gSXMgb25seSB2YWxpZCBvbiBgaGhtbWAgZGVjb2Rlci5cbiAgICovXG4gIHJlc2V0KCkge1xuICAgIGlmICh0aGlzLl9kZWNvZGVyLnJlc2V0KSB7XG4gICAgICB0aGlzLl9kZWNvZGVyLnJlc2V0KCk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFBlcmZvcm0gdGhlIGNhbHNzaWZpY2F0aW9uIG9yIHRoZSByZWdyZXNzaW9uIG9mIHRoZSBnaXZlbiB2ZWN0b3IuXG4gICAqXG4gICAqIEBwYXJhbSB7RmxvYXQzMkFycmF5fEFycmF5fSB2ZWN0b3IgLSBJbnB1dCB2ZWN0b3IgZm9yIHRoZSBkZWNvZGluZy5cbiAgICogQHJldHVybiB7T2JqZWN0fSByZXN1bHRzIC0gT2JqZWN0IGNvbnRhaW5pbmcgdGhlIGRlY29kaW5nIHJlc3VsdHMuXG4gICAqL1xuICBydW4odmVjdG9yKSB7XG4gICAgaWYgKHZlY3RvciBpbnN0YW5jZW9mIEZsb2F0MzJBcnJheSB8fCB2ZWN0b3IgaW5zdGFuY2VvZiBGbG9hdDY0QXJyYXkpIHtcbiAgICAgIHZlY3RvciA9IEFycmF5LmZyb20odmVjdG9yKTtcbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcy5fZGVjb2Rlci5maWx0ZXIodmVjdG9yKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSYXBpZE1peCBjb21wbGlhbnQgY29uZmlndXJhdGlvbiBvYmplY3QuXG4gICAqXG4gICAqIEByZXR1cm4ge09iamVjdH0gLSBSYXBpZE1peCBDb25maWd1cmF0aW9uIG9iamVjdC5cbiAgICovXG4gIGdldENvbmZpZygpIHtcbiAgICByZXR1cm4gcmFwaWRNaXhBZGFwdGVycy54bW1Ub1JhcGlkTWl4Q29uZmlnKE9iamVjdC5hc3NpZ24oe30sIHRoaXMuX2NvbmZpZywge1xuICAgICAgbW9kZWxUeXBlOiB0aGlzLl9tb2RlbFR5cGVcbiAgICB9KSk7XG4gIH1cblxuICAvKipcbiAgICogU2V0IHRoZSBtb2RlbCBjb25maWd1cmF0aW9uIHBhcmFtZXRlcnMgKG9yIGEgc3Vic2V0IG9mIHRoZW0pLlxuICAgKlxuICAgKiBAcGFyYW0ge09iamVjdH0gY29uZmlnIC0gUmFwaWRNaXggSlNPTiBjb25maWd1cmF0aW9uIG9iamVjdCBvciBzdWJzZXQgb2YgcGFyYW1ldGVycy5cbiAgICovXG4gIHNldENvbmZpZyhjb25maWcgPSB7fSkge1xuICAgIGlmICghY29uZmlnKVxuICAgICAgcmV0dXJuO1xuXG4gICAgaWYgKGNvbmZpZy5kb2NUeXBlID09PSAncmFwaWQtbWl4Om1sLWNvbmZpZ3VyYXRpb24nICYmXG4gICAgICAgIGNvbmZpZy5kb2NWZXJzaW9uICYmXG4gICAgICAgIGNvbmZpZy5wYXlsb2FkICYmXG4gICAgICAgIGNvbmZpZy50YXJnZXQgJiZcbiAgICAgICAgY29uZmlnLnRhcmdldC5uYW1lID09PSAneG1tJ1xuICAgICkge1xuICAgICAgY29uZmlnID0gY29uZmlnLnBheWxvYWQ7XG4gICAgfVxuXG4gICAgaWYgKGNvbmZpZy5tb2RlbFR5cGUgJiYga25vd25UYXJnZXRzLmluZGV4T2YoY29uZmlnLm1vZGVsVHlwZSkgPiAtMSkge1xuICAgICAgY29uc3QgbW9kZWxUeXBlID0gY29uZmlnLm1vZGVsVHlwZTtcbiAgICAgIGxldCBuZXdNb2RlbFR5cGUgPSBudWxsO1xuXG4gICAgICBzd2l0Y2ggKG1vZGVsVHlwZSkge1xuICAgICAgICBjYXNlICdnbW0nOlxuICAgICAgICBjYXNlICdnbXInOlxuICAgICAgICAgIG5ld01vZGVsVHlwZSA9ICdnbW0nO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICdoaG1tJzpcbiAgICAgICAgY2FzZSAnaGhtcic6XG4gICAgICAgICAgbmV3TW9kZWxUeXBlID0gJ2hobW0nO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgfVxuXG4gICAgICBpZiAobmV3TW9kZWxUeXBlICE9PSB0aGlzLl9tb2RlbFR5cGUpIHtcbiAgICAgICAgdGhpcy5fbW9kZWxUeXBlID0gbmV3TW9kZWxUeXBlO1xuICAgICAgICB0aGlzLl9zZXREZWNvZGVyKCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgZm9yIChsZXQga2V5IG9mIE9iamVjdC5rZXlzKGNvbmZpZykpIHtcbiAgICAgIGNvbnN0IHZhbCA9IGNvbmZpZ1trZXldO1xuXG4gICAgICBpZiAoKGtleSA9PT0gJ2dhdXNzaWFucycgJiYgTnVtYmVyLmlzSW50ZWdlcih2YWwpICYmIHZhbCA+IDApIHx8XG4gICAgICAgICAgKGtleSA9PT0gJ2Fic29sdXRlUmVndWxhcml6YXRpb24nICYmIE51bWJlci5pc0Zpbml0ZSh2YWwpICYmIHZhbCA+IDApIHx8XG4gICAgICAgICAgKGtleSA9PT0gJ3JlbGF0aXZlUmVndWxhcml6YXRpb24nICYmIE51bWJlci5pc0Zpbml0ZSh2YWwpICYmIHZhbCA+IDApIHx8XG4gICAgICAgICAgKGtleSA9PT0gJ2NvdmFyaWFuY2VNb2RlJyAmJiBbJ2Z1bGwnLCAnZGlhZ29uYWwnXS5pbmRleE9mKHZhbCkgPiAtMSkgfHxcbiAgICAgICAgICAoa2V5ID09PSAnaGllcmFyY2hpY2FsJyAmJiB0eXBlb2YgdmFsID09PSAnYm9vbGVhbicpIHx8XG4gICAgICAgICAgKGtleSA9PT0gJ3N0YXRlcycgJiYgTnVtYmVyLmlzSW50ZWdlcih2YWwpICYmIHZhbCA+IDApIHx8XG4gICAgICAgICAgKGtleSA9PT0gJ3RyYW5zaXRpb25Nb2RlJyAmJiBbJ2xlZnRyaWdodCcsICdlcmdvZGljJ10uaW5kZXhPZih2YWwpID4gLTEpIHx8XG4gICAgICAgICAgKGtleSA9PT0gJ3JlZ3Jlc3Npb25Fc3RpbWF0b3InICYmIFsnZnVsbCcsICd3aW5kb3dlZCcsICdsaWtlbGllc3QnXS5pbmRleE9mKHZhbCkgPiAtMSkgfHxcbiAgICAgICAgICAoa2V5ID09PSAnbXVsdGlDbGFzc1JlZ3Jlc3Npb25Fc3RpbWF0b3InICYmIFsnbGlrZWxpZXN0JywgJ21peHR1cmUnXS5pbmRleE9mKHZhbCkgPiAtMSkpIHtcbiAgICAgICAgdGhpcy5fY29uZmlnW2tleV0gPSB2YWw7XG4gICAgICB9IGVsc2UgaWYgKGtleSA9PT0gJ2xpa2VsaWhvb2RXaW5kb3cnICYmIE51bWJlci5pc0ludGVnZXIodmFsKSAmJiB2YWwgPiAwKSB7XG4gICAgICAgIHRoaXMuX2xpa2VsaWhvb2RXaW5kb3cgPSB2YWw7XG5cbiAgICAgICAgaWYgKHRoaXMuX2RlY29kZXIgIT09IG51bGwpIHtcbiAgICAgICAgICB0aGlzLl9kZWNvZGVyLnNldExpa2VsaWhvb2RXaW5kb3codGhpcy5fbGlrZWxpaG9vZFdpbmRvdyk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgfVxuXG4gIC8qKlxuICAgKiBSZXRyaWV2ZSB0aGUgbW9kZWwgaW4gUmFwaWRNaXggbW9kZWwgZm9ybWF0LlxuICAgKlxuICAgKiBAcmV0dXJuIHtPYmplY3R9IC0gQ3VycmVudCBSYXBpZE1peCBNb2RlbCBvYmplY3QuXG4gICAqL1xuICBnZXRNb2RlbCgpIHtcbiAgICByZXR1cm4gdGhpcy5fbW9kZWw7XG4gIH1cblxuICAvKipcbiAgICogVXNlIHRoZSBnaXZlbiBSYXBpZE1peCBtb2RlbCBvYmplY3QgZm9yIHRoZSBkZWNvZGluZy5cbiAgICpcbiAgICogQHBhcmFtIHtPYmplY3R9IG1vZGVsIC0gUmFwaWRNaXggTW9kZWwgb2JqZWN0LlxuICAgKi9cbiAgc2V0TW9kZWwobW9kZWwpIHtcbiAgICBpZiAoIW1vZGVsKSB7XG4gICAgICB0aGlzLm1vZGVsID0gbnVsbDtcbiAgICAgIHRoaXMuX2RlY29kZXIuc2V0TW9kZWwobnVsbCk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKG1vZGVsLnRhcmdldC5uYW1lID09PSAneG1tJykge1xuICAgICAgdGhpcy5fbW9kZWxUeXBlID0gbW9kZWwucGF5bG9hZC5tb2RlbFR5cGU7XG4gICAgICB0aGlzLl9tb2RlbCA9IG1vZGVsO1xuICAgICAgY29uc3QgeG1tTW9kZWwgPSByYXBpZE1peEFkYXB0ZXJzLnJhcGlkTWl4VG9YbW1Nb2RlbChtb2RlbCk7XG5cbiAgICAgIHRoaXMuX3NldERlY29kZXIoKTtcbiAgICAgIHRoaXMuX2RlY29kZXIuc2V0TW9kZWwoeG1tTW9kZWwpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYEludmFsaWQgdGFyZ2V0IG5hbWVgKTtcbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgWG1tUHJvY2Vzc29yO1xuXG4iXX0=