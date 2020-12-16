"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _BaseModule = _interopRequireDefault(require("./BaseModule"));

var _helpers = require("./helpers");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// states: idle, armed, recording, pending, confirm, cancel
class ExampleRecorder extends _BaseModule.default {
  constructor(graph, type, id, options) {
    super(graph, type, id, options);
    this.currentState = null;
    this.record = false;
    this.example = null;
    this.unsubscribe = null;

    if (this.graph.player) {
      this.unsubscribe = this.graph.player.subscribe(updates => {
        if ('recordingState' in updates) {
          const state = updates['recordingState'];
          this.setState(state);
        }
      }); // @note - we need a recording target too...

      const recordingState = this.graph.player.get('recordingState');
      this.setState(recordingState);
    }
  }

  destroy() {
    if (this.unsubscribe) {
      this.unsubscribe();
    }
  }

  setState(recordingState) {
    if (this.currentState === recordingState) {
      return;
    }

    this.currentState = recordingState;

    switch (recordingState) {
      case 'idle':
        {
          this.record = false;
          this.example = null;
          break;
        }

      case 'armed':
        {
          break;
        }

      case 'recording':
        {
          this.record = true;
          this.example = {
            label: null,
            input: [],
            output: []
          };
          break;
        }

      case 'pending':
        this.record = false;
        break;

      case 'confirm':
        {
          // if input.length === 0, crashes xmm-node
          if (this.example.input.length > 0) {
            this.example.label = this.graph.player.get('label');
            this.graph.session.addExample(this.example);
          }

          this.graph.player.set({
            recordingState: 'idle'
          });
          break;
        }

      case 'cancel':
        {
          this.example = null;
          this.graph.player.set({
            recordingState: 'idle'
          });
          break;
        }
    }
  } // override process and not execute to make sure they is no further node
  // this is a deadend


  process(inputFrame) {
    if (this.record) {
      const inputData = inputFrame.data;
      const copy = {};
      (0, _helpers.copyFrameData)(inputData, copy);
      this.example.input.push(copy);
    }
  }

}

var _default = ExampleRecorder;
exports.default = _default;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9jb21tb24vbW9kdWxlcy9FeGFtcGxlUmVjb3JkZXIuanMiXSwibmFtZXMiOlsiRXhhbXBsZVJlY29yZGVyIiwiQmFzZU1vZHVsZSIsImNvbnN0cnVjdG9yIiwiZ3JhcGgiLCJ0eXBlIiwiaWQiLCJvcHRpb25zIiwiY3VycmVudFN0YXRlIiwicmVjb3JkIiwiZXhhbXBsZSIsInVuc3Vic2NyaWJlIiwicGxheWVyIiwic3Vic2NyaWJlIiwidXBkYXRlcyIsInN0YXRlIiwic2V0U3RhdGUiLCJyZWNvcmRpbmdTdGF0ZSIsImdldCIsImRlc3Ryb3kiLCJsYWJlbCIsImlucHV0Iiwib3V0cHV0IiwibGVuZ3RoIiwic2Vzc2lvbiIsImFkZEV4YW1wbGUiLCJzZXQiLCJwcm9jZXNzIiwiaW5wdXRGcmFtZSIsImlucHV0RGF0YSIsImRhdGEiLCJjb3B5IiwicHVzaCJdLCJtYXBwaW5ncyI6Ijs7Ozs7OztBQUFBOztBQUNBOzs7O0FBRUE7QUFFQSxNQUFNQSxlQUFOLFNBQThCQyxtQkFBOUIsQ0FBeUM7QUFDdkNDLEVBQUFBLFdBQVcsQ0FBQ0MsS0FBRCxFQUFRQyxJQUFSLEVBQWNDLEVBQWQsRUFBa0JDLE9BQWxCLEVBQTJCO0FBQ3BDLFVBQU1ILEtBQU4sRUFBYUMsSUFBYixFQUFtQkMsRUFBbkIsRUFBdUJDLE9BQXZCO0FBRUEsU0FBS0MsWUFBTCxHQUFvQixJQUFwQjtBQUNBLFNBQUtDLE1BQUwsR0FBYyxLQUFkO0FBQ0EsU0FBS0MsT0FBTCxHQUFlLElBQWY7QUFDQSxTQUFLQyxXQUFMLEdBQW1CLElBQW5COztBQUVBLFFBQUksS0FBS1AsS0FBTCxDQUFXUSxNQUFmLEVBQXVCO0FBQ3JCLFdBQUtELFdBQUwsR0FBbUIsS0FBS1AsS0FBTCxDQUFXUSxNQUFYLENBQWtCQyxTQUFsQixDQUE0QkMsT0FBTyxJQUFJO0FBQ3hELFlBQUksb0JBQW9CQSxPQUF4QixFQUFpQztBQUMvQixnQkFBTUMsS0FBSyxHQUFHRCxPQUFPLENBQUMsZ0JBQUQsQ0FBckI7QUFDQSxlQUFLRSxRQUFMLENBQWNELEtBQWQ7QUFDRDtBQUNGLE9BTGtCLENBQW5CLENBRHFCLENBUXJCOztBQUNBLFlBQU1FLGNBQWMsR0FBRyxLQUFLYixLQUFMLENBQVdRLE1BQVgsQ0FBa0JNLEdBQWxCLENBQXNCLGdCQUF0QixDQUF2QjtBQUNBLFdBQUtGLFFBQUwsQ0FBY0MsY0FBZDtBQUNEO0FBQ0Y7O0FBRURFLEVBQUFBLE9BQU8sR0FBRztBQUNSLFFBQUksS0FBS1IsV0FBVCxFQUFzQjtBQUNwQixXQUFLQSxXQUFMO0FBQ0Q7QUFDRjs7QUFFREssRUFBQUEsUUFBUSxDQUFDQyxjQUFELEVBQWlCO0FBQ3ZCLFFBQUksS0FBS1QsWUFBTCxLQUFzQlMsY0FBMUIsRUFBMEM7QUFDeEM7QUFDRDs7QUFFRCxTQUFLVCxZQUFMLEdBQW9CUyxjQUFwQjs7QUFFQSxZQUFRQSxjQUFSO0FBQ0UsV0FBSyxNQUFMO0FBQWE7QUFDWCxlQUFLUixNQUFMLEdBQWMsS0FBZDtBQUNBLGVBQUtDLE9BQUwsR0FBZSxJQUFmO0FBQ0E7QUFDRDs7QUFDRCxXQUFLLE9BQUw7QUFBYztBQUNaO0FBQ0Q7O0FBQ0QsV0FBSyxXQUFMO0FBQWtCO0FBQ2hCLGVBQUtELE1BQUwsR0FBYyxJQUFkO0FBQ0EsZUFBS0MsT0FBTCxHQUFlO0FBQ2JVLFlBQUFBLEtBQUssRUFBRSxJQURNO0FBRWJDLFlBQUFBLEtBQUssRUFBRSxFQUZNO0FBR2JDLFlBQUFBLE1BQU0sRUFBRTtBQUhLLFdBQWY7QUFNQTtBQUNEOztBQUNELFdBQUssU0FBTDtBQUNFLGFBQUtiLE1BQUwsR0FBYyxLQUFkO0FBQ0E7O0FBQ0YsV0FBSyxTQUFMO0FBQWdCO0FBQ2Q7QUFDQSxjQUFJLEtBQUtDLE9BQUwsQ0FBYVcsS0FBYixDQUFtQkUsTUFBbkIsR0FBNEIsQ0FBaEMsRUFBbUM7QUFDakMsaUJBQUtiLE9BQUwsQ0FBYVUsS0FBYixHQUFxQixLQUFLaEIsS0FBTCxDQUFXUSxNQUFYLENBQWtCTSxHQUFsQixDQUFzQixPQUF0QixDQUFyQjtBQUNBLGlCQUFLZCxLQUFMLENBQVdvQixPQUFYLENBQW1CQyxVQUFuQixDQUE4QixLQUFLZixPQUFuQztBQUNEOztBQUVELGVBQUtOLEtBQUwsQ0FBV1EsTUFBWCxDQUFrQmMsR0FBbEIsQ0FBc0I7QUFBRVQsWUFBQUEsY0FBYyxFQUFFO0FBQWxCLFdBQXRCO0FBQ0E7QUFDRDs7QUFDRCxXQUFLLFFBQUw7QUFBZTtBQUNiLGVBQUtQLE9BQUwsR0FBZSxJQUFmO0FBQ0EsZUFBS04sS0FBTCxDQUFXUSxNQUFYLENBQWtCYyxHQUFsQixDQUFzQjtBQUFFVCxZQUFBQSxjQUFjLEVBQUU7QUFBbEIsV0FBdEI7QUFDQTtBQUNEO0FBcENIO0FBc0NELEdBMUVzQyxDQTRFdkM7QUFDQTs7O0FBQ0FVLEVBQUFBLE9BQU8sQ0FBQ0MsVUFBRCxFQUFhO0FBQ2xCLFFBQUksS0FBS25CLE1BQVQsRUFBaUI7QUFDZixZQUFNb0IsU0FBUyxHQUFHRCxVQUFVLENBQUNFLElBQTdCO0FBQ0EsWUFBTUMsSUFBSSxHQUFHLEVBQWI7QUFFQSxrQ0FBY0YsU0FBZCxFQUF5QkUsSUFBekI7QUFFQSxXQUFLckIsT0FBTCxDQUFhVyxLQUFiLENBQW1CVyxJQUFuQixDQUF3QkQsSUFBeEI7QUFDRDtBQUNGOztBQXZGc0M7O2VBMEYxQjlCLGUiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgQmFzZU1vZHVsZSBmcm9tICcuL0Jhc2VNb2R1bGUnO1xuaW1wb3J0IHsgY29weUZyYW1lRGF0YSB9IGZyb20gJy4vaGVscGVycyc7XG5cbi8vIHN0YXRlczogaWRsZSwgYXJtZWQsIHJlY29yZGluZywgcGVuZGluZywgY29uZmlybSwgY2FuY2VsXG5cbmNsYXNzIEV4YW1wbGVSZWNvcmRlciBleHRlbmRzIEJhc2VNb2R1bGUge1xuICBjb25zdHJ1Y3RvcihncmFwaCwgdHlwZSwgaWQsIG9wdGlvbnMpIHtcbiAgICBzdXBlcihncmFwaCwgdHlwZSwgaWQsIG9wdGlvbnMpO1xuXG4gICAgdGhpcy5jdXJyZW50U3RhdGUgPSBudWxsO1xuICAgIHRoaXMucmVjb3JkID0gZmFsc2U7XG4gICAgdGhpcy5leGFtcGxlID0gbnVsbDtcbiAgICB0aGlzLnVuc3Vic2NyaWJlID0gbnVsbDtcblxuICAgIGlmICh0aGlzLmdyYXBoLnBsYXllcikge1xuICAgICAgdGhpcy51bnN1YnNjcmliZSA9IHRoaXMuZ3JhcGgucGxheWVyLnN1YnNjcmliZSh1cGRhdGVzID0+IHtcbiAgICAgICAgaWYgKCdyZWNvcmRpbmdTdGF0ZScgaW4gdXBkYXRlcykge1xuICAgICAgICAgIGNvbnN0IHN0YXRlID0gdXBkYXRlc1sncmVjb3JkaW5nU3RhdGUnXTtcbiAgICAgICAgICB0aGlzLnNldFN0YXRlKHN0YXRlKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG5cbiAgICAgIC8vIEBub3RlIC0gd2UgbmVlZCBhIHJlY29yZGluZyB0YXJnZXQgdG9vLi4uXG4gICAgICBjb25zdCByZWNvcmRpbmdTdGF0ZSA9IHRoaXMuZ3JhcGgucGxheWVyLmdldCgncmVjb3JkaW5nU3RhdGUnKTtcbiAgICAgIHRoaXMuc2V0U3RhdGUocmVjb3JkaW5nU3RhdGUpO1xuICAgIH1cbiAgfVxuXG4gIGRlc3Ryb3koKSB7XG4gICAgaWYgKHRoaXMudW5zdWJzY3JpYmUpIHtcbiAgICAgIHRoaXMudW5zdWJzY3JpYmUoKTtcbiAgICB9XG4gIH1cblxuICBzZXRTdGF0ZShyZWNvcmRpbmdTdGF0ZSkge1xuICAgIGlmICh0aGlzLmN1cnJlbnRTdGF0ZSA9PT0gcmVjb3JkaW5nU3RhdGUpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB0aGlzLmN1cnJlbnRTdGF0ZSA9IHJlY29yZGluZ1N0YXRlO1xuXG4gICAgc3dpdGNoIChyZWNvcmRpbmdTdGF0ZSkge1xuICAgICAgY2FzZSAnaWRsZSc6IHtcbiAgICAgICAgdGhpcy5yZWNvcmQgPSBmYWxzZTtcbiAgICAgICAgdGhpcy5leGFtcGxlID0gbnVsbDtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICBjYXNlICdhcm1lZCc6IHtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICBjYXNlICdyZWNvcmRpbmcnOiB7XG4gICAgICAgIHRoaXMucmVjb3JkID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5leGFtcGxlID0ge1xuICAgICAgICAgIGxhYmVsOiBudWxsLFxuICAgICAgICAgIGlucHV0OiBbXSxcbiAgICAgICAgICBvdXRwdXQ6IFtdLFxuICAgICAgICB9O1xuXG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgY2FzZSAncGVuZGluZyc6XG4gICAgICAgIHRoaXMucmVjb3JkID0gZmFsc2U7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAnY29uZmlybSc6IHtcbiAgICAgICAgLy8gaWYgaW5wdXQubGVuZ3RoID09PSAwLCBjcmFzaGVzIHhtbS1ub2RlXG4gICAgICAgIGlmICh0aGlzLmV4YW1wbGUuaW5wdXQubGVuZ3RoID4gMCkge1xuICAgICAgICAgIHRoaXMuZXhhbXBsZS5sYWJlbCA9IHRoaXMuZ3JhcGgucGxheWVyLmdldCgnbGFiZWwnKTtcbiAgICAgICAgICB0aGlzLmdyYXBoLnNlc3Npb24uYWRkRXhhbXBsZSh0aGlzLmV4YW1wbGUpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5ncmFwaC5wbGF5ZXIuc2V0KHsgcmVjb3JkaW5nU3RhdGU6ICdpZGxlJyB9KTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICBjYXNlICdjYW5jZWwnOiB7XG4gICAgICAgIHRoaXMuZXhhbXBsZSA9IG51bGw7XG4gICAgICAgIHRoaXMuZ3JhcGgucGxheWVyLnNldCh7IHJlY29yZGluZ1N0YXRlOiAnaWRsZScgfSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8vIG92ZXJyaWRlIHByb2Nlc3MgYW5kIG5vdCBleGVjdXRlIHRvIG1ha2Ugc3VyZSB0aGV5IGlzIG5vIGZ1cnRoZXIgbm9kZVxuICAvLyB0aGlzIGlzIGEgZGVhZGVuZFxuICBwcm9jZXNzKGlucHV0RnJhbWUpIHtcbiAgICBpZiAodGhpcy5yZWNvcmQpIHtcbiAgICAgIGNvbnN0IGlucHV0RGF0YSA9IGlucHV0RnJhbWUuZGF0YTtcbiAgICAgIGNvbnN0IGNvcHkgPSB7fTtcblxuICAgICAgY29weUZyYW1lRGF0YShpbnB1dERhdGEsIGNvcHkpO1xuXG4gICAgICB0aGlzLmV4YW1wbGUuaW5wdXQucHVzaChjb3B5KTtcbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgRXhhbXBsZVJlY29yZGVyO1xuIl19