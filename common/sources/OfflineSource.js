"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _BaseSource = _interopRequireDefault(require("./BaseSource.js"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

class OfflineSource extends _BaseSource.default {
  constructor(data) {
    super();
    this.data = data;
  }

  run() {
    this.data.forEach(frame => this.emit(frame));
  }

}

var _default = OfflineSource;
exports.default = _default;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9jb21tb24vc291cmNlcy9PZmZsaW5lU291cmNlLmpzIl0sIm5hbWVzIjpbIk9mZmxpbmVTb3VyY2UiLCJCYXNlU291cmNlIiwiY29uc3RydWN0b3IiLCJkYXRhIiwicnVuIiwiZm9yRWFjaCIsImZyYW1lIiwiZW1pdCJdLCJtYXBwaW5ncyI6Ijs7Ozs7OztBQUFBOzs7O0FBRUEsTUFBTUEsYUFBTixTQUE0QkMsbUJBQTVCLENBQXVDO0FBQ3JDQyxFQUFBQSxXQUFXLENBQUNDLElBQUQsRUFBTztBQUNoQjtBQUNBLFNBQUtBLElBQUwsR0FBWUEsSUFBWjtBQUNEOztBQUVEQyxFQUFBQSxHQUFHLEdBQUc7QUFDSixTQUFLRCxJQUFMLENBQVVFLE9BQVYsQ0FBa0JDLEtBQUssSUFBSSxLQUFLQyxJQUFMLENBQVVELEtBQVYsQ0FBM0I7QUFDRDs7QUFSb0M7O2VBV3hCTixhIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IEJhc2VTb3VyY2UgZnJvbSAnLi9CYXNlU291cmNlLmpzJztcblxuY2xhc3MgT2ZmbGluZVNvdXJjZSBleHRlbmRzIEJhc2VTb3VyY2Uge1xuICBjb25zdHJ1Y3RvcihkYXRhKSB7XG4gICAgc3VwZXIoKTtcbiAgICB0aGlzLmRhdGEgPSBkYXRhO1xuICB9XG5cbiAgcnVuKCkge1xuICAgIHRoaXMuZGF0YS5mb3JFYWNoKGZyYW1lID0+IHRoaXMuZW1pdChmcmFtZSkpO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IE9mZmxpbmVTb3VyY2U7XG4iXX0=