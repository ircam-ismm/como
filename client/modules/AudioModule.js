"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _BaseModule = _interopRequireDefault(require("../../common/modules/BaseModule.js"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

class AudioModule extends _BaseModule.default {
  constructor(graph, type, id, options) {
    // @todo - bypass is only a ScriptModule problem, should not be there...
    options = Object.assign({
      bypass: false
    }, options);
    super(graph, type, id, options);
    this.audioContext = graph.como.audioContext; //                            (0|1)
    //               /----------o bypass ----------- \
    //              /                                 \
    //             /                                   o
    // audioInNode -o thruIn -o [process] -o thruOut -o audioOutNode
    //                (1|0)                  (1|0)
    //
    // we wan't both pass-through in, to fill [process] with zeros and hopefully save
    // some computations, and pass-through out, to allow bypassing synths.

    this.audioOutNode = this.audioContext.createGain();
    this.audioInNode = this.audioContext.createGain();
    this.passThroughInNode = this.audioContext.createGain();
    this.passThroughOutNode = this.audioContext.createGain();
    this.bypassNode = this.audioContext.createGain(); // avoid clics when dynamically creating nodes

    this.passThroughInNode.gain.value = 0;
    this.passThroughOutNode.gain.value = 0;
    this.bypassNode.gain.value = 0; // connect everybody

    this.audioInNode.connect(this.passThroughInNode);
    this.audioInNode.connect(this.bypassNode);
    this.passThroughOutNode.connect(this.audioOutNode);
    this.bypassNode.connect(this.audioOutNode);
    this._bypass = this.options.bypass;

    this._updateAudioRouting();
  }

  connect(dest) {
    if (!(dest instanceof AudioModule)) {
      throw new Error(`can't connect "${this.id}" to "${dest.id}, destination is not of type AudioModule`);
    }

    this.audioOutNode.connect(dest.audioInNode);
  }

  disconnect(dest = null) {
    if (dest !== null) {
      if (!(dest instanceof AudioModule)) {
        throw new Error(`can't fromconnect "${this.id}" from "${dest.id}, destination is not of type AudioModule`);
      }

      this.audioOutNode.disconnect(dest.audioInNode);
    } else {
      this.audioOutNode.disconnect();
    }
  }

  updateOptions(options) {
    super.updateOptions(options);

    if (this.options.bypass !== this._bypass) {
      this._bypass = this.options.bypass;

      this._updateAudioRouting();
    }
  }

  _updateAudioRouting() {
    const timeConstant = 0.005;
    const now = this.graph.como.audioContext.currentTime;
    const passThroughGain = this._bypass ? 0 : 1;
    const bypassGain = this._bypass ? 1 : 0;
    this.passThroughInNode.gain.cancelScheduledValues(now);
    this.passThroughInNode.gain.setTargetAtTime(passThroughGain, now, timeConstant);
    this.passThroughOutNode.gain.cancelScheduledValues(now);
    this.passThroughOutNode.gain.setTargetAtTime(passThroughGain, now, timeConstant);
    this.bypassNode.gain.cancelScheduledValues(now);
    this.bypassNode.gain.setTargetAtTime(bypassGain, now, timeConstant);
  }

}

var _default = AudioModule;
exports.default = _default;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9jbGllbnQvbW9kdWxlcy9BdWRpb01vZHVsZS5qcyJdLCJuYW1lcyI6WyJBdWRpb01vZHVsZSIsIkJhc2VNb2R1bGUiLCJjb25zdHJ1Y3RvciIsImdyYXBoIiwidHlwZSIsImlkIiwib3B0aW9ucyIsIk9iamVjdCIsImFzc2lnbiIsImJ5cGFzcyIsImF1ZGlvQ29udGV4dCIsImNvbW8iLCJhdWRpb091dE5vZGUiLCJjcmVhdGVHYWluIiwiYXVkaW9Jbk5vZGUiLCJwYXNzVGhyb3VnaEluTm9kZSIsInBhc3NUaHJvdWdoT3V0Tm9kZSIsImJ5cGFzc05vZGUiLCJnYWluIiwidmFsdWUiLCJjb25uZWN0IiwiX2J5cGFzcyIsIl91cGRhdGVBdWRpb1JvdXRpbmciLCJkZXN0IiwiRXJyb3IiLCJkaXNjb25uZWN0IiwidXBkYXRlT3B0aW9ucyIsInRpbWVDb25zdGFudCIsIm5vdyIsImN1cnJlbnRUaW1lIiwicGFzc1Rocm91Z2hHYWluIiwiYnlwYXNzR2FpbiIsImNhbmNlbFNjaGVkdWxlZFZhbHVlcyIsInNldFRhcmdldEF0VGltZSJdLCJtYXBwaW5ncyI6Ijs7Ozs7OztBQUFBOzs7O0FBRUEsTUFBTUEsV0FBTixTQUEwQkMsbUJBQTFCLENBQXFDO0FBQ25DQyxFQUFBQSxXQUFXLENBQUNDLEtBQUQsRUFBUUMsSUFBUixFQUFjQyxFQUFkLEVBQWtCQyxPQUFsQixFQUEyQjtBQUNwQztBQUNBQSxJQUFBQSxPQUFPLEdBQUdDLE1BQU0sQ0FBQ0MsTUFBUCxDQUFjO0FBQUVDLE1BQUFBLE1BQU0sRUFBRTtBQUFWLEtBQWQsRUFBaUNILE9BQWpDLENBQVY7QUFDQSxVQUFNSCxLQUFOLEVBQWFDLElBQWIsRUFBbUJDLEVBQW5CLEVBQXVCQyxPQUF2QjtBQUVBLFNBQUtJLFlBQUwsR0FBb0JQLEtBQUssQ0FBQ1EsSUFBTixDQUFXRCxZQUEvQixDQUxvQyxDQU9wQztBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBQ0EsU0FB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QUE3RCxFQUFrRUQsWUFBbEU7QUFFQSxTQUFLWCxrQkFBTCxDQUF3QkUsSUFBeEIsQ0FBNkJjLHFCQUE3QixDQUFtREosR0FBbkQ7QUFDQSxTQUFLWixrQkFBTCxDQUF3QkUsSUFBeEIsQ0FBNkJlLGVBQTdCLENBQTZDSCxlQUE3QyxFQUE4REYsR0FBOUQsRUFBbUVELFlBQW5FO0FBRUEsU0FBS1YsVUFBTCxDQUFnQkMsSUFBaEIsQ0FBcUJjLHFCQUFyQixDQUEyQ0osR0FBM0M7QUFDQSxTQUFLWCxVQUFMLENBQWdCQyxJQUFoQixDQUFxQmUsZUFBckIsQ0FBcUNGLFVBQXJDLEVBQWlESCxHQUFqRCxFQUFzREQsWUFBdEQ7QUFDRDs7QUFqRmtDOztlQW9GdEIzQixXIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IEJhc2VNb2R1bGUgZnJvbSAnLi4vLi4vY29tbW9uL21vZHVsZXMvQmFzZU1vZHVsZS5qcyc7XG5cbmNsYXNzIEF1ZGlvTW9kdWxlIGV4dGVuZHMgQmFzZU1vZHVsZSB7XG4gIGNvbnN0cnVjdG9yKGdyYXBoLCB0eXBlLCBpZCwgb3B0aW9ucykge1xuICAgIC8vIEB0b2RvIC0gYnlwYXNzIGlzIG9ubHkgYSBTY3JpcHRNb2R1bGUgcHJvYmxlbSwgc2hvdWxkIG5vdCBiZSB0aGVyZS4uLlxuICAgIG9wdGlvbnMgPSBPYmplY3QuYXNzaWduKHsgYnlwYXNzOiBmYWxzZSB9LCBvcHRpb25zKTtcbiAgICBzdXBlcihncmFwaCwgdHlwZSwgaWQsIG9wdGlvbnMpO1xuXG4gICAgdGhpcy5hdWRpb0NvbnRleHQgPSBncmFwaC5jb21vLmF1ZGlvQ29udGV4dDtcblxuICAgIC8vICAgICAgICAgICAgICAgICAgICAgICAgICAgICgwfDEpXG4gICAgLy8gICAgICAgICAgICAgICAvLS0tLS0tLS0tLW8gYnlwYXNzIC0tLS0tLS0tLS0tIFxcXG4gICAgLy8gICAgICAgICAgICAgIC8gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcXFxuICAgIC8vICAgICAgICAgICAgIC8gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9cbiAgICAvLyBhdWRpb0luTm9kZSAtbyB0aHJ1SW4gLW8gW3Byb2Nlc3NdIC1vIHRocnVPdXQgLW8gYXVkaW9PdXROb2RlXG4gICAgLy8gICAgICAgICAgICAgICAgKDF8MCkgICAgICAgICAgICAgICAgICAoMXwwKVxuICAgIC8vXG4gICAgLy8gd2Ugd2FuJ3QgYm90aCBwYXNzLXRocm91Z2ggaW4sIHRvIGZpbGwgW3Byb2Nlc3NdIHdpdGggemVyb3MgYW5kIGhvcGVmdWxseSBzYXZlXG4gICAgLy8gc29tZSBjb21wdXRhdGlvbnMsIGFuZCBwYXNzLXRocm91Z2ggb3V0LCB0byBhbGxvdyBieXBhc3Npbmcgc3ludGhzLlxuICAgIHRoaXMuYXVkaW9PdXROb2RlID0gdGhpcy5hdWRpb0NvbnRleHQuY3JlYXRlR2FpbigpO1xuICAgIHRoaXMuYXVkaW9Jbk5vZGUgPSB0aGlzLmF1ZGlvQ29udGV4dC5jcmVhdGVHYWluKCk7XG4gICAgdGhpcy5wYXNzVGhyb3VnaEluTm9kZSA9IHRoaXMuYXVkaW9Db250ZXh0LmNyZWF0ZUdhaW4oKTtcbiAgICB0aGlzLnBhc3NUaHJvdWdoT3V0Tm9kZSA9IHRoaXMuYXVkaW9Db250ZXh0LmNyZWF0ZUdhaW4oKTtcbiAgICB0aGlzLmJ5cGFzc05vZGUgPSB0aGlzLmF1ZGlvQ29udGV4dC5jcmVhdGVHYWluKCk7XG5cbiAgICAvLyBhdm9pZCBjbGljcyB3aGVuIGR5bmFtaWNhbGx5IGNyZWF0aW5nIG5vZGVzXG4gICAgdGhpcy5wYXNzVGhyb3VnaEluTm9kZS5nYWluLnZhbHVlID0gMDtcbiAgICB0aGlzLnBhc3NUaHJvdWdoT3V0Tm9kZS5nYWluLnZhbHVlID0gMDtcbiAgICB0aGlzLmJ5cGFzc05vZGUuZ2Fpbi52YWx1ZSA9IDA7XG4gICAgLy8gY29ubmVjdCBldmVyeWJvZHlcbiAgICB0aGlzLmF1ZGlvSW5Ob2RlLmNvbm5lY3QodGhpcy5wYXNzVGhyb3VnaEluTm9kZSk7XG4gICAgdGhpcy5hdWRpb0luTm9kZS5jb25uZWN0KHRoaXMuYnlwYXNzTm9kZSk7XG5cbiAgICB0aGlzLnBhc3NUaHJvdWdoT3V0Tm9kZS5jb25uZWN0KHRoaXMuYXVkaW9PdXROb2RlKTtcbiAgICB0aGlzLmJ5cGFzc05vZGUuY29ubmVjdCh0aGlzLmF1ZGlvT3V0Tm9kZSk7XG5cbiAgICB0aGlzLl9ieXBhc3MgPSB0aGlzLm9wdGlvbnMuYnlwYXNzO1xuICAgIHRoaXMuX3VwZGF0ZUF1ZGlvUm91dGluZygpO1xuICB9XG5cbiAgY29ubmVjdChkZXN0KSB7XG4gICAgaWYgKCEoZGVzdCBpbnN0YW5jZW9mIEF1ZGlvTW9kdWxlKSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBjYW4ndCBjb25uZWN0IFwiJHt0aGlzLmlkfVwiIHRvIFwiJHtkZXN0LmlkfSwgZGVzdGluYXRpb24gaXMgbm90IG9mIHR5cGUgQXVkaW9Nb2R1bGVgKTtcbiAgICB9XG5cbiAgICB0aGlzLmF1ZGlvT3V0Tm9kZS5jb25uZWN0KGRlc3QuYXVkaW9Jbk5vZGUpO1xuICB9XG5cbiAgZGlzY29ubmVjdChkZXN0ID0gbnVsbCkge1xuICAgIGlmIChkZXN0ICE9PSBudWxsKSB7XG4gICAgICBpZiAoIShkZXN0IGluc3RhbmNlb2YgQXVkaW9Nb2R1bGUpKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgY2FuJ3QgZnJvbWNvbm5lY3QgXCIke3RoaXMuaWR9XCIgZnJvbSBcIiR7ZGVzdC5pZH0sIGRlc3RpbmF0aW9uIGlzIG5vdCBvZiB0eXBlIEF1ZGlvTW9kdWxlYCk7XG4gICAgICB9XG5cbiAgICAgIHRoaXMuYXVkaW9PdXROb2RlLmRpc2Nvbm5lY3QoZGVzdC5hdWRpb0luTm9kZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuYXVkaW9PdXROb2RlLmRpc2Nvbm5lY3QoKTtcbiAgICB9XG4gIH1cblxuICB1cGRhdGVPcHRpb25zKG9wdGlvbnMpIHtcbiAgICBzdXBlci51cGRhdGVPcHRpb25zKG9wdGlvbnMpO1xuXG4gICAgaWYgKHRoaXMub3B0aW9ucy5ieXBhc3MgIT09IHRoaXMuX2J5cGFzcykge1xuICAgICAgdGhpcy5fYnlwYXNzID0gdGhpcy5vcHRpb25zLmJ5cGFzcztcbiAgICAgIHRoaXMuX3VwZGF0ZUF1ZGlvUm91dGluZygpO1xuICAgIH1cbiAgfVxuXG4gIF91cGRhdGVBdWRpb1JvdXRpbmcoKSB7XG4gICAgY29uc3QgdGltZUNvbnN0YW50ID0gMC4wMDU7XG4gICAgY29uc3Qgbm93ID0gdGhpcy5ncmFwaC5jb21vLmF1ZGlvQ29udGV4dC5jdXJyZW50VGltZTtcbiAgICBjb25zdCBwYXNzVGhyb3VnaEdhaW4gPSB0aGlzLl9ieXBhc3MgPyAwIDogMTtcbiAgICBjb25zdCBieXBhc3NHYWluID0gdGhpcy5fYnlwYXNzID8gMSA6IDA7XG5cbiAgICB0aGlzLnBhc3NUaHJvdWdoSW5Ob2RlLmdhaW4uY2FuY2VsU2NoZWR1bGVkVmFsdWVzKG5vdyk7XG4gICAgdGhpcy5wYXNzVGhyb3VnaEluTm9kZS5nYWluLnNldFRhcmdldEF0VGltZShwYXNzVGhyb3VnaEdhaW4sIG5vdywgdGltZUNvbnN0YW50KTtcblxuICAgIHRoaXMucGFzc1Rocm91Z2hPdXROb2RlLmdhaW4uY2FuY2VsU2NoZWR1bGVkVmFsdWVzKG5vdyk7XG4gICAgdGhpcy5wYXNzVGhyb3VnaE91dE5vZGUuZ2Fpbi5zZXRUYXJnZXRBdFRpbWUocGFzc1Rocm91Z2hHYWluLCBub3csIHRpbWVDb25zdGFudCk7XG5cbiAgICB0aGlzLmJ5cGFzc05vZGUuZ2Fpbi5jYW5jZWxTY2hlZHVsZWRWYWx1ZXMobm93KTtcbiAgICB0aGlzLmJ5cGFzc05vZGUuZ2Fpbi5zZXRUYXJnZXRBdFRpbWUoYnlwYXNzR2Fpbiwgbm93LCB0aW1lQ29uc3RhbnQpO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IEF1ZGlvTW9kdWxlO1xuIl19