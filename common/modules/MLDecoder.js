"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _BaseModule = _interopRequireDefault(require("./BaseModule.js"));

var _XmmProcessor = _interopRequireDefault(require("../libs/mano/XmmProcessor.js"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

class MLDecoder extends _BaseModule.default {
  constructor(graph, type, id, options) {
    super(graph, type, id); // @todo - as we dont have the not normalized Likelihoods, this does not
    // allow us to implement the JIP-like emergence thing...
    //
    // @note - XMM output:
    // - likeliest {String}
    // - likeliestIndex {Integer}
    // - likelihoods {Array}
    // - outputCovariance {Array}
    // - outputValues {Array}

    this.decoder = new _XmmProcessor.default();
    this.overrideLikeliest = false; // what is this default value

    this.decoder.setConfig({
      likelihoodWindow: this.options.likelihoodWindow
    }); // @todo - this should be related to module options, not to the session

    this.unsubscribeSession = this.graph.session.subscribe(updates => {
      for (let name in updates) {
        switch (name) {
          case 'model':
            this.decoder.setModel(updates['model']);
            break;
        }
      }
    });
    this.unsubscribePlayer = this.graph.player.subscribe(updates => {
      for (let name in updates) {
        switch (name) {
          case 'recordingState':
            switch (updates[name]) {
              case 'idle':
                this.overrideLikeliest = false;
                break;

              default:
                this.overrideLikeliest = true;
                break;
            }

            break;

          case 'preview':
            if (updates[name]) {
              this.overrideLikeliest = true;
            } else {
              this.overrideLikeliest = false;
            }

            break;
        }
      }
    });
    const model = this.graph.session.get('model');
    this.decoder.setModel(model);
  }

  destroy() {
    this.unsubscribeSession();
    this.unsubscribePlayer();
  }

  execute(inputFrame) {
    this.outputFrame.data[this.id] = this.decoder.run(inputFrame.data);

    if (this.overrideLikeliest === true) {
      this.outputFrame.data[this.id].likeliest = this.graph.player.get('label');
    }

    return this.outputFrame;
  }

}

var _default = MLDecoder;
exports.default = _default;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9jb21tb24vbW9kdWxlcy9NTERlY29kZXIuanMiXSwibmFtZXMiOlsiTUxEZWNvZGVyIiwiQmFzZU1vZHVsZSIsImNvbnN0cnVjdG9yIiwiZ3JhcGgiLCJ0eXBlIiwiaWQiLCJvcHRpb25zIiwiZGVjb2RlciIsIlhtbVByb2Nlc3NvciIsIm92ZXJyaWRlTGlrZWxpZXN0Iiwic2V0Q29uZmlnIiwibGlrZWxpaG9vZFdpbmRvdyIsInVuc3Vic2NyaWJlU2Vzc2lvbiIsInNlc3Npb24iLCJzdWJzY3JpYmUiLCJ1cGRhdGVzIiwibmFtZSIsInNldE1vZGVsIiwidW5zdWJzY3JpYmVQbGF5ZXIiLCJwbGF5ZXIiLCJtb2RlbCIsImdldCIsImRlc3Ryb3kiLCJleGVjdXRlIiwiaW5wdXRGcmFtZSIsIm91dHB1dEZyYW1lIiwiZGF0YSIsInJ1biIsImxpa2VsaWVzdCJdLCJtYXBwaW5ncyI6Ijs7Ozs7OztBQUFBOztBQUNBOzs7O0FBRUEsTUFBTUEsU0FBTixTQUF3QkMsbUJBQXhCLENBQW1DO0FBQ2pDQyxFQUFBQSxXQUFXLENBQUNDLEtBQUQsRUFBUUMsSUFBUixFQUFjQyxFQUFkLEVBQWtCQyxPQUFsQixFQUEyQjtBQUNwQyxVQUFNSCxLQUFOLEVBQWFDLElBQWIsRUFBbUJDLEVBQW5CLEVBRG9DLENBR3BDO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQSxTQUFLRSxPQUFMLEdBQWUsSUFBSUMscUJBQUosRUFBZjtBQUNBLFNBQUtDLGlCQUFMLEdBQXlCLEtBQXpCLENBZG9DLENBZ0JwQzs7QUFDQSxTQUFLRixPQUFMLENBQWFHLFNBQWIsQ0FBdUI7QUFBRUMsTUFBQUEsZ0JBQWdCLEVBQUUsS0FBS0wsT0FBTCxDQUFhSztBQUFqQyxLQUF2QixFQWpCb0MsQ0FrQnBDOztBQUNBLFNBQUtDLGtCQUFMLEdBQTBCLEtBQUtULEtBQUwsQ0FBV1UsT0FBWCxDQUFtQkMsU0FBbkIsQ0FBNkJDLE9BQU8sSUFBSTtBQUNoRSxXQUFLLElBQUlDLElBQVQsSUFBaUJELE9BQWpCLEVBQTBCO0FBQ3hCLGdCQUFRQyxJQUFSO0FBQ0UsZUFBSyxPQUFMO0FBQ0UsaUJBQUtULE9BQUwsQ0FBYVUsUUFBYixDQUFzQkYsT0FBTyxDQUFDLE9BQUQsQ0FBN0I7QUFDQTtBQUhKO0FBS0Q7QUFDRixLQVJ5QixDQUExQjtBQVVBLFNBQUtHLGlCQUFMLEdBQXlCLEtBQUtmLEtBQUwsQ0FBV2dCLE1BQVgsQ0FBa0JMLFNBQWxCLENBQTRCQyxPQUFPLElBQUk7QUFDOUQsV0FBSyxJQUFJQyxJQUFULElBQWlCRCxPQUFqQixFQUEwQjtBQUN4QixnQkFBUUMsSUFBUjtBQUNFLGVBQUssZ0JBQUw7QUFDRSxvQkFBT0QsT0FBTyxDQUFDQyxJQUFELENBQWQ7QUFDRSxtQkFBSyxNQUFMO0FBQ0UscUJBQUtQLGlCQUFMLEdBQXlCLEtBQXpCO0FBQ0E7O0FBQ0Y7QUFDRSxxQkFBS0EsaUJBQUwsR0FBeUIsSUFBekI7QUFDQTtBQU5KOztBQVFBOztBQUNGLGVBQUssU0FBTDtBQUNFLGdCQUFJTSxPQUFPLENBQUNDLElBQUQsQ0FBWCxFQUFtQjtBQUNqQixtQkFBS1AsaUJBQUwsR0FBeUIsSUFBekI7QUFDRCxhQUZELE1BRU87QUFDTCxtQkFBS0EsaUJBQUwsR0FBeUIsS0FBekI7QUFDRDs7QUFDRDtBQWpCSjtBQW1CRDtBQUNGLEtBdEJ3QixDQUF6QjtBQXdCQSxVQUFNVyxLQUFLLEdBQUcsS0FBS2pCLEtBQUwsQ0FBV1UsT0FBWCxDQUFtQlEsR0FBbkIsQ0FBdUIsT0FBdkIsQ0FBZDtBQUNBLFNBQUtkLE9BQUwsQ0FBYVUsUUFBYixDQUFzQkcsS0FBdEI7QUFDRDs7QUFFREUsRUFBQUEsT0FBTyxHQUFHO0FBQ1IsU0FBS1Ysa0JBQUw7QUFDQSxTQUFLTSxpQkFBTDtBQUNEOztBQUVESyxFQUFBQSxPQUFPLENBQUNDLFVBQUQsRUFBYTtBQUNsQixTQUFLQyxXQUFMLENBQWlCQyxJQUFqQixDQUFzQixLQUFLckIsRUFBM0IsSUFBaUMsS0FBS0UsT0FBTCxDQUFhb0IsR0FBYixDQUFpQkgsVUFBVSxDQUFDRSxJQUE1QixDQUFqQzs7QUFFQSxRQUFJLEtBQUtqQixpQkFBTCxLQUEyQixJQUEvQixFQUFxQztBQUNuQyxXQUFLZ0IsV0FBTCxDQUFpQkMsSUFBakIsQ0FBc0IsS0FBS3JCLEVBQTNCLEVBQStCdUIsU0FBL0IsR0FBMkMsS0FBS3pCLEtBQUwsQ0FBV2dCLE1BQVgsQ0FBa0JFLEdBQWxCLENBQXNCLE9BQXRCLENBQTNDO0FBQ0Q7O0FBRUQsV0FBTyxLQUFLSSxXQUFaO0FBQ0Q7O0FBdkVnQzs7ZUEwRXBCekIsUyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCBCYXNlTW9kdWxlIGZyb20gJy4vQmFzZU1vZHVsZS5qcyc7XG5pbXBvcnQgWG1tUHJvY2Vzc29yIGZyb20gJy4uL2xpYnMvbWFuby9YbW1Qcm9jZXNzb3IuanMnO1xuXG5jbGFzcyBNTERlY29kZXIgZXh0ZW5kcyBCYXNlTW9kdWxlIHtcbiAgY29uc3RydWN0b3IoZ3JhcGgsIHR5cGUsIGlkLCBvcHRpb25zKSB7XG4gICAgc3VwZXIoZ3JhcGgsIHR5cGUsIGlkKTtcblxuICAgIC8vIEB0b2RvIC0gYXMgd2UgZG9udCBoYXZlIHRoZSBub3Qgbm9ybWFsaXplZCBMaWtlbGlob29kcywgdGhpcyBkb2VzIG5vdFxuICAgIC8vIGFsbG93IHVzIHRvIGltcGxlbWVudCB0aGUgSklQLWxpa2UgZW1lcmdlbmNlIHRoaW5nLi4uXG4gICAgLy9cbiAgICAvLyBAbm90ZSAtIFhNTSBvdXRwdXQ6XG4gICAgLy8gLSBsaWtlbGllc3Qge1N0cmluZ31cbiAgICAvLyAtIGxpa2VsaWVzdEluZGV4IHtJbnRlZ2VyfVxuICAgIC8vIC0gbGlrZWxpaG9vZHMge0FycmF5fVxuICAgIC8vIC0gb3V0cHV0Q292YXJpYW5jZSB7QXJyYXl9XG4gICAgLy8gLSBvdXRwdXRWYWx1ZXMge0FycmF5fVxuXG4gICAgdGhpcy5kZWNvZGVyID0gbmV3IFhtbVByb2Nlc3NvcigpO1xuICAgIHRoaXMub3ZlcnJpZGVMaWtlbGllc3QgPSBmYWxzZTtcblxuICAgIC8vIHdoYXQgaXMgdGhpcyBkZWZhdWx0IHZhbHVlXG4gICAgdGhpcy5kZWNvZGVyLnNldENvbmZpZyh7IGxpa2VsaWhvb2RXaW5kb3c6IHRoaXMub3B0aW9ucy5saWtlbGlob29kV2luZG93IH0pO1xuICAgIC8vIEB0b2RvIC0gdGhpcyBzaG91bGQgYmUgcmVsYXRlZCB0byBtb2R1bGUgb3B0aW9ucywgbm90IHRvIHRoZSBzZXNzaW9uXG4gICAgdGhpcy51bnN1YnNjcmliZVNlc3Npb24gPSB0aGlzLmdyYXBoLnNlc3Npb24uc3Vic2NyaWJlKHVwZGF0ZXMgPT4ge1xuICAgICAgZm9yIChsZXQgbmFtZSBpbiB1cGRhdGVzKSB7XG4gICAgICAgIHN3aXRjaCAobmFtZSkge1xuICAgICAgICAgIGNhc2UgJ21vZGVsJzpcbiAgICAgICAgICAgIHRoaXMuZGVjb2Rlci5zZXRNb2RlbCh1cGRhdGVzWydtb2RlbCddKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICB0aGlzLnVuc3Vic2NyaWJlUGxheWVyID0gdGhpcy5ncmFwaC5wbGF5ZXIuc3Vic2NyaWJlKHVwZGF0ZXMgPT4ge1xuICAgICAgZm9yIChsZXQgbmFtZSBpbiB1cGRhdGVzKSB7XG4gICAgICAgIHN3aXRjaCAobmFtZSkge1xuICAgICAgICAgIGNhc2UgJ3JlY29yZGluZ1N0YXRlJzpcbiAgICAgICAgICAgIHN3aXRjaCh1cGRhdGVzW25hbWVdKSB7XG4gICAgICAgICAgICAgIGNhc2UgJ2lkbGUnOlxuICAgICAgICAgICAgICAgIHRoaXMub3ZlcnJpZGVMaWtlbGllc3QgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgICAgICB0aGlzLm92ZXJyaWRlTGlrZWxpZXN0ID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIGNhc2UgJ3ByZXZpZXcnOlxuICAgICAgICAgICAgaWYgKHVwZGF0ZXNbbmFtZV0pIHtcbiAgICAgICAgICAgICAgdGhpcy5vdmVycmlkZUxpa2VsaWVzdCA9IHRydWU7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICB0aGlzLm92ZXJyaWRlTGlrZWxpZXN0ID0gZmFsc2U7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0pO1xuXG4gICAgY29uc3QgbW9kZWwgPSB0aGlzLmdyYXBoLnNlc3Npb24uZ2V0KCdtb2RlbCcpO1xuICAgIHRoaXMuZGVjb2Rlci5zZXRNb2RlbChtb2RlbCk7XG4gIH1cblxuICBkZXN0cm95KCkge1xuICAgIHRoaXMudW5zdWJzY3JpYmVTZXNzaW9uKCk7XG4gICAgdGhpcy51bnN1YnNjcmliZVBsYXllcigpO1xuICB9XG5cbiAgZXhlY3V0ZShpbnB1dEZyYW1lKSB7XG4gICAgdGhpcy5vdXRwdXRGcmFtZS5kYXRhW3RoaXMuaWRdID0gdGhpcy5kZWNvZGVyLnJ1bihpbnB1dEZyYW1lLmRhdGEpO1xuXG4gICAgaWYgKHRoaXMub3ZlcnJpZGVMaWtlbGllc3QgPT09IHRydWUpIHtcbiAgICAgIHRoaXMub3V0cHV0RnJhbWUuZGF0YVt0aGlzLmlkXS5saWtlbGllc3QgPSB0aGlzLmdyYXBoLnBsYXllci5nZXQoJ2xhYmVsJyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXMub3V0cHV0RnJhbWU7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgTUxEZWNvZGVyO1xuIl19