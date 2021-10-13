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
  },
  // list of all active audio files at server startup, bypass loading between sessions
  // usefull for concert situations (cf. `config/project-*.json` files)
  preloadAudioFiles: {
    type: 'boolean',
    default: false
  }
};
exports.default = _default;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9zZXJ2ZXIvc2NoZW1hcy9wcm9qZWN0LmpzIl0sIm5hbWVzIjpbImF1ZGlvRmlsZXMiLCJ0eXBlIiwiZGVmYXVsdCIsIm1ldGFzIiwic2Vzc2lvbnNPdmVydmlldyIsInN0cmVhbXNSb3V0aW5nIiwiZ3JhcGhQcmVzZXRzIiwibGVhcm5pbmdQcmVzZXRzIiwicHJlbG9hZEF1ZGlvRmlsZXMiXSwibWFwcGluZ3MiOiI7Ozs7OztlQUFlO0FBQ2JBLEVBQUFBLFVBQVUsRUFBRTtBQUNWQyxJQUFBQSxJQUFJLEVBQUUsS0FESTtBQUVWQyxJQUFBQSxPQUFPLEVBQUU7QUFGQyxHQURDO0FBS2JDLEVBQUFBLEtBQUssRUFBRTtBQUNMRixJQUFBQSxJQUFJLEVBQUUsS0FERDtBQUVMQyxJQUFBQSxPQUFPLEVBQUUsRUFGSixDQUVROztBQUZSLEdBTE07QUFTYkUsRUFBQUEsZ0JBQWdCLEVBQUU7QUFDaEJILElBQUFBLElBQUksRUFBRSxLQURVO0FBRWhCQyxJQUFBQSxPQUFPLEVBQUU7QUFGTyxHQVRMO0FBYWJHLEVBQUFBLGNBQWMsRUFBRTtBQUNkSixJQUFBQSxJQUFJLEVBQUUsS0FEUTtBQUVkQyxJQUFBQSxPQUFPLEVBQUU7QUFGSyxHQWJIO0FBa0JaO0FBQ0RJLEVBQUFBLFlBQVksRUFBRTtBQUNaTCxJQUFBQSxJQUFJLEVBQUUsS0FETTtBQUVaQyxJQUFBQSxPQUFPLEVBQUU7QUFGRyxHQW5CRDtBQXVCYkssRUFBQUEsZUFBZSxFQUFFO0FBQ2ZOLElBQUFBLElBQUksRUFBRSxLQURTO0FBRWZDLElBQUFBLE9BQU8sRUFBRTtBQUZNLEdBdkJKO0FBNEJiO0FBQ0E7QUFDQU0sRUFBQUEsaUJBQWlCLEVBQUU7QUFDakJQLElBQUFBLElBQUksRUFBRSxTQURXO0FBRWpCQyxJQUFBQSxPQUFPLEVBQUU7QUFGUTtBQTlCTixDIiwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGRlZmF1bHQge1xuICBhdWRpb0ZpbGVzOiB7XG4gICAgdHlwZTogJ2FueScsXG4gICAgZGVmYXVsdDogW10sXG4gIH0sXG4gIG1ldGFzOiB7XG4gICAgdHlwZTogJ2FueScsXG4gICAgZGVmYXVsdDoge30sIC8vIHsgbmFtZSwgdGl0bGUsIHZlcnNpb24sICB9XG4gIH0sXG4gIHNlc3Npb25zT3ZlcnZpZXc6IHtcbiAgICB0eXBlOiAnYW55JyxcbiAgICBkZWZhdWx0OiBbXSxcbiAgfSxcbiAgc3RyZWFtc1JvdXRpbmc6IHtcbiAgICB0eXBlOiAnYW55JyxcbiAgICBkZWZhdWx0OiBbXSxcbiAgfSxcblxuICAgLy8gQG5vdGUgLSBkZWZhdWx0cyBwcmVzZXRzIGFyZSBwb3B1bGF0ZWQgaW4gYFByb2pldC5jb25zdHJ1Y3RvclxuICBncmFwaFByZXNldHM6IHtcbiAgICB0eXBlOiAnYW55JyxcbiAgICBkZWZhdWx0OiBbXSxcbiAgfSxcbiAgbGVhcm5pbmdQcmVzZXRzOiB7XG4gICAgdHlwZTogJ2FueScsXG4gICAgZGVmYXVsdDoge30sXG4gIH0sXG5cbiAgLy8gbGlzdCBvZiBhbGwgYWN0aXZlIGF1ZGlvIGZpbGVzIGF0IHNlcnZlciBzdGFydHVwLCBieXBhc3MgbG9hZGluZyBiZXR3ZWVuIHNlc3Npb25zXG4gIC8vIHVzZWZ1bGwgZm9yIGNvbmNlcnQgc2l0dWF0aW9ucyAoY2YuIGBjb25maWcvcHJvamVjdC0qLmpzb25gIGZpbGVzKVxuICBwcmVsb2FkQXVkaW9GaWxlczoge1xuICAgIHR5cGU6ICdib29sZWFuJyxcbiAgICBkZWZhdWx0OiBmYWxzZSxcbiAgfSxcbn1cbiJdfQ==