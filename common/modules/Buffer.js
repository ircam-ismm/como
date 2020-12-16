"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _BaseModule = _interopRequireDefault(require("./BaseModule"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// used by server.Session to record transformed stream
class Buffer extends _BaseModule.default {
  constructor(graph, type, id, options) {
    super(graph, type, id, options);
    this.reset();
  }

  getData() {
    return this.data;
  }

  reset() {
    this.data = [];
  }

  process(inputFrame) {
    const frame = [];

    for (let i = 0; i < inputFrame.data.length; i++) {
      frame[i] = inputFrame.data[i];
    }

    this.data.push(frame);
  }

}

var _default = Buffer;
exports.default = _default;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9jb21tb24vbW9kdWxlcy9CdWZmZXIuanMiXSwibmFtZXMiOlsiQnVmZmVyIiwiQmFzZU1vZHVsZSIsImNvbnN0cnVjdG9yIiwiZ3JhcGgiLCJ0eXBlIiwiaWQiLCJvcHRpb25zIiwicmVzZXQiLCJnZXREYXRhIiwiZGF0YSIsInByb2Nlc3MiLCJpbnB1dEZyYW1lIiwiZnJhbWUiLCJpIiwibGVuZ3RoIiwicHVzaCJdLCJtYXBwaW5ncyI6Ijs7Ozs7OztBQUFBOzs7O0FBRUE7QUFDQSxNQUFNQSxNQUFOLFNBQXFCQyxtQkFBckIsQ0FBZ0M7QUFDOUJDLEVBQUFBLFdBQVcsQ0FBQ0MsS0FBRCxFQUFRQyxJQUFSLEVBQWNDLEVBQWQsRUFBa0JDLE9BQWxCLEVBQTJCO0FBQ3BDLFVBQU1ILEtBQU4sRUFBYUMsSUFBYixFQUFtQkMsRUFBbkIsRUFBdUJDLE9BQXZCO0FBRUEsU0FBS0MsS0FBTDtBQUNEOztBQUVEQyxFQUFBQSxPQUFPLEdBQUc7QUFDUixXQUFPLEtBQUtDLElBQVo7QUFDRDs7QUFFREYsRUFBQUEsS0FBSyxHQUFHO0FBQ04sU0FBS0UsSUFBTCxHQUFZLEVBQVo7QUFDRDs7QUFFREMsRUFBQUEsT0FBTyxDQUFDQyxVQUFELEVBQWE7QUFDbEIsVUFBTUMsS0FBSyxHQUFHLEVBQWQ7O0FBRUEsU0FBSyxJQUFJQyxDQUFDLEdBQUcsQ0FBYixFQUFnQkEsQ0FBQyxHQUFHRixVQUFVLENBQUNGLElBQVgsQ0FBZ0JLLE1BQXBDLEVBQTRDRCxDQUFDLEVBQTdDLEVBQWlEO0FBQy9DRCxNQUFBQSxLQUFLLENBQUNDLENBQUQsQ0FBTCxHQUFXRixVQUFVLENBQUNGLElBQVgsQ0FBZ0JJLENBQWhCLENBQVg7QUFDRDs7QUFFRCxTQUFLSixJQUFMLENBQVVNLElBQVYsQ0FBZUgsS0FBZjtBQUNEOztBQXZCNkI7O2VBMEJqQlosTSIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCBCYXNlTW9kdWxlIGZyb20gJy4vQmFzZU1vZHVsZSc7XG5cbi8vIHVzZWQgYnkgc2VydmVyLlNlc3Npb24gdG8gcmVjb3JkIHRyYW5zZm9ybWVkIHN0cmVhbVxuY2xhc3MgQnVmZmVyIGV4dGVuZHMgQmFzZU1vZHVsZSB7XG4gIGNvbnN0cnVjdG9yKGdyYXBoLCB0eXBlLCBpZCwgb3B0aW9ucykge1xuICAgIHN1cGVyKGdyYXBoLCB0eXBlLCBpZCwgb3B0aW9ucyk7XG5cbiAgICB0aGlzLnJlc2V0KCk7XG4gIH1cblxuICBnZXREYXRhKCkge1xuICAgIHJldHVybiB0aGlzLmRhdGE7XG4gIH1cblxuICByZXNldCgpIHtcbiAgICB0aGlzLmRhdGEgPSBbXTtcbiAgfVxuXG4gIHByb2Nlc3MoaW5wdXRGcmFtZSkge1xuICAgIGNvbnN0IGZyYW1lID0gW107XG5cbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGlucHV0RnJhbWUuZGF0YS5sZW5ndGg7IGkrKykge1xuICAgICAgZnJhbWVbaV0gPSBpbnB1dEZyYW1lLmRhdGFbaV07XG4gICAgfVxuXG4gICAgdGhpcy5kYXRhLnB1c2goZnJhbWUpO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IEJ1ZmZlcjtcbiJdfQ==