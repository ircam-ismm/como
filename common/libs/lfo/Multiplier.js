"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _BaseLfo = _interopRequireDefault(require("./BaseLfo.js"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const definitions = {
  // float or array
  factor: {
    type: 'any',
    default: 1
  }
};
/**
 * Multiply a given signal or vector by a given factor. On vector
 * streams, `factor` can be an array of values to apply on each dimension of the
 * vector frames.
 *
 * _support `standalone` usage_
 *
 * @param {Object} options - override default values
 * @param {Number|Array} [options.factor=1] - factor or array of factor to
 *  apply on the incomming frame. Setting an array is only defined in case of
 *  a vector stream.
 *
 * @memberof module:common.operator
 *
 * @example
 * import * as lfo from 'waves-lfo/common';
 *
 * const eventIn = new lfo.operator.EventIn({
 *   type: 'vector',
 *   frameSize: 2,
 *   frameRate: 0,
 * });
 * const scaler = new lfo.operator.Multiplier({ factor: 0.1 });
 *
 * eventIn.connect(scaler);
 *
 * eventIn.process(null, [2, 3]);
 * > [0.2, 0.3]
 */

class Multiplier extends _BaseLfo.default {
  constructor(options) {
    super(definitions, options);
  }
  /**
   * Use the `Multiplier` operator in standalone mode.
   *
   * @param {Float32Array|Array} data - Input vector
   * @return {Array} - Scaled values
   *
   * @example
   * const scaler = new Multiplier({ factor: [2, 4] });
   * scaler.initStream({ frameType: 'vector', frameSize: 2 });
   *
   * scaler.inputVector([3, 2]);
   * > [6, 8]
   */


  inputVector(data) {
    const output = this.frame.data;
    const frameSize = this.streamParams.frameSize;
    const factor = this.params.get('factor');

    if (Array.isArray(factor)) {
      for (let i = 0; i < frameSize; i++) output[i] = data[i] * factor[i];
    } else {
      for (let i = 0; i < frameSize; i++) output[i] = data[i] * factor;
    }

    return output;
  }
  /** @private */


  processVector(frame) {
    this.frame.data = this.inputVector(frame.data);
  }
  /**
   * Use the `Multiplier` operator in standalone mode.
   *
   * @param {Float32Array|Array} data - Input signal.
   * @return {Array} - Scaled signal.
   *
   * @example
   * const scaler = new Multiplier({ factor: 0.1 });
   * scaler.initStream({ frameType: 'signal', frameSize: 2 });
   *
   * scaler.inputVector([1, 2]);
   * > [0.1, 0.2]
   */


  inputSignal(data) {
    const output = this.frame.data;
    const frameSize = this.streamParams.frameSize;
    const factor = this.params.get('factor');

    for (let i = 0; i < frameSize; i++) output[i] = data[i] * factor;

    return output;
  }
  /** @private */


  processSignal(frame) {
    this.frame.data = this.inputSignal(frame.data);
  }

}

var _default = Multiplier;
exports.default = _default;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9jb21tb24vbGlicy9sZm8vTXVsdGlwbGllci5qcyJdLCJuYW1lcyI6WyJkZWZpbml0aW9ucyIsImZhY3RvciIsInR5cGUiLCJkZWZhdWx0IiwiTXVsdGlwbGllciIsIkJhc2VMZm8iLCJjb25zdHJ1Y3RvciIsIm9wdGlvbnMiLCJpbnB1dFZlY3RvciIsImRhdGEiLCJvdXRwdXQiLCJmcmFtZSIsImZyYW1lU2l6ZSIsInN0cmVhbVBhcmFtcyIsInBhcmFtcyIsImdldCIsIkFycmF5IiwiaXNBcnJheSIsImkiLCJwcm9jZXNzVmVjdG9yIiwiaW5wdXRTaWduYWwiLCJwcm9jZXNzU2lnbmFsIl0sIm1hcHBpbmdzIjoiOzs7Ozs7O0FBQUE7Ozs7QUFFQSxNQUFNQSxXQUFXLEdBQUc7QUFDbEI7QUFDQUMsRUFBQUEsTUFBTSxFQUFFO0FBQ05DLElBQUFBLElBQUksRUFBRSxLQURBO0FBRU5DLElBQUFBLE9BQU8sRUFBRTtBQUZIO0FBRlUsQ0FBcEI7QUFRQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUNBLE1BQU1DLFVBQU4sU0FBeUJDLGdCQUF6QixDQUFpQztBQUMvQkMsRUFBQUEsV0FBVyxDQUFDQyxPQUFELEVBQVU7QUFDbkIsVUFBTVAsV0FBTixFQUFtQk8sT0FBbkI7QUFDRDtBQUVEO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUFDRUMsRUFBQUEsV0FBVyxDQUFDQyxJQUFELEVBQU87QUFDaEIsVUFBTUMsTUFBTSxHQUFHLEtBQUtDLEtBQUwsQ0FBV0YsSUFBMUI7QUFDQSxVQUFNRyxTQUFTLEdBQUcsS0FBS0MsWUFBTCxDQUFrQkQsU0FBcEM7QUFDQSxVQUFNWCxNQUFNLEdBQUcsS0FBS2EsTUFBTCxDQUFZQyxHQUFaLENBQWdCLFFBQWhCLENBQWY7O0FBRUEsUUFBSUMsS0FBSyxDQUFDQyxPQUFOLENBQWNoQixNQUFkLENBQUosRUFBMkI7QUFDekIsV0FBSyxJQUFJaUIsQ0FBQyxHQUFHLENBQWIsRUFBZ0JBLENBQUMsR0FBR04sU0FBcEIsRUFBK0JNLENBQUMsRUFBaEMsRUFDRVIsTUFBTSxDQUFDUSxDQUFELENBQU4sR0FBWVQsSUFBSSxDQUFDUyxDQUFELENBQUosR0FBVWpCLE1BQU0sQ0FBQ2lCLENBQUQsQ0FBNUI7QUFDSCxLQUhELE1BR087QUFDTCxXQUFLLElBQUlBLENBQUMsR0FBRyxDQUFiLEVBQWdCQSxDQUFDLEdBQUdOLFNBQXBCLEVBQStCTSxDQUFDLEVBQWhDLEVBQ0VSLE1BQU0sQ0FBQ1EsQ0FBRCxDQUFOLEdBQVlULElBQUksQ0FBQ1MsQ0FBRCxDQUFKLEdBQVVqQixNQUF0QjtBQUNIOztBQUVELFdBQU9TLE1BQVA7QUFDRDtBQUVEOzs7QUFDQVMsRUFBQUEsYUFBYSxDQUFDUixLQUFELEVBQVE7QUFDbkIsU0FBS0EsS0FBTCxDQUFXRixJQUFYLEdBQWtCLEtBQUtELFdBQUwsQ0FBaUJHLEtBQUssQ0FBQ0YsSUFBdkIsQ0FBbEI7QUFDRDtBQUVEO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUFDRVcsRUFBQUEsV0FBVyxDQUFDWCxJQUFELEVBQU87QUFDaEIsVUFBTUMsTUFBTSxHQUFHLEtBQUtDLEtBQUwsQ0FBV0YsSUFBMUI7QUFDQSxVQUFNRyxTQUFTLEdBQUcsS0FBS0MsWUFBTCxDQUFrQkQsU0FBcEM7QUFDQSxVQUFNWCxNQUFNLEdBQUcsS0FBS2EsTUFBTCxDQUFZQyxHQUFaLENBQWdCLFFBQWhCLENBQWY7O0FBRUEsU0FBSyxJQUFJRyxDQUFDLEdBQUcsQ0FBYixFQUFnQkEsQ0FBQyxHQUFHTixTQUFwQixFQUErQk0sQ0FBQyxFQUFoQyxFQUNFUixNQUFNLENBQUNRLENBQUQsQ0FBTixHQUFZVCxJQUFJLENBQUNTLENBQUQsQ0FBSixHQUFVakIsTUFBdEI7O0FBRUYsV0FBT1MsTUFBUDtBQUNEO0FBRUQ7OztBQUNBVyxFQUFBQSxhQUFhLENBQUNWLEtBQUQsRUFBUTtBQUNuQixTQUFLQSxLQUFMLENBQVdGLElBQVgsR0FBa0IsS0FBS1csV0FBTCxDQUFpQlQsS0FBSyxDQUFDRixJQUF2QixDQUFsQjtBQUNEOztBQWxFOEI7O2VBcUVsQkwsVSIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCBCYXNlTGZvIGZyb20gJy4vQmFzZUxmby5qcyc7XG5cbmNvbnN0IGRlZmluaXRpb25zID0ge1xuICAvLyBmbG9hdCBvciBhcnJheVxuICBmYWN0b3I6IHtcbiAgICB0eXBlOiAnYW55JyxcbiAgICBkZWZhdWx0OiAxLFxuICB9XG59O1xuXG4vKipcbiAqIE11bHRpcGx5IGEgZ2l2ZW4gc2lnbmFsIG9yIHZlY3RvciBieSBhIGdpdmVuIGZhY3Rvci4gT24gdmVjdG9yXG4gKiBzdHJlYW1zLCBgZmFjdG9yYCBjYW4gYmUgYW4gYXJyYXkgb2YgdmFsdWVzIHRvIGFwcGx5IG9uIGVhY2ggZGltZW5zaW9uIG9mIHRoZVxuICogdmVjdG9yIGZyYW1lcy5cbiAqXG4gKiBfc3VwcG9ydCBgc3RhbmRhbG9uZWAgdXNhZ2VfXG4gKlxuICogQHBhcmFtIHtPYmplY3R9IG9wdGlvbnMgLSBvdmVycmlkZSBkZWZhdWx0IHZhbHVlc1xuICogQHBhcmFtIHtOdW1iZXJ8QXJyYXl9IFtvcHRpb25zLmZhY3Rvcj0xXSAtIGZhY3RvciBvciBhcnJheSBvZiBmYWN0b3IgdG9cbiAqICBhcHBseSBvbiB0aGUgaW5jb21taW5nIGZyYW1lLiBTZXR0aW5nIGFuIGFycmF5IGlzIG9ubHkgZGVmaW5lZCBpbiBjYXNlIG9mXG4gKiAgYSB2ZWN0b3Igc3RyZWFtLlxuICpcbiAqIEBtZW1iZXJvZiBtb2R1bGU6Y29tbW9uLm9wZXJhdG9yXG4gKlxuICogQGV4YW1wbGVcbiAqIGltcG9ydCAqIGFzIGxmbyBmcm9tICd3YXZlcy1sZm8vY29tbW9uJztcbiAqXG4gKiBjb25zdCBldmVudEluID0gbmV3IGxmby5vcGVyYXRvci5FdmVudEluKHtcbiAqICAgdHlwZTogJ3ZlY3RvcicsXG4gKiAgIGZyYW1lU2l6ZTogMixcbiAqICAgZnJhbWVSYXRlOiAwLFxuICogfSk7XG4gKiBjb25zdCBzY2FsZXIgPSBuZXcgbGZvLm9wZXJhdG9yLk11bHRpcGxpZXIoeyBmYWN0b3I6IDAuMSB9KTtcbiAqXG4gKiBldmVudEluLmNvbm5lY3Qoc2NhbGVyKTtcbiAqXG4gKiBldmVudEluLnByb2Nlc3MobnVsbCwgWzIsIDNdKTtcbiAqID4gWzAuMiwgMC4zXVxuICovXG5jbGFzcyBNdWx0aXBsaWVyIGV4dGVuZHMgQmFzZUxmbyB7XG4gIGNvbnN0cnVjdG9yKG9wdGlvbnMpIHtcbiAgICBzdXBlcihkZWZpbml0aW9ucywgb3B0aW9ucyk7XG4gIH1cblxuICAvKipcbiAgICogVXNlIHRoZSBgTXVsdGlwbGllcmAgb3BlcmF0b3IgaW4gc3RhbmRhbG9uZSBtb2RlLlxuICAgKlxuICAgKiBAcGFyYW0ge0Zsb2F0MzJBcnJheXxBcnJheX0gZGF0YSAtIElucHV0IHZlY3RvclxuICAgKiBAcmV0dXJuIHtBcnJheX0gLSBTY2FsZWQgdmFsdWVzXG4gICAqXG4gICAqIEBleGFtcGxlXG4gICAqIGNvbnN0IHNjYWxlciA9IG5ldyBNdWx0aXBsaWVyKHsgZmFjdG9yOiBbMiwgNF0gfSk7XG4gICAqIHNjYWxlci5pbml0U3RyZWFtKHsgZnJhbWVUeXBlOiAndmVjdG9yJywgZnJhbWVTaXplOiAyIH0pO1xuICAgKlxuICAgKiBzY2FsZXIuaW5wdXRWZWN0b3IoWzMsIDJdKTtcbiAgICogPiBbNiwgOF1cbiAgICovXG4gIGlucHV0VmVjdG9yKGRhdGEpIHtcbiAgICBjb25zdCBvdXRwdXQgPSB0aGlzLmZyYW1lLmRhdGE7XG4gICAgY29uc3QgZnJhbWVTaXplID0gdGhpcy5zdHJlYW1QYXJhbXMuZnJhbWVTaXplO1xuICAgIGNvbnN0IGZhY3RvciA9IHRoaXMucGFyYW1zLmdldCgnZmFjdG9yJyk7XG5cbiAgICBpZiAoQXJyYXkuaXNBcnJheShmYWN0b3IpKSB7XG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGZyYW1lU2l6ZTsgaSsrKVxuICAgICAgICBvdXRwdXRbaV0gPSBkYXRhW2ldICogZmFjdG9yW2ldO1xuICAgIH0gZWxzZSB7XG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGZyYW1lU2l6ZTsgaSsrKVxuICAgICAgICBvdXRwdXRbaV0gPSBkYXRhW2ldICogZmFjdG9yO1xuICAgIH1cblxuICAgIHJldHVybiBvdXRwdXQ7XG4gIH1cblxuICAvKiogQHByaXZhdGUgKi9cbiAgcHJvY2Vzc1ZlY3RvcihmcmFtZSkge1xuICAgIHRoaXMuZnJhbWUuZGF0YSA9IHRoaXMuaW5wdXRWZWN0b3IoZnJhbWUuZGF0YSk7XG4gIH1cblxuICAvKipcbiAgICogVXNlIHRoZSBgTXVsdGlwbGllcmAgb3BlcmF0b3IgaW4gc3RhbmRhbG9uZSBtb2RlLlxuICAgKlxuICAgKiBAcGFyYW0ge0Zsb2F0MzJBcnJheXxBcnJheX0gZGF0YSAtIElucHV0IHNpZ25hbC5cbiAgICogQHJldHVybiB7QXJyYXl9IC0gU2NhbGVkIHNpZ25hbC5cbiAgICpcbiAgICogQGV4YW1wbGVcbiAgICogY29uc3Qgc2NhbGVyID0gbmV3IE11bHRpcGxpZXIoeyBmYWN0b3I6IDAuMSB9KTtcbiAgICogc2NhbGVyLmluaXRTdHJlYW0oeyBmcmFtZVR5cGU6ICdzaWduYWwnLCBmcmFtZVNpemU6IDIgfSk7XG4gICAqXG4gICAqIHNjYWxlci5pbnB1dFZlY3RvcihbMSwgMl0pO1xuICAgKiA+IFswLjEsIDAuMl1cbiAgICovXG4gIGlucHV0U2lnbmFsKGRhdGEpIHtcbiAgICBjb25zdCBvdXRwdXQgPSB0aGlzLmZyYW1lLmRhdGE7XG4gICAgY29uc3QgZnJhbWVTaXplID0gdGhpcy5zdHJlYW1QYXJhbXMuZnJhbWVTaXplO1xuICAgIGNvbnN0IGZhY3RvciA9IHRoaXMucGFyYW1zLmdldCgnZmFjdG9yJyk7XG5cbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGZyYW1lU2l6ZTsgaSsrKVxuICAgICAgb3V0cHV0W2ldID0gZGF0YVtpXSAqIGZhY3RvcjtcblxuICAgIHJldHVybiBvdXRwdXQ7XG4gIH1cblxuICAvKiogQHByaXZhdGUgKi9cbiAgcHJvY2Vzc1NpZ25hbChmcmFtZSkge1xuICAgIHRoaXMuZnJhbWUuZGF0YSA9IHRoaXMuaW5wdXRTaWduYWwoZnJhbWUuZGF0YSk7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgTXVsdGlwbGllcjtcbiJdfQ==