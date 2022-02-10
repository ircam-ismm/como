"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

/**
 * output format MUST be
 * {
 *   metas: [id, timestamp, period]
 *   accelerationIncludingGravity: [x, y, z],
 *   rotationRate: [alpha (yaw), beta (pitch), gamma (roll)]
 * }
 */
class BaseSource {
  constructor() {
    this.listeners = new Set();
  }

  addListener(callback) {
    this.listeners.add(callback);
  }

  removeListener(callback) {
    this.listeners.delete(callback);
  }

  removeAllListeners() {
    this.listeners.clear();
  }

  emit(data) {
    this.listeners.forEach(callback => callback(data));
  }

}

var _default = BaseSource;
exports.default = _default;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9jb21tb24vc291cmNlcy9CYXNlU291cmNlLmpzIl0sIm5hbWVzIjpbIkJhc2VTb3VyY2UiLCJjb25zdHJ1Y3RvciIsImxpc3RlbmVycyIsIlNldCIsImFkZExpc3RlbmVyIiwiY2FsbGJhY2siLCJhZGQiLCJyZW1vdmVMaXN0ZW5lciIsImRlbGV0ZSIsInJlbW92ZUFsbExpc3RlbmVycyIsImNsZWFyIiwiZW1pdCIsImRhdGEiLCJmb3JFYWNoIl0sIm1hcHBpbmdzIjoiOzs7Ozs7O0FBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLE1BQU1BLFVBQU4sQ0FBaUI7QUFDZkMsRUFBQUEsV0FBVyxHQUFHO0FBQ1osU0FBS0MsU0FBTCxHQUFpQixJQUFJQyxHQUFKLEVBQWpCO0FBQ0Q7O0FBRURDLEVBQUFBLFdBQVcsQ0FBQ0MsUUFBRCxFQUFXO0FBQ3BCLFNBQUtILFNBQUwsQ0FBZUksR0FBZixDQUFtQkQsUUFBbkI7QUFDRDs7QUFFREUsRUFBQUEsY0FBYyxDQUFDRixRQUFELEVBQVc7QUFDdkIsU0FBS0gsU0FBTCxDQUFlTSxNQUFmLENBQXNCSCxRQUF0QjtBQUNEOztBQUVESSxFQUFBQSxrQkFBa0IsR0FBRztBQUNuQixTQUFLUCxTQUFMLENBQWVRLEtBQWY7QUFDRDs7QUFFREMsRUFBQUEsSUFBSSxDQUFDQyxJQUFELEVBQU87QUFDVCxTQUFLVixTQUFMLENBQWVXLE9BQWYsQ0FBdUJSLFFBQVEsSUFBSUEsUUFBUSxDQUFDTyxJQUFELENBQTNDO0FBQ0Q7O0FBbkJjOztlQXNCRlosVSIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogb3V0cHV0IGZvcm1hdCBNVVNUIGJlXG4gKiB7XG4gKiAgIG1ldGFzOiBbaWQsIHRpbWVzdGFtcCwgcGVyaW9kXVxuICogICBhY2NlbGVyYXRpb25JbmNsdWRpbmdHcmF2aXR5OiBbeCwgeSwgel0sXG4gKiAgIHJvdGF0aW9uUmF0ZTogW2FscGhhICh5YXcpLCBiZXRhIChwaXRjaCksIGdhbW1hIChyb2xsKV1cbiAqIH1cbiAqL1xuY2xhc3MgQmFzZVNvdXJjZSB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHRoaXMubGlzdGVuZXJzID0gbmV3IFNldCgpO1xuICB9XG5cbiAgYWRkTGlzdGVuZXIoY2FsbGJhY2spIHtcbiAgICB0aGlzLmxpc3RlbmVycy5hZGQoY2FsbGJhY2spO1xuICB9XG5cbiAgcmVtb3ZlTGlzdGVuZXIoY2FsbGJhY2spIHtcbiAgICB0aGlzLmxpc3RlbmVycy5kZWxldGUoY2FsbGJhY2spO1xuICB9XG5cbiAgcmVtb3ZlQWxsTGlzdGVuZXJzKCkge1xuICAgIHRoaXMubGlzdGVuZXJzLmNsZWFyKCk7XG4gIH1cblxuICBlbWl0KGRhdGEpIHtcbiAgICB0aGlzLmxpc3RlbmVycy5mb3JFYWNoKGNhbGxiYWNrID0+IGNhbGxiYWNrKGRhdGEpKTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBCYXNlU291cmNlO1xuIl19