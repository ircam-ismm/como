"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _BaseModule = _interopRequireDefault(require("./BaseModule"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

class SelectAs extends _BaseModule.default {
  constructor(graph, type, id, options) {
    options = Object.assign({
      entries: []
    }, options);
    super(graph, type, id, options);
  }

  execute(inputFrame) {
    // select and rename from options
    this.options.entries.forEach(entry => {
      const [src, dest] = entry;
      this.outputFrame.data[dest] = inputFrame.data[src];
    });
    return this.outputFrame;
  }

}

var _default = SelectAs;
exports.default = _default;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9jb21tb24vbW9kdWxlcy9TZWxlY3RBcy5qcyJdLCJuYW1lcyI6WyJTZWxlY3RBcyIsIkJhc2VNb2R1bGUiLCJjb25zdHJ1Y3RvciIsImdyYXBoIiwidHlwZSIsImlkIiwib3B0aW9ucyIsIk9iamVjdCIsImFzc2lnbiIsImVudHJpZXMiLCJleGVjdXRlIiwiaW5wdXRGcmFtZSIsImZvckVhY2giLCJlbnRyeSIsInNyYyIsImRlc3QiLCJvdXRwdXRGcmFtZSIsImRhdGEiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7QUFBQTs7OztBQUVBLE1BQU1BLFFBQU4sU0FBdUJDLG1CQUF2QixDQUFrQztBQUNoQ0MsRUFBQUEsV0FBVyxDQUFDQyxLQUFELEVBQVFDLElBQVIsRUFBY0MsRUFBZCxFQUFrQkMsT0FBbEIsRUFBMkI7QUFDcENBLElBQUFBLE9BQU8sR0FBR0MsTUFBTSxDQUFDQyxNQUFQLENBQWM7QUFBRUMsTUFBQUEsT0FBTyxFQUFFO0FBQVgsS0FBZCxFQUErQkgsT0FBL0IsQ0FBVjtBQUNBLFVBQU1ILEtBQU4sRUFBYUMsSUFBYixFQUFtQkMsRUFBbkIsRUFBdUJDLE9BQXZCO0FBQ0Q7O0FBRURJLEVBQUFBLE9BQU8sQ0FBQ0MsVUFBRCxFQUFhO0FBQ2xCO0FBQ0EsU0FBS0wsT0FBTCxDQUFhRyxPQUFiLENBQXFCRyxPQUFyQixDQUE2QkMsS0FBSyxJQUFJO0FBQ3BDLFlBQU0sQ0FBQ0MsR0FBRCxFQUFNQyxJQUFOLElBQWNGLEtBQXBCO0FBQ0EsV0FBS0csV0FBTCxDQUFpQkMsSUFBakIsQ0FBc0JGLElBQXRCLElBQThCSixVQUFVLENBQUNNLElBQVgsQ0FBZ0JILEdBQWhCLENBQTlCO0FBQ0QsS0FIRDtBQUtBLFdBQU8sS0FBS0UsV0FBWjtBQUNEOztBQWQrQjs7ZUFpQm5CaEIsUSIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCBCYXNlTW9kdWxlIGZyb20gJy4vQmFzZU1vZHVsZSc7XG5cbmNsYXNzIFNlbGVjdEFzIGV4dGVuZHMgQmFzZU1vZHVsZSB7XG4gIGNvbnN0cnVjdG9yKGdyYXBoLCB0eXBlLCBpZCwgb3B0aW9ucykge1xuICAgIG9wdGlvbnMgPSBPYmplY3QuYXNzaWduKHsgZW50cmllczogW10gfSwgb3B0aW9ucyk7XG4gICAgc3VwZXIoZ3JhcGgsIHR5cGUsIGlkLCBvcHRpb25zKTtcbiAgfVxuXG4gIGV4ZWN1dGUoaW5wdXRGcmFtZSkge1xuICAgIC8vIHNlbGVjdCBhbmQgcmVuYW1lIGZyb20gb3B0aW9uc1xuICAgIHRoaXMub3B0aW9ucy5lbnRyaWVzLmZvckVhY2goZW50cnkgPT4ge1xuICAgICAgY29uc3QgW3NyYywgZGVzdF0gPSBlbnRyeTtcbiAgICAgIHRoaXMub3V0cHV0RnJhbWUuZGF0YVtkZXN0XSA9IGlucHV0RnJhbWUuZGF0YVtzcmNdO1xuICAgIH0pO1xuXG4gICAgcmV0dXJuIHRoaXMub3V0cHV0RnJhbWU7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgU2VsZWN0QXM7XG4iXX0=