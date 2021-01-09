"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

// using Welford’s method, eg  https://jonisalonen.com/2013/deriving-welfords-method-for-computing-variance/
// std computed with 1 dof (divided by N-1)
class MovingMeanStd {
  constructor(order = 5, initValue = 0) {
    this.order = order;
    this.stack = [];
    this.index = 0; // fill stack with zeros

    for (let i = 0; i < this.order; i++) {
      this.stack[i] = initValue;
    }
  }

  process(value) {
    if (this.order < 2) {
      return 0;
    }

    this.stack[this.index] = value;
    this.index = (this.index + 1) % this.order;
    let mean = 0; // mean

    let v = 0; // variance * (N-1)

    let oldMean = 0;

    for (let i = 0; i < this.order; i++) {
      let x = this.stack[i];
      oldMean = mean;
      mean = oldMean + (x - oldMean) / (i + 1);
      v = v + (x - mean) * (x - oldMean);
    }

    const std = Math.pow(v / (this.order - 1), 0.5);
    return [mean, std];
  }

}

var _default = MovingMeanStd;
exports.default = _default;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9jb21tb24vaGVscGVycy9hbGdvL01vdmluZ01lYW5TdGQuanMiXSwibmFtZXMiOlsiTW92aW5nTWVhblN0ZCIsImNvbnN0cnVjdG9yIiwib3JkZXIiLCJpbml0VmFsdWUiLCJzdGFjayIsImluZGV4IiwiaSIsInByb2Nlc3MiLCJ2YWx1ZSIsIm1lYW4iLCJ2Iiwib2xkTWVhbiIsIngiLCJzdGQiLCJNYXRoIiwicG93Il0sIm1hcHBpbmdzIjoiOzs7Ozs7O0FBQUE7QUFDQTtBQUNBLE1BQU1BLGFBQU4sQ0FBb0I7QUFDbEJDLEVBQUFBLFdBQVcsQ0FBQ0MsS0FBSyxHQUFHLENBQVQsRUFBWUMsU0FBUyxHQUFHLENBQXhCLEVBQTJCO0FBQ3BDLFNBQUtELEtBQUwsR0FBYUEsS0FBYjtBQUNBLFNBQUtFLEtBQUwsR0FBYSxFQUFiO0FBQ0EsU0FBS0MsS0FBTCxHQUFhLENBQWIsQ0FIb0MsQ0FLcEM7O0FBQ0EsU0FBSyxJQUFJQyxDQUFDLEdBQUcsQ0FBYixFQUFnQkEsQ0FBQyxHQUFHLEtBQUtKLEtBQXpCLEVBQWdDSSxDQUFDLEVBQWpDLEVBQXFDO0FBQ25DLFdBQUtGLEtBQUwsQ0FBV0UsQ0FBWCxJQUFnQkgsU0FBaEI7QUFDRDtBQUNGOztBQUVESSxFQUFBQSxPQUFPLENBQUNDLEtBQUQsRUFBUTtBQUNiLFFBQUksS0FBS04sS0FBTCxHQUFhLENBQWpCLEVBQW1CO0FBQ2pCLGFBQU8sQ0FBUDtBQUNEOztBQUVELFNBQUtFLEtBQUwsQ0FBVyxLQUFLQyxLQUFoQixJQUF5QkcsS0FBekI7QUFDQSxTQUFLSCxLQUFMLEdBQWEsQ0FBQyxLQUFLQSxLQUFMLEdBQWEsQ0FBZCxJQUFtQixLQUFLSCxLQUFyQztBQUVBLFFBQUlPLElBQUksR0FBRyxDQUFYLENBUmEsQ0FRQzs7QUFDZCxRQUFJQyxDQUFDLEdBQUcsQ0FBUixDQVRhLENBU0Y7O0FBQ1gsUUFBSUMsT0FBTyxHQUFHLENBQWQ7O0FBRUEsU0FBSyxJQUFJTCxDQUFDLEdBQUcsQ0FBYixFQUFnQkEsQ0FBQyxHQUFHLEtBQUtKLEtBQXpCLEVBQWdDSSxDQUFDLEVBQWpDLEVBQXFDO0FBQ25DLFVBQUlNLENBQUMsR0FBRyxLQUFLUixLQUFMLENBQVdFLENBQVgsQ0FBUjtBQUVBSyxNQUFBQSxPQUFPLEdBQUdGLElBQVY7QUFDQUEsTUFBQUEsSUFBSSxHQUFHRSxPQUFPLEdBQUcsQ0FBQ0MsQ0FBQyxHQUFDRCxPQUFILEtBQWFMLENBQUMsR0FBRyxDQUFqQixDQUFqQjtBQUNBSSxNQUFBQSxDQUFDLEdBQUdBLENBQUMsR0FBRyxDQUFDRSxDQUFDLEdBQUNILElBQUgsS0FBVUcsQ0FBQyxHQUFDRCxPQUFaLENBQVI7QUFDRDs7QUFDRCxVQUFNRSxHQUFHLEdBQUdDLElBQUksQ0FBQ0MsR0FBTCxDQUFTTCxDQUFDLElBQUUsS0FBS1IsS0FBTCxHQUFXLENBQWIsQ0FBVixFQUEyQixHQUEzQixDQUFaO0FBRUEsV0FBTyxDQUFDTyxJQUFELEVBQU9JLEdBQVAsQ0FBUDtBQUNEOztBQWxDaUI7O2VBcUNMYixhIiwic291cmNlc0NvbnRlbnQiOlsiLy8gdXNpbmcgV2VsZm9yZOKAmXMgbWV0aG9kLCBlZyAgaHR0cHM6Ly9qb25pc2Fsb25lbi5jb20vMjAxMy9kZXJpdmluZy13ZWxmb3Jkcy1tZXRob2QtZm9yLWNvbXB1dGluZy12YXJpYW5jZS9cbi8vIHN0ZCBjb21wdXRlZCB3aXRoIDEgZG9mIChkaXZpZGVkIGJ5IE4tMSlcbmNsYXNzIE1vdmluZ01lYW5TdGQge1xuICBjb25zdHJ1Y3RvcihvcmRlciA9IDUsIGluaXRWYWx1ZSA9IDApIHtcbiAgICB0aGlzLm9yZGVyID0gb3JkZXI7XG4gICAgdGhpcy5zdGFjayA9IFtdO1xuICAgIHRoaXMuaW5kZXggPSAwO1xuXG4gICAgLy8gZmlsbCBzdGFjayB3aXRoIHplcm9zXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLm9yZGVyOyBpKyspIHtcbiAgICAgIHRoaXMuc3RhY2tbaV0gPSBpbml0VmFsdWU7XG4gICAgfVxuICB9XG5cbiAgcHJvY2Vzcyh2YWx1ZSkge1xuICAgIGlmICh0aGlzLm9yZGVyIDwgMil7XG4gICAgICByZXR1cm4gMDtcbiAgICB9XG5cbiAgICB0aGlzLnN0YWNrW3RoaXMuaW5kZXhdID0gdmFsdWU7XG4gICAgdGhpcy5pbmRleCA9ICh0aGlzLmluZGV4ICsgMSkgJSB0aGlzLm9yZGVyO1xuIFxuICAgIGxldCBtZWFuID0gMDsgLy8gbWVhblxuICAgIGxldCB2ID0gMDsgLy8gdmFyaWFuY2UgKiAoTi0xKVxuICAgIGxldCBvbGRNZWFuID0gMDtcblxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5vcmRlcjsgaSsrKSB7XG4gICAgICBsZXQgeCA9IHRoaXMuc3RhY2tbaV07XG5cbiAgICAgIG9sZE1lYW4gPSBtZWFuO1xuICAgICAgbWVhbiA9IG9sZE1lYW4gKyAoeC1vbGRNZWFuKS8oaSArIDEpO1xuICAgICAgdiA9IHYgKyAoeC1tZWFuKSooeC1vbGRNZWFuKTtcbiAgICB9ICBcbiAgICBjb25zdCBzdGQgPSBNYXRoLnBvdyh2Lyh0aGlzLm9yZGVyLTEpLCAwLjUpO1xuXG4gICAgcmV0dXJuIFttZWFuLCBzdGRdXG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgTW92aW5nTWVhblN0ZDtcbiJdfQ==