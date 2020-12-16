"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _default = {
  audioFiles: {
    type: 'any',
    default: []
  },
  metas: {
    type: 'any',
    default: {} // { name, title, version,  }

  },
  sessionsOverview: {
    type: 'any',
    default: []
  },
  streamsRouting: {
    type: 'any',
    default: []
  },
  // @note - defaults presets are populated in `Projet.constructor
  graphPresets: {
    type: 'any',
    default: []
  },
  learningPresets: {
    type: 'any',
    default: {}
  } // to be implemented
  // preloadAudioFiles: {
  //   type: 'any',
  //   default: [],
  // },

};
exports.default = _default;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9zZXJ2ZXIvc2NoZW1hcy9wcm9qZWN0LmpzIl0sIm5hbWVzIjpbImF1ZGlvRmlsZXMiLCJ0eXBlIiwiZGVmYXVsdCIsIm1ldGFzIiwic2Vzc2lvbnNPdmVydmlldyIsInN0cmVhbXNSb3V0aW5nIiwiZ3JhcGhQcmVzZXRzIiwibGVhcm5pbmdQcmVzZXRzIl0sIm1hcHBpbmdzIjoiOzs7Ozs7ZUFBZTtBQUNiQSxFQUFBQSxVQUFVLEVBQUU7QUFDVkMsSUFBQUEsSUFBSSxFQUFFLEtBREk7QUFFVkMsSUFBQUEsT0FBTyxFQUFFO0FBRkMsR0FEQztBQUtiQyxFQUFBQSxLQUFLLEVBQUU7QUFDTEYsSUFBQUEsSUFBSSxFQUFFLEtBREQ7QUFFTEMsSUFBQUEsT0FBTyxFQUFFLEVBRkosQ0FFUTs7QUFGUixHQUxNO0FBU2JFLEVBQUFBLGdCQUFnQixFQUFFO0FBQ2hCSCxJQUFBQSxJQUFJLEVBQUUsS0FEVTtBQUVoQkMsSUFBQUEsT0FBTyxFQUFFO0FBRk8sR0FUTDtBQWFiRyxFQUFBQSxjQUFjLEVBQUU7QUFDZEosSUFBQUEsSUFBSSxFQUFFLEtBRFE7QUFFZEMsSUFBQUEsT0FBTyxFQUFFO0FBRkssR0FiSDtBQWtCWjtBQUNESSxFQUFBQSxZQUFZLEVBQUU7QUFDWkwsSUFBQUEsSUFBSSxFQUFFLEtBRE07QUFFWkMsSUFBQUEsT0FBTyxFQUFFO0FBRkcsR0FuQkQ7QUF1QmJLLEVBQUFBLGVBQWUsRUFBRTtBQUNmTixJQUFBQSxJQUFJLEVBQUUsS0FEUztBQUVmQyxJQUFBQSxPQUFPLEVBQUU7QUFGTSxHQXZCSixDQTZCYjtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQWpDYSxDIiwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGRlZmF1bHQge1xuICBhdWRpb0ZpbGVzOiB7XG4gICAgdHlwZTogJ2FueScsXG4gICAgZGVmYXVsdDogW10sXG4gIH0sXG4gIG1ldGFzOiB7XG4gICAgdHlwZTogJ2FueScsXG4gICAgZGVmYXVsdDoge30sIC8vIHsgbmFtZSwgdGl0bGUsIHZlcnNpb24sICB9XG4gIH0sXG4gIHNlc3Npb25zT3ZlcnZpZXc6IHtcbiAgICB0eXBlOiAnYW55JyxcbiAgICBkZWZhdWx0OiBbXSxcbiAgfSxcbiAgc3RyZWFtc1JvdXRpbmc6IHtcbiAgICB0eXBlOiAnYW55JyxcbiAgICBkZWZhdWx0OiBbXSxcbiAgfSxcblxuICAgLy8gQG5vdGUgLSBkZWZhdWx0cyBwcmVzZXRzIGFyZSBwb3B1bGF0ZWQgaW4gYFByb2pldC5jb25zdHJ1Y3RvclxuICBncmFwaFByZXNldHM6IHtcbiAgICB0eXBlOiAnYW55JyxcbiAgICBkZWZhdWx0OiBbXSxcbiAgfSxcbiAgbGVhcm5pbmdQcmVzZXRzOiB7XG4gICAgdHlwZTogJ2FueScsXG4gICAgZGVmYXVsdDoge30sXG4gIH0sXG5cblxuICAvLyB0byBiZSBpbXBsZW1lbnRlZFxuICAvLyBwcmVsb2FkQXVkaW9GaWxlczoge1xuICAvLyAgIHR5cGU6ICdhbnknLFxuICAvLyAgIGRlZmF1bHQ6IFtdLFxuICAvLyB9LFxufVxuIl19