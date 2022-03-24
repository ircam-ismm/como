"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _default = {
  name: {
    type: 'string',
    default: ''
  },
  id: {
    type: 'string',
    default: ''
  },
  audioFiles: {
    type: 'any',
    default: []
  },
  labels: {
    type: 'any',
    default: []
  },
  labelAudioFileTable: {
    type: 'any',
    default: []
  },
  graph: {
    type: 'any',
    default: {}
  },
  // these two are not persisted as is, they are mixed in the "graph"
  // @todo - document this behavior, this is hard to understand
  graphOptions: {
    type: 'any',
    default: {}
  },
  graphOptionsEvent: {
    type: 'any',
    default: {},
    event: true
  },
  // this should belong to the "encoder / decoder"
  // this needs to be discussed further... what would be clean
  // architecture / strategy for that, e.g.
  // - we don't want to dispatch the examples everywhere,
  // - how to attach an example to a particular encoder / decoder instance,
  // - same for config, etc.
  //
  // @see also `player` schema
  model: {
    type: 'any',
    default: null,
    nullable: true
  },
  // raw sensors examples
  examples: {
    type: 'any',
    default: {}
  },
  // processed examples
  processedExamples: {
    type: 'any',
    default: {}
  },
  learningConfig: {
    type: 'any',
    // posture default for now...
    default: {
      target: {
        name: 'xmm'
      },
      payload: {
        modelType: 'hhmm',
        gaussians: 1,
        absoluteRegularization: 0.1,
        relativeRegularization: 0.1,
        covarianceMode: 'full',
        hierarchical: true,
        states: 4,
        transitionMode: 'leftright',
        regressionEstimator: 'full',
        likelihoodWindow: 10
      }
    }
  } // ...

};
exports.default = _default;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9zZXJ2ZXIvc2NoZW1hcy9zZXNzaW9uLmpzIl0sIm5hbWVzIjpbIm5hbWUiLCJ0eXBlIiwiZGVmYXVsdCIsImlkIiwiYXVkaW9GaWxlcyIsImxhYmVscyIsImxhYmVsQXVkaW9GaWxlVGFibGUiLCJncmFwaCIsImdyYXBoT3B0aW9ucyIsImdyYXBoT3B0aW9uc0V2ZW50IiwiZXZlbnQiLCJtb2RlbCIsIm51bGxhYmxlIiwiZXhhbXBsZXMiLCJwcm9jZXNzZWRFeGFtcGxlcyIsImxlYXJuaW5nQ29uZmlnIiwidGFyZ2V0IiwicGF5bG9hZCIsIm1vZGVsVHlwZSIsImdhdXNzaWFucyIsImFic29sdXRlUmVndWxhcml6YXRpb24iLCJyZWxhdGl2ZVJlZ3VsYXJpemF0aW9uIiwiY292YXJpYW5jZU1vZGUiLCJoaWVyYXJjaGljYWwiLCJzdGF0ZXMiLCJ0cmFuc2l0aW9uTW9kZSIsInJlZ3Jlc3Npb25Fc3RpbWF0b3IiLCJsaWtlbGlob29kV2luZG93Il0sIm1hcHBpbmdzIjoiOzs7Ozs7ZUFBZTtBQUNiQSxFQUFBQSxJQUFJLEVBQUU7QUFDSkMsSUFBQUEsSUFBSSxFQUFFLFFBREY7QUFFSkMsSUFBQUEsT0FBTyxFQUFFO0FBRkwsR0FETztBQUtiQyxFQUFBQSxFQUFFLEVBQUU7QUFDRkYsSUFBQUEsSUFBSSxFQUFFLFFBREo7QUFFRkMsSUFBQUEsT0FBTyxFQUFFO0FBRlAsR0FMUztBQVNiRSxFQUFBQSxVQUFVLEVBQUU7QUFDVkgsSUFBQUEsSUFBSSxFQUFFLEtBREk7QUFFVkMsSUFBQUEsT0FBTyxFQUFFO0FBRkMsR0FUQztBQWFiRyxFQUFBQSxNQUFNLEVBQUU7QUFDTkosSUFBQUEsSUFBSSxFQUFFLEtBREE7QUFFTkMsSUFBQUEsT0FBTyxFQUFFO0FBRkgsR0FiSztBQWtCYkksRUFBQUEsbUJBQW1CLEVBQUU7QUFDbkJMLElBQUFBLElBQUksRUFBRSxLQURhO0FBRW5CQyxJQUFBQSxPQUFPLEVBQUU7QUFGVSxHQWxCUjtBQXVCYkssRUFBQUEsS0FBSyxFQUFFO0FBQ0xOLElBQUFBLElBQUksRUFBRSxLQUREO0FBRUxDLElBQUFBLE9BQU8sRUFBRTtBQUZKLEdBdkJNO0FBNEJiO0FBQ0E7QUFDQU0sRUFBQUEsWUFBWSxFQUFFO0FBQ1pQLElBQUFBLElBQUksRUFBRSxLQURNO0FBRVpDLElBQUFBLE9BQU8sRUFBRTtBQUZHLEdBOUJEO0FBa0NiTyxFQUFBQSxpQkFBaUIsRUFBRTtBQUNqQlIsSUFBQUEsSUFBSSxFQUFFLEtBRFc7QUFFakJDLElBQUFBLE9BQU8sRUFBRSxFQUZRO0FBR2pCUSxJQUFBQSxLQUFLLEVBQUU7QUFIVSxHQWxDTjtBQXdDYjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0FDLEVBQUFBLEtBQUssRUFBRTtBQUNMVixJQUFBQSxJQUFJLEVBQUUsS0FERDtBQUVMQyxJQUFBQSxPQUFPLEVBQUUsSUFGSjtBQUdMVSxJQUFBQSxRQUFRLEVBQUU7QUFITCxHQWhETTtBQXFEYjtBQUNBQyxFQUFBQSxRQUFRLEVBQUU7QUFDUlosSUFBQUEsSUFBSSxFQUFFLEtBREU7QUFFUkMsSUFBQUEsT0FBTyxFQUFFO0FBRkQsR0F0REc7QUEwRGI7QUFDQVksRUFBQUEsaUJBQWlCLEVBQUU7QUFDakJiLElBQUFBLElBQUksRUFBRSxLQURXO0FBRWpCQyxJQUFBQSxPQUFPLEVBQUU7QUFGUSxHQTNETjtBQWdFYmEsRUFBQUEsY0FBYyxFQUFFO0FBQ2RkLElBQUFBLElBQUksRUFBRSxLQURRO0FBRWQ7QUFDQUMsSUFBQUEsT0FBTyxFQUFFO0FBQ1BjLE1BQUFBLE1BQU0sRUFBRTtBQUNOaEIsUUFBQUEsSUFBSSxFQUFFO0FBREEsT0FERDtBQUlQaUIsTUFBQUEsT0FBTyxFQUFFO0FBQ1BDLFFBQUFBLFNBQVMsRUFBRSxNQURKO0FBRVBDLFFBQUFBLFNBQVMsRUFBRSxDQUZKO0FBR1BDLFFBQUFBLHNCQUFzQixFQUFFLElBSGpCO0FBSVBDLFFBQUFBLHNCQUFzQixFQUFFLElBSmpCO0FBS1BDLFFBQUFBLGNBQWMsRUFBRSxNQUxUO0FBTVBDLFFBQUFBLFlBQVksRUFBRSxJQU5QO0FBT1BDLFFBQUFBLE1BQU0sRUFBRSxDQVBEO0FBUVBDLFFBQUFBLGNBQWMsRUFBRSxXQVJUO0FBU1BDLFFBQUFBLG1CQUFtQixFQUFFLE1BVGQ7QUFVUEMsUUFBQUEsZ0JBQWdCLEVBQUU7QUFWWDtBQUpGO0FBSEssR0FoRUgsQ0FxRmI7O0FBckZhLEMiLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZGVmYXVsdCB7XG4gIG5hbWU6IHtcbiAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICBkZWZhdWx0OiAnJyxcbiAgfSxcbiAgaWQ6IHtcbiAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICBkZWZhdWx0OiAnJyxcbiAgfSxcbiAgYXVkaW9GaWxlczoge1xuICAgIHR5cGU6ICdhbnknLFxuICAgIGRlZmF1bHQ6IFtdLFxuICB9LFxuICBsYWJlbHM6IHtcbiAgICB0eXBlOiAnYW55JyxcbiAgICBkZWZhdWx0OiBbXSxcbiAgfSxcblxuICBsYWJlbEF1ZGlvRmlsZVRhYmxlOiB7XG4gICAgdHlwZTogJ2FueScsXG4gICAgZGVmYXVsdDogW10sXG4gIH0sXG5cbiAgZ3JhcGg6IHtcbiAgICB0eXBlOiAnYW55JyxcbiAgICBkZWZhdWx0OiB7fSxcbiAgfSxcblxuICAvLyB0aGVzZSB0d28gYXJlIG5vdCBwZXJzaXN0ZWQgYXMgaXMsIHRoZXkgYXJlIG1peGVkIGluIHRoZSBcImdyYXBoXCJcbiAgLy8gQHRvZG8gLSBkb2N1bWVudCB0aGlzIGJlaGF2aW9yLCB0aGlzIGlzIGhhcmQgdG8gdW5kZXJzdGFuZFxuICBncmFwaE9wdGlvbnM6IHtcbiAgICB0eXBlOiAnYW55JyxcbiAgICBkZWZhdWx0OiB7fSxcbiAgfSxcbiAgZ3JhcGhPcHRpb25zRXZlbnQ6IHtcbiAgICB0eXBlOiAnYW55JyxcbiAgICBkZWZhdWx0OiB7fSxcbiAgICBldmVudDogdHJ1ZSxcbiAgfSxcblxuICAvLyB0aGlzIHNob3VsZCBiZWxvbmcgdG8gdGhlIFwiZW5jb2RlciAvIGRlY29kZXJcIlxuICAvLyB0aGlzIG5lZWRzIHRvIGJlIGRpc2N1c3NlZCBmdXJ0aGVyLi4uIHdoYXQgd291bGQgYmUgY2xlYW5cbiAgLy8gYXJjaGl0ZWN0dXJlIC8gc3RyYXRlZ3kgZm9yIHRoYXQsIGUuZy5cbiAgLy8gLSB3ZSBkb24ndCB3YW50IHRvIGRpc3BhdGNoIHRoZSBleGFtcGxlcyBldmVyeXdoZXJlLFxuICAvLyAtIGhvdyB0byBhdHRhY2ggYW4gZXhhbXBsZSB0byBhIHBhcnRpY3VsYXIgZW5jb2RlciAvIGRlY29kZXIgaW5zdGFuY2UsXG4gIC8vIC0gc2FtZSBmb3IgY29uZmlnLCBldGMuXG4gIC8vXG4gIC8vIEBzZWUgYWxzbyBgcGxheWVyYCBzY2hlbWFcbiAgbW9kZWw6IHtcbiAgICB0eXBlOiAnYW55JyxcbiAgICBkZWZhdWx0OiBudWxsLFxuICAgIG51bGxhYmxlOiB0cnVlLFxuICB9LFxuICAvLyByYXcgc2Vuc29ycyBleGFtcGxlc1xuICBleGFtcGxlczoge1xuICAgIHR5cGU6ICdhbnknLFxuICAgIGRlZmF1bHQ6IHt9LFxuICB9LFxuICAvLyBwcm9jZXNzZWQgZXhhbXBsZXNcbiAgcHJvY2Vzc2VkRXhhbXBsZXM6IHtcbiAgICB0eXBlOiAnYW55JyxcbiAgICBkZWZhdWx0OiB7fSxcbiAgfSxcblxuICBsZWFybmluZ0NvbmZpZzoge1xuICAgIHR5cGU6ICdhbnknLFxuICAgIC8vIHBvc3R1cmUgZGVmYXVsdCBmb3Igbm93Li4uXG4gICAgZGVmYXVsdDoge1xuICAgICAgdGFyZ2V0OiB7XG4gICAgICAgIG5hbWU6ICd4bW0nLFxuICAgICAgfSxcbiAgICAgIHBheWxvYWQ6IHtcbiAgICAgICAgbW9kZWxUeXBlOiAnaGhtbScsXG4gICAgICAgIGdhdXNzaWFuczogMSxcbiAgICAgICAgYWJzb2x1dGVSZWd1bGFyaXphdGlvbjogMC4wMSxcbiAgICAgICAgcmVsYXRpdmVSZWd1bGFyaXphdGlvbjogMC4wMSxcbiAgICAgICAgY292YXJpYW5jZU1vZGU6ICdmdWxsJyxcbiAgICAgICAgaGllcmFyY2hpY2FsOiB0cnVlLFxuICAgICAgICBzdGF0ZXM6IDQsXG4gICAgICAgIHRyYW5zaXRpb25Nb2RlOiAnbGVmdHJpZ2h0JyxcbiAgICAgICAgcmVncmVzc2lvbkVzdGltYXRvcjogJ2Z1bGwnLFxuICAgICAgICBsaWtlbGlob29kV2luZG93OiAxMCxcbiAgICAgIH0sXG4gICAgfSxcbiAgfSxcbiAgLy8gLi4uXG59O1xuIl19