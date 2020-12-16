"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _MovingAverage = _interopRequireDefault(require("./algo/MovingAverage.js"));

var _MovingMedian = _interopRequireDefault(require("./algo/MovingMedian.js"));

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
    MovingMedian: _MovingMedian.default
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9jb21tb24vaGVscGVycy9pbmRleC5qcyJdLCJuYW1lcyI6WyJhbGdvIiwiTW92aW5nQXZlcmFnZSIsIk1vdmluZ01lZGlhbiIsIm1hdGgiLCJkZWNpYmVsVG9MaW5lYXIiLCJkZWNpYmVsVG9Qb3dlciIsImxpbmVhclRvRGVjaWJlbCIsInBvd2VyVG9EZWNpYmVsIiwic2NhbGUiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7QUFFQTs7QUFDQTs7QUFHQTs7QUFDQTs7QUFDQTs7QUFDQTs7QUFDQTs7OztBQVRBO0FBSUE7ZUFPZTtBQUNiQSxFQUFBQSxJQUFJLEVBQUU7QUFDSkMsSUFBQUEsYUFBYSxFQUFiQSxzQkFESTtBQUVKQyxJQUFBQSxZQUFZLEVBQVpBO0FBRkksR0FETztBQUtiQyxFQUFBQSxJQUFJLEVBQUU7QUFDSkMsSUFBQUEsZUFBZSxFQUFmQSx3QkFESTtBQUVKQyxJQUFBQSxjQUFjLEVBQWRBLHVCQUZJO0FBR0pDLElBQUFBLGVBQWUsRUFBZkEsd0JBSEk7QUFJSkMsSUFBQUEsY0FBYyxFQUFkQSx1QkFKSTtBQUtKQyxJQUFBQSxLQUFLLEVBQUxBO0FBTEk7QUFMTyxDIiwic291cmNlc0NvbnRlbnQiOlsiXG4vLyBhbGdvc1xuaW1wb3J0IE1vdmluZ0F2ZXJhZ2UgZnJvbSAnLi9hbGdvL01vdmluZ0F2ZXJhZ2UuanMnO1xuaW1wb3J0IE1vdmluZ01lZGlhbiBmcm9tICcuL2FsZ28vTW92aW5nTWVkaWFuLmpzJztcblxuLy8gbWF0aFxuaW1wb3J0IGRlY2liZWxUb0xpbmVhciBmcm9tICcuL21hdGgvZGVjaWJlbFRvTGluZWFyLmpzJztcbmltcG9ydCBkZWNpYmVsVG9Qb3dlciBmcm9tICcuL21hdGgvZGVjaWJlbFRvUG93ZXIuanMnO1xuaW1wb3J0IGxpbmVhclRvRGVjaWJlbCBmcm9tICcuL21hdGgvbGluZWFyVG9EZWNpYmVsLmpzJztcbmltcG9ydCBwb3dlclRvRGVjaWJlbCBmcm9tICcuL21hdGgvcG93ZXJUb0RlY2liZWwuanMnO1xuaW1wb3J0IHNjYWxlIGZyb20gJy4vbWF0aC9zY2FsZS5qcyc7XG5cbmV4cG9ydCBkZWZhdWx0IHtcbiAgYWxnbzoge1xuICAgIE1vdmluZ0F2ZXJhZ2UsXG4gICAgTW92aW5nTWVkaWFuLFxuICB9LFxuICBtYXRoOiB7XG4gICAgZGVjaWJlbFRvTGluZWFyLFxuICAgIGRlY2liZWxUb1Bvd2VyLFxuICAgIGxpbmVhclRvRGVjaWJlbCxcbiAgICBwb3dlclRvRGVjaWJlbCxcbiAgICBzY2FsZSxcbiAgfSxcbn07XG5cbiJdfQ==