"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _BaseModule = _interopRequireDefault(require("./BaseModule.js"));

var _index = _interopRequireDefault(require("../helpers/index.js"));

var _json = _interopRequireDefault(require("json5"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

class ScriptData extends _BaseModule.default {
  constructor(graph, type, id, options) {
    // @note - these defaults are weak, we must reinforce this
    options = Object.assign({
      scriptName: 'default'
    }, options);
    super(graph, type, id, options);
    this.scriptService = this.graph.como.experience.plugins['scripts-data'];
    this.script = null;
    this._inited = false; // do not require model update on graph instanciation
  }

  async init() {
    await this.setScript(this.options.scriptName);
    this._inited = true;
  }

  async destroy() {
    super.destroy();

    if (this.script !== null) {
      const script = this.script;
      this.script = null; // this will call the onDetach callback and thus destroy the script

      await script.detach();
    }
  }

  async updateOptions(options) {
    super.updateOptions(options);

    if (!this.script || this.options.scriptName !== this.script.name) {
      await this.setScript(this.options.scriptName);
    }

    if (this.scriptModule && this.options.scriptParams) {
      if (typeof this.options.scriptParams === 'string') {
        try {
          this.options.scriptParams = _json.default.parse(this.options.scriptParams);
        } catch (err) {
          console.error(`Invalid script param, please provide a proper javascript object`);
          console.error(err);
        }
      }

      this.scriptModule.updateParams(this.options.scriptParams);
    }
  }

  async setScript(scriptName) {
    if (this.script !== null) {
      await this.script.detach();
      this.script = null;
    }

    this.script = await this.scriptService.attach(scriptName);
    this.script.subscribe(updates => {
      if (!updates.error) {
        this.initScript();
      }
    });
    this.script.onDetach(() => {
      this.scriptModule.destroy();
      this.scriptModule = null;
    });
    this.initScript();
  }

  initScript() {
    if (this.scriptModule) {
      this.scriptModule.destroy();
    }

    try {
      const scriptModule = this.script.execute(this.graph, _index.default, this.outputFrame);

      if (!('process' in scriptModule) || !('destroy' in scriptModule) || !('updateParams' in scriptModule)) {
        throw new Error(`Invalid scriptModule "${scriptName}", the script should return an object { updateParams, process, destroy }`);
      }

      this.scriptModule = scriptModule; // if we are server-side, we want to retrain the model
      // we don't want to require model update on graph instanciation

      if (this.graph.session.updateModel && this._inited) {
        this.graph.session.updateModel();
      } // @todo - define how this should work
      // if (this.options.scriptParams) {
      //   this.updateOptions(this.options);
      // }

    } catch (err) {
      console.log(err);
    }
  }

  execute(inputFrame) {
    if (this.scriptModule) {
      this.outputFrame = this.scriptModule.process(inputFrame, this.outputFrame);

      if (this.outputFrame === undefined) {
        this.outputFrame = {};
        throw new Error(`script "${this.options.scriptName}" must return "outputFrame"`);
      }
    }

    return this.outputFrame;
  }

}

var _default = ScriptData;
exports.default = _default;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9jb21tb24vbW9kdWxlcy9TY3JpcHREYXRhLmpzIl0sIm5hbWVzIjpbIlNjcmlwdERhdGEiLCJCYXNlTW9kdWxlIiwiY29uc3RydWN0b3IiLCJncmFwaCIsInR5cGUiLCJpZCIsIm9wdGlvbnMiLCJPYmplY3QiLCJhc3NpZ24iLCJzY3JpcHROYW1lIiwic2NyaXB0U2VydmljZSIsImNvbW8iLCJleHBlcmllbmNlIiwicGx1Z2lucyIsInNjcmlwdCIsIl9pbml0ZWQiLCJpbml0Iiwic2V0U2NyaXB0IiwiZGVzdHJveSIsImRldGFjaCIsInVwZGF0ZU9wdGlvbnMiLCJuYW1lIiwic2NyaXB0TW9kdWxlIiwic2NyaXB0UGFyYW1zIiwiSlNPTjUiLCJwYXJzZSIsImVyciIsImNvbnNvbGUiLCJlcnJvciIsInVwZGF0ZVBhcmFtcyIsImF0dGFjaCIsInN1YnNjcmliZSIsInVwZGF0ZXMiLCJpbml0U2NyaXB0Iiwib25EZXRhY2giLCJleGVjdXRlIiwiaGVscGVycyIsIm91dHB1dEZyYW1lIiwiRXJyb3IiLCJzZXNzaW9uIiwidXBkYXRlTW9kZWwiLCJsb2ciLCJpbnB1dEZyYW1lIiwicHJvY2VzcyIsInVuZGVmaW5lZCJdLCJtYXBwaW5ncyI6Ijs7Ozs7OztBQUFBOztBQUNBOztBQUNBOzs7O0FBRUEsTUFBTUEsVUFBTixTQUF5QkMsbUJBQXpCLENBQW9DO0FBQ2xDQyxFQUFBQSxXQUFXLENBQUNDLEtBQUQsRUFBUUMsSUFBUixFQUFjQyxFQUFkLEVBQWtCQyxPQUFsQixFQUEyQjtBQUNwQztBQUNBQSxJQUFBQSxPQUFPLEdBQUdDLE1BQU0sQ0FBQ0MsTUFBUCxDQUFjO0FBQUVDLE1BQUFBLFVBQVUsRUFBRTtBQUFkLEtBQWQsRUFBeUNILE9BQXpDLENBQVY7QUFDQSxVQUFNSCxLQUFOLEVBQWFDLElBQWIsRUFBbUJDLEVBQW5CLEVBQXVCQyxPQUF2QjtBQUVBLFNBQUtJLGFBQUwsR0FBcUIsS0FBS1AsS0FBTCxDQUFXUSxJQUFYLENBQWdCQyxVQUFoQixDQUEyQkMsT0FBM0IsQ0FBbUMsY0FBbkMsQ0FBckI7QUFFQSxTQUFLQyxNQUFMLEdBQWMsSUFBZDtBQUNBLFNBQUtDLE9BQUwsR0FBZSxLQUFmLENBUm9DLENBUWQ7QUFDdkI7O0FBRUQsUUFBTUMsSUFBTixHQUFhO0FBQ1gsVUFBTSxLQUFLQyxTQUFMLENBQWUsS0FBS1gsT0FBTCxDQUFhRyxVQUE1QixDQUFOO0FBQ0EsU0FBS00sT0FBTCxHQUFlLElBQWY7QUFDRDs7QUFFRCxRQUFNRyxPQUFOLEdBQWdCO0FBQ2QsVUFBTUEsT0FBTjs7QUFFQSxRQUFJLEtBQUtKLE1BQUwsS0FBZ0IsSUFBcEIsRUFBMEI7QUFDeEIsWUFBTUEsTUFBTSxHQUFHLEtBQUtBLE1BQXBCO0FBQ0EsV0FBS0EsTUFBTCxHQUFjLElBQWQsQ0FGd0IsQ0FHeEI7O0FBQ0EsWUFBTUEsTUFBTSxDQUFDSyxNQUFQLEVBQU47QUFDRDtBQUNGOztBQUVELFFBQU1DLGFBQU4sQ0FBb0JkLE9BQXBCLEVBQTZCO0FBQzNCLFVBQU1jLGFBQU4sQ0FBb0JkLE9BQXBCOztBQUVBLFFBQUksQ0FBQyxLQUFLUSxNQUFOLElBQWlCLEtBQUtSLE9BQUwsQ0FBYUcsVUFBYixLQUE0QixLQUFLSyxNQUFMLENBQVlPLElBQTdELEVBQW9FO0FBQ2xFLFlBQU0sS0FBS0osU0FBTCxDQUFlLEtBQUtYLE9BQUwsQ0FBYUcsVUFBNUIsQ0FBTjtBQUNEOztBQUVELFFBQUksS0FBS2EsWUFBTCxJQUFxQixLQUFLaEIsT0FBTCxDQUFhaUIsWUFBdEMsRUFBb0Q7QUFDbEQsVUFBSSxPQUFPLEtBQUtqQixPQUFMLENBQWFpQixZQUFwQixLQUFxQyxRQUF6QyxFQUFtRDtBQUNqRCxZQUFJO0FBQ0YsZUFBS2pCLE9BQUwsQ0FBYWlCLFlBQWIsR0FBNEJDLGNBQU1DLEtBQU4sQ0FBWSxLQUFLbkIsT0FBTCxDQUFhaUIsWUFBekIsQ0FBNUI7QUFDRCxTQUZELENBRUUsT0FBT0csR0FBUCxFQUFZO0FBQ1pDLFVBQUFBLE9BQU8sQ0FBQ0MsS0FBUixDQUFlLGlFQUFmO0FBQ0FELFVBQUFBLE9BQU8sQ0FBQ0MsS0FBUixDQUFjRixHQUFkO0FBQ0Q7QUFDRjs7QUFFRCxXQUFLSixZQUFMLENBQWtCTyxZQUFsQixDQUErQixLQUFLdkIsT0FBTCxDQUFhaUIsWUFBNUM7QUFDRDtBQUNGOztBQUVELFFBQU1OLFNBQU4sQ0FBZ0JSLFVBQWhCLEVBQTRCO0FBQzFCLFFBQUksS0FBS0ssTUFBTCxLQUFnQixJQUFwQixFQUEwQjtBQUN4QixZQUFNLEtBQUtBLE1BQUwsQ0FBWUssTUFBWixFQUFOO0FBQ0EsV0FBS0wsTUFBTCxHQUFjLElBQWQ7QUFDRDs7QUFFRCxTQUFLQSxNQUFMLEdBQWMsTUFBTSxLQUFLSixhQUFMLENBQW1Cb0IsTUFBbkIsQ0FBMEJyQixVQUExQixDQUFwQjtBQUVBLFNBQUtLLE1BQUwsQ0FBWWlCLFNBQVosQ0FBc0JDLE9BQU8sSUFBSTtBQUMvQixVQUFJLENBQUNBLE9BQU8sQ0FBQ0osS0FBYixFQUFvQjtBQUNsQixhQUFLSyxVQUFMO0FBQ0Q7QUFDRixLQUpEO0FBTUEsU0FBS25CLE1BQUwsQ0FBWW9CLFFBQVosQ0FBcUIsTUFBTTtBQUN6QixXQUFLWixZQUFMLENBQWtCSixPQUFsQjtBQUNBLFdBQUtJLFlBQUwsR0FBb0IsSUFBcEI7QUFDRCxLQUhEO0FBS0EsU0FBS1csVUFBTDtBQUNEOztBQUVEQSxFQUFBQSxVQUFVLEdBQUc7QUFDWCxRQUFJLEtBQUtYLFlBQVQsRUFBdUI7QUFDckIsV0FBS0EsWUFBTCxDQUFrQkosT0FBbEI7QUFDRDs7QUFFRCxRQUFJO0FBQ0YsWUFBTUksWUFBWSxHQUFHLEtBQUtSLE1BQUwsQ0FBWXFCLE9BQVosQ0FDbkIsS0FBS2hDLEtBRGMsRUFFbkJpQyxjQUZtQixFQUduQixLQUFLQyxXQUhjLENBQXJCOztBQU1BLFVBQUksRUFBRSxhQUFhZixZQUFmLEtBQ0EsRUFBRSxhQUFhQSxZQUFmLENBREEsSUFFQSxFQUFFLGtCQUFrQkEsWUFBcEIsQ0FGSixFQUdFO0FBQ0EsY0FBTSxJQUFJZ0IsS0FBSixDQUFXLHlCQUF3QjdCLFVBQVcsMEVBQTlDLENBQU47QUFDRDs7QUFFRCxXQUFLYSxZQUFMLEdBQW9CQSxZQUFwQixDQWRFLENBZ0JGO0FBQ0E7O0FBQ0EsVUFBSSxLQUFLbkIsS0FBTCxDQUFXb0MsT0FBWCxDQUFtQkMsV0FBbkIsSUFBa0MsS0FBS3pCLE9BQTNDLEVBQW9EO0FBQ2xELGFBQUtaLEtBQUwsQ0FBV29DLE9BQVgsQ0FBbUJDLFdBQW5CO0FBQ0QsT0FwQkMsQ0FzQkY7QUFDQTtBQUNBO0FBQ0E7O0FBQ0QsS0ExQkQsQ0EwQkUsT0FBTWQsR0FBTixFQUFXO0FBQ1hDLE1BQUFBLE9BQU8sQ0FBQ2MsR0FBUixDQUFZZixHQUFaO0FBQ0Q7QUFDRjs7QUFFRFMsRUFBQUEsT0FBTyxDQUFDTyxVQUFELEVBQWE7QUFDbEIsUUFBSSxLQUFLcEIsWUFBVCxFQUF1QjtBQUNyQixXQUFLZSxXQUFMLEdBQW1CLEtBQUtmLFlBQUwsQ0FBa0JxQixPQUFsQixDQUEwQkQsVUFBMUIsRUFBc0MsS0FBS0wsV0FBM0MsQ0FBbkI7O0FBRUEsVUFBSSxLQUFLQSxXQUFMLEtBQXFCTyxTQUF6QixFQUFvQztBQUNsQyxhQUFLUCxXQUFMLEdBQW1CLEVBQW5CO0FBQ0EsY0FBTSxJQUFJQyxLQUFKLENBQVcsV0FBVSxLQUFLaEMsT0FBTCxDQUFhRyxVQUFXLDZCQUE3QyxDQUFOO0FBQ0Q7QUFDRjs7QUFFRCxXQUFPLEtBQUs0QixXQUFaO0FBQ0Q7O0FBdEhpQzs7ZUF5SHJCckMsVSIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCBCYXNlTW9kdWxlIGZyb20gJy4vQmFzZU1vZHVsZS5qcyc7XG5pbXBvcnQgaGVscGVycyBmcm9tICcuLi9oZWxwZXJzL2luZGV4LmpzJztcbmltcG9ydCBKU09ONSBmcm9tICdqc29uNSc7XG5cbmNsYXNzIFNjcmlwdERhdGEgZXh0ZW5kcyBCYXNlTW9kdWxlIHtcbiAgY29uc3RydWN0b3IoZ3JhcGgsIHR5cGUsIGlkLCBvcHRpb25zKSB7XG4gICAgLy8gQG5vdGUgLSB0aGVzZSBkZWZhdWx0cyBhcmUgd2Vhaywgd2UgbXVzdCByZWluZm9yY2UgdGhpc1xuICAgIG9wdGlvbnMgPSBPYmplY3QuYXNzaWduKHsgc2NyaXB0TmFtZTogJ2RlZmF1bHQnIH0sIG9wdGlvbnMpO1xuICAgIHN1cGVyKGdyYXBoLCB0eXBlLCBpZCwgb3B0aW9ucyk7XG5cbiAgICB0aGlzLnNjcmlwdFNlcnZpY2UgPSB0aGlzLmdyYXBoLmNvbW8uZXhwZXJpZW5jZS5wbHVnaW5zWydzY3JpcHRzLWRhdGEnXTtcblxuICAgIHRoaXMuc2NyaXB0ID0gbnVsbDtcbiAgICB0aGlzLl9pbml0ZWQgPSBmYWxzZTsgLy8gZG8gbm90IHJlcXVpcmUgbW9kZWwgdXBkYXRlIG9uIGdyYXBoIGluc3RhbmNpYXRpb25cbiAgfVxuXG4gIGFzeW5jIGluaXQoKSB7XG4gICAgYXdhaXQgdGhpcy5zZXRTY3JpcHQodGhpcy5vcHRpb25zLnNjcmlwdE5hbWUpO1xuICAgIHRoaXMuX2luaXRlZCA9IHRydWU7XG4gIH1cblxuICBhc3luYyBkZXN0cm95KCkge1xuICAgIHN1cGVyLmRlc3Ryb3koKTtcblxuICAgIGlmICh0aGlzLnNjcmlwdCAhPT0gbnVsbCkge1xuICAgICAgY29uc3Qgc2NyaXB0ID0gdGhpcy5zY3JpcHQ7XG4gICAgICB0aGlzLnNjcmlwdCA9IG51bGw7XG4gICAgICAvLyB0aGlzIHdpbGwgY2FsbCB0aGUgb25EZXRhY2ggY2FsbGJhY2sgYW5kIHRodXMgZGVzdHJveSB0aGUgc2NyaXB0XG4gICAgICBhd2FpdCBzY3JpcHQuZGV0YWNoKCk7XG4gICAgfVxuICB9XG5cbiAgYXN5bmMgdXBkYXRlT3B0aW9ucyhvcHRpb25zKSB7XG4gICAgc3VwZXIudXBkYXRlT3B0aW9ucyhvcHRpb25zKTtcblxuICAgIGlmICghdGhpcy5zY3JpcHQgfHwgKHRoaXMub3B0aW9ucy5zY3JpcHROYW1lICE9PSB0aGlzLnNjcmlwdC5uYW1lKSkge1xuICAgICAgYXdhaXQgdGhpcy5zZXRTY3JpcHQodGhpcy5vcHRpb25zLnNjcmlwdE5hbWUpO1xuICAgIH1cblxuICAgIGlmICh0aGlzLnNjcmlwdE1vZHVsZSAmJiB0aGlzLm9wdGlvbnMuc2NyaXB0UGFyYW1zKSB7XG4gICAgICBpZiAodHlwZW9mIHRoaXMub3B0aW9ucy5zY3JpcHRQYXJhbXMgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgdGhpcy5vcHRpb25zLnNjcmlwdFBhcmFtcyA9IEpTT041LnBhcnNlKHRoaXMub3B0aW9ucy5zY3JpcHRQYXJhbXMpO1xuICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICBjb25zb2xlLmVycm9yKGBJbnZhbGlkIHNjcmlwdCBwYXJhbSwgcGxlYXNlIHByb3ZpZGUgYSBwcm9wZXIgamF2YXNjcmlwdCBvYmplY3RgKTtcbiAgICAgICAgICBjb25zb2xlLmVycm9yKGVycik7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgdGhpcy5zY3JpcHRNb2R1bGUudXBkYXRlUGFyYW1zKHRoaXMub3B0aW9ucy5zY3JpcHRQYXJhbXMpO1xuICAgIH1cbiAgfVxuXG4gIGFzeW5jIHNldFNjcmlwdChzY3JpcHROYW1lKSB7XG4gICAgaWYgKHRoaXMuc2NyaXB0ICE9PSBudWxsKSB7XG4gICAgICBhd2FpdCB0aGlzLnNjcmlwdC5kZXRhY2goKTtcbiAgICAgIHRoaXMuc2NyaXB0ID0gbnVsbDtcbiAgICB9XG5cbiAgICB0aGlzLnNjcmlwdCA9IGF3YWl0IHRoaXMuc2NyaXB0U2VydmljZS5hdHRhY2goc2NyaXB0TmFtZSk7XG5cbiAgICB0aGlzLnNjcmlwdC5zdWJzY3JpYmUodXBkYXRlcyA9PiB7XG4gICAgICBpZiAoIXVwZGF0ZXMuZXJyb3IpIHtcbiAgICAgICAgdGhpcy5pbml0U2NyaXB0KCk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICB0aGlzLnNjcmlwdC5vbkRldGFjaCgoKSA9PiB7XG4gICAgICB0aGlzLnNjcmlwdE1vZHVsZS5kZXN0cm95KCk7XG4gICAgICB0aGlzLnNjcmlwdE1vZHVsZSA9IG51bGw7XG4gICAgfSk7XG5cbiAgICB0aGlzLmluaXRTY3JpcHQoKTtcbiAgfVxuXG4gIGluaXRTY3JpcHQoKSB7XG4gICAgaWYgKHRoaXMuc2NyaXB0TW9kdWxlKSB7XG4gICAgICB0aGlzLnNjcmlwdE1vZHVsZS5kZXN0cm95KCk7XG4gICAgfVxuXG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHNjcmlwdE1vZHVsZSA9IHRoaXMuc2NyaXB0LmV4ZWN1dGUoXG4gICAgICAgIHRoaXMuZ3JhcGgsXG4gICAgICAgIGhlbHBlcnMsXG4gICAgICAgIHRoaXMub3V0cHV0RnJhbWVcbiAgICAgICk7XG5cbiAgICAgIGlmICghKCdwcm9jZXNzJyBpbiBzY3JpcHRNb2R1bGUpIHx8XG4gICAgICAgICAgISgnZGVzdHJveScgaW4gc2NyaXB0TW9kdWxlKSB8fFxuICAgICAgICAgICEoJ3VwZGF0ZVBhcmFtcycgaW4gc2NyaXB0TW9kdWxlKVxuICAgICAgKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgSW52YWxpZCBzY3JpcHRNb2R1bGUgXCIke3NjcmlwdE5hbWV9XCIsIHRoZSBzY3JpcHQgc2hvdWxkIHJldHVybiBhbiBvYmplY3QgeyB1cGRhdGVQYXJhbXMsIHByb2Nlc3MsIGRlc3Ryb3kgfWApO1xuICAgICAgfVxuXG4gICAgICB0aGlzLnNjcmlwdE1vZHVsZSA9IHNjcmlwdE1vZHVsZTtcblxuICAgICAgLy8gaWYgd2UgYXJlIHNlcnZlci1zaWRlLCB3ZSB3YW50IHRvIHJldHJhaW4gdGhlIG1vZGVsXG4gICAgICAvLyB3ZSBkb24ndCB3YW50IHRvIHJlcXVpcmUgbW9kZWwgdXBkYXRlIG9uIGdyYXBoIGluc3RhbmNpYXRpb25cbiAgICAgIGlmICh0aGlzLmdyYXBoLnNlc3Npb24udXBkYXRlTW9kZWwgJiYgdGhpcy5faW5pdGVkKSB7XG4gICAgICAgIHRoaXMuZ3JhcGguc2Vzc2lvbi51cGRhdGVNb2RlbCgpO1xuICAgICAgfVxuXG4gICAgICAvLyBAdG9kbyAtIGRlZmluZSBob3cgdGhpcyBzaG91bGQgd29ya1xuICAgICAgLy8gaWYgKHRoaXMub3B0aW9ucy5zY3JpcHRQYXJhbXMpIHtcbiAgICAgIC8vICAgdGhpcy51cGRhdGVPcHRpb25zKHRoaXMub3B0aW9ucyk7XG4gICAgICAvLyB9XG4gICAgfSBjYXRjaChlcnIpIHtcbiAgICAgIGNvbnNvbGUubG9nKGVycik7XG4gICAgfVxuICB9XG5cbiAgZXhlY3V0ZShpbnB1dEZyYW1lKSB7XG4gICAgaWYgKHRoaXMuc2NyaXB0TW9kdWxlKSB7XG4gICAgICB0aGlzLm91dHB1dEZyYW1lID0gdGhpcy5zY3JpcHRNb2R1bGUucHJvY2VzcyhpbnB1dEZyYW1lLCB0aGlzLm91dHB1dEZyYW1lKTtcblxuICAgICAgaWYgKHRoaXMub3V0cHV0RnJhbWUgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICB0aGlzLm91dHB1dEZyYW1lID0ge307XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgc2NyaXB0IFwiJHt0aGlzLm9wdGlvbnMuc2NyaXB0TmFtZX1cIiBtdXN0IHJldHVybiBcIm91dHB1dEZyYW1lXCJgKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcy5vdXRwdXRGcmFtZTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBTY3JpcHREYXRhO1xuIl19