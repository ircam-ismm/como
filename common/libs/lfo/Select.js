"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _BaseLfo = _interopRequireDefault(require("./BaseLfo.js"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const definitions = {
  index: {
    type: 'integer',
    default: 0,
    metas: {
      kind: 'static'
    }
  },
  indexes: {
    type: 'any',
    default: null,
    nullable: true,
    metas: {
      kind: 'dynamic'
    }
  }
};
/**
 * Select one or several indexes from a `vector` input. If only one index is
 * selected, the output will be of type `scalar`, otherwise the output will
 * be a vector containing the selected indexes.
 *
 * @memberof module:common.operator
 *
 * @param {Object} options - Override default values.
 * @param {Number} options.index - Index to select from the input frame.
 * @param {Array<Number>} options.indexes - Indices to select from the input
 *  frame, if defined, take precedance over `option.index`.
 *
 * @example
 * import * as lfo from 'waves-lfo/common';
 *
 * const eventIn = new lfo.source.EventIn({
 *   frameType: 'vector',
 *   frameSize: 3,
 * });
 *
 * const select = new lfo.operator.Select({
 *   indexes: [2, 0],
 * });
 *
 * eventIn.start();
 * eventIn.process(0, [0, 2, 4]);
 * > [4, 0]
 * eventIn.process(0, [1, 3, 5]);
 * > [5, 1]
 */

class Select extends _BaseLfo.default {
  constructor(options = {}) {
    super(definitions, options);
  }
  /** @private */


  onParamUpdate(name, value, metas = {}) {
    super.onParamUpdate(name, value, metas);
    const index = this.params.get('index');
    const indexes = this.params.get('indexes');
    this.select = indexes !== null ? indexes : [index];
  }
  /** @private */


  processStreamParams(prevStreamParams) {
    this.prepareStreamParams(prevStreamParams);
    const index = this.params.get('index');
    const indexes = this.params.get('indexes');
    let max = indexes !== null ? Math.max.apply(null, indexes) : index;
    if (max >= prevStreamParams.frameSize) throw new Error(`Invalid select index "${max}"`);
    this.streamParams.frameType = indexes !== null ? 'vector' : 'scalar';
    this.streamParams.frameSize = indexes !== null ? indexes.length : 1;
    this.select = indexes !== null ? indexes : [index]; // steal description() from parent

    if (prevStreamParams.description) {
      this.select.forEach((val, index) => {
        this.streamParams.description[index] = prevStreamParams.description[val];
      });
    }

    this.propagateStreamParams();
  }
  /** @private */


  processVector(frame) {
    const data = frame.data;
    const outData = this.frame.data;
    const select = this.select;

    for (let i = 0; i < select.length; i++) outData[i] = data[select[i]];
  }

}

var _default = Select;
exports.default = _default;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9jb21tb24vbGlicy9sZm8vU2VsZWN0LmpzIl0sIm5hbWVzIjpbImRlZmluaXRpb25zIiwiaW5kZXgiLCJ0eXBlIiwiZGVmYXVsdCIsIm1ldGFzIiwia2luZCIsImluZGV4ZXMiLCJudWxsYWJsZSIsIlNlbGVjdCIsIkJhc2VMZm8iLCJjb25zdHJ1Y3RvciIsIm9wdGlvbnMiLCJvblBhcmFtVXBkYXRlIiwibmFtZSIsInZhbHVlIiwicGFyYW1zIiwiZ2V0Iiwic2VsZWN0IiwicHJvY2Vzc1N0cmVhbVBhcmFtcyIsInByZXZTdHJlYW1QYXJhbXMiLCJwcmVwYXJlU3RyZWFtUGFyYW1zIiwibWF4IiwiTWF0aCIsImFwcGx5IiwiZnJhbWVTaXplIiwiRXJyb3IiLCJzdHJlYW1QYXJhbXMiLCJmcmFtZVR5cGUiLCJsZW5ndGgiLCJkZXNjcmlwdGlvbiIsImZvckVhY2giLCJ2YWwiLCJwcm9wYWdhdGVTdHJlYW1QYXJhbXMiLCJwcm9jZXNzVmVjdG9yIiwiZnJhbWUiLCJkYXRhIiwib3V0RGF0YSIsImkiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7QUFBQTs7OztBQUVBLE1BQU1BLFdBQVcsR0FBRztBQUNsQkMsRUFBQUEsS0FBSyxFQUFFO0FBQ0xDLElBQUFBLElBQUksRUFBRSxTQUREO0FBRUxDLElBQUFBLE9BQU8sRUFBRSxDQUZKO0FBR0xDLElBQUFBLEtBQUssRUFBRTtBQUFFQyxNQUFBQSxJQUFJLEVBQUU7QUFBUjtBQUhGLEdBRFc7QUFNbEJDLEVBQUFBLE9BQU8sRUFBRTtBQUNQSixJQUFBQSxJQUFJLEVBQUUsS0FEQztBQUVQQyxJQUFBQSxPQUFPLEVBQUUsSUFGRjtBQUdQSSxJQUFBQSxRQUFRLEVBQUUsSUFISDtBQUlQSCxJQUFBQSxLQUFLLEVBQUU7QUFBRUMsTUFBQUEsSUFBSSxFQUFFO0FBQVI7QUFKQTtBQU5TLENBQXBCO0FBY0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNB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IGZyb20gJy4vQmFzZUxmby5qcyc7XG5cbmNvbnN0IGRlZmluaXRpb25zID0ge1xuICBpbmRleDoge1xuICAgIHR5cGU6ICdpbnRlZ2VyJyxcbiAgICBkZWZhdWx0OiAwLFxuICAgIG1ldGFzOiB7IGtpbmQ6ICdzdGF0aWMnIH0sXG4gIH0sXG4gIGluZGV4ZXM6IHtcbiAgICB0eXBlOiAnYW55JyxcbiAgICBkZWZhdWx0OiBudWxsLFxuICAgIG51bGxhYmxlOiB0cnVlLFxuICAgIG1ldGFzOiB7IGtpbmQ6ICdkeW5hbWljJyB9LFxuICB9XG59O1xuXG4vKipcbiAqIFNlbGVjdCBvbmUgb3Igc2V2ZXJhbCBpbmRleGVzIGZyb20gYSBgdmVjdG9yYCBpbnB1dC4gSWYgb25seSBvbmUgaW5kZXggaXNcbiAqIHNlbGVjdGVkLCB0aGUgb3V0cHV0IHdpbGwgYmUgb2YgdHlwZSBgc2NhbGFyYCwgb3RoZXJ3aXNlIHRoZSBvdXRwdXQgd2lsbFxuICogYmUgYSB2ZWN0b3IgY29udGFpbmluZyB0aGUgc2VsZWN0ZWQgaW5kZXhlcy5cbiAqXG4gKiBAbWVtYmVyb2YgbW9kdWxlOmNvbW1vbi5vcGVyYXRvclxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSBvcHRpb25zIC0gT3ZlcnJpZGUgZGVmYXVsdCB2YWx1ZXMuXG4gKiBAcGFyYW0ge051bWJlcn0gb3B0aW9ucy5pbmRleCAtIEluZGV4IHRvIHNlbGVjdCBmcm9tIHRoZSBpbnB1dCBmcmFtZS5cbiAqIEBwYXJhbSB7QXJyYXk8TnVtYmVyPn0gb3B0aW9ucy5pbmRleGVzIC0gSW5kaWNlcyB0byBzZWxlY3QgZnJvbSB0aGUgaW5wdXRcbiAqICBmcmFtZSwgaWYgZGVmaW5lZCwgdGFrZSBwcmVjZWRhbmNlIG92ZXIgYG9wdGlvbi5pbmRleGAuXG4gKlxuICogQGV4YW1wbGVcbiAqIGltcG9ydCAqIGFzIGxmbyBmcm9tICd3YXZlcy1sZm8vY29tbW9uJztcbiAqXG4gKiBjb25zdCBldmVudEluID0gbmV3IGxmby5zb3VyY2UuRXZlbnRJbih7XG4gKiAgIGZyYW1lVHlwZTogJ3ZlY3RvcicsXG4gKiAgIGZyYW1lU2l6ZTogMyxcbiAqIH0pO1xuICpcbiAqIGNvbnN0IHNlbGVjdCA9IG5ldyBsZm8ub3BlcmF0b3IuU2VsZWN0KHtcbiAqICAgaW5kZXhlczogWzIsIDBdLFxuICogfSk7XG4gKlxuICogZXZlbnRJbi5zdGFydCgpO1xuICogZXZlbnRJbi5wcm9jZXNzKDAsIFswLCAyLCA0XSk7XG4gKiA+IFs0LCAwXVxuICogZXZlbnRJbi5wcm9jZXNzKDAsIFsxLCAzLCA1XSk7XG4gKiA+IFs1LCAxXVxuICovXG5jbGFzcyBTZWxlY3QgZXh0ZW5kcyBCYXNlTGZvIHtcbiAgY29uc3RydWN0b3Iob3B0aW9ucyA9IHt9KSB7XG4gICAgc3VwZXIoZGVmaW5pdGlvbnMsIG9wdGlvbnMpO1xuICB9XG5cbiAgLyoqIEBwcml2YXRlICovXG4gIG9uUGFyYW1VcGRhdGUobmFtZSwgdmFsdWUsIG1ldGFzID0ge30pIHtcbiAgICBzdXBlci5vblBhcmFtVXBkYXRlKG5hbWUsIHZhbHVlLCBtZXRhcyk7XG5cbiAgICBjb25zdCBpbmRleCA9IHRoaXMucGFyYW1zLmdldCgnaW5kZXgnKTtcbiAgICBjb25zdCBpbmRleGVzID0gdGhpcy5wYXJhbXMuZ2V0KCdpbmRleGVzJyk7XG5cbiAgICB0aGlzLnNlbGVjdCA9IChpbmRleGVzICE9PSBudWxsKSA/IGluZGV4ZXMgOiBbaW5kZXhdO1xuICB9XG5cbiAgLyoqIEBwcml2YXRlICovXG4gIHByb2Nlc3NTdHJlYW1QYXJhbXMocHJldlN0cmVhbVBhcmFtcykge1xuICAgIHRoaXMucHJlcGFyZVN0cmVhbVBhcmFtcyhwcmV2U3RyZWFtUGFyYW1zKTtcblxuICAgIGNvbnN0IGluZGV4ID0gdGhpcy5wYXJhbXMuZ2V0KCdpbmRleCcpO1xuICAgIGNvbnN0IGluZGV4ZXMgPSB0aGlzLnBhcmFtcy5nZXQoJ2luZGV4ZXMnKTtcblxuICAgIGxldCBtYXggPSAoaW5kZXhlcyAhPT0gbnVsbCkgPyAgTWF0aC5tYXguYXBwbHkobnVsbCwgaW5kZXhlcykgOiBpbmRleDtcblxuICAgIGlmIChtYXggPj0gcHJldlN0cmVhbVBhcmFtcy5mcmFtZVNpemUpXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYEludmFsaWQgc2VsZWN0IGluZGV4IFwiJHttYXh9XCJgKTtcblxuICAgIHRoaXMuc3RyZWFtUGFyYW1zLmZyYW1lVHlwZSA9IChpbmRleGVzICE9PSBudWxsKSA/ICd2ZWN0b3InIDogJ3NjYWxhcic7XG4gICAgdGhpcy5zdHJlYW1QYXJhbXMuZnJhbWVTaXplID0gKGluZGV4ZXMgIT09IG51bGwpID8gaW5kZXhlcy5sZW5ndGggOiAxO1xuXG4gICAgdGhpcy5zZWxlY3QgPSAoaW5kZXhlcyAhPT0gbnVsbCkgPyBpbmRleGVzIDogW2luZGV4XTtcblxuICAgIC8vIHN0ZWFsIGRlc2NyaXB0aW9uKCkgZnJvbSBwYXJlbnRcbiAgICBpZiAocHJldlN0cmVhbVBhcmFtcy5kZXNjcmlwdGlvbikge1xuICAgICAgdGhpcy5zZWxlY3QuZm9yRWFjaCgodmFsLCBpbmRleCkgPT4ge1xuICAgICAgICB0aGlzLnN0cmVhbVBhcmFtcy5kZXNjcmlwdGlvbltpbmRleF0gPSBwcmV2U3RyZWFtUGFyYW1zLmRlc2NyaXB0aW9uW3ZhbF07XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICB0aGlzLnByb3BhZ2F0ZVN0cmVhbVBhcmFtcygpO1xuICB9XG5cbiAgLyoqIEBwcml2YXRlICovXG4gIHByb2Nlc3NWZWN0b3IoZnJhbWUpIHtcbiAgICBjb25zdCBkYXRhID0gZnJhbWUuZGF0YTtcbiAgICBjb25zdCBvdXREYXRhID0gdGhpcy5mcmFtZS5kYXRhO1xuICAgIGNvbnN0IHNlbGVjdCA9IHRoaXMuc2VsZWN0O1xuXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBzZWxlY3QubGVuZ3RoOyBpKyspXG4gICAgICBvdXREYXRhW2ldID0gZGF0YVtzZWxlY3RbaV1dO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IFNlbGVjdDtcbiJdfQ==