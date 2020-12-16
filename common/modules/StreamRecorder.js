"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _BaseModule = _interopRequireDefault(require("./BaseModule"));

var _helpers = require("./helpers");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

class StreamRecorder extends _BaseModule.default {
  constructor(graph, type, id, options) {
    options = Object.assign({
      name: `player`,
      bufferSize: 50
    }, options);
    super(graph, type, id, options);
    this.writer = null; // this is a no-op in slave graphs (server-side and duplicated players)

    if (!this.graph.slave) {
      this.unsubscribe = this.graph.player.subscribe(async updates => {
        if ('streamRecord' in updates) {
          if (updates['streamRecord'] === true) {
            const recordingName = `${this.options.name}-${graph.player.get('id')}`;
            const logger = graph.como.experience.plugins['logger'];
            this.writer = await logger.create(recordingName, {
              bufferSize: this.options.bufferSize
            });
          } else {
            if (this.writer) {
              this.writer.close();
            }

            this.writer = null;
          }
        }
      });
    }
  }

  destroy() {
    this.unsubscribe();
  } // @note - deadend


  process(inputFrame) {
    if (this.writer !== null) {
      const copy = {};
      (0, _helpers.copyFrameData)(inputFrame.data, copy);
      console.log(copy);
      this.writer.write(copy);
    }
  }

}

var _default = StreamRecorder;
exports.default = _default;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9jb21tb24vbW9kdWxlcy9TdHJlYW1SZWNvcmRlci5qcyJdLCJuYW1lcyI6WyJTdHJlYW1SZWNvcmRlciIsIkJhc2VNb2R1bGUiLCJjb25zdHJ1Y3RvciIsImdyYXBoIiwidHlwZSIsImlkIiwib3B0aW9ucyIsIk9iamVjdCIsImFzc2lnbiIsIm5hbWUiLCJidWZmZXJTaXplIiwid3JpdGVyIiwic2xhdmUiLCJ1bnN1YnNjcmliZSIsInBsYXllciIsInN1YnNjcmliZSIsInVwZGF0ZXMiLCJyZWNvcmRpbmdOYW1lIiwiZ2V0IiwibG9nZ2VyIiwiY29tbyIsImV4cGVyaWVuY2UiLCJwbHVnaW5zIiwiY3JlYXRlIiwiY2xvc2UiLCJkZXN0cm95IiwicHJvY2VzcyIsImlucHV0RnJhbWUiLCJjb3B5IiwiZGF0YSIsImNvbnNvbGUiLCJsb2ciLCJ3cml0ZSJdLCJtYXBwaW5ncyI6Ijs7Ozs7OztBQUFBOztBQUNBOzs7O0FBRUEsTUFBTUEsY0FBTixTQUE2QkMsbUJBQTdCLENBQXdDO0FBQ3RDQyxFQUFBQSxXQUFXLENBQUNDLEtBQUQsRUFBUUMsSUFBUixFQUFjQyxFQUFkLEVBQWtCQyxPQUFsQixFQUEyQjtBQUNwQ0EsSUFBQUEsT0FBTyxHQUFHQyxNQUFNLENBQUNDLE1BQVAsQ0FBYztBQUN0QkMsTUFBQUEsSUFBSSxFQUFHLFFBRGU7QUFFdEJDLE1BQUFBLFVBQVUsRUFBRTtBQUZVLEtBQWQsRUFHUEosT0FITyxDQUFWO0FBS0EsVUFBTUgsS0FBTixFQUFhQyxJQUFiLEVBQW1CQyxFQUFuQixFQUF1QkMsT0FBdkI7QUFFQSxTQUFLSyxNQUFMLEdBQWMsSUFBZCxDQVJvQyxDQVVwQzs7QUFDQSxRQUFJLENBQUMsS0FBS1IsS0FBTCxDQUFXUyxLQUFoQixFQUF1QjtBQUNyQixXQUFLQyxXQUFMLEdBQW1CLEtBQUtWLEtBQUwsQ0FBV1csTUFBWCxDQUFrQkMsU0FBbEIsQ0FBNEIsTUFBTUMsT0FBTixJQUFpQjtBQUM5RCxZQUFJLGtCQUFrQkEsT0FBdEIsRUFBK0I7QUFDN0IsY0FBSUEsT0FBTyxDQUFDLGNBQUQsQ0FBUCxLQUE0QixJQUFoQyxFQUFzQztBQUNwQyxrQkFBTUMsYUFBYSxHQUFJLEdBQUUsS0FBS1gsT0FBTCxDQUFhRyxJQUFLLElBQUdOLEtBQUssQ0FBQ1csTUFBTixDQUFhSSxHQUFiLENBQWlCLElBQWpCLENBQXVCLEVBQXJFO0FBQ0Esa0JBQU1DLE1BQU0sR0FBR2hCLEtBQUssQ0FBQ2lCLElBQU4sQ0FBV0MsVUFBWCxDQUFzQkMsT0FBdEIsQ0FBOEIsUUFBOUIsQ0FBZjtBQUVBLGlCQUFLWCxNQUFMLEdBQWMsTUFBTVEsTUFBTSxDQUFDSSxNQUFQLENBQWNOLGFBQWQsRUFBNkI7QUFDL0NQLGNBQUFBLFVBQVUsRUFBRSxLQUFLSixPQUFMLENBQWFJO0FBRHNCLGFBQTdCLENBQXBCO0FBR0QsV0FQRCxNQU9PO0FBQ0wsZ0JBQUksS0FBS0MsTUFBVCxFQUFpQjtBQUNmLG1CQUFLQSxNQUFMLENBQVlhLEtBQVo7QUFDRDs7QUFFRCxpQkFBS2IsTUFBTCxHQUFjLElBQWQ7QUFDRDtBQUNGO0FBQ0YsT0FqQmtCLENBQW5CO0FBa0JEO0FBQ0Y7O0FBRURjLEVBQUFBLE9BQU8sR0FBRztBQUNSLFNBQUtaLFdBQUw7QUFDRCxHQXBDcUMsQ0FzQ3RDOzs7QUFDQWEsRUFBQUEsT0FBTyxDQUFDQyxVQUFELEVBQWE7QUFDbEIsUUFBSSxLQUFLaEIsTUFBTCxLQUFnQixJQUFwQixFQUEwQjtBQUN4QixZQUFNaUIsSUFBSSxHQUFHLEVBQWI7QUFDQSxrQ0FBY0QsVUFBVSxDQUFDRSxJQUF6QixFQUErQkQsSUFBL0I7QUFDQUUsTUFBQUEsT0FBTyxDQUFDQyxHQUFSLENBQVlILElBQVo7QUFDQSxXQUFLakIsTUFBTCxDQUFZcUIsS0FBWixDQUFrQkosSUFBbEI7QUFDRDtBQUNGOztBQTlDcUM7O2VBaUR6QjVCLGMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgQmFzZU1vZHVsZSBmcm9tICcuL0Jhc2VNb2R1bGUnO1xuaW1wb3J0IHsgY29weUZyYW1lRGF0YSB9IGZyb20gJy4vaGVscGVycyc7XG5cbmNsYXNzIFN0cmVhbVJlY29yZGVyIGV4dGVuZHMgQmFzZU1vZHVsZSB7XG4gIGNvbnN0cnVjdG9yKGdyYXBoLCB0eXBlLCBpZCwgb3B0aW9ucykge1xuICAgIG9wdGlvbnMgPSBPYmplY3QuYXNzaWduKHtcbiAgICAgIG5hbWU6IGBwbGF5ZXJgLFxuICAgICAgYnVmZmVyU2l6ZTogNTAsXG4gICAgfSwgb3B0aW9ucyk7XG5cbiAgICBzdXBlcihncmFwaCwgdHlwZSwgaWQsIG9wdGlvbnMpO1xuXG4gICAgdGhpcy53cml0ZXIgPSBudWxsO1xuXG4gICAgLy8gdGhpcyBpcyBhIG5vLW9wIGluIHNsYXZlIGdyYXBocyAoc2VydmVyLXNpZGUgYW5kIGR1cGxpY2F0ZWQgcGxheWVycylcbiAgICBpZiAoIXRoaXMuZ3JhcGguc2xhdmUpIHtcbiAgICAgIHRoaXMudW5zdWJzY3JpYmUgPSB0aGlzLmdyYXBoLnBsYXllci5zdWJzY3JpYmUoYXN5bmMgdXBkYXRlcyA9PiB7XG4gICAgICAgIGlmICgnc3RyZWFtUmVjb3JkJyBpbiB1cGRhdGVzKSB7XG4gICAgICAgICAgaWYgKHVwZGF0ZXNbJ3N0cmVhbVJlY29yZCddID09PSB0cnVlKSB7XG4gICAgICAgICAgICBjb25zdCByZWNvcmRpbmdOYW1lID0gYCR7dGhpcy5vcHRpb25zLm5hbWV9LSR7Z3JhcGgucGxheWVyLmdldCgnaWQnKX1gO1xuICAgICAgICAgICAgY29uc3QgbG9nZ2VyID0gZ3JhcGguY29tby5leHBlcmllbmNlLnBsdWdpbnNbJ2xvZ2dlciddO1xuXG4gICAgICAgICAgICB0aGlzLndyaXRlciA9IGF3YWl0IGxvZ2dlci5jcmVhdGUocmVjb3JkaW5nTmFtZSwge1xuICAgICAgICAgICAgICBidWZmZXJTaXplOiB0aGlzLm9wdGlvbnMuYnVmZmVyU2l6ZSxcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBpZiAodGhpcy53cml0ZXIpIHtcbiAgICAgICAgICAgICAgdGhpcy53cml0ZXIuY2xvc2UoKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhpcy53cml0ZXIgPSBudWxsO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfVxuICB9XG5cbiAgZGVzdHJveSgpIHtcbiAgICB0aGlzLnVuc3Vic2NyaWJlKCk7XG4gIH1cblxuICAvLyBAbm90ZSAtIGRlYWRlbmRcbiAgcHJvY2VzcyhpbnB1dEZyYW1lKSB7XG4gICAgaWYgKHRoaXMud3JpdGVyICE9PSBudWxsKSB7XG4gICAgICBjb25zdCBjb3B5ID0ge31cbiAgICAgIGNvcHlGcmFtZURhdGEoaW5wdXRGcmFtZS5kYXRhLCBjb3B5KTtcbiAgICAgIGNvbnNvbGUubG9nKGNvcHkpO1xuICAgICAgdGhpcy53cml0ZXIud3JpdGUoY29weSk7XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IFN0cmVhbVJlY29yZGVyO1xuIl19