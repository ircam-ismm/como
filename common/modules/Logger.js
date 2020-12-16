"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _BaseModule = _interopRequireDefault(require("./BaseModule"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

class Logger extends _BaseModule.default {
  execute(inputFrame) {
    console.log(JSON.stringify(inputFrame.data, null, 2)); // dead end

    return null;
  }

}

var _default = Logger;
exports.default = _default;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9jb21tb24vbW9kdWxlcy9Mb2dnZXIuanMiXSwibmFtZXMiOlsiTG9nZ2VyIiwiQmFzZU1vZHVsZSIsImV4ZWN1dGUiLCJpbnB1dEZyYW1lIiwiY29uc29sZSIsImxvZyIsIkpTT04iLCJzdHJpbmdpZnkiLCJkYXRhIl0sIm1hcHBpbmdzIjoiOzs7Ozs7O0FBQUE7Ozs7QUFFQSxNQUFNQSxNQUFOLFNBQXFCQyxtQkFBckIsQ0FBZ0M7QUFDOUJDLEVBQUFBLE9BQU8sQ0FBQ0MsVUFBRCxFQUFhO0FBQ2xCQyxJQUFBQSxPQUFPLENBQUNDLEdBQVIsQ0FBWUMsSUFBSSxDQUFDQyxTQUFMLENBQWVKLFVBQVUsQ0FBQ0ssSUFBMUIsRUFBZ0MsSUFBaEMsRUFBc0MsQ0FBdEMsQ0FBWixFQURrQixDQUVsQjs7QUFDQSxXQUFPLElBQVA7QUFDRDs7QUFMNkI7O2VBUWpCUixNIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IEJhc2VNb2R1bGUgZnJvbSAnLi9CYXNlTW9kdWxlJztcblxuY2xhc3MgTG9nZ2VyIGV4dGVuZHMgQmFzZU1vZHVsZSB7XG4gIGV4ZWN1dGUoaW5wdXRGcmFtZSkge1xuICAgIGNvbnNvbGUubG9nKEpTT04uc3RyaW5naWZ5KGlucHV0RnJhbWUuZGF0YSwgbnVsbCwgMikpO1xuICAgIC8vIGRlYWQgZW5kXG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgTG9nZ2VyO1xuIl19