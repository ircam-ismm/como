"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _BaseModule = _interopRequireDefault(require("./BaseModule.js"));

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
      const scriptModule = this.script.execute(this.graph, this.graph.como.helpers, this.outputFrame);

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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9jb21tb24vbW9kdWxlcy9TY3JpcHREYXRhLmpzIl0sIm5hbWVzIjpbIlNjcmlwdERhdGEiLCJCYXNlTW9kdWxlIiwiY29uc3RydWN0b3IiLCJncmFwaCIsInR5cGUiLCJpZCIsIm9wdGlvbnMiLCJPYmplY3QiLCJhc3NpZ24iLCJzY3JpcHROYW1lIiwic2NyaXB0U2VydmljZSIsImNvbW8iLCJleHBlcmllbmNlIiwicGx1Z2lucyIsInNjcmlwdCIsIl9pbml0ZWQiLCJpbml0Iiwic2V0U2NyaXB0IiwiZGVzdHJveSIsImRldGFjaCIsInVwZGF0ZU9wdGlvbnMiLCJuYW1lIiwic2NyaXB0TW9kdWxlIiwic2NyaXB0UGFyYW1zIiwiSlNPTjUiLCJwYXJzZSIsImVyciIsImNvbnNvbGUiLCJlcnJvciIsInVwZGF0ZVBhcmFtcyIsImF0dGFjaCIsInN1YnNjcmliZSIsInVwZGF0ZXMiLCJpbml0U2NyaXB0Iiwib25EZXRhY2giLCJleGVjdXRlIiwiaGVscGVycyIsIm91dHB1dEZyYW1lIiwiRXJyb3IiLCJzZXNzaW9uIiwidXBkYXRlTW9kZWwiLCJsb2ciLCJpbnB1dEZyYW1lIiwicHJvY2VzcyIsInVuZGVmaW5lZCJdLCJtYXBwaW5ncyI6Ijs7Ozs7OztBQUFBOztBQUNBOzs7O0FBRUEsTUFBTUEsVUFBTixTQUF5QkMsbUJBQXpCLENBQW9DO0FBQ2xDQyxFQUFBQSxXQUFXLENBQUNDLEtBQUQsRUFBUUMsSUFBUixFQUFjQyxFQUFkLEVBQWtCQyxPQUFsQixFQUEyQjtBQUNwQztBQUNBQSxJQUFBQSxPQUFPLEdBQUdDLE1BQU0sQ0FBQ0MsTUFBUCxDQUFjO0FBQUVDLE1BQUFBLFVBQVUsRUFBRTtBQUFkLEtBQWQsRUFBeUNILE9BQXpDLENBQVY7QUFDQSxVQUFNSCxLQUFOLEVBQWFDLElBQWIsRUFBbUJDLEVBQW5CLEVBQXVCQyxPQUF2QjtBQUVBLFNBQUtJLGFBQUwsR0FBcUIsS0FBS1AsS0FBTCxDQUFXUSxJQUFYLENBQWdCQyxVQUFoQixD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S0FBSixDQUFXLHlCQUF3QjdCLFVBQVcsMEVBQTlDLENBQU47QUFDRDs7QUFFRCxXQUFLYSxZQUFMLEdBQW9CQSxZQUFwQixDQWRFLENBZ0JGO0FBQ0E7O0FBQ0EsVUFBSSxLQUFLbkIsS0FBTCxDQUFXb0MsT0FBWCxDQUFtQkMsV0FBbkIsSUFBa0MsS0FBS3pCLE9BQTNDLEVBQW9EO0FBQ2xELGFBQUtaLEtBQUwsQ0FBV29DLE9BQVgsQ0FBbUJDLFdBQW5CO0FBQ0QsT0FwQkMsQ0FzQkY7QUFDQTtBQUNBO0FBQ0E7O0FBQ0QsS0ExQkQsQ0EwQkUsT0FBTWQsR0FBTixFQUFXO0FBQ1hDLE1BQUFBLE9BQU8sQ0FBQ2MsR0FBUixDQUFZZixHQUFaO0FBQ0Q7QUFDRjs7QUFFRFMsRUFBQUEsT0FBTyxDQUFDTyxVQUFELEVBQWE7QUFDbEIsUUFBSSxLQUFLcEIsWUFBVCxFQUF1QjtBQUNyQixXQUFLZSxXQUFMLEdBQW1CLEtBQUtmLFlBQUwsQ0FBa0JxQixPQUFsQixDQUEwQkQsVUFBMUIsRUFBc0MsS0FBS0wsV0FBM0MsQ0FBbkI7O0FBRUEsVUFBSSxLQUFLQSxXQUFMLEtBQXFCTyxTQUF6QixFQUFvQztBQUNsQyxhQUFLUCxXQUFMLEdBQW1CLEVBQW5CO0FBQ0EsY0FBTSxJQUFJQyxLQUFKLENBQVcsV0FBVSxLQUFLaEMsT0FBTCxDQUFhRyxVQUFXLDZCQUE3QyxDQUFOO0FBQ0Q7QUFDRjs7QUFFRCxXQUFPLEtBQUs0QixXQUFaO0FBQ0Q7O0FBdEhpQzs7ZUF5SHJCckMsVSIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCBCYXNlTW9kdWxlIGZyb20gJy4vQmFzZU1vZHVsZS5qcyc7XG5pbXBvcnQgSlNPTjUgZnJvbSAnanNvbjUnO1xuXG5jbGFzcyBTY3JpcHREYXRhIGV4dGVuZHMgQmFzZU1vZHVsZSB7XG4gIGNvbnN0cnVjdG9yKGdyYXBoLCB0eXBlLCBpZCwgb3B0aW9ucykge1xuICAgIC8vIEBub3RlIC0gdGhlc2UgZGVmYXVsdHMgYXJlIHdlYWssIHdlIG11c3QgcmVpbmZvcmNlIHRoaXNcbiAgICBvcHRpb25zID0gT2JqZWN0LmFzc2lnbih7IHNjcmlwdE5hbWU6ICdkZWZhdWx0JyB9LCBvcHRpb25zKTtcbiAgICBzdXBlcihncmFwaCwgdHlwZSwgaWQsIG9wdGlvbnMpO1xuXG4gICAgdGhpcy5zY3JpcHRTZXJ2aWNlID0gdGhpcy5ncmFwaC5jb21vLmV4cGVyaWVuY2UucGx1Z2luc1snc2NyaXB0cy1kYXRhJ107XG5cbiAgICB0aGlzLnNjcmlwdCA9IG51bGw7XG4gICAgdGhpcy5faW5pdGVkID0gZmFsc2U7IC8vIGRvIG5vdCByZXF1aXJlIG1vZGVsIHVwZGF0ZSBvbiBncmFwaCBpbnN0YW5jaWF0aW9uXG4gIH1cblxuICBhc3luYyBpbml0KCkge1xuICAgIGF3YWl0IHRoaXMuc2V0U2NyaXB0KHRoaXMub3B0aW9ucy5zY3JpcHROYW1lKTtcbiAgICB0aGlzLl9pbml0ZWQgPSB0cnVlO1xuICB9XG5cbiAgYXN5bmMgZGVzdHJveSgpIHtcbiAgICBzdXBlci5kZXN0cm95KCk7XG5cbiAgICBpZiAodGhpcy5zY3JpcHQgIT09IG51bGwpIHtcbiAgICAgIGNvbnN0IHNjcmlwdCA9IHRoaXMuc2NyaXB0O1xuICAgICAgdGhpcy5zY3JpcHQgPSBudWxsO1xuICAgICAgLy8gdGhpcyB3aWxsIGNhbGwgdGhlIG9uRGV0YWNoIGNhbGxiYWNrIGFuZCB0aHVzIGRlc3Ryb3kgdGhlIHNjcmlwdFxuICAgICAgYXdhaXQgc2NyaXB0LmRldGFjaCgpO1xuICAgIH1cbiAgfVxuXG4gIGFzeW5jIHVwZGF0ZU9wdGlvbnMob3B0aW9ucykge1xuICAgIHN1cGVyLnVwZGF0ZU9wdGlvbnMob3B0aW9ucyk7XG5cbiAgICBpZiAoIXRoaXMuc2NyaXB0IHx8ICh0aGlzLm9wdGlvbnMuc2NyaXB0TmFtZSAhPT0gdGhpcy5zY3JpcHQubmFtZSkpIHtcbiAgICAgIGF3YWl0IHRoaXMuc2V0U2NyaXB0KHRoaXMub3B0aW9ucy5zY3JpcHROYW1lKTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5zY3JpcHRNb2R1bGUgJiYgdGhpcy5vcHRpb25zLnNjcmlwdFBhcmFtcykge1xuICAgICAgaWYgKHR5cGVvZiB0aGlzLm9wdGlvbnMuc2NyaXB0UGFyYW1zID09PSAnc3RyaW5nJykge1xuICAgICAgICB0cnkge1xuICAgICAgICAgIHRoaXMub3B0aW9ucy5zY3JpcHRQYXJhbXMgPSBKU09ONS5wYXJzZSh0aGlzLm9wdGlvbnMuc2NyaXB0UGFyYW1zKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgY29uc29sZS5lcnJvcihgSW52YWxpZCBzY3JpcHQgcGFyYW0sIHBsZWFzZSBwcm92aWRlIGEgcHJvcGVyIGphdmFzY3JpcHQgb2JqZWN0YCk7XG4gICAgICAgICAgY29uc29sZS5lcnJvcihlcnIpO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIHRoaXMuc2NyaXB0TW9kdWxlLnVwZGF0ZVBhcmFtcyh0aGlzLm9wdGlvbnMuc2NyaXB0UGFyYW1zKTtcbiAgICB9XG4gIH1cblxuICBhc3luYyBzZXRTY3JpcHQoc2NyaXB0TmFtZSkge1xuICAgIGlmICh0aGlzLnNjcmlwdCAhPT0gbnVsbCkge1xuICAgICAgYXdhaXQgdGhpcy5zY3JpcHQuZGV0YWNoKCk7XG4gICAgICB0aGlzLnNjcmlwdCA9IG51bGw7XG4gICAgfVxuXG4gICAgdGhpcy5zY3JpcHQgPSBhd2FpdCB0aGlzLnNjcmlwdFNlcnZpY2UuYXR0YWNoKHNjcmlwdE5hbWUpO1xuXG4gICAgdGhpcy5zY3JpcHQuc3Vic2NyaWJlKHVwZGF0ZXMgPT4ge1xuICAgICAgaWYgKCF1cGRhdGVzLmVycm9yKSB7XG4gICAgICAgIHRoaXMuaW5pdFNjcmlwdCgpO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgdGhpcy5zY3JpcHQub25EZXRhY2goKCkgPT4ge1xuICAgICAgdGhpcy5zY3JpcHRNb2R1bGUuZGVzdHJveSgpO1xuICAgICAgdGhpcy5zY3JpcHRNb2R1bGUgPSBudWxsO1xuICAgIH0pO1xuXG4gICAgdGhpcy5pbml0U2NyaXB0KCk7XG4gIH1cblxuICBpbml0U2NyaXB0KCkge1xuICAgIGlmICh0aGlzLnNjcmlwdE1vZHVsZSkge1xuICAgICAgdGhpcy5zY3JpcHRNb2R1bGUuZGVzdHJveSgpO1xuICAgIH1cblxuICAgIHRyeSB7XG4gICAgICBjb25zdCBzY3JpcHRNb2R1bGUgPSB0aGlzLnNjcmlwdC5leGVjdXRlKFxuICAgICAgICB0aGlzLmdyYXBoLFxuICAgICAgICB0aGlzLmdyYXBoLmNvbW8uaGVscGVycyxcbiAgICAgICAgdGhpcy5vdXRwdXRGcmFtZVxuICAgICAgKTtcblxuICAgICAgaWYgKCEoJ3Byb2Nlc3MnIGluIHNjcmlwdE1vZHVsZSkgfHxcbiAgICAgICAgICAhKCdkZXN0cm95JyBpbiBzY3JpcHRNb2R1bGUpIHx8XG4gICAgICAgICAgISgndXBkYXRlUGFyYW1zJyBpbiBzY3JpcHRNb2R1bGUpXG4gICAgICApIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBJbnZhbGlkIHNjcmlwdE1vZHVsZSBcIiR7c2NyaXB0TmFtZX1cIiwgdGhlIHNjcmlwdCBzaG91bGQgcmV0dXJuIGFuIG9iamVjdCB7IHVwZGF0ZVBhcmFtcywgcHJvY2VzcywgZGVzdHJveSB9YCk7XG4gICAgICB9XG5cbiAgICAgIHRoaXMuc2NyaXB0TW9kdWxlID0gc2NyaXB0TW9kdWxlO1xuXG4gICAgICAvLyBpZiB3ZSBhcmUgc2VydmVyLXNpZGUsIHdlIHdhbnQgdG8gcmV0cmFpbiB0aGUgbW9kZWxcbiAgICAgIC8vIHdlIGRvbid0IHdhbnQgdG8gcmVxdWlyZSBtb2RlbCB1cGRhdGUgb24gZ3JhcGggaW5zdGFuY2lhdGlvblxuICAgICAgaWYgKHRoaXMuZ3JhcGguc2Vzc2lvbi51cGRhdGVNb2RlbCAmJiB0aGlzLl9pbml0ZWQpIHtcbiAgICAgICAgdGhpcy5ncmFwaC5zZXNzaW9uLnVwZGF0ZU1vZGVsKCk7XG4gICAgICB9XG5cbiAgICAgIC8vIEB0b2RvIC0gZGVmaW5lIGhvdyB0aGlzIHNob3VsZCB3b3JrXG4gICAgICAvLyBpZiAodGhpcy5vcHRpb25zLnNjcmlwdFBhcmFtcykge1xuICAgICAgLy8gICB0aGlzLnVwZGF0ZU9wdGlvbnModGhpcy5vcHRpb25zKTtcbiAgICAgIC8vIH1cbiAgICB9IGNhdGNoKGVycikge1xuICAgICAgY29uc29sZS5sb2coZXJyKTtcbiAgICB9XG4gIH1cblxuICBleGVjdXRlKGlucHV0RnJhbWUpIHtcbiAgICBpZiAodGhpcy5zY3JpcHRNb2R1bGUpIHtcbiAgICAgIHRoaXMub3V0cHV0RnJhbWUgPSB0aGlzLnNjcmlwdE1vZHVsZS5wcm9jZXNzKGlucHV0RnJhbWUsIHRoaXMub3V0cHV0RnJhbWUpO1xuXG4gICAgICBpZiAodGhpcy5vdXRwdXRGcmFtZSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHRoaXMub3V0cHV0RnJhbWUgPSB7fTtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBzY3JpcHQgXCIke3RoaXMub3B0aW9ucy5zY3JpcHROYW1lfVwiIG11c3QgcmV0dXJuIFwib3V0cHV0RnJhbWVcImApO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiB0aGlzLm91dHB1dEZyYW1lO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IFNjcmlwdERhdGE7XG4iXX0=