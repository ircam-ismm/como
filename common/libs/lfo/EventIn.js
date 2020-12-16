"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _BaseLfo = _interopRequireDefault(require("./BaseLfo.js"));

var _SourceMixin = _interopRequireDefault(require("./SourceMixin.js"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// http://stackoverflow.com/questions/17575790/environment-detection-node-js-or-browser
const isNode = new Function('try { return this === global; } catch(e) { return false }');
/**
 * Create a function that returns time in seconds according to the current
 * environnement (node or browser).
 * If running in node the time rely on `process.hrtime`, while if in the browser
 * it is provided by the `currentTime` of an `AudioContext`, this context can
 * optionnaly be provided to keep time consistency between several `EventIn`
 * nodes.
 *
 * @param {AudioContext} [audioContext=null] - Optionnal audio context.
 * @return {Function}
 * @private
 */

function getTimeFunction(audioContext = null) {
  if (isNode()) {
    return () => {
      const t = process.hrtime();
      return t[0] + t[1] * 1e-9;
    };
  } else {
    return () => performance.now() / 1000;
  }
}

const definitions = {
  absoluteTime: {
    type: 'boolean',
    default: false,
    constant: true
  },
  audioContext: {
    type: 'any',
    default: null,
    constant: true,
    nullable: true
  },
  frameType: {
    type: 'enum',
    list: ['signal', 'vector', 'scalar'],
    default: 'signal',
    constant: true
  },
  frameSize: {
    type: 'integer',
    default: 1,
    min: 1,
    max: +Infinity,
    // not recommended...
    metas: {
      kind: 'static'
    }
  },
  sampleRate: {
    type: 'float',
    default: null,
    min: 0,
    max: +Infinity,
    // same here
    nullable: true,
    metas: {
      kind: 'static'
    }
  },
  frameRate: {
    type: 'float',
    default: null,
    min: 0,
    max: +Infinity,
    // same here
    nullable: true,
    metas: {
      kind: 'static'
    }
  },
  description: {
    type: 'any',
    default: null,
    constant: true
  }
};
/**
 * The `EventIn` operator allows to manually create a stream of data or to feed
 * a stream from another source (e.g. sensors) into a processing graph.
 *
 * @param {Object} options - Override parameters' default values.
 * @param {String} [options.frameType='signal'] - Type of the input - allowed
 * values: `signal`,  `vector` or `scalar`.
 * @param {Number} [options.frameSize=1] - Size of the output frame.
 * @param {Number} [options.sampleRate=null] - Sample rate of the source stream,
 *  if of type `signal`.
 * @param {Number} [options.frameRate=null] - Rate of the source stream, if of
 *  type `vector`.
 * @param {Array|String} [options.description] - Optionnal description
 *  describing the dimensions of the output frame
 * @param {Boolean} [options.absoluteTime=false] - Define if time should be used
 *  as forwarded as given in the process method, or relatively to the time of
 *  the first `process` call after start.
 *
 * @memberof module:common.source
 *
 * @todo - Add a `logicalTime` parameter to tag frame according to frame rate.
 *
 * @example
 * import * as lfo from 'waves-lfo/client';
 *
 * const eventIn = new lfo.source.EventIn({
 *   frameType: 'vector',
 *   frameSize: 3,
 *   frameRate: 1 / 50,
 *   description: ['alpha', 'beta', 'gamma'],
 * });
 *
 * // connect source to operators and sink(s)
 *
 * // initialize and start the graph
 * eventIn.start();
 *
 * // feed `deviceorientation` data into the graph
 * window.addEventListener('deviceorientation', (e) => {
 *   const frame = {
 *     time: window.performace.now() / 1000,
 *     data: [e.alpha, e.beta, e.gamma],
 *   };
 *
 *   eventIn.processFrame(frame);
 * }, false);
 */

class EventIn extends (0, _SourceMixin.default)(_BaseLfo.default) {
  constructor(options = {}) {
    super(definitions, options);
    const audioContext = this.params.get('audioContext');
    this._getTime = getTimeFunction(audioContext);
    this._startTime = null;
    this._systemTime = null;
    this._absoluteTime = this.params.get('absoluteTime');
  }
  /**
   * Propagate the `streamParams` in the graph and allow to push frames into
   * the graph. Any call to `process` or `processFrame` before `start` will be
   * ignored.
   *
   * @see {@link module:core.BaseLfo#processStreamParams}
   * @see {@link module:core.BaseLfo#resetStream}
   * @see {@link module:common.source.EventIn#stop}
   */


  start(startTime = null) {
    if (this.initialized === false) {
      if (this.initPromise === null) // init has not yet been called
        this.initPromise = this.init();
      return this.initPromise.then(() => this.start(startTime));
    }

    this._startTime = startTime;
    this._systemTime = null; // value set in the first `process` call

    this.started = true;
  }
  /**
   * Finalize the stream and stop the whole graph. Any call to `process` or
   * `processFrame` after `stop` will be ignored.
   *
   * @see {@link module:core.BaseLfo#finalizeStream}
   * @see {@link module:common.source.EventIn#start}
   */


  stop() {
    if (this.started && this._startTime !== null) {
      const currentTime = this._getTime();

      const endTime = this.frame.time + (currentTime - this._systemTime);
      this.finalizeStream(endTime);
      this.started = false;
    }
  }
  /** @private */


  processStreamParams() {
    const frameSize = this.params.get('frameSize');
    const frameType = this.params.get('frameType');
    const sampleRate = this.params.get('sampleRate');
    const frameRate = this.params.get('frameRate');
    const description = this.params.get('description'); // init operator's stream params

    this.streamParams.frameSize = frameType === 'scalar' ? 1 : frameSize;
    this.streamParams.frameType = frameType;
    this.streamParams.description = description;

    if (frameType === 'signal') {
      if (sampleRate === null) throw new Error('Undefined "sampleRate" for "signal" stream');
      this.streamParams.sourceSampleRate = sampleRate;
      this.streamParams.frameRate = sampleRate / frameSize;
      this.streamParams.sourceSampleCount = frameSize;
    } else if (frameType === 'vector' || frameType === 'scalar') {
      if (frameRate === null) throw new Error(`Undefined "frameRate" for "${frameType}" stream`);
      this.streamParams.frameRate = frameRate;
      this.streamParams.sourceSampleRate = frameRate;
      this.streamParams.sourceSampleCount = 1;
    }

    this.propagateStreamParams();
  }
  /** @private */


  processFunction(frame) {
    const currentTime = this._getTime();

    const inData = frame.data.length ? frame.data : [frame.data];
    const outData = this.frame.data; // if no time provided, use system time

    let time = Number.isFinite(frame.time) ? frame.time : currentTime;
    if (this._startTime === null) this._startTime = time;
    if (this._absoluteTime === false) time = time - this._startTime;

    for (let i = 0, l = this.streamParams.frameSize; i < l; i++) outData[i] = inData[i];

    this.frame.time = time;
    this.frame.metadata = frame.metadata; // store current time to compute `endTime` on stop

    this._systemTime = currentTime;
  }
  /**
   * Alternative interface to propagate a frame in the graph. Pack `time`,
   * `data` and `metadata` in a frame object.
   *
   * @param {Number} time - Frame time.
   * @param {Float32Array|Array} data - Frame data.
   * @param {Object} metadata - Optionnal frame metadata.
   *
   * @example
   * eventIn.process(1, [0, 1, 2]);
   * // is equivalent to
   * eventIn.processFrame({ time: 1, data: [0, 1, 2] });
   */


  process(time, data, metadata = null) {
    this.processFrame({
      time,
      data,
      metadata
    });
  }
  /**
   * Propagate a frame object in the graph.
   *
   * @param {Object} frame - Input frame.
   * @param {Number} frame.time - Frame time.
   * @param {Float32Array|Array} frame.data - Frame data.
   * @param {Object} [frame.metadata=undefined] - Optionnal frame metadata.
   *
   * @example
   * eventIn.processFrame({ time: 1, data: [0, 1, 2] });
   */


  processFrame(frame) {
    if (!this.started) return;
    this.prepareFrame();
    this.processFunction(frame);
    this.propagateFrame();
  }

}

var _default = EventIn;
exports.default = _default;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9jb21tb24vbGlicy9sZm8vRXZlbnRJbi5qcyJdLCJuYW1lcyI6WyJpc05vZGUiLCJGdW5jdGlvbiIsImdldFRpbWVGdW5jdGlvbiIsImF1ZGlvQ29udGV4dCIsInQiLCJwcm9jZXNzIiwiaHJ0aW1lIiwicGVyZm9ybWFuY2UiLCJub3ciLCJkZWZpbml0aW9ucyIsImFic29sdXRlVGltZSIsInR5cGUiLCJkZWZhdWx0IiwiY29uc3RhbnQiLCJudWxsYWJsZSIsImZyYW1lVHlwZSIsImxpc3QiLCJmcmFtZVNpemUiLCJtaW4iLCJtYXgiLCJJbmZpbml0eSIsIm1ldGFzIiwia2luZCIsInNhbXBsZVJhdGUiLCJmcmFtZVJhdGUiLCJkZXNjcmlwdGlvbiIsIkV2ZW50SW4iLCJCYXNlTGZvIiwiY29uc3RydWN0b3IiLCJvcHRpb25zIiwicGFyYW1zIiwiZ2V0IiwiX2dldFRpbWUiLCJfc3RhcnRUaW1lIiwiX3N5c3RlbVRpbWUiLCJfYWJzb2x1dGVUaW1lIiwic3RhcnQiLCJzdGFydFRpbWUiLCJpbml0aWFsaXplZCIsImluaXRQcm9taXNlIiwiaW5pdCIsInRoZW4iLCJzdGFydGVkIiwic3RvcCIsImN1cnJlbnRUaW1lIiwiZW5kVGltZSIsImZyYW1lIiwidGltZSIsImZpbmFsaXplU3RyZWFtIiwicHJvY2Vzc1N0cmVhbVBhcmFtcyIsInN0cmVhbVBhcmFtcyIsIkVycm9yIiwic291cmNlU2FtcGxlUmF0ZSIsInNvdXJjZVNhbXBsZUNvdW50IiwicHJvcGFnYXRlU3RyZWFtUGFyYW1zIiwicHJvY2Vzc0Z1bmN0aW9uIiwiaW5EYXRhIiwiZGF0YSIsImxlbmd0aCIsIm91dERhdGEiLCJOdW1iZXIiLCJpc0Zpbml0ZSIsImkiLCJsIiwibWV0YWRhdGEiLCJwcm9jZXNzRnJhbWUiLCJwcmVwYXJlRnJhbWUiLCJwcm9wYWdhdGVGcmFtZSJdLCJtYXBwaW5ncyI6Ijs7Ozs7OztBQUFBOztBQUNBOzs7O0FBRUE7QUFDQSxNQUFNQSxNQUFNLEdB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Q0FBQyxHQUFHQyxDQUFyRCxFQUF3REQsQ0FBQyxFQUF6RCxFQUNFSCxPQUFPLENBQUNHLENBQUQsQ0FBUCxHQUFhTixNQUFNLENBQUNNLENBQUQsQ0FBbkI7O0FBRUYsU0FBS2hCLEtBQUwsQ0FBV0MsSUFBWCxHQUFrQkEsSUFBbEI7QUFDQSxTQUFLRCxLQUFMLENBQVdrQixRQUFYLEdBQXNCbEIsS0FBSyxDQUFDa0IsUUFBNUIsQ0FqQnFCLENBa0JyQjs7QUFDQSxTQUFLOUIsV0FBTCxHQUFtQlUsV0FBbkI7QUFDRDtBQUVEO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUFDRXZDLEVBQUFBLE9BQU8sQ0FBQzBDLElBQUQsRUFBT1UsSUFBUCxFQUFhTyxRQUFRLEdBQUcsSUFBeEIsRUFBOEI7QUFDbkMsU0FBS0MsWUFBTCxDQUFrQjtBQUFFbEIsTUFBQUEsSUFBRjtBQUFRVSxNQUFBQSxJQUFSO0FBQWNPLE1BQUFBO0FBQWQsS0FBbEI7QUFDRDtBQUVEO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQUNFQyxFQUFBQSxZQUFZLENBQUNuQixLQUFELEVBQVE7QUFDbEIsUUFBSSxDQUFDLEtBQUtKLE9BQVYsRUFBbUI7QUFFbkIsU0FBS3dCLFlBQUw7QUFDQSxTQUFLWCxlQUFMLENBQXFCVCxLQUFyQjtBQUNBLFNBQUtxQixjQUFMO0FBQ0Q7O0FBN0l3Qzs7ZUFnSjVCekMsTyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCBCYXNlTGZvIGZyb20gJy4vQmFzZUxmby5qcyc7XG5pbXBvcnQgU291cmNlTWl4aW4gZnJvbSAnLi9Tb3VyY2VNaXhpbi5qcyc7XG5cbi8vIGh0dHA6Ly9zdGFja292ZXJmbG93LmNvbS9xdWVzdGlvbnMvMTc1NzU3OTAvZW52aXJvbm1lbnQtZGV0ZWN0aW9uLW5vZGUtanMtb3ItYnJvd3NlclxuY29uc3QgaXNOb2RlID0gbmV3IEZ1bmN0aW9uKCd0cnkgeyByZXR1cm4gdGhpcyA9PT0gZ2xvYmFsOyB9IGNhdGNoKGUpIHsgcmV0dXJuIGZhbHNlIH0nKTtcblxuLyoqXG4gKiBDcmVhdGUgYSBmdW5jdGlvbiB0aGF0IHJldHVybnMgdGltZSBpbiBzZWNvbmRzIGFjY29yZGluZyB0byB0aGUgY3VycmVudFxuICogZW52aXJvbm5lbWVudCAobm9kZSBvciBicm93c2VyKS5cbiAqIElmIHJ1bm5pbmcgaW4gbm9kZSB0aGUgdGltZSByZWx5IG9uIGBwcm9jZXNzLmhydGltZWAsIHdoaWxlIGlmIGluIHRoZSBicm93c2VyXG4gKiBpdCBpcyBwcm92aWRlZCBieSB0aGUgYGN1cnJlbnRUaW1lYCBvZiBhbiBgQXVkaW9Db250ZXh0YCwgdGhpcyBjb250ZXh0IGNhblxuICogb3B0aW9ubmFseSBiZSBwcm92aWRlZCB0byBrZWVwIHRpbWUgY29uc2lzdGVuY3kgYmV0d2VlbiBzZXZlcmFsIGBFdmVudEluYFxuICogbm9kZXMuXG4gKlxuICogQHBhcmFtIHtBdWRpb0NvbnRleHR9IFthdWRpb0NvbnRleHQ9bnVsbF0gLSBPcHRpb25uYWwgYXVkaW8gY29udGV4dC5cbiAqIEByZXR1cm4ge0Z1bmN0aW9ufVxuICogQHByaXZhdGVcbiAqL1xuZnVuY3Rpb24gZ2V0VGltZUZ1bmN0aW9uKGF1ZGlvQ29udGV4dCA9IG51bGwpIHtcbiAgaWYgKGlzTm9kZSgpKSB7XG4gICAgcmV0dXJuICgpID0+IHtcbiAgICAgIGNvbnN0IHQgPSBwcm9jZXNzLmhydGltZSgpO1xuICAgICAgcmV0dXJuIHRbMF0gKyB0WzFdICogMWUtOTtcbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuICgpID0+IHBlcmZvcm1hbmNlLm5vdygpIC8gMTAwMDtcbiAgfVxufVxuXG5cbmNvbnN0IGRlZmluaXRpb25zID0ge1xuICBhYnNvbHV0ZVRpbWU6IHtcbiAgICB0eXBlOiAnYm9vbGVhbicsXG4gICAgZGVmYXVsdDogZmFsc2UsXG4gICAgY29uc3RhbnQ6IHRydWUsXG4gIH0sXG4gIGF1ZGlvQ29udGV4dDoge1xuICAgIHR5cGU6ICdhbnknLFxuICAgIGRlZmF1bHQ6IG51bGwsXG4gICAgY29uc3RhbnQ6IHRydWUsXG4gICAgbnVsbGFibGU6IHRydWUsXG4gIH0sXG4gIGZyYW1lVHlwZToge1xuICAgIHR5cGU6ICdlbnVtJyxcbiAgICBsaXN0OiBbJ3NpZ25hbCcsICd2ZWN0b3InLCAnc2NhbGFyJ10sXG4gICAgZGVmYXVsdDogJ3NpZ25hbCcsXG4gICAgY29uc3RhbnQ6IHRydWUsXG4gIH0sXG4gIGZyYW1lU2l6ZToge1xuICAgIHR5cGU6ICdpbnRlZ2VyJyxcbiAgICBkZWZhdWx0OiAxLFxuICAgIG1pbjogMSxcbiAgICBtYXg6ICtJbmZpbml0eSwgLy8gbm90IHJlY29tbWVuZGVkLi4uXG4gICAgbWV0YXM6IHsga2luZDogJ3N0YXRpYycgfSxcbiAgfSxcbiAgc2FtcGxlUmF0ZToge1xuICAgIHR5cGU6ICdmbG9hdCcsXG4gICAgZGVmYXVsdDogbnVsbCxcbiAgICBtaW46IDAsXG4gICAgbWF4OiArSW5maW5pdHksIC8vIHNhbWUgaGVyZVxuICAgIG51bGxhYmxlOiB0cnVlLFxuICAgIG1ldGFzOiB7IGtpbmQ6ICdzdGF0aWMnIH0sXG4gIH0sXG4gIGZyYW1lUmF0ZToge1xuICAgIHR5cGU6ICdmbG9hdCcsXG4gICAgZGVmYXVsdDogbnVsbCxcbiAgICBtaW46IDAsXG4gICAgbWF4OiArSW5maW5pdHksIC8vIHNhbWUgaGVyZVxuICAgIG51bGxhYmxlOiB0cnVlLFxuICAgIG1ldGFzOiB7IGtpbmQ6ICdzdGF0aWMnIH0sXG4gIH0sXG4gIGRlc2NyaXB0aW9uOiB7XG4gICAgdHlwZTogJ2FueScsXG4gICAgZGVmYXVsdDogbnVsbCxcbiAgICBjb25zdGFudDogdHJ1ZSxcbiAgfVxufTtcblxuLyoqXG4gKiBUaGUgYEV2ZW50SW5gIG9wZXJhdG9yIGFsbG93cyB0byBtYW51YWxseSBjcmVhdGUgYSBzdHJlYW0gb2YgZGF0YSBvciB0byBmZWVkXG4gKiBhIHN0cmVhbSBmcm9tIGFub3RoZXIgc291cmNlIChlLmcuIHNlbnNvcnMpIGludG8gYSBwcm9jZXNzaW5nIGdyYXBoLlxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSBvcHRpb25zIC0gT3ZlcnJpZGUgcGFyYW1ldGVycycgZGVmYXVsdCB2YWx1ZXMuXG4gKiBAcGFyYW0ge1N0cmluZ30gW29wdGlvbnMuZnJhbWVUeXBlPSdzaWduYWwnXSAtIFR5cGUgb2YgdGhlIGlucHV0IC0gYWxsb3dlZFxuICogdmFsdWVzOiBgc2lnbmFsYCwgIGB2ZWN0b3JgIG9yIGBzY2FsYXJgLlxuICogQHBhcmFtIHtOdW1iZXJ9IFtvcHRpb25zLmZyYW1lU2l6ZT0xXSAtIFNpemUgb2YgdGhlIG91dHB1dCBmcmFtZS5cbiAqIEBwYXJhbSB7TnVtYmVyfSBbb3B0aW9ucy5zYW1wbGVSYXRlPW51bGxdIC0gU2FtcGxlIHJhdGUgb2YgdGhlIHNvdXJjZSBzdHJlYW0sXG4gKiAgaWYgb2YgdHlwZSBgc2lnbmFsYC5cbiAqIEBwYXJhbSB7TnVtYmVyfSBbb3B0aW9ucy5mcmFtZVJhdGU9bnVsbF0gLSBSYXRlIG9mIHRoZSBzb3VyY2Ugc3RyZWFtLCBpZiBvZlxuICogIHR5cGUgYHZlY3RvcmAuXG4gKiBAcGFyYW0ge0FycmF5fFN0cmluZ30gW29wdGlvbnMuZGVzY3JpcHRpb25dIC0gT3B0aW9ubmFsIGRlc2NyaXB0aW9uXG4gKiAgZGVzY3JpYmluZyB0aGUgZGltZW5zaW9ucyBvZiB0aGUgb3V0cHV0IGZyYW1lXG4gKiBAcGFyYW0ge0Jvb2xlYW59IFtvcHRpb25zLmFic29sdXRlVGltZT1mYWxzZV0gLSBEZWZpbmUgaWYgdGltZSBzaG91bGQgYmUgdXNlZFxuICogIGFzIGZvcndhcmRlZCBhcyBnaXZlbiBpbiB0aGUgcHJvY2VzcyBtZXRob2QsIG9yIHJlbGF0aXZlbHkgdG8gdGhlIHRpbWUgb2ZcbiAqICB0aGUgZmlyc3QgYHByb2Nlc3NgIGNhbGwgYWZ0ZXIgc3RhcnQuXG4gKlxuICogQG1lbWJlcm9mIG1vZHVsZTpjb21tb24uc291cmNlXG4gKlxuICogQHRvZG8gLSBBZGQgYSBgbG9naWNhbFRpbWVgIHBhcmFtZXRlciB0byB0YWcgZnJhbWUgYWNjb3JkaW5nIHRvIGZyYW1lIHJhdGUuXG4gKlxuICogQGV4YW1wbGVcbiAqIGltcG9ydCAqIGFzIGxmbyBmcm9tICd3YXZlcy1sZm8vY2xpZW50JztcbiAqXG4gKiBjb25zdCBldmVudEluID0gbmV3IGxmby5zb3VyY2UuRXZlbnRJbih7XG4gKiAgIGZyYW1lVHlwZTogJ3ZlY3RvcicsXG4gKiAgIGZyYW1lU2l6ZTogMyxcbiAqICAgZnJhbWVSYXRlOiAxIC8gNTAsXG4gKiAgIGRlc2NyaXB0aW9uOiBbJ2FscGhhJywgJ2JldGEnLCAnZ2FtbWEnXSxcbiAqIH0pO1xuICpcbiAqIC8vIGNvbm5lY3Qgc291cmNlIHRvIG9wZXJhdG9ycyBhbmQgc2luayhzKVxuICpcbiAqIC8vIGluaXRpYWxpemUgYW5kIHN0YXJ0IHRoZSBncmFwaFxuICogZXZlbnRJbi5zdGFydCgpO1xuICpcbiAqIC8vIGZlZWQgYGRldmljZW9yaWVudGF0aW9uYCBkYXRhIGludG8gdGhlIGdyYXBoXG4gKiB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcignZGV2aWNlb3JpZW50YXRpb24nLCAoZSkgPT4ge1xuICogICBjb25zdCBmcmFtZSA9IHtcbiAqICAgICB0aW1lOiB3aW5kb3cucGVyZm9ybWFjZS5ub3coKSAvIDEwMDAsXG4gKiAgICAgZGF0YTogW2UuYWxwaGEsIGUuYmV0YSwgZS5nYW1tYV0sXG4gKiAgIH07XG4gKlxuICogICBldmVudEluLnByb2Nlc3NGcmFtZShmcmFtZSk7XG4gKiB9LCBmYWxzZSk7XG4gKi9cbmNsYXNzIEV2ZW50SW4gZXh0ZW5kcyBTb3VyY2VNaXhpbihCYXNlTGZvKSB7XG4gIGNvbnN0cnVjdG9yKG9wdGlvbnMgPSB7fSkge1xuICAgIHN1cGVyKGRlZmluaXRpb25zLCBvcHRpb25zKTtcblxuICAgIGNvbnN0IGF1ZGlvQ29udGV4dCA9IHRoaXMucGFyYW1zLmdldCgnYXVkaW9Db250ZXh0Jyk7XG4gICAgdGhpcy5fZ2V0VGltZSA9IGdldFRpbWVGdW5jdGlvbihhdWRpb0NvbnRleHQpO1xuICAgIHRoaXMuX3N0YXJ0VGltZSA9IG51bGw7XG4gICAgdGhpcy5fc3lzdGVtVGltZSA9IG51bGw7XG4gICAgdGhpcy5fYWJzb2x1dGVUaW1lID0gdGhpcy5wYXJhbXMuZ2V0KCdhYnNvbHV0ZVRpbWUnKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBQcm9wYWdhdGUgdGhlIGBzdHJlYW1QYXJhbXNgIGluIHRoZSBncmFwaCBhbmQgYWxsb3cgdG8gcHVzaCBmcmFtZXMgaW50b1xuICAgKiB0aGUgZ3JhcGguIEFueSBjYWxsIHRvIGBwcm9jZXNzYCBvciBgcHJvY2Vzc0ZyYW1lYCBiZWZvcmUgYHN0YXJ0YCB3aWxsIGJlXG4gICAqIGlnbm9yZWQuXG4gICAqXG4gICAqIEBzZWUge0BsaW5rIG1vZHVsZTpjb3JlLkJhc2VMZm8jcHJvY2Vzc1N0cmVhbVBhcmFtc31cbiAgICogQHNlZSB7QGxpbmsgbW9kdWxlOmNvcmUuQmFzZUxmbyNyZXNldFN0cmVhbX1cbiAgICogQHNlZSB7QGxpbmsgbW9kdWxlOmNvbW1vbi5zb3VyY2UuRXZlbnRJbiNzdG9wfVxuICAgKi9cbiAgc3RhcnQoc3RhcnRUaW1lID0gbnVsbCkge1xuICAgIGlmICh0aGlzLmluaXRpYWxpemVkID09PSBmYWxzZSkge1xuICAgICAgaWYgKHRoaXMuaW5pdFByb21pc2UgPT09IG51bGwpIC8vIGluaXQgaGFzIG5vdCB5ZXQgYmVlbiBjYWxsZWRcbiAgICAgICAgdGhpcy5pbml0UHJvbWlzZSA9IHRoaXMuaW5pdCgpO1xuXG4gICAgICByZXR1cm4gdGhpcy5pbml0UHJvbWlzZS50aGVuKCgpID0+IHRoaXMuc3RhcnQoc3RhcnRUaW1lKSk7XG4gICAgfVxuXG4gICAgdGhpcy5fc3RhcnRUaW1lID0gc3RhcnRUaW1lO1xuICAgIHRoaXMuX3N5c3RlbVRpbWUgPSBudWxsOyAvLyB2YWx1ZSBzZXQgaW4gdGhlIGZpcnN0IGBwcm9jZXNzYCBjYWxsXG5cbiAgICB0aGlzLnN0YXJ0ZWQgPSB0cnVlO1xuICB9XG5cbiAgLyoqXG4gICAqIEZpbmFsaXplIHRoZSBzdHJlYW0gYW5kIHN0b3AgdGhlIHdob2xlIGdyYXBoLiBBbnkgY2FsbCB0byBgcHJvY2Vzc2Agb3JcbiAgICogYHByb2Nlc3NGcmFtZWAgYWZ0ZXIgYHN0b3BgIHdpbGwgYmUgaWdub3JlZC5cbiAgICpcbiAgICogQHNlZSB7QGxpbmsgbW9kdWxlOmNvcmUuQmFzZUxmbyNmaW5hbGl6ZVN0cmVhbX1cbiAgICogQHNlZSB7QGxpbmsgbW9kdWxlOmNvbW1vbi5zb3VyY2UuRXZlbnRJbiNzdGFydH1cbiAgICovXG4gIHN0b3AoKSB7XG4gICAgaWYgKHRoaXMuc3RhcnRlZCAmJiB0aGlzLl9zdGFydFRpbWUgIT09IG51bGwpIHtcbiAgICAgIGNvbnN0IGN1cnJlbnRUaW1lID0gdGhpcy5fZ2V0VGltZSgpO1xuICAgICAgY29uc3QgZW5kVGltZSA9IHRoaXMuZnJhbWUudGltZSArIChjdXJyZW50VGltZSAtIHRoaXMuX3N5c3RlbVRpbWUpO1xuXG4gICAgICB0aGlzLmZpbmFsaXplU3RyZWFtKGVuZFRpbWUpO1xuICAgICAgdGhpcy5zdGFydGVkID0gZmFsc2U7XG4gICAgfVxuICB9XG5cbiAgLyoqIEBwcml2YXRlICovXG4gIHByb2Nlc3NTdHJlYW1QYXJhbXMoKSB7XG4gICAgY29uc3QgZnJhbWVTaXplID0gdGhpcy5wYXJhbXMuZ2V0KCdmcmFtZVNpemUnKTtcbiAgICBjb25zdCBmcmFtZVR5cGUgPSB0aGlzLnBhcmFtcy5nZXQoJ2ZyYW1lVHlwZScpO1xuICAgIGNvbnN0IHNhbXBsZVJhdGUgPSB0aGlzLnBhcmFtcy5nZXQoJ3NhbXBsZVJhdGUnKTtcbiAgICBjb25zdCBmcmFtZVJhdGUgPSB0aGlzLnBhcmFtcy5nZXQoJ2ZyYW1lUmF0ZScpO1xuICAgIGNvbnN0IGRlc2NyaXB0aW9uID0gdGhpcy5wYXJhbXMuZ2V0KCdkZXNjcmlwdGlvbicpO1xuXG4gICAgLy8gaW5pdCBvcGVyYXRvcidzIHN0cmVhbSBwYXJhbXNcbiAgICB0aGlzLnN0cmVhbVBhcmFtcy5mcmFtZVNpemUgPSBmcmFtZVR5cGUgPT09ICdzY2FsYXInID8gMSA6IGZyYW1lU2l6ZTtcbiAgICB0aGlzLnN0cmVhbVBhcmFtcy5mcmFtZVR5cGUgPSBmcmFtZVR5cGU7XG4gICAgdGhpcy5zdHJlYW1QYXJhbXMuZGVzY3JpcHRpb24gPSBkZXNjcmlwdGlvbjtcblxuICAgIGlmIChmcmFtZVR5cGUgPT09ICdzaWduYWwnKSB7XG4gICAgICBpZiAoc2FtcGxlUmF0ZSA9PT0gbnVsbClcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbmRlZmluZWQgXCJzYW1wbGVSYXRlXCIgZm9yIFwic2lnbmFsXCIgc3RyZWFtJyk7XG5cbiAgICAgIHRoaXMuc3RyZWFtUGFyYW1zLnNvdXJjZVNhbXBsZVJhdGUgPSBzYW1wbGVSYXRlO1xuICAgICAgdGhpcy5zdHJlYW1QYXJhbXMuZnJhbWVSYXRlID0gc2FtcGxlUmF0ZSAvIGZyYW1lU2l6ZTtcbiAgICAgIHRoaXMuc3RyZWFtUGFyYW1zLnNvdXJjZVNhbXBsZUNvdW50ID0gZnJhbWVTaXplO1xuXG4gICAgfSBlbHNlIGlmIChmcmFtZVR5cGUgPT09ICd2ZWN0b3InIHx8IGZyYW1lVHlwZSA9PT0gJ3NjYWxhcicpIHtcbiAgICAgIGlmIChmcmFtZVJhdGUgPT09IG51bGwpXG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgVW5kZWZpbmVkIFwiZnJhbWVSYXRlXCIgZm9yIFwiJHtmcmFtZVR5cGV9XCIgc3RyZWFtYCk7XG5cbiAgICAgIHRoaXMuc3RyZWFtUGFyYW1zLmZyYW1lUmF0ZSA9IGZyYW1lUmF0ZTtcbiAgICAgIHRoaXMuc3RyZWFtUGFyYW1zLnNvdXJjZVNhbXBsZVJhdGUgPSBmcmFtZVJhdGU7XG4gICAgICB0aGlzLnN0cmVhbVBhcmFtcy5zb3VyY2VTYW1wbGVDb3VudCA9IDE7XG4gICAgfVxuXG4gICAgdGhpcy5wcm9wYWdhdGVTdHJlYW1QYXJhbXMoKTtcbiAgfVxuXG4gIC8qKiBAcHJpdmF0ZSAqL1xuICBwcm9jZXNzRnVuY3Rpb24oZnJhbWUpIHtcbiAgICBjb25zdCBjdXJyZW50VGltZSA9IHRoaXMuX2dldFRpbWUoKTtcbiAgICBjb25zdCBpbkRhdGEgPSBmcmFtZS5kYXRhLmxlbmd0aCA/IGZyYW1lLmRhdGEgOiBbZnJhbWUuZGF0YV07XG4gICAgY29uc3Qgb3V0RGF0YSA9IHRoaXMuZnJhbWUuZGF0YTtcbiAgICAvLyBpZiBubyB0aW1lIHByb3ZpZGVkLCB1c2Ugc3lzdGVtIHRpbWVcbiAgICBsZXQgdGltZSA9IE51bWJlci5pc0Zpbml0ZShmcmFtZS50aW1lKSA/IGZyYW1lLnRpbWUgOiBjdXJyZW50VGltZTtcblxuICAgIGlmICh0aGlzLl9zdGFydFRpbWUgPT09IG51bGwpXG4gICAgICB0aGlzLl9zdGFydFRpbWUgPSB0aW1lO1xuXG4gICAgaWYgKHRoaXMuX2Fic29sdXRlVGltZSA9PT0gZmFsc2UpXG4gICAgICB0aW1lID0gdGltZSAtIHRoaXMuX3N0YXJ0VGltZTtcblxuICAgIGZvciAobGV0IGkgPSAwLCBsID0gdGhpcy5zdHJlYW1QYXJhbXMuZnJhbWVTaXplOyBpIDwgbDsgaSsrKVxuICAgICAgb3V0RGF0YVtpXSA9IGluRGF0YVtpXTtcblxuICAgIHRoaXMuZnJhbWUudGltZSA9IHRpbWU7XG4gICAgdGhpcy5mcmFtZS5tZXRhZGF0YSA9IGZyYW1lLm1ldGFkYXRhO1xuICAgIC8vIHN0b3JlIGN1cnJlbnQgdGltZSB0byBjb21wdXRlIGBlbmRUaW1lYCBvbiBzdG9wXG4gICAgdGhpcy5fc3lzdGVtVGltZSA9IGN1cnJlbnRUaW1lO1xuICB9XG5cbiAgLyoqXG4gICAqIEFsdGVybmF0aXZlIGludGVyZmFjZSB0byBwcm9wYWdhdGUgYSBmcmFtZSBpbiB0aGUgZ3JhcGguIFBhY2sgYHRpbWVgLFxuICAgKiBgZGF0YWAgYW5kIGBtZXRhZGF0YWAgaW4gYSBmcmFtZSBvYmplY3QuXG4gICAqXG4gICAqIEBwYXJhbSB7TnVtYmVyfSB0aW1lIC0gRnJhbWUgdGltZS5cbiAgICogQHBhcmFtIHtGbG9hdDMyQXJyYXl8QXJyYXl9IGRhdGEgLSBGcmFtZSBkYXRhLlxuICAgKiBAcGFyYW0ge09iamVjdH0gbWV0YWRhdGEgLSBPcHRpb25uYWwgZnJhbWUgbWV0YWRhdGEuXG4gICAqXG4gICAqIEBleGFtcGxlXG4gICAqIGV2ZW50SW4ucHJvY2VzcygxLCBbMCwgMSwgMl0pO1xuICAgKiAvLyBpcyBlcXVpdmFsZW50IHRvXG4gICAqIGV2ZW50SW4ucHJvY2Vzc0ZyYW1lKHsgdGltZTogMSwgZGF0YTogWzAsIDEsIDJdIH0pO1xuICAgKi9cbiAgcHJvY2Vzcyh0aW1lLCBkYXRhLCBtZXRhZGF0YSA9IG51bGwpIHtcbiAgICB0aGlzLnByb2Nlc3NGcmFtZSh7IHRpbWUsIGRhdGEsIG1ldGFkYXRhIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIFByb3BhZ2F0ZSBhIGZyYW1lIG9iamVjdCBpbiB0aGUgZ3JhcGguXG4gICAqXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBmcmFtZSAtIElucHV0IGZyYW1lLlxuICAgKiBAcGFyYW0ge051bWJlcn0gZnJhbWUudGltZSAtIEZyYW1lIHRpbWUuXG4gICAqIEBwYXJhbSB7RmxvYXQzMkFycmF5fEFycmF5fSBmcmFtZS5kYXRhIC0gRnJhbWUgZGF0YS5cbiAgICogQHBhcmFtIHtPYmplY3R9IFtmcmFtZS5tZXRhZGF0YT11bmRlZmluZWRdIC0gT3B0aW9ubmFsIGZyYW1lIG1ldGFkYXRhLlxuICAgKlxuICAgKiBAZXhhbXBsZVxuICAgKiBldmVudEluLnByb2Nlc3NGcmFtZSh7IHRpbWU6IDEsIGRhdGE6IFswLCAxLCAyXSB9KTtcbiAgICovXG4gIHByb2Nlc3NGcmFtZShmcmFtZSkge1xuICAgIGlmICghdGhpcy5zdGFydGVkKSByZXR1cm47XG5cbiAgICB0aGlzLnByZXBhcmVGcmFtZSgpO1xuICAgIHRoaXMucHJvY2Vzc0Z1bmN0aW9uKGZyYW1lKTtcbiAgICB0aGlzLnByb3BhZ2F0ZUZyYW1lKCk7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgRXZlbnRJbjtcbiJdfQ==