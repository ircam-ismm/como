"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _MovingAverage = _interopRequireDefault(require("./algo/MovingAverage.js"));

var _MovingMedian = _interopRequireDefault(require("./algo/MovingMedian.js"));

var _MovingStd = _interopRequireDefault(require("./algo/MovingStd.js"));

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
    MovingStd: _MovingStd.default
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9jb21tb24vaGVscGVycy9pbmRleC5qcyJdLCJuYW1lcyI6WyJhbGdvIiwiTW92aW5nQXZlcmFnZSIsIk1vdmluZ01lZGlhbiIsIk1vdmluZ1N0ZCIsIm1hdGgiLCJkZWNpYmVsVG9MaW5lYXIiLCJkZWNpYmVsVG9Qb3dlciIsImxpbmVhclRvRGVjaWJlbCIsInBvd2VyVG9EZWNpYmVsIiwic2NhbGUiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7QUFFQTs7QUFDQTs7QUFDQTs7QUFHQTs7QUFDQTs7QUFDQTs7QUFDQTs7QUFDQTs7OztBQVZBO0FBS0E7ZUFPZTtBQUNiQSxFQUFBQSxJQUFJLEVBQUU7QUFDSkMsSUFBQUEsYUFBYSxFQUFiQSxzQkFESTtBQUVKQyxJQUFBQSxZQUFZLEVBQVpBLHFCQUZJO0FBR0pDLElBQUFBLFNBQVMsRUFBVEE7QUFISSxHQURPO0FBTWJDLEVBQUFBLElBQUksRUFBRTtBQUNKQyxJQUFBQSxlQUFlLEVBQWZBLHdCQURJO0FBRUpDLElBQUFBLGNBQWMsRUFBZEEsdUJBRkk7QUFHSkMsSUFBQUEsZUFBZSxFQUFmQSx3QkFISTtBQUlKQyxJQUFBQSxjQUFjLEVBQWRBLHVCQUpJO0FBS0pDLElBQUFBLEtBQUssRUFBTEE7QUFMSTtBQU5PLEMiLCJzb3VyY2VzQ29udGVudCI6WyJcbi8vIGFsZ29zXG5pbXBvcnQgTW92aW5nQXZlcmFnZSBmcm9tICcuL2FsZ28vTW92aW5nQXZlcmFnZS5qcyc7XG5pbXBvcnQgTW92aW5nTWVkaWFuIGZyb20gJy4vYWxnby9Nb3ZpbmdNZWRpYW4uanMnO1xuaW1wb3J0IE1vdmluZ1N0ZCBmcm9tICcuL2FsZ28vTW92aW5nU3RkLmpzJztcblxuLy8gbWF0aFxuaW1wb3J0IGRlY2liZWxUb0xpbmVhciBmcm9tICcuL21hdGgvZGVjaWJlbFRvTGluZWFyLmpzJztcbmltcG9ydCBkZWNpYmVsVG9Qb3dlciBmcm9tICcuL21hdGgvZGVjaWJlbFRvUG93ZXIuanMnO1xuaW1wb3J0IGxpbmVhclRvRGVjaWJlbCBmcm9tICcuL21hdGgvbGluZWFyVG9EZWNpYmVsLmpzJztcbmltcG9ydCBwb3dlclRvRGVjaWJlbCBmcm9tICcuL21hdGgvcG93ZXJUb0RlY2liZWwuanMnO1xuaW1wb3J0IHNjYWxlIGZyb20gJy4vbWF0aC9zY2FsZS5qcyc7XG5cbmV4cG9ydCBkZWZhdWx0IHtcbiAgYWxnbzoge1xuICAgIE1vdmluZ0F2ZXJhZ2UsXG4gICAgTW92aW5nTWVkaWFuLFxuICAgIE1vdmluZ1N0ZCxcbiAgfSxcbiAgbWF0aDoge1xuICAgIGRlY2liZWxUb0xpbmVhcixcbiAgICBkZWNpYmVsVG9Qb3dlcixcbiAgICBsaW5lYXJUb0RlY2liZWwsXG4gICAgcG93ZXJUb0RlY2liZWwsXG4gICAgc2NhbGUsXG4gIH0sXG59O1xuXG4iXX0=