"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _BaseLfo = _interopRequireDefault(require("./BaseLfo.js"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const definitions = {
  processStreamParams: {
    type: 'any',
    default: null,
    nullable: true,
    metas: {
      kind: 'dynamic'
    }
  },
  processFrame: {
    type: 'any',
    default: null,
    nullable: true,
    metas: {
      kind: 'dynamic'
    }
  },
  finalizeStream: {
    type: 'any',
    default: null,
    nullable: true,
    metas: {
      kind: 'dynamic'
    }
  }
};
/**
 * Create a bridge between the graph and application logic. Handle `push`
 * and `pull` paradigms.
 *
 * This sink can handle any type of input (`signal`, `vector`, `scalar`)
 *
 * @memberof module:common.sink
 *
 * @param {Object} options - Override default parameters.
 * @param {Function} [options.processFrame=null] - Callback executed on each
 *  `processFrame` call.
 * @param {Function} [options.finalizeStream=null] - Callback executed on each
 *  `finalizeStream` call.
 *
 * @see {@link module:core.BaseLfo#processFrame}
 * @see {@link module:core.BaseLfo#processStreamParams}
 *
 * @example
 * import * as lfo from 'waves-lfo/common';
 *
 * const frames = [
 *  { time: 0, data: [0, 1] },
 *  { time: 1, data: [1, 2] },
 * ];
 *
 * const eventIn = new EventIn({
 *   frameType: 'vector',
 *   frameSize: 2,
 *   frameRate: 1,
 * });
 *
 * const bridge = new Bridge({
 *   processFrame: (frame) => console.log(frame),
 * });
 *
 * eventIn.connect(bridge);
 * eventIn.start();
 *
 * // callback executed on each frame
 * eventIn.processFrame(frame[0]);
 * > { time: 0, data: [0, 1] }
 * eventIn.processFrame(frame[1]);
 * > { time: 1, data: [1, 2] }
 *
 * // pull current frame when needed
 * console.log(bridge.frame);
 * > { time: 1, data: [1, 2] }
 */

class Bridge extends _BaseLfo.default {
  constructor(options = {}) {
    super(definitions, options);
  }
  /** @private */


  processStreamParams(prevStreamParams) {
    this.prepareStreamParams(prevStreamParams);
    const processStreamParamsCallback = this.params.get('processStreamParams');
    if (processStreamParamsCallback !== null) processStreamParamsCallback(this.streamParams);
    this.propagateStreamParams();
  }
  /** @private */


  finalizeStream(endTime) {
    const finalizeStreamCallback = this.params.get('finalizeStream');
    if (finalizeStreamCallback !== null) finalizeStreamCallback(endTime);
  } // process any type

  /** @private */


  processScalar() {}
  /** @private */


  processVector() {}
  /** @private */


  processSignal() {}
  /** @private */


  processFrame(frame) {
    this.prepareFrame();
    const processFrameCallback = this.params.get('processFrame');
    const output = this.frame;
    output.data = new Float32Array(this.streamParams.frameSize); // pull interface (we copy data since we don't know what could
    // be done outside the graph)

    for (let i = 0; i < this.streamParams.frameSize; i++) output.data[i] = frame.data[i];

    output.time = frame.time;
    output.metadata = frame.metadata; // `push` interface

    if (processFrameCallback !== null) processFrameCallback(output);
  }

}

var _default = Bridge;
exports.default = _default;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9jb21tb24vbGlicy9sZm8vQnJpZGdlLmpzIl0sIm5hbWVzIjpbImRlZmluaXRpb25zIiwicHJvY2Vzc1N0cmVhbVBhcmFtcyIsInR5cGUiLCJkZWZhdWx0IiwibnVsbGFibGUiLCJtZXRhcyIsImtpbmQiLCJwcm9jZXNzRnJhbWUiLCJmaW5hbGl6ZVN0cmVhbSIsIkJyaWRnZSIsIkJhc2VMZm8iLCJjb25zdHJ1Y3RvciIsIm9wdGlvbnMiLCJwcmV2U3RyZWFtUGFyYW1zIiwicHJlcGFyZVN0cmVhbVBhcmFtcyIsInByb2Nlc3NTdHJlYW1QYXJhbXNDYWxsYmFjayIsInBhcmFtcyIsImdldCIsInN0cmVhbVBhcmFtcyIsInByb3BhZ2F0ZVN0cmVhbVBhcmFtcyIsImVuZFRpbWUiLCJmaW5hbGl6ZVN0cmVhbUNhbGxiYWNrIiwicHJvY2Vzc1NjYWxhciIsInByb2Nlc3NWZWN0b3IiLCJwcm9jZXNzU2lnbmFsIiwiZnJhbWUiLCJwcmVwYXJlRnJhbWUiLCJwcm9jZXNzRnJhbWVDYWxsYmFjayIsIm91dHB1dCIsImRhdGEiLCJGbG9hdDMyQXJyYXkiLCJmcmFtZVNpemUiLCJpIiwidGltZSIsIm1ldGFkYXRhIl0sIm1hcHBpbmdzIjoiOzs7Ozs7O0FBQUE7Ozs7QUFFQSxNQUFNQSxXQUFXLEdBQUc7QUFDbEJDLEVBQUFBLG1CQUFtQixFQUFFO0FBQ25CQyxJQUFBQSxJQUFJLEVBQUUsS0FEYTtBQUVuQkMsSUFBQUEsT0FBTyxFQUFFLElBRlU7QUFHbkJDLElBQUFBLFFBQVEsRUFBRSxJQUhTO0FBSW5CQyxJQUFBQSxLQUFLLEVBQUU7QUFBRUMsTUFBQUEsSUFBSSxFQUFFO0FBQVI7QUFKWSxHQURIO0FBT2xCQyxFQUFBQSxZQUFZLEVBQUU7QUFDWkwsSUFBQUEsSUFBSSxFQUFFLEtBRE07QUFFWkMsSUFBQUEsT0FBTyxFQUFFLElBRkc7QUFHWkMsSUFBQUEsUUFBUSxFQUFFLElBSEU7QUFJWkMsSUFBQUEsS0FBSyxFQUFFO0FBQUVDLE1BQUFBLElBQUksRUFBRTtBQUFSO0FBSkssR0FQSTtBQWFsQkUsRUFBQUEsY0FBYyxFQUFFO0FBQ2ROLElBQUFBLElBQUksRUFBRSxLQURRO0FBRWRDLElBQUFBLE9BQU8sRUFBRSxJQUZLO0FBR2RDLElBQUFBLFFBQVEsRUFBRSxJQUhJO0FBSWRDLElBQUFBLEtBQUssRUFBRTtBQUFFQyxNQUFBQSxJQUFJLEVBQUU7QUFBUjtBQUpPO0FBYkUsQ0FBcEI7QUFxQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUNBLE1BQU1HLE1BQU4sU0FBcUJDLGdCQUFyQixDQUE2QjtBQUMzQkMsRUFBQUEsV0FBVyxDQUFDQyxPQUFPLEdBQUcsRUFBWCxFQUFlO0FBQ3hCLFVBQU1aLFdBQU4sRUFBbUJZLE9BQW5CO0FBQ0Q7QUFFRDs7O0FBQ0FYLEVBQUFBLG1CQUFtQixDQUFDWSxnQkFBRCxFQUFtQjtBQUNwQyxTQUFLQyxtQkFBTCxDQUF5QkQsZ0JBQXpCO0FBRUEsVUFBTUUsMkJBQTJCLEdBQUcsS0FBS0MsTUFBTCxDQUFZQyxHQUFaLENBQWdCLHFCQUFoQixDQUFwQztBQUVBLFFBQUlGLDJCQUEyQixLQUFLLElBQXBDLEVBQ0VBLDJCQUEyQixDQUFDLEtBQUtHLFlBQU4sQ0FBM0I7QUFFRixTQUFLQyxxQkFBTDtBQUNEO0FBRUQ7OztBQUNBWCxFQUFBQSxjQUFjLENBQUNZLE9BQUQsRUFBVTtBQUN0QixVQUFNQyxzQkFBc0IsR0FBRyxLQUFLTCxNQUFMLENBQVlDLEdBQVosQ0FBZ0IsZ0JBQWhCLENBQS9CO0FBRUEsUUFBSUksc0JBQXNCLEtBQUssSUFBL0IsRUFDRUEsc0JBQXNCLENBQUNELE9BQUQsQ0FBdEI7QUFDSCxHQXZCMEIsQ0F5QjNCOztBQUNBOzs7QUFDQUUsRUFBQUEsYUFBYSxHQUFHLENBQUU7QUFDbEI7OztBQUNBQyxFQUFBQSxhQUFhLEdBQUcsQ0FBRTtBQUNsQjs7O0FBQ0FDLEVBQUFBLGFBQWEsR0FBRyxDQUFFO0FBRWxCOzs7QUFDQWpCLEVBQUFBLFlBQVksQ0FBQ2tCLEtBQUQsRUFBUTtBQUNsQixTQUFLQyxZQUFMO0FBRUEsVUFBTUMsb0JBQW9CLEdBQUcsS0FBS1gsTUFBTCxDQUFZQyxHQUFaLENBQWdCLGNBQWhCLENBQTdCO0FBQ0EsVUFBTVcsTUFBTSxHQUFHLEtBQUtILEtBQXBCO0FBQ0FHLElBQUFBLE1BQU0sQ0FBQ0MsSUFBUCxHQUFjLElBQUlDLFlBQUosQ0FBaUIsS0FBS1osWUFBTCxDQUFrQmEsU0FBbkMsQ0FBZCxDQUxrQixDQU1sQjtBQUNBOztBQUNBLFNBQUssSUFBSUMsQ0FBQyxHQUFHLENBQWIsRUFBZ0JBLENBQUMsR0FBRyxLQUFLZCxZQUFMLENBQWtCYSxTQUF0QyxFQUFpREMsQ0FBQyxFQUFsRCxFQUNFSixNQUFNLENBQUNDLElBQVAsQ0FBWUcsQ0FBWixJQUFpQlAsS0FBSyxDQUFDSSxJQUFOLENBQVdHLENBQVgsQ0FBakI7O0FBRUZKLElBQUFBLE1BQU0sQ0FBQ0ssSUFBUCxHQUFjUixLQUFLLENBQUNRLElBQXBCO0FBQ0FMLElBQUFBLE1BQU0sQ0FBQ00sUUFBUCxHQUFrQlQsS0FBSyxDQUFDUyxRQUF4QixDQVprQixDQWNsQjs7QUFDQSxRQUFJUCxvQkFBb0IsS0FBSyxJQUE3QixFQUNFQSxvQkFBb0IsQ0FBQ0MsTUFBRCxDQUFwQjtBQUNIOztBQW5EMEI7O2VBc0RkbkIsTSIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCBCYXNlTGZvIGZyb20gJy4vQmFzZUxmby5qcyc7XG5cbmNvbnN0IGRlZmluaXRpb25zID0ge1xuICBwcm9jZXNzU3RyZWFtUGFyYW1zOiB7XG4gICAgdHlwZTogJ2FueScsXG4gICAgZGVmYXVsdDogbnVsbCxcbiAgICBudWxsYWJsZTogdHJ1ZSxcbiAgICBtZXRhczogeyBraW5kOiAnZHluYW1pYycgfSxcbiAgfSxcbiAgcHJvY2Vzc0ZyYW1lOiB7XG4gICAgdHlwZTogJ2FueScsXG4gICAgZGVmYXVsdDogbnVsbCxcbiAgICBudWxsYWJsZTogdHJ1ZSxcbiAgICBtZXRhczogeyBraW5kOiAnZHluYW1pYycgfSxcbiAgfSxcbiAgZmluYWxpemVTdHJlYW06IHtcbiAgICB0eXBlOiAnYW55JyxcbiAgICBkZWZhdWx0OiBudWxsLFxuICAgIG51bGxhYmxlOiB0cnVlLFxuICAgIG1ldGFzOiB7IGtpbmQ6ICdkeW5hbWljJyB9LFxuICB9LFxufTtcblxuLyoqXG4gKiBDcmVhdGUgYSBicmlkZ2UgYmV0d2VlbiB0aGUgZ3JhcGggYW5kIGFwcGxpY2F0aW9uIGxvZ2ljLiBIYW5kbGUgYHB1c2hgXG4gKiBhbmQgYHB1bGxgIHBhcmFkaWdtcy5cbiAqXG4gKiBUaGlzIHNpbmsgY2FuIGhhbmRsZSBhbnkgdHlwZSBvZiBpbnB1dCAoYHNpZ25hbGAsIGB2ZWN0b3JgLCBgc2NhbGFyYClcbiAqXG4gKiBAbWVtYmVyb2YgbW9kdWxlOmNvbW1vbi5zaW5rXG4gKlxuICogQHBhcmFtIHtPYmplY3R9IG9wdGlvbnMgLSBPdmVycmlkZSBkZWZhdWx0IHBhcmFtZXRlcnMuXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBbb3B0aW9ucy5wcm9jZXNzRnJhbWU9bnVsbF0gLSBDYWxsYmFjayBleGVjdXRlZCBvbiBlYWNoXG4gKiAgYHByb2Nlc3NGcmFtZWAgY2FsbC5cbiAqIEBwYXJhbSB7RnVuY3Rpb259IFtvcHRpb25zLmZpbmFsaXplU3RyZWFtPW51bGxdIC0gQ2FsbGJhY2sgZXhlY3V0ZWQgb24gZWFjaFxuICogIGBmaW5hbGl6ZVN0cmVhbWAgY2FsbC5cbiAqXG4gKiBAc2VlIHtAbGluayBtb2R1bGU6Y29yZS5CYXNlTGZvI3Byb2Nlc3NGcmFtZX1cbiAqIEBzZWUge0BsaW5rIG1vZHVsZTpjb3JlLkJhc2VMZm8jcHJvY2Vzc1N0cmVhbVBhcmFtc31cbiAqXG4gKiBAZXhhbXBsZVxuICogaW1wb3J0ICogYXMgbGZvIGZyb20gJ3dhdmVzLWxmby9jb21tb24nO1xuICpcbiAqIGNvbnN0IGZyYW1lcyA9IFtcbiAqICB7IHRpbWU6IDAsIGRhdGE6IFswLCAxXSB9LFxuICogIHsgdGltZTogMSwgZGF0YTogWzEsIDJdIH0sXG4gKiBdO1xuICpcbiAqIGNvbnN0IGV2ZW50SW4gPSBuZXcgRXZlbnRJbih7XG4gKiAgIGZyYW1lVHlwZTogJ3ZlY3RvcicsXG4gKiAgIGZyYW1lU2l6ZTogMixcbiAqICAgZnJhbWVSYXRlOiAxLFxuICogfSk7XG4gKlxuICogY29uc3QgYnJpZGdlID0gbmV3IEJyaWRnZSh7XG4gKiAgIHByb2Nlc3NGcmFtZTogKGZyYW1lKSA9PiBjb25zb2xlLmxvZyhmcmFtZSksXG4gKiB9KTtcbiAqXG4gKiBldmVudEluLmNvbm5lY3QoYnJpZGdlKTtcbiAqIGV2ZW50SW4uc3RhcnQoKTtcbiAqXG4gKiAvLyBjYWxsYmFjayBleGVjdXRlZCBvbiBlYWNoIGZyYW1lXG4gKiBldmVudEluLnByb2Nlc3NGcmFtZShmcmFtZVswXSk7XG4gKiA+IHsgdGltZTogMCwgZGF0YTogWzAsIDFdIH1cbiAqIGV2ZW50SW4ucHJvY2Vzc0ZyYW1lKGZyYW1lWzFdKTtcbiAqID4geyB0aW1lOiAxLCBkYXRhOiBbMSwgMl0gfVxuICpcbiAqIC8vIHB1bGwgY3VycmVudCBmcmFtZSB3aGVuIG5lZWRlZFxuICogY29uc29sZS5sb2coYnJpZGdlLmZyYW1lKTtcbiAqID4geyB0aW1lOiAxLCBkYXRhOiBbMSwgMl0gfVxuICovXG5jbGFzcyBCcmlkZ2UgZXh0ZW5kcyBCYXNlTGZvIHtcbiAgY29uc3RydWN0b3Iob3B0aW9ucyA9IHt9KSB7XG4gICAgc3VwZXIoZGVmaW5pdGlvbnMsIG9wdGlvbnMpO1xuICB9XG5cbiAgLyoqIEBwcml2YXRlICovXG4gIHByb2Nlc3NTdHJlYW1QYXJhbXMocHJldlN0cmVhbVBhcmFtcykge1xuICAgIHRoaXMucHJlcGFyZVN0cmVhbVBhcmFtcyhwcmV2U3RyZWFtUGFyYW1zKTtcblxuICAgIGNvbnN0IHByb2Nlc3NTdHJlYW1QYXJhbXNDYWxsYmFjayA9IHRoaXMucGFyYW1zLmdldCgncHJvY2Vzc1N0cmVhbVBhcmFtcycpO1xuXG4gICAgaWYgKHByb2Nlc3NTdHJlYW1QYXJhbXNDYWxsYmFjayAhPT0gbnVsbClcbiAgICAgIHByb2Nlc3NTdHJlYW1QYXJhbXNDYWxsYmFjayh0aGlzLnN0cmVhbVBhcmFtcyk7XG5cbiAgICB0aGlzLnByb3BhZ2F0ZVN0cmVhbVBhcmFtcygpO1xuICB9XG5cbiAgLyoqIEBwcml2YXRlICovXG4gIGZpbmFsaXplU3RyZWFtKGVuZFRpbWUpIHtcbiAgICBjb25zdCBmaW5hbGl6ZVN0cmVhbUNhbGxiYWNrID0gdGhpcy5wYXJhbXMuZ2V0KCdmaW5hbGl6ZVN0cmVhbScpO1xuXG4gICAgaWYgKGZpbmFsaXplU3RyZWFtQ2FsbGJhY2sgIT09IG51bGwpXG4gICAgICBmaW5hbGl6ZVN0cmVhbUNhbGxiYWNrKGVuZFRpbWUpO1xuICB9XG5cbiAgLy8gcHJvY2VzcyBhbnkgdHlwZVxuICAvKiogQHByaXZhdGUgKi9cbiAgcHJvY2Vzc1NjYWxhcigpIHt9XG4gIC8qKiBAcHJpdmF0ZSAqL1xuICBwcm9jZXNzVmVjdG9yKCkge31cbiAgLyoqIEBwcml2YXRlICovXG4gIHByb2Nlc3NTaWduYWwoKSB7fVxuXG4gIC8qKiBAcHJpdmF0ZSAqL1xuICBwcm9jZXNzRnJhbWUoZnJhbWUpIHtcbiAgICB0aGlzLnByZXBhcmVGcmFtZSgpO1xuXG4gICAgY29uc3QgcHJvY2Vzc0ZyYW1lQ2FsbGJhY2sgPSB0aGlzLnBhcmFtcy5nZXQoJ3Byb2Nlc3NGcmFtZScpO1xuICAgIGNvbnN0IG91dHB1dCA9IHRoaXMuZnJhbWU7XG4gICAgb3V0cHV0LmRhdGEgPSBuZXcgRmxvYXQzMkFycmF5KHRoaXMuc3RyZWFtUGFyYW1zLmZyYW1lU2l6ZSk7XG4gICAgLy8gcHVsbCBpbnRlcmZhY2UgKHdlIGNvcHkgZGF0YSBzaW5jZSB3ZSBkb24ndCBrbm93IHdoYXQgY291bGRcbiAgICAvLyBiZSBkb25lIG91dHNpZGUgdGhlIGdyYXBoKVxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5zdHJlYW1QYXJhbXMuZnJhbWVTaXplOyBpKyspXG4gICAgICBvdXRwdXQuZGF0YVtpXSA9IGZyYW1lLmRhdGFbaV07XG5cbiAgICBvdXRwdXQudGltZSA9IGZyYW1lLnRpbWU7XG4gICAgb3V0cHV0Lm1ldGFkYXRhID0gZnJhbWUubWV0YWRhdGE7XG5cbiAgICAvLyBgcHVzaGAgaW50ZXJmYWNlXG4gICAgaWYgKHByb2Nlc3NGcmFtZUNhbGxiYWNrICE9PSBudWxsKVxuICAgICAgcHJvY2Vzc0ZyYW1lQ2FsbGJhY2sob3V0cHV0KTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBCcmlkZ2U7XG4iXX0=