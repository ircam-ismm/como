"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _BaseLfo = _interopRequireDefault(require("./BaseLfo.js"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const definitions = {
  type: {
    type: 'enum',
    list: ['linear'],
    default: 'linear',
    metas: {
      kind: 'dynamic'
    }
  },
  inputMin: {
    type: 'float',
    default: 0,
    min: -Infinity,
    max: +Infinity,
    metas: {
      kind: 'dynamic'
    }
  },
  inputMax: {
    type: 'float',
    default: 1,
    min: -Infinity,
    max: +Infinity,
    metas: {
      kind: 'dynamic'
    }
  },
  outputMin: {
    type: 'float',
    default: 1,
    min: -Infinity,
    max: +Infinity,
    metas: {
      kind: 'dynamic'
    }
  },
  outputMax: {
    type: 'float',
    default: 1,
    min: -Infinity,
    max: +Infinity,
    metas: {
      kind: 'dynamic'
    }
  }
};
/**
 * Apply a linear scale on the incomming stream. The output is not clipped.
 *
 * @todo - implement log and exp scale
 *
 * @param {Object} options - Override default options
 * @param {Number} [options.inputMin=0] - Input Minimum
 * @param {Number} [options.inputMax=1] - Input Maximum
 * @param {Number} [options.outputMin=0] - Output Minimum
 * @param {Number} [options.outputMax=1] - Output Maximum
 */

class Scale extends _BaseLfo.default {
  constructor(options) {
    super(definitions, options);
    this.scale = null;
  }
  /** @private */


  _setScaleFunction() {
    const inputMin = this.params.get('inputMin');
    const inputMax = this.params.get('inputMax');
    const outputMin = this.params.get('outputMin');
    const outputMax = this.params.get('outputMax');
    const a = (outputMax - outputMin) / (inputMax - inputMin);
    const b = outputMin - a * inputMin;

    this.scale = x => a * x + b;
  }
  /** @private */


  onParamUpdate(name, value, metas) {
    super.onParamUpdate(name, value, metas);
    if (name !== 'type') this._setScaleFunction();
  }
  /** @private */


  processStreamParams(prevStreamParams) {
    this.prepareStreamParams(prevStreamParams);

    this._setScaleFunction();

    this.propagateStreamParams();
  }

  inputVector(data) {
    const outData = this.frame.data;
    const frameSize = this.streamParams.frameSize;
    const scale = this.scale;

    for (let i = 0; i < frameSize; i++) outData[i] = scale(data[i]);

    return outData;
  }
  /** @private */


  processVector(frame) {
    this.frame.data = this.inputVector(frame.data);
  }

  inputSignal(data) {
    const outData = this.frame.data;
    const frameSize = this.streamParams.frameSize;
    const scale = this.scale;

    for (let i = 0; i < frameSize; i++) outData[i] = scale(data[i]);

    return outData;
  }
  /** @private */


  processSignal(frame) {
    this.frame.data = this.inputVector(frame.data);
  }

}

var _default = Scale;
exports.default = _default;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9jb21tb24vbGlicy9sZm8vU2NhbGUuanMiXSwibmFtZXMiOlsiZGVmaW5pdGlvbnMiLCJ0eXBlIiwibGlzdCIsImRlZmF1bHQiLCJtZXRhcyIsImtpbmQiLCJpbnB1dE1pbiIsIm1pbiIsIkluZmluaXR5IiwibWF4IiwiaW5wdXRNYXgiLCJvdXRwdXRNaW4iLCJvdXRwdXRNYXgiLCJTY2FsZSIsIkJhc2VMZm8iLCJjb25zdHJ1Y3RvciIsIm9wdGlvbnMiLCJzY2FsZSIsIl9zZXRTY2FsZUZ1bmN0aW9uIiwicGFyYW1zIiwiZ2V0IiwiYSIsImIiLCJ4Iiwib25QYXJhbVVwZGF0ZSIsIm5hbWUiLCJ2YWx1ZSIsInByb2Nlc3NTdHJlYW1QYXJhbXMiLCJwcmV2U3RyZWFtUGFyYW1zIiwicHJlcGFyZVN0cmVhbVBhcmFtcyIsInByb3BhZ2F0ZVN0cmVhbVBhcmFtcyIsImlucHV0VmVjdG9yIiwiZGF0YSIsIm91dERhdGEiLCJmcmFtZSIsImZyYW1lU2l6ZSIsInN0cmVhbVBhcmFtcyIsImkiLCJwcm9jZXNzVmVjdG9yIiwiaW5wdXRTaWduYWwiLCJwcm9jZXNzU2lnbmFsIl0sIm1hcHBpbmdzIjoiOzs7Ozs7O0FBQUE7Ozs7QUFFQSxNQUFNQSxXQUFXLEdBQUc7QUFDbEJDLEVBQUFBLElBQUksRUFBRTtBQUNKQSxJQUFBQSxJQUFJLEVBQUUsTUFERjtBQUVKQyxJQUFBQSxJQUFJLEVBQUUsQ0FBQyxRQUFELENBRkY7QUFHSkMsSUFBQUEsT0FBTyxFQUFFLFFBSEw7QUFJSkMsSUFBQUEsS0FBSyxFQUFFO0FBQ0xDLE1BQUFBLElBQUksRUFBRTtBQUREO0FBSkgsR0FEWTtBQVNsQkMsRUFBQUEsUUFBUSxFQUFFO0FBQ1JMLElBQUFBLElBQUksRUFBRSxPQURFO0FBRVJFLElBQUFBLE9BQU8sRUFBRSxDQUZEO0FBR1JJLElBQUFBLEdBQUcsRUFBRSxDQUFDQyxRQUhFO0FBSVJDLElBQUFBLEdBQUcsRUFBRSxDQUFDRCxRQUpFO0FBS1JKLElB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QUFiLEVBQWdCQSxDQUFDLEdBQUdGLFNBQXBCLEVBQStCRSxDQUFDLEVBQWhDLEVBQ0VKLE9BQU8sQ0FBQ0ksQ0FBRCxDQUFQLEdBQWFwQixLQUFLLENBQUNlLElBQUksQ0FBQ0ssQ0FBRCxDQUFMLENBQWxCOztBQUVGLFdBQU9KLE9BQVA7QUFDRDtBQUVEOzs7QUFDQUssRUFBQUEsYUFBYSxDQUFDSixLQUFELEVBQVE7QUFDbkIsU0FBS0EsS0FBTCxDQUFXRixJQUFYLEdBQWtCLEtBQUtELFdBQUwsQ0FBaUJHLEtBQUssQ0FBQ0YsSUFBdkIsQ0FBbEI7QUFDRDs7QUFFRE8sRUFBQUEsV0FBVyxDQUFDUCxJQUFELEVBQU87QUFDaEIsVUFBTUMsT0FBTyxHQUFHLEtBQUtDLEtBQUwsQ0FBV0YsSUFBM0I7QUFDQSxVQUFNRyxTQUFTLEdBQUcsS0FBS0MsWUFBTCxDQUFrQkQsU0FBcEM7QUFDQSxVQUFNbEIsS0FBSyxHQUFHLEtBQUtBLEtBQW5COztBQUVBLFNBQUssSUFBSW9CLENBQUMsR0FBRyxDQUFiLEVBQWdCQSxDQUFDLEdBQUdGLFNBQXBCLEVBQStCRSxDQUFDLEVBQWhDLEVBQ0VKLE9BQU8sQ0FBQ0ksQ0FBRCxDQUFQLEdBQWFwQixLQUFLLENBQUNlLElBQUksQ0FBQ0ssQ0FBRCxDQUFMLENBQWxCOztBQUVGLFdBQU9KLE9BQVA7QUFDRDtBQUVEOzs7QUFDQU8sRUFBQUEsYUFBYSxDQUFDTixLQUFELEVBQVE7QUFDbkIsU0FBS0EsS0FBTCxDQUFXRixJQUFYLEdBQWtCLEtBQUtELFdBQUwsQ0FBaUJHLEtBQUssQ0FBQ0YsSUFBdkIsQ0FBbEI7QUFDRDs7QUFuRXlCOztlQXNFYm5CLEsiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgQmFzZUxmbyBmcm9tICcuL0Jhc2VMZm8uanMnO1xuXG5jb25zdCBkZWZpbml0aW9ucyA9IHtcbiAgdHlwZToge1xuICAgIHR5cGU6ICdlbnVtJyxcbiAgICBsaXN0OiBbJ2xpbmVhciddLFxuICAgIGRlZmF1bHQ6ICdsaW5lYXInLFxuICAgIG1ldGFzOiB7XG4gICAgICBraW5kOiAnZHluYW1pYycsXG4gICAgfVxuICB9LFxuICBpbnB1dE1pbjoge1xuICAgIHR5cGU6ICdmbG9hdCcsXG4gICAgZGVmYXVsdDogMCxcbiAgICBtaW46IC1JbmZpbml0eSxcbiAgICBtYXg6ICtJbmZpbml0eSxcbiAgICBtZXRhczoge1xuICAgICAga2luZDogJ2R5bmFtaWMnLFxuICAgIH0sXG4gIH0sXG4gIGlucHV0TWF4OiB7XG4gICAgdHlwZTogJ2Zsb2F0JyxcbiAgICBkZWZhdWx0OiAxLFxuICAgIG1pbjogLUluZmluaXR5LFxuICAgIG1heDogK0luZmluaXR5LFxuICAgIG1ldGFzOiB7XG4gICAgICBraW5kOiAnZHluYW1pYycsXG4gICAgfSxcbiAgfSxcbiAgb3V0cHV0TWluOiB7XG4gICAgdHlwZTogJ2Zsb2F0JyxcbiAgICBkZWZhdWx0OiAxLFxuICAgIG1pbjogLUluZmluaXR5LFxuICAgIG1heDogK0luZmluaXR5LFxuICAgIG1ldGFzOiB7XG4gICAgICBraW5kOiAnZHluYW1pYycsXG4gICAgfSxcbiAgfSxcbiAgb3V0cHV0TWF4OiB7XG4gICAgdHlwZTogJ2Zsb2F0JyxcbiAgICBkZWZhdWx0OiAxLFxuICAgIG1pbjogLUluZmluaXR5LFxuICAgIG1heDogK0luZmluaXR5LFxuICAgIG1ldGFzOiB7XG4gICAgICBraW5kOiAnZHluYW1pYycsXG4gICAgfSxcbiAgfSxcbn1cblxuLyoqXG4gKiBBcHBseSBhIGxpbmVhciBzY2FsZSBvbiB0aGUgaW5jb21taW5nIHN0cmVhbS4gVGhlIG91dHB1dCBpcyBub3QgY2xpcHBlZC5cbiAqXG4gKiBAdG9kbyAtIGltcGxlbWVudCBsb2cgYW5kIGV4cCBzY2FsZVxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSBvcHRpb25zIC0gT3ZlcnJpZGUgZGVmYXVsdCBvcHRpb25zXG4gKiBAcGFyYW0ge051bWJlcn0gW29wdGlvbnMuaW5wdXRNaW49MF0gLSBJbnB1dCBNaW5pbXVtXG4gKiBAcGFyYW0ge051bWJlcn0gW29wdGlvbnMuaW5wdXRNYXg9MV0gLSBJbnB1dCBNYXhpbXVtXG4gKiBAcGFyYW0ge051bWJlcn0gW29wdGlvbnMub3V0cHV0TWluPTBdIC0gT3V0cHV0IE1pbmltdW1cbiAqIEBwYXJhbSB7TnVtYmVyfSBbb3B0aW9ucy5vdXRwdXRNYXg9MV0gLSBPdXRwdXQgTWF4aW11bVxuICovXG5jbGFzcyBTY2FsZSBleHRlbmRzIEJhc2VMZm8ge1xuICBjb25zdHJ1Y3RvcihvcHRpb25zKSB7XG4gICAgc3VwZXIoZGVmaW5pdGlvbnMsIG9wdGlvbnMpO1xuXG4gICAgdGhpcy5zY2FsZSA9IG51bGw7XG4gIH1cblxuICAvKiogQHByaXZhdGUgKi9cbiAgX3NldFNjYWxlRnVuY3Rpb24oKSB7XG4gICAgY29uc3QgaW5wdXRNaW4gPSB0aGlzLnBhcmFtcy5nZXQoJ2lucHV0TWluJyk7XG4gICAgY29uc3QgaW5wdXRNYXggPSB0aGlzLnBhcmFtcy5nZXQoJ2lucHV0TWF4Jyk7XG4gICAgY29uc3Qgb3V0cHV0TWluID0gdGhpcy5wYXJhbXMuZ2V0KCdvdXRwdXRNaW4nKTtcbiAgICBjb25zdCBvdXRwdXRNYXggPSB0aGlzLnBhcmFtcy5nZXQoJ291dHB1dE1heCcpO1xuXG4gICAgY29uc3QgYSA9IChvdXRwdXRNYXggLSBvdXRwdXRNaW4pIC8gKGlucHV0TWF4IC0gaW5wdXRNaW4pO1xuICAgIGNvbnN0IGIgPSBvdXRwdXRNaW4gLSBhICogaW5wdXRNaW47XG5cbiAgICB0aGlzLnNjYWxlID0gKHgpID0+IGEgKiB4ICsgYjtcbiAgfVxuXG4gIC8qKiBAcHJpdmF0ZSAqL1xuICBvblBhcmFtVXBkYXRlKG5hbWUsIHZhbHVlLCBtZXRhcykge1xuICAgIHN1cGVyLm9uUGFyYW1VcGRhdGUobmFtZSwgdmFsdWUsIG1ldGFzKTtcblxuICAgIGlmIChuYW1lICE9PSAndHlwZScpXG4gICAgICB0aGlzLl9zZXRTY2FsZUZ1bmN0aW9uKCk7XG4gIH1cblxuICAvKiogQHByaXZhdGUgKi9cbiAgcHJvY2Vzc1N0cmVhbVBhcmFtcyhwcmV2U3RyZWFtUGFyYW1zKSB7XG4gICAgdGhpcy5wcmVwYXJlU3RyZWFtUGFyYW1zKHByZXZTdHJlYW1QYXJhbXMpO1xuXG4gICAgdGhpcy5fc2V0U2NhbGVGdW5jdGlvbigpO1xuXG4gICAgdGhpcy5wcm9wYWdhdGVTdHJlYW1QYXJhbXMoKTtcbiAgfVxuXG4gIGlucHV0VmVjdG9yKGRhdGEpIHtcbiAgICBjb25zdCBvdXREYXRhID0gdGhpcy5mcmFtZS5kYXRhO1xuICAgIGNvbnN0IGZyYW1lU2l6ZSA9IHRoaXMuc3RyZWFtUGFyYW1zLmZyYW1lU2l6ZTtcbiAgICBjb25zdCBzY2FsZSA9IHRoaXMuc2NhbGU7XG5cbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGZyYW1lU2l6ZTsgaSsrKVxuICAgICAgb3V0RGF0YVtpXSA9IHNjYWxlKGRhdGFbaV0pO1xuXG4gICAgcmV0dXJuIG91dERhdGE7XG4gIH1cblxuICAvKiogQHByaXZhdGUgKi9cbiAgcHJvY2Vzc1ZlY3RvcihmcmFtZSkge1xuICAgIHRoaXMuZnJhbWUuZGF0YSA9IHRoaXMuaW5wdXRWZWN0b3IoZnJhbWUuZGF0YSk7XG4gIH1cblxuICBpbnB1dFNpZ25hbChkYXRhKSB7XG4gICAgY29uc3Qgb3V0RGF0YSA9IHRoaXMuZnJhbWUuZGF0YTtcbiAgICBjb25zdCBmcmFtZVNpemUgPSB0aGlzLnN0cmVhbVBhcmFtcy5mcmFtZVNpemU7XG4gICAgY29uc3Qgc2NhbGUgPSB0aGlzLnNjYWxlO1xuXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBmcmFtZVNpemU7IGkrKylcbiAgICAgIG91dERhdGFbaV0gPSBzY2FsZShkYXRhW2ldKTtcblxuICAgIHJldHVybiBvdXREYXRhO1xuICB9XG5cbiAgLyoqIEBwcml2YXRlICovXG4gIHByb2Nlc3NTaWduYWwoZnJhbWUpIHtcbiAgICB0aGlzLmZyYW1lLmRhdGEgPSB0aGlzLmlucHV0VmVjdG9yKGZyYW1lLmRhdGEpO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IFNjYWxlO1xuIl19