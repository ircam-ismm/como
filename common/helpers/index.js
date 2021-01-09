"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _MovingAverage = _interopRequireDefault(require("./algo/MovingAverage.js"));

var _MovingMedian = _interopRequireDefault(require("./algo/MovingMedian.js"));

var _MovingMeanStd = _interopRequireDefault(require("./algo/MovingMeanStd.js"));

var _MovingDelta = _interopRequireDefault(require("./algo/MovingDelta.js"));

var _decibelToLinear = _interopRequireDefault(require("./math/decibelToLinear.js"));

var _decibelToPower = _interopRequireDefault(require("./math/decibelToPower.js"));

var _linearToDecibel = _interopRequireDefault(require("./math/linearToDecibel.js"));

var _powerToDecibel = _interopRequireDefault(require("./math/powerToDecibel.js"));

var _scale = _interopRequireDefault(require("./math/scale.js"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// algos
// math
var _default = {
  algo: {
    MovingAverage: _MovingAverage.default,
    MovingMedian: _MovingMedian.default,
    MovingMeanStd: _MovingMeanStd.default,
    MovingDelta: _MovingDelta.default
  },
  math: {
    decibelToLinear: _decibelToLinear.default,
    decibelToPower: _decibelToPower.default,
    linearToDecibel: _linearToDecibel.default,
    powerToDecibel: _powerToDecibel.default,
    scale: _scale.default
  }
};
exports.default = _default;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9jb21tb24vaGVscGVycy9pbmRleC5qcyJdLCJuYW1lcyI6WyJhbGdvIiwiTW92aW5nQXZlcmFnZSIsIk1vdmluZ01lZGlhbiIsIk1vdmluZ01lYW5TdGQiLCJNb3ZpbmdEZWx0YSIsIm1hdGgiLCJkZWNpYmVsVG9MaW5lYXIiLCJkZWNpYmVsVG9Qb3dlciIsImxpbmVhclRvRGVjaWJlbCIsInBvd2VyVG9EZWNpYmVsIiwic2NhbGUiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7QUFFQTs7QUFDQTs7QUFDQTs7QUFDQTs7QUFHQTs7QUFDQTs7QUFDQTs7QUFDQTs7QUFDQTs7OztBQVhBO0FBTUE7ZUFPZTtBQUNiQSxFQUFBQSxJQUFJLEVBQUU7QUFDSkMsSUFBQUEsYUFBYSxFQUFiQSxzQkFESTtBQUVKQyxJQUFBQSxZQUFZLEVBQVpBLHFCQUZJO0FBR0pDLElBQUFBLGFBQWEsRUFBYkEsc0JBSEk7QUFJSkMsSUFBQUEsV0FBVyxFQUFYQTtBQUpJLEdBRE87QUFPYkMsRUFBQUEsSUFBSSxFQUFFO0FBQ0pDLElBQUFBLGVBQWUsRUFBZkEsd0JBREk7QUFFSkMsSUFBQUEsY0FBYyxFQUFkQSx1QkFGSTtBQUdKQyxJQUFBQSxlQUFlLEVBQWZBLHdCQUhJO0FBSUpDLElBQUFBLGNBQWMsRUFBZEEsdUJBSkk7QUFLSkMsSUFBQUEsS0FBSyxFQUFMQTtBQUxJO0FBUE8sQyIsInNvdXJjZXNDb250ZW50IjpbIlxuLy8gYWxnb3NcbmltcG9ydCBNb3ZpbmdBdmVyYWdlIGZyb20gJy4vYWxnby9Nb3ZpbmdBdmVyYWdlLmpzJztcbmltcG9ydCBNb3ZpbmdNZWRpYW4gZnJvbSAnLi9hbGdvL01vdmluZ01lZGlhbi5qcyc7XG5pbXBvcnQgTW92aW5nTWVhblN0ZCBmcm9tICcuL2FsZ28vTW92aW5nTWVhblN0ZC5qcyc7XG5pbXBvcnQgTW92aW5nRGVsdGEgZnJvbSAnLi9hbGdvL01vdmluZ0RlbHRhLmpzJztcblxuLy8gbWF0aFxuaW1wb3J0IGRlY2liZWxUb0xpbmVhciBmcm9tICcuL21hdGgvZGVjaWJlbFRvTGluZWFyLmpzJztcbmltcG9ydCBkZWNpYmVsVG9Qb3dlciBmcm9tICcuL21hdGgvZGVjaWJlbFRvUG93ZXIuanMnO1xuaW1wb3J0IGxpbmVhclRvRGVjaWJlbCBmcm9tICcuL21hdGgvbGluZWFyVG9EZWNpYmVsLmpzJztcbmltcG9ydCBwb3dlclRvRGVjaWJlbCBmcm9tICcuL21hdGgvcG93ZXJUb0RlY2liZWwuanMnO1xuaW1wb3J0IHNjYWxlIGZyb20gJy4vbWF0aC9zY2FsZS5qcyc7XG5cbmV4cG9ydCBkZWZhdWx0IHtcbiAgYWxnbzoge1xuICAgIE1vdmluZ0F2ZXJhZ2UsXG4gICAgTW92aW5nTWVkaWFuLFxuICAgIE1vdmluZ01lYW5TdGQsXG4gICAgTW92aW5nRGVsdGEsXG4gIH0sXG4gIG1hdGg6IHtcbiAgICBkZWNpYmVsVG9MaW5lYXIsXG4gICAgZGVjaWJlbFRvUG93ZXIsXG4gICAgbGluZWFyVG9EZWNpYmVsLFxuICAgIHBvd2VyVG9EZWNpYmVsLFxuICAgIHNjYWxlLFxuICB9LFxufTtcblxuIl19