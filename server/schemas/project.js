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
  },
  activeAudioFiles: {
    type: 'any',
    default: null,
    nullable: true
  }
};
exports.default = _default;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9zZXJ2ZXIvc2NoZW1hcy9wcm9qZWN0LmpzIl0sIm5hbWVzIjpbImF1ZGlvRmlsZXMiLCJ0eXBlIiwiZGVmYXVsdCIsIm1ldGFzIiwic2Vzc2lvbnNPdmVydmlldyIsInN0cmVhbXNSb3V0aW5nIiwiZ3JhcGhQcmVzZXRzIiwibGVhcm5pbmdQcmVzZXRzIiwicHJlbG9hZEF1ZGlvRmlsZXMiLCJhY3RpdmVBdWRpb0ZpbGVzIiwibnVsbGFibGUiXSwibWFwcGluZ3MiOiI7Ozs7OztlQUFlO0FBQ2JBLEVBQUFBLFVBQVUsRUFBRTtBQUNWQyxJQUFBQSxJQUFJLEVBQUUsS0FESTtBQUVWQyxJQUFBQSxPQUFPLEVBQUU7QUFGQyxHQURDO0FBS2JDLEVBQUFBLEtBQUssRUFBRTtBQUNMRixJQUFBQSxJQUFJLEVBQUUsS0FERDtBQUVMQyxJQUFBQSxPQUFPLEVBQUUsRUFGSixDQUVROztBQUZSLEdBTE07QUFTYkUsRUFBQUEsZ0JBQWdCLEVBQUU7QUFDaEJILElBQUFBLElBQUksRUFBRSxLQURVO0FBRWhCQyxJQUFBQSxPQUFPLEVBQUU7QUFGTyxHQVRMO0FBYWJHLEVBQUFBLGNBQWMsRUFBRTtBQUNkSixJQUFBQSxJQUFJLEVBQUUsS0FEUTtBQUVkQyxJQUFBQSxPQUFPLEVBQUU7QUFGSyxHQWJIO0FBa0JaO0FBQ0RJLEVBQUFBLFlBQVksRUFBRTtBQUNaTCxJQUFBQSxJQUFJLEVBQUUsS0FETTtBQUVaQyxJQUFBQSxPQUFPLEVBQUU7QUFGRyxHQW5CRDtBQXVCYkssRUFBQUEsZUFBZSxFQUFFO0FBQ2ZOLElBQUFBLElBQUksRUFBRSxLQURTO0FBRWZDLElBQUFBLE9BQU8sRUFBRTtBQUZNLEdBdkJKO0FBNEJiO0FBQ0E7QUFDQU0sRUFBQUEsaUJBQWlCLEVBQUU7QUFDakJQLElBQUFBLElBQUksRUFBRSxTQURXO0FBRWpCQyxJQUFBQSxPQUFPLEVBQUU7QUFGUSxHQTlCTjtBQW1DYk8sRUFBQUEsZ0JBQWdCLEVBQUU7QUFDaEJSLElBQUFBLElBQUksRUFBRSxLQURVO0FBRWhCQyxJQUFBQSxPQUFPLEVBQUUsSUFGTztBQUdoQlEsSUFBQUEsUUFBUSxFQUFFO0FBSE07QUFuQ0wsQyIsInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBkZWZhdWx0IHtcbiAgYXVkaW9GaWxlczoge1xuICAgIHR5cGU6ICdhbnknLFxuICAgIGRlZmF1bHQ6IFtdLFxuICB9LFxuICBtZXRhczoge1xuICAgIHR5cGU6ICdhbnknLFxuICAgIGRlZmF1bHQ6IHt9LCAvLyB7IG5hbWUsIHRpdGxlLCB2ZXJzaW9uLCAgfVxuICB9LFxuICBzZXNzaW9uc092ZXJ2aWV3OiB7XG4gICAgdHlwZTogJ2FueScsXG4gICAgZGVmYXVsdDogW10sXG4gIH0sXG4gIHN0cmVhbXNSb3V0aW5nOiB7XG4gICAgdHlwZTogJ2FueScsXG4gICAgZGVmYXVsdDogW10sXG4gIH0sXG5cbiAgIC8vIEBub3RlIC0gZGVmYXVsdHMgcHJlc2V0cyBhcmUgcG9wdWxhdGVkIGluIGBQcm9qZXQuY29uc3RydWN0b3JcbiAgZ3JhcGhQcmVzZXRzOiB7XG4gICAgdHlwZTogJ2FueScsXG4gICAgZGVmYXVsdDogW10sXG4gIH0sXG4gIGxlYXJuaW5nUHJlc2V0czoge1xuICAgIHR5cGU6ICdhbnknLFxuICAgIGRlZmF1bHQ6IHt9LFxuICB9LFxuXG4gIC8vIGxpc3Qgb2YgYWxsIGFjdGl2ZSBhdWRpbyBmaWxlcyBhdCBzZXJ2ZXIgc3RhcnR1cCwgYnlwYXNzIGxvYWRpbmcgYmV0d2VlbiBzZXNzaW9uc1xuICAvLyB1c2VmdWxsIGZvciBjb25jZXJ0IHNpdHVhdGlvbnMgKGNmLiBgY29uZmlnL3Byb2plY3QtKi5qc29uYCBmaWxlcylcbiAgcHJlbG9hZEF1ZGlvRmlsZXM6IHtcbiAgICB0eXBlOiAnYm9vbGVhbicsXG4gICAgZGVmYXVsdDogZmFsc2UsXG4gIH0sXG5cbiAgYWN0aXZlQXVkaW9GaWxlczoge1xuICAgIHR5cGU6ICdhbnknLFxuICAgIGRlZmF1bHQ6IG51bGwsXG4gICAgbnVsbGFibGU6IHRydWUsXG4gIH0sXG59XG4iXX0=