"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _BaseModule = _interopRequireDefault(require("./BaseModule.js"));

var _helpers = require("./helpers.js");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * Merge two stream without making assumptions on how to merge them
 * outputs only when all stream have been received at least once, if a stream
 * is received before other streams are received, its values are simply replaced
 *
 * At the différence of other streams, this objet output an array of all received
 * frames.
 *
 * Should be use mainly before a user defined script
 *
 * output.data = [inputFrame1, inputFrame2]
 */
class Merge extends _BaseModule.default {
  constructor(graph, type, id, options) {
    super(graph, type, id, options);
    this.inputIds = null;
    this._inputs = new Set();
    this.inputs = {
      add: value => {
        this._inputs.add(value);

        this._resetStack();
      },
      delete: value => {
        this._inputs.delete(value);

        this._resetStack();
      },
      clear: () => {
        this._inputs.clear();

        this._resetStack();
      }
    };

    this._resetStack();
  }

  _resetStack() {
    // reset output frame
    this.inputIds = Array.from(this._inputs).map(i => i.id);
    this.stack = [];
  }

  process(inputFrame) {
    const inputIndex = this.inputIds.indexOf(inputFrame.id); // console.log(inputFrame.id, inputIndex);

    this.stack[inputIndex] = inputFrame;
    let propagate = true;

    for (let i = 0; i < this.inputIds.length; i++) {
      if (!this.stack[i]) {
        propagate = false;
      }
    }

    if (propagate) {
      const outputData = this.outputFrame.data; // merge every entries in stack[n].data in outputFrame.data

      for (let i = 0; i < this.inputIds.length; i++) {
        const inputData = this.stack[i].data;
        (0, _helpers.copyFrameData)(inputData, outputData); // for (let name in input) {
        //   if (Array.isArray(input[name])) {
        //     if (!output[name]) {
        //       output[name] = [];
        //     }
        //     output[name] = input[name].slice(0);
        //     // output[name] = output[name].concat(input[name]);
        //   // handle objects
        //   } else if (Object.prototype.toString.call(input[name]) === '[object Object]') {
        //     if (!output[name]) {
        //       output[name] = {};
        //     }
        //     for (let key in input[name]) {
        //       output[name][key] = input[name][key];
        //     }
        //   // consider everything else as a scalar
        //   } else {
        //     output[name] = input[name];
        //   }
        // }
      }

      super.propagate(this.outputFrame); // reset stack for next call

      for (let i = 0; i < this.inputIds.length; i++) {
        this.stack[i] = undefined;
      }
    }
  }

}

var _default = Merge;
exports.default = _default;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9jb21tb24vbW9kdWxlcy9NZXJnZS5qcyJdLCJuYW1lcyI6WyJNZXJnZSIsIkJhc2VNb2R1bGUiLCJjb25zdHJ1Y3RvciIsImdyYXBoIiwidHlwZSIsImlkIiwib3B0aW9ucyIsImlucHV0SWRzIiwiX2lucHV0cyIsIlNldCIsImlucHV0cyIsImFkZCIsInZhbHVlIiwiX3Jlc2V0U3RhY2siLCJkZWxldGUiLCJjbGVhciIsIkFycmF5IiwiZnJvbSIsIm1hcCIsImkiLCJzdGFjayIsInByb2Nlc3MiLCJpbnB1dEZyYW1lIiwiaW5wdXRJbmRleCIsImluZGV4T2YiLCJwcm9wYWdhdGUiLCJsZW5ndGgiLCJvdXRwdXREYXRhIiwib3V0cHV0RnJhbWUiLCJkYXRhIiwiaW5wdXREYXRhIiwidW5kZWZpbmVkIl0sIm1hcHBpbmdzIjoiOzs7Ozs7O0FBQUE7O0FBQ0E7Ozs7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxNQUFNQSxLQUFOLFNBQW9CQyxtQkFBcEIsQ0FBK0I7QUFDN0JDLEVBQUFBLFdBQVcsQ0FBQ0MsS0FBRCxFQUFRQyxJQUFSLEVBQWNDLEVBQWQsRUFBa0JDLE9BQWxCLEVBQTJCO0FBQ3BDLFVBQU1ILEtBQU4sRUFBYUMsSUFBYixFQUFtQkMsRUFBbkIsRUFBdUJDLE9BQXZCO0FBRUEsU0FBS0MsUUFBTCxHQUFnQixJQUFoQjtBQUVBLFNBQUtDLE9BQUwsR0FBZSxJQUFJQyxHQUFKLEVBQWY7QUFDQSxTQUFLQyxNQUFMLEdBQWM7QUFDWkMsTUFBQUEsR0FBRyxFQUFHQyxLQUFELElBQVc7QUFDZCxhQUFLSixPQUFMLENBQWFHLEdBQWIsQ0FBaUJDLEtBQWpCOztBQUNBLGFBQUtDLFdBQUw7QUFDRCxPQUpXO0FBS1pDLE1BQUFBLE1BQU0sRUFBR0YsS0FBRCxJQUFXO0FBQ2pCLGFBQUtKLE9BQUwsQ0FBYU0sTUFBYixDQUFvQkYsS0FBcEI7O0FBQ0EsYUFBS0MsV0FBTDtBQUNELE9BUlc7QUFTWkUsTUFBQUEsS0FBSyxFQUFFLE1BQU07QUFDWCxhQUFLUCxPQUFMLENBQWFPLEtBQWI7O0FBQ0EsYUFBS0YsV0FBTDtBQUNEO0FBWlcsS0FBZDs7QUFlQSxTQUFLQSxXQUFMO0FBQ0Q7O0FBRURBLEVBQUFBLFdBQVcsR0FBRztBQUNaO0FBQ0EsU0FBS04sUUFBTCxHQUFnQlMsS0FBSyxDQUFDQyxJQUFOLENBQVcsS0FBS1QsT0FBaEIsRUFBeUJVLEdBQXpCLENBQTZCQyxDQUFDLElBQUlBLENBQUMsQ0FBQ2QsRUFBcEMsQ0FBaEI7QUFDQSxTQUFLZSxLQUFMLEdBQWEsRUFBYjtBQUNEOztBQUVEQyxFQUFBQSxPQUFPLENBQUNDLFVBQUQsRUFBYTtBQUNsQixVQUFNQyxVQUFVLEdBQUcsS0FBS2hCLFFBQUwsQ0FBY2lCLE9BQWQsQ0FBc0JGLFVBQVUsQ0FBQ2pCLEVBQWpDLENBQW5CLENBRGtCLENBRWxCOztBQUNBLFNBQUtlLEtBQUwsQ0FBV0csVUFBWCxJQUF5QkQsVUFBekI7QUFFQSxRQUFJRyxTQUFTLEdBQUcsSUFBaEI7O0FBRUEsU0FBSyxJQUFJTixDQUFDLEdBQUcsQ0FBYixFQUFnQkEsQ0FBQyxHQUFHLEtBQUtaLFFBQUwsQ0FBY21CLE1BQWxDLEVBQTBDUCxDQUFDLEVBQTNDLEVBQStDO0FBQzdDLFVBQUksQ0FBQyxLQUFLQyxLQUFMLENBQVdELENBQVgsQ0FBTCxFQUFvQjtBQUNsQk0sUUFBQUEsU0FBUyxHQUFHLEtBQVo7QUFDRDtBQUNGOztBQUVELFFBQUlBLFNBQUosRUFBZTtBQUNiLFlBQU1FLFVBQVUsR0FBRyxLQUFLQyxXQUFMLENBQWlCQyxJQUFwQyxDQURhLENBRWI7O0FBQ0EsV0FBSyxJQUFJVixDQUFDLEdBQUcsQ0FBYixFQUFnQkEsQ0FBQyxHQUFHLEtBQUtaLFFBQUwsQ0FBY21CLE1BQWxDLEVBQTBDUCxDQUFDLEVBQTNDLEVBQStDO0FBQzdDLGNBQU1XLFNBQVMsR0FBRyxLQUFLVixLQUFMLENBQVdELENBQVgsRUFBY1UsSUFBaEM7QUFFQSxvQ0FBY0MsU0FBZCxFQUF5QkgsVUFBekIsRUFINkMsQ0FJN0M7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNEOztBQUVELFlBQU1GLFNBQU4sQ0FBZ0IsS0FBS0csV0FBckIsRUEvQmEsQ0FpQ2I7O0FBQ0EsV0FBSyxJQUFJVCxDQUFDLEdBQUcsQ0FBYixFQUFnQkEsQ0FBQyxHQUFHLEtBQUtaLFFBQUwsQ0FBY21CLE1BQWxDLEVBQTBDUCxDQUFDLEVBQTNDLEVBQStDO0FBQzdDLGFBQUtDLEtBQUwsQ0FBV0QsQ0FBWCxJQUFnQlksU0FBaEI7QUFDRDtBQUNGO0FBQ0Y7O0FBbEY0Qjs7ZUFxRmhCL0IsSyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCBCYXNlTW9kdWxlIGZyb20gJy4vQmFzZU1vZHVsZS5qcyc7XG5pbXBvcnQgeyBjb3B5RnJhbWVEYXRhIH0gZnJvbSAnLi9oZWxwZXJzLmpzJztcbi8qKlxuICogTWVyZ2UgdHdvIHN0cmVhbSB3aXRob3V0IG1ha2luZyBhc3N1bXB0aW9ucyBvbiBob3cgdG8gbWVyZ2UgdGhlbVxuICogb3V0cHV0cyBvbmx5IHdoZW4gYWxsIHN0cmVhbSBoYXZlIGJlZW4gcmVjZWl2ZWQgYXQgbGVhc3Qgb25jZSwgaWYgYSBzdHJlYW1cbiAqIGlzIHJlY2VpdmVkIGJlZm9yZSBvdGhlciBzdHJlYW1zIGFyZSByZWNlaXZlZCwgaXRzIHZhbHVlcyBhcmUgc2ltcGx5IHJlcGxhY2VkXG4gKlxuICogQXQgdGhlIGRpZmbDqXJlbmNlIG9mIG90aGVyIHN0cmVhbXMsIHRoaXMgb2JqZXQgb3V0cHV0IGFuIGFycmF5IG9mIGFsbCByZWNlaXZlZFxuICogZnJhbWVzLlxuICpcbiAqIFNob3VsZCBiZSB1c2UgbWFpbmx5IGJlZm9yZSBhIHVzZXIgZGVmaW5lZCBzY3JpcHRcbiAqXG4gKiBvdXRwdXQuZGF0YSA9IFtpbnB1dEZyYW1lMSwgaW5wdXRGcmFtZTJdXG4gKi9cbmNsYXNzIE1lcmdlIGV4dGVuZHMgQmFzZU1vZHVsZSB7XG4gIGNvbnN0cnVjdG9yKGdyYXBoLCB0eXBlLCBpZCwgb3B0aW9ucykge1xuICAgIHN1cGVyKGdyYXBoLCB0eXBlLCBpZCwgb3B0aW9ucyk7XG5cbiAgICB0aGlzLmlucHV0SWRzID0gbnVsbDtcblxuICAgIHRoaXMuX2lucHV0cyA9IG5ldyBTZXQoKTtcbiAgICB0aGlzLmlucHV0cyA9IHtcbiAgICAgIGFkZDogKHZhbHVlKSA9PiB7XG4gICAgICAgIHRoaXMuX2lucHV0cy5hZGQodmFsdWUpO1xuICAgICAgICB0aGlzLl9yZXNldFN0YWNrKCk7XG4gICAgICB9LFxuICAgICAgZGVsZXRlOiAodmFsdWUpID0+IHtcbiAgICAgICAgdGhpcy5faW5wdXRzLmRlbGV0ZSh2YWx1ZSk7XG4gICAgICAgIHRoaXMuX3Jlc2V0U3RhY2soKTtcbiAgICAgIH0sXG4gICAgICBjbGVhcjogKCkgPT4ge1xuICAgICAgICB0aGlzLl9pbnB1dHMuY2xlYXIoKTtcbiAgICAgICAgdGhpcy5fcmVzZXRTdGFjaygpO1xuICAgICAgfSxcbiAgICB9O1xuXG4gICAgdGhpcy5fcmVzZXRTdGFjaygpO1xuICB9XG5cbiAgX3Jlc2V0U3RhY2soKSB7XG4gICAgLy8gcmVzZXQgb3V0cHV0IGZyYW1lXG4gICAgdGhpcy5pbnB1dElkcyA9IEFycmF5LmZyb20odGhpcy5faW5wdXRzKS5tYXAoaSA9PiBpLmlkKTtcbiAgICB0aGlzLnN0YWNrID0gW107XG4gIH1cblxuICBwcm9jZXNzKGlucHV0RnJhbWUpIHtcbiAgICBjb25zdCBpbnB1dEluZGV4ID0gdGhpcy5pbnB1dElkcy5pbmRleE9mKGlucHV0RnJhbWUuaWQpO1xuICAgIC8vIGNvbnNvbGUubG9nKGlucHV0RnJhbWUuaWQsIGlucHV0SW5kZXgpO1xuICAgIHRoaXMuc3RhY2tbaW5wdXRJbmRleF0gPSBpbnB1dEZyYW1lO1xuXG4gICAgbGV0IHByb3BhZ2F0ZSA9IHRydWU7XG5cbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuaW5wdXRJZHMubGVuZ3RoOyBpKyspIHtcbiAgICAgIGlmICghdGhpcy5zdGFja1tpXSkge1xuICAgICAgICBwcm9wYWdhdGUgPSBmYWxzZTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAocHJvcGFnYXRlKSB7XG4gICAgICBjb25zdCBvdXRwdXREYXRhID0gdGhpcy5vdXRwdXRGcmFtZS5kYXRhO1xuICAgICAgLy8gbWVyZ2UgZXZlcnkgZW50cmllcyBpbiBzdGFja1tuXS5kYXRhIGluIG91dHB1dEZyYW1lLmRhdGFcbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5pbnB1dElkcy5sZW5ndGg7IGkrKykge1xuICAgICAgICBjb25zdCBpbnB1dERhdGEgPSB0aGlzLnN0YWNrW2ldLmRhdGE7XG5cbiAgICAgICAgY29weUZyYW1lRGF0YShpbnB1dERhdGEsIG91dHB1dERhdGEpO1xuICAgICAgICAvLyBmb3IgKGxldCBuYW1lIGluIGlucHV0KSB7XG4gICAgICAgIC8vICAgaWYgKEFycmF5LmlzQXJyYXkoaW5wdXRbbmFtZV0pKSB7XG4gICAgICAgIC8vICAgICBpZiAoIW91dHB1dFtuYW1lXSkge1xuICAgICAgICAvLyAgICAgICBvdXRwdXRbbmFtZV0gPSBbXTtcbiAgICAgICAgLy8gICAgIH1cblxuICAgICAgICAvLyAgICAgb3V0cHV0W25hbWVdID0gaW5wdXRbbmFtZV0uc2xpY2UoMCk7XG4gICAgICAgIC8vICAgICAvLyBvdXRwdXRbbmFtZV0gPSBvdXRwdXRbbmFtZV0uY29uY2F0KGlucHV0W25hbWVdKTtcbiAgICAgICAgLy8gICAvLyBoYW5kbGUgb2JqZWN0c1xuICAgICAgICAvLyAgIH0gZWxzZSBpZiAoT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKGlucHV0W25hbWVdKSA9PT0gJ1tvYmplY3QgT2JqZWN0XScpIHtcbiAgICAgICAgLy8gICAgIGlmICghb3V0cHV0W25hbWVdKSB7XG4gICAgICAgIC8vICAgICAgIG91dHB1dFtuYW1lXSA9IHt9O1xuICAgICAgICAvLyAgICAgfVxuXG4gICAgICAgIC8vICAgICBmb3IgKGxldCBrZXkgaW4gaW5wdXRbbmFtZV0pIHtcbiAgICAgICAgLy8gICAgICAgb3V0cHV0W25hbWVdW2tleV0gPSBpbnB1dFtuYW1lXVtrZXldO1xuICAgICAgICAvLyAgICAgfVxuICAgICAgICAvLyAgIC8vIGNvbnNpZGVyIGV2ZXJ5dGhpbmcgZWxzZSBhcyBhIHNjYWxhclxuICAgICAgICAvLyAgIH0gZWxzZSB7XG4gICAgICAgIC8vICAgICBvdXRwdXRbbmFtZV0gPSBpbnB1dFtuYW1lXTtcbiAgICAgICAgLy8gICB9XG4gICAgICAgIC8vIH1cbiAgICAgIH1cblxuICAgICAgc3VwZXIucHJvcGFnYXRlKHRoaXMub3V0cHV0RnJhbWUpO1xuXG4gICAgICAvLyByZXNldCBzdGFjayBmb3IgbmV4dCBjYWxsXG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuaW5wdXRJZHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgdGhpcy5zdGFja1tpXSA9IHVuZGVmaW5lZDtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgTWVyZ2U7XG4iXX0=