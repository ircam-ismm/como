"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var Xmm = _interopRequireWildcard(require("xmm-client"));

var _rapidMixAdapters = _interopRequireDefault(require("rapid-mix-adapters"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function (nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }

function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || typeof obj !== "object" && typeof obj !== "function") { return { default: obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; }

/**
 * This class is only used as a shortcut for xmm client-side
 */
const knownTargets = ['gmm', 'gmr', 'hhmm', 'hhmr']; // this is not used
// see, `server/schemas/session` for real defaults

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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9jb21tb24vbGlicy9tYW5vL1htbVByb2Nlc3Nvci5qcyJdLCJuYW1lcyI6WyJrbm93blRhcmdldHMiLCJkZWZhdWx0WG1tQ29uZmlnIiwibW9kZWxUeXBlIiwiZ2F1c3NpYW5zIiwiYWJzb2x1dGVSZWd1bGFyaXphdGlvbiIsInJlbGF0aXZlUmVndWxhcml6YXRpb24iLCJjb3ZhcmlhbmNlTW9kZSIsImhpZXJhcmNoaWNhbCIsInN0YXRlcyIsInRyYW5zaXRpb25Nb2RlIiwicmVncmVzc2lvbkVzdGltYXRvciIsImxpa2VsaWhvb2RXaW5kb3ciLCJYbW1Qcm9jZXNzb3IiLCJjb25zdHJ1Y3RvciIsIl9jb25maWciLCJfZGVjb2RlciIsIl9tb2RlbCIsIl9tb2RlbFR5cGUiLCJfbGlrZWxpaG9vZFdpbmRvdyIsInNldENvbmZpZyIsIl9zZXREZWNvZGVyIiwiWG1tIiwiSGhtbURlY29kZXIiLCJHbW1EZWNvZGVyIiwicmVzZXQiLCJydW4iLCJ2ZWN0b3IiLCJGbG9hdDMyQXJyYXkiLCJGbG9hdDY0QXJyYXkiLCJBcnJheSIsImZyb20iLCJmaWx0ZXIiLCJnZXRDb25maWciLCJyYXBpZE1peEFkYXB0ZXJzIiwieG1tVG9SYXBpZE1peENvbmZpZyIsIk9iamVjdCIsImFzc2lnbiIsImNvbmZpZyIsImRvY1R5cGUiLCJkb2NWZXJzaW9uIiwicGF5bG9hZCIsInRhcmdldCIsIm5hbWUiLCJpbmRleE9mIiwibmV3TW9kZWxUeXBlIiwia2V5Iiwia2V5cyIsInZhbCIsIk51bWJlciIsImlzSW50ZWdlciIsImlzRmluaXRlIiwic2V0TGlrZWxpaG9vZFdpbmRvdyIsImdldE1vZGVsIiwic2V0TW9kZWwiLCJtb2RlbCIsInhtbU1vZGVsIiwicmFwaWRNaXhUb1htbU1vZGVsIiwiRXJyb3IiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7QUFBQTs7QUFDQTs7Ozs7Ozs7QUFFQTtBQUNBO0FBQ0E7QUFFQSxNQUFNQSxZQUFZLEdBQUcsQ0FBRSxLQUFGLEVB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QTs7O0FBQ0VxQyxFQUFBQSxRQUFRLENBQUNDLEtBQUQsRUFBUTtBQUNkLFFBQUksQ0FBQ0EsS0FBTCxFQUFZO0FBQ1YsV0FBS0EsS0FBTCxHQUFhLElBQWI7O0FBQ0EsV0FBS3ZDLFFBQUwsQ0FBY3NDLFFBQWQsQ0FBdUIsSUFBdkI7O0FBQ0E7QUFDRDs7QUFFRCxRQUFJQyxLQUFLLENBQUNiLE1BQU4sQ0FBYUMsSUFBYixLQUFzQixLQUExQixFQUFpQztBQUMvQixXQUFLekIsVUFBTCxHQUFrQnFDLEtBQUssQ0FBQ2QsT0FBTixDQUFjdEMsU0FBaEM7QUFDQSxXQUFLYyxNQUFMLEdBQWNzQyxLQUFkOztBQUNBLFlBQU1DLFFBQVEsR0FBR3RCLDBCQUFpQnVCLGtCQUFqQixDQUFvQ0YsS0FBcEMsQ0FBakI7O0FBRUEsV0FBS2xDLFdBQUw7O0FBQ0EsV0FBS0wsUUFBTCxDQUFjc0MsUUFBZCxDQUF1QkUsUUFBdkI7QUFDRCxLQVBELE1BT087QUFDTCxZQUFNLElBQUlFLEtBQUosQ0FBVyxxQkFBWCxDQUFOO0FBQ0Q7QUFDRjs7QUF4SmdCOztlQTJKSjdDLFkiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBYbW0gZnJvbSAneG1tLWNsaWVudCc7XG5pbXBvcnQgcmFwaWRNaXhBZGFwdGVycyBmcm9tICdyYXBpZC1taXgtYWRhcHRlcnMnO1xuXG4vKipcbiAqIFRoaXMgY2xhc3MgaXMgb25seSB1c2VkIGFzIGEgc2hvcnRjdXQgZm9yIHhtbSBjbGllbnQtc2lkZVxuICovXG5cbmNvbnN0IGtub3duVGFyZ2V0cyA9IFsgJ2dtbScsICdnbXInLCAnaGhtbScsICdoaG1yJyBdO1xuXG4vLyB0aGlzIGlzIG5vdCB1c2VkXG4vLyBzZWUsIGBzZXJ2ZXIvc2NoZW1hcy9zZXNzaW9uYCBmb3IgcmVhbCBkZWZhdWx0c1xuY29uc3QgZGVmYXVsdFhtbUNvbmZpZyA9IHtcbiAgbW9kZWxUeXBlOiAnZ21tJyxcbiAgZ2F1c3NpYW5zOiAxLFxuICBhYnNvbHV0ZVJlZ3VsYXJpemF0aW9uOiAwLjAxLFxuICByZWxhdGl2ZVJlZ3VsYXJpemF0aW9uOiAwLjAxLFxuICBjb3ZhcmlhbmNlTW9kZTogJ2Z1bGwnLFxuICBoaWVyYXJjaGljYWw6IHRydWUsXG4gIHN0YXRlczogMSxcbiAgdHJhbnNpdGlvbk1vZGU6ICdsZWZ0cmlnaHQnLFxuICByZWdyZXNzaW9uRXN0aW1hdG9yOiAnZnVsbCcsXG4gIGxpa2VsaWhvb2RXaW5kb3c6IDEwLFxufTtcblxuLyoqXG4gKiBSZXByZXNlbnRhdGlvbiBvZiBhIGdlc3R1cmUgbW9kZWwuIEEgaW5zdGFuY2Ugb2YgYFhtbVByb2Nlc3NvcmAgY2FuXG4gKiB0cmFpbiBhIG1vZGVsIGZyb20gZXhhbXBsZXMgYW5kIGNhbiBwZXJmb3JtIGNsYXNzaWZpY2F0aW9uIGFuZC9vclxuICogcmVncmVzc2lvbiBkZXBlbmRpbmcgb24gdGhlIGNob3NlbiBhbGdvcml0aG0uXG4gKlxuICogVGhlIHRyYWluaW5nIGlzIGN1cnJlbnRseSBiYXNlZCBvbiB0aGUgcHJlc2VuY2Ugb2YgYSByZW1vdGUgc2VydmVyLXNpZGVcbiAqIEFQSSwgdGhhdCBtdXN0IGJlIGFibGUgdG8gcHJvY2VzcyByYXBpZE1peCBjb21wbGlhbnQgSlNPTiBmb3JtYXRzLlxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSBvcHRpb25zIC0gT3ZlcnJpZGUgZGVmYXVsdCBwYXJhbWV0ZXJzXG4gKiBAcGFyYW0ge1N0cmluZ30gW29wdGlvbnMudXJsPSdodHRwczovL2NvbW8uaXJjYW0uZnIvYXBpL3YxL3RyYWluJ10gLSBVcmxcbiAqICBvZiB0aGUgdHJhaW5pbmcgZW5kIHBvaW50LlxuICpcbiAqIEBleGFtcGxlXG4gKiBpbXBvcnQgKiBhcyBtYW5vIGZyb20gJ21hbm8tanMvY2xpZW50JztcbiAqXG4gKiBjb25zdCBwcm9jZXNzZWRTZW5zb3JzID0gbmV3IG1hbm8uUHJvY2Vzc2VkU2Vuc29ycygpO1xuICogY29uc3QgZXhhbXBsZSA9IG5ldyBtYW5vLkV4YW1wbGUoKTtcbiAqIGNvbnN0IHRyYWluaW5nU2V0ID0gbmV3IG1hbm8uVHJhaW5pbmdTZXQoKTtcbiAqIGNvbnN0IHhtbVByb2Nlc3NvciA9IG5ldyBtYW5vLlhtbVByb2Nlc3Nzb3IoKTtcbiAqXG4gKiBleGFtcGxlLnNldExhYmVsKCd0ZXN0Jyk7XG4gKiBwcm9jZXNzZWRTZW5zb3JzLmFkZExpc3RlbmVyKGV4YW1wbGUuYWRkRWxlbWVudCk7XG4gKlxuICogLy8gbGF0ZXJcbiAqIHByb2Nlc3NlZFNlbnNvcnMucmVtb3ZlTGlzdGVuZXIoZXhhbXBsZS5hZGRFbGVtZW50KTtcbiAqIGNvbnN0IHJhcGlkTWl4SnNvbkV4YW1wbGUgPSBleGFtcGxlLnRvSlNPTigpO1xuICpcbiAqIHRyYWluaW5nU2V0LmFkZEV4YW1wbGUocmFwaWRNaXhKc29uRXhhbXBsZSk7XG4gKiBjb25zdCByYXBpZE1peEpzb25UcmFpbmluZ1NldCA9IHRyYWluaW5nU2V0LnRvSlNPTigpO1xuICpcbiAqIHhtbVByb2Nlc3NvclxuICogICAudHJhaW4ocmFwaWRNaXhKc29uVHJhaW5pbmdTZXQpXG4gKiAgIC50aGVuKCgpID0+IHtcbiAqICAgICAvLyBzdGFydCBkZWNvZGluZ1xuICogICAgIHByb2Nlc3NlZFNlbnNvcnMuYWRkTGlzdGVuZXIoZGF0YSA9PiB7XG4gKiAgICAgICBjb25zdCByZXN1bHRzID0geG1tUHJvY2Vzc29yLnJ1bihkYXRhKTtcbiAqICAgICAgIGNvbnNvbGUubG9nKHJlc3VsdHMpO1xuICogICAgIH0pO1xuICogICB9KTtcbiAqL1xuY2xhc3MgWG1tUHJvY2Vzc29yIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgdGhpcy5fY29uZmlnID0ge307XG4gICAgdGhpcy5fZGVjb2RlciA9IG51bGw7XG4gICAgdGhpcy5fbW9kZWwgPSBudWxsO1xuICAgIHRoaXMuX21vZGVsVHlwZSA9IG51bGw7XG4gICAgdGhpcy5fbGlrZWxpaG9vZFdpbmRvdyA9IG51bGw7XG5cbiAgICB0aGlzLnNldENvbmZpZyhkZWZhdWx0WG1tQ29uZmlnKTtcbiAgICB0aGlzLl9zZXREZWNvZGVyKCk7XG4gIH1cblxuICBfc2V0RGVjb2RlcigpIHtcbiAgICBzd2l0Y2ggKHRoaXMuX21vZGVsVHlwZSkge1xuICAgICAgY2FzZSAnaGhtbSc6XG4gICAgICAgIHRoaXMuX2RlY29kZXIgPSBuZXcgWG1tLkhobW1EZWNvZGVyKHRoaXMuX2xpa2VsaWhvb2RXaW5kb3cpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgJ2dtbSc6XG4gICAgICBkZWZhdWx0OlxuICAgICAgICB0aGlzLl9kZWNvZGVyID0gbmV3IFhtbS5HbW1EZWNvZGVyKHRoaXMuX2xpa2VsaWhvb2RXaW5kb3cpO1xuICAgICAgICBicmVhaztcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogUmVzZXQgdGhlIG1vZGVsJ3MgdGVtcG9yYWwgZGVjb2Rpbmcgc3RhdGUuIElzIG9ubHkgdmFsaWQgb24gYGhobW1gIGRlY29kZXIuXG4gICAqL1xuICByZXNldCgpIHtcbiAgICBpZiAodGhpcy5fZGVjb2Rlci5yZXNldCkge1xuICAgICAgdGhpcy5fZGVjb2Rlci5yZXNldCgpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBQZXJmb3JtIHRoZSBjYWxzc2lmaWNhdGlvbiBvciB0aGUgcmVncmVzc2lvbiBvZiB0aGUgZ2l2ZW4gdmVjdG9yLlxuICAgKlxuICAgKiBAcGFyYW0ge0Zsb2F0MzJBcnJheXxBcnJheX0gdmVjdG9yIC0gSW5wdXQgdmVjdG9yIGZvciB0aGUgZGVjb2RpbmcuXG4gICAqIEByZXR1cm4ge09iamVjdH0gcmVzdWx0cyAtIE9iamVjdCBjb250YWluaW5nIHRoZSBkZWNvZGluZyByZXN1bHRzLlxuICAgKi9cbiAgcnVuKHZlY3Rvcikge1xuICAgIGlmICh2ZWN0b3IgaW5zdGFuY2VvZiBGbG9hdDMyQXJyYXkgfHwgdmVjdG9yIGluc3RhbmNlb2YgRmxvYXQ2NEFycmF5KSB7XG4gICAgICB2ZWN0b3IgPSBBcnJheS5mcm9tKHZlY3Rvcik7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXMuX2RlY29kZXIuZmlsdGVyKHZlY3Rvcik7XG4gIH1cblxuICAvKipcbiAgICogUmFwaWRNaXggY29tcGxpYW50IGNvbmZpZ3VyYXRpb24gb2JqZWN0LlxuICAgKlxuICAgKiBAcmV0dXJuIHtPYmplY3R9IC0gUmFwaWRNaXggQ29uZmlndXJhdGlvbiBvYmplY3QuXG4gICAqL1xuICBnZXRDb25maWcoKSB7XG4gICAgcmV0dXJuIHJhcGlkTWl4QWRhcHRlcnMueG1tVG9SYXBpZE1peENvbmZpZyhPYmplY3QuYXNzaWduKHt9LCB0aGlzLl9jb25maWcsIHtcbiAgICAgIG1vZGVsVHlwZTogdGhpcy5fbW9kZWxUeXBlXG4gICAgfSkpO1xuICB9XG5cbiAgLyoqXG4gICAqIFNldCB0aGUgbW9kZWwgY29uZmlndXJhdGlvbiBwYXJhbWV0ZXJzIChvciBhIHN1YnNldCBvZiB0aGVtKS5cbiAgICpcbiAgICogQHBhcmFtIHtPYmplY3R9IGNvbmZpZyAtIFJhcGlkTWl4IEpTT04gY29uZmlndXJhdGlvbiBvYmplY3Qgb3Igc3Vic2V0IG9mIHBhcmFtZXRlcnMuXG4gICAqL1xuICBzZXRDb25maWcoY29uZmlnID0ge30pIHtcbiAgICBpZiAoIWNvbmZpZylcbiAgICAgIHJldHVybjtcblxuICAgIGlmIChjb25maWcuZG9jVHlwZSA9PT0gJ3JhcGlkLW1peDptbC1jb25maWd1cmF0aW9uJyAmJlxuICAgICAgICBjb25maWcuZG9jVmVyc2lvbiAmJlxuICAgICAgICBjb25maWcucGF5bG9hZCAmJlxuICAgICAgICBjb25maWcudGFyZ2V0ICYmXG4gICAgICAgIGNvbmZpZy50YXJnZXQubmFtZSA9PT0gJ3htbSdcbiAgICApIHtcbiAgICAgIGNvbmZpZyA9IGNvbmZpZy5wYXlsb2FkO1xuICAgIH1cblxuICAgIGlmIChjb25maWcubW9kZWxUeXBlICYmIGtub3duVGFyZ2V0cy5pbmRleE9mKGNvbmZpZy5tb2RlbFR5cGUpID4gLTEpIHtcbiAgICAgIGNvbnN0IG1vZGVsVHlwZSA9IGNvbmZpZy5tb2RlbFR5cGU7XG4gICAgICBsZXQgbmV3TW9kZWxUeXBlID0gbnVsbDtcblxuICAgICAgc3dpdGNoIChtb2RlbFR5cGUpIHtcbiAgICAgICAgY2FzZSAnZ21tJzpcbiAgICAgICAgY2FzZSAnZ21yJzpcbiAgICAgICAgICBuZXdNb2RlbFR5cGUgPSAnZ21tJztcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAnaGhtbSc6XG4gICAgICAgIGNhc2UgJ2hobXInOlxuICAgICAgICAgIG5ld01vZGVsVHlwZSA9ICdoaG1tJztcbiAgICAgICAgICBicmVhaztcbiAgICAgIH1cblxuICAgICAgaWYgKG5ld01vZGVsVHlwZSAhPT0gdGhpcy5fbW9kZWxUeXBlKSB7XG4gICAgICAgIHRoaXMuX21vZGVsVHlwZSA9IG5ld01vZGVsVHlwZTtcbiAgICAgICAgdGhpcy5fc2V0RGVjb2RlcigpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGZvciAobGV0IGtleSBvZiBPYmplY3Qua2V5cyhjb25maWcpKSB7XG4gICAgICBjb25zdCB2YWwgPSBjb25maWdba2V5XTtcblxuICAgICAgaWYgKChrZXkgPT09ICdnYXVzc2lhbnMnICYmIE51bWJlci5pc0ludGVnZXIodmFsKSAmJiB2YWwgPiAwKSB8fFxuICAgICAgICAgIChrZXkgPT09ICdhYnNvbHV0ZVJlZ3VsYXJpemF0aW9uJyAmJiBOdW1iZXIuaXNGaW5pdGUodmFsKSAmJiB2YWwgPiAwKSB8fFxuICAgICAgICAgIChrZXkgPT09ICdyZWxhdGl2ZVJlZ3VsYXJpemF0aW9uJyAmJiBOdW1iZXIuaXNGaW5pdGUodmFsKSAmJiB2YWwgPiAwKSB8fFxuICAgICAgICAgIChrZXkgPT09ICdjb3ZhcmlhbmNlTW9kZScgJiYgWydmdWxsJywgJ2RpYWdvbmFsJ10uaW5kZXhPZih2YWwpID4gLTEpIHx8XG4gICAgICAgICAgKGtleSA9PT0gJ2hpZXJhcmNoaWNhbCcgJiYgdHlwZW9mIHZhbCA9PT0gJ2Jvb2xlYW4nKSB8fFxuICAgICAgICAgIChrZXkgPT09ICdzdGF0ZXMnICYmIE51bWJlci5pc0ludGVnZXIodmFsKSAmJiB2YWwgPiAwKSB8fFxuICAgICAgICAgIChrZXkgPT09ICd0cmFuc2l0aW9uTW9kZScgJiYgWydsZWZ0cmlnaHQnLCAnZXJnb2RpYyddLmluZGV4T2YodmFsKSA+IC0xKSB8fFxuICAgICAgICAgIChrZXkgPT09ICdyZWdyZXNzaW9uRXN0aW1hdG9yJyAmJiBbJ2Z1bGwnLCAnd2luZG93ZWQnLCAnbGlrZWxpZXN0J10uaW5kZXhPZih2YWwpID4gLTEpIHx8XG4gICAgICAgICAgKGtleSA9PT0gJ211bHRpQ2xhc3NSZWdyZXNzaW9uRXN0aW1hdG9yJyAmJiBbJ2xpa2VsaWVzdCcsICdtaXh0dXJlJ10uaW5kZXhPZih2YWwpID4gLTEpKSB7XG4gICAgICAgIHRoaXMuX2NvbmZpZ1trZXldID0gdmFsO1xuICAgICAgfSBlbHNlIGlmIChrZXkgPT09ICdsaWtlbGlob29kV2luZG93JyAmJiBOdW1iZXIuaXNJbnRlZ2VyKHZhbCkgJiYgdmFsID4gMCkge1xuICAgICAgICB0aGlzLl9saWtlbGlob29kV2luZG93ID0gdmFsO1xuXG4gICAgICAgIGlmICh0aGlzLl9kZWNvZGVyICE9PSBudWxsKSB7XG4gICAgICAgICAgdGhpcy5fZGVjb2Rlci5zZXRMaWtlbGlob29kV2luZG93KHRoaXMuX2xpa2VsaWhvb2RXaW5kb3cpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gIH1cblxuICAvKipcbiAgICogUmV0cmlldmUgdGhlIG1vZGVsIGluIFJhcGlkTWl4IG1vZGVsIGZvcm1hdC5cbiAgICpcbiAgICogQHJldHVybiB7T2JqZWN0fSAtIEN1cnJlbnQgUmFwaWRNaXggTW9kZWwgb2JqZWN0LlxuICAgKi9cbiAgZ2V0TW9kZWwoKSB7XG4gICAgcmV0dXJuIHRoaXMuX21vZGVsO1xuICB9XG5cbiAgLyoqXG4gICAqIFVzZSB0aGUgZ2l2ZW4gUmFwaWRNaXggbW9kZWwgb2JqZWN0IGZvciB0aGUgZGVjb2RpbmcuXG4gICAqXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBtb2RlbCAtIFJhcGlkTWl4IE1vZGVsIG9iamVjdC5cbiAgICovXG4gIHNldE1vZGVsKG1vZGVsKSB7XG4gICAgaWYgKCFtb2RlbCkge1xuICAgICAgdGhpcy5tb2RlbCA9IG51bGw7XG4gICAgICB0aGlzLl9kZWNvZGVyLnNldE1vZGVsKG51bGwpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmIChtb2RlbC50YXJnZXQubmFtZSA9PT0gJ3htbScpIHtcbiAgICAgIHRoaXMuX21vZGVsVHlwZSA9IG1vZGVsLnBheWxvYWQubW9kZWxUeXBlO1xuICAgICAgdGhpcy5fbW9kZWwgPSBtb2RlbDtcbiAgICAgIGNvbnN0IHhtbU1vZGVsID0gcmFwaWRNaXhBZGFwdGVycy5yYXBpZE1peFRvWG1tTW9kZWwobW9kZWwpO1xuXG4gICAgICB0aGlzLl9zZXREZWNvZGVyKCk7XG4gICAgICB0aGlzLl9kZWNvZGVyLnNldE1vZGVsKHhtbU1vZGVsKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBJbnZhbGlkIHRhcmdldCBuYW1lYCk7XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IFhtbVByb2Nlc3NvcjtcblxuIl19