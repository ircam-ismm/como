"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _fs = _interopRequireDefault(require("fs"));

var _path = _interopRequireDefault(require("path"));

var _util = require("util");

var _json = _interopRequireDefault(require("json5"));

var _rimraf = _interopRequireDefault(require("rimraf"));

var _mkdirp = _interopRequireDefault(require("mkdirp"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const writeFile = (0, _util.promisify)(_fs.default.writeFile);
const readFile = (0, _util.promisify)(_fs.default.readFile);
const unlink = (0, _util.promisify)(_rimraf.default);
const locks = {};
const writeQueue = {};
const VERBOSE = false;
const db = {
  async read(fullpath) {
    try {
      const data = await readFile(fullpath, 'utf8');

      const json = _json.default.parse(data.toString());

      return json;
    } catch (err) {
      console.log('db::read', err);
    }
  },

  // @todo - we need to queue write calls because it can lead to file corruption
  async write(fullpath, data, format = true) {
    try {
      if (locks[fullpath] === true) {
        if (VERBOSE) {
          console.log(`[db.write] enqueue ${fullpath}`);
        }

        writeQueue[fullpath] = data; // @todo - this is not clean, as it will resolve before the first
        // write ends... this should be handled properly

        return Promise.resolve();
      } else {
        locks[fullpath] = true;

        if (VERBOSE) {
          console.log(`[db.write] ensuring ${_path.default.dirname(fullpath)}`);
          console.log(`[db.write] writing ${fullpath}`);
        } // create directory if not exists


        await (0, _mkdirp.default)(_path.default.dirname(fullpath)); // write the file

        const json = format ? _json.default.stringify(data, null, 2) : _json.default.stringify(data);
        await writeFile(fullpath, json, 'utf8');
        locks[fullpath] = false;

        if (writeQueue[fullpath]) {
          if (VERBOSE) {
            console.log(`[db.write] dequeue ${fullpath}`);
          }

          const data = writeQueue[fullpath];
          delete writeQueue[fullpath];
          await this.write(fullpath, data);
        }
      }
    } catch (err) {
      console.log('db::write', err);
    }
  },

  async delete(fullpath) {
    try {
      await unlink(fullpath);
    } catch (err) {
      console.log('db::delete', err);
    }
  }

};
var _default = db;
exports.default = _default;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9zZXJ2ZXIvdXRpbHMvZGIuanMiXSwibmFtZXMiOlsid3JpdGVGaWxlIiwiZnMiLCJyZWFkRmlsZSIsInVubGluayIsInJpbXJhZiIsImxvY2tzIiwid3JpdGVRdWV1ZSIsIlZFUkJPU0UiLCJkYiIsInJlYWQiLCJmdWxscGF0aCIsImRhdGEiLCJqc29uIiwiSlNPTjUiLCJwYXJzZSIsInRvU3RyaW5nIiwiZXJyIiwiY29uc29sZSIsImxvZyIsIndyaXRlIiwiZm9ybWF0IiwiUHJvbWlzZSIsInJlc29sdmUiLCJwYXRoIiwiZGlybmFtZSIsInN0cmluZ2lmeSIsImRlbGV0ZSJdLCJtYXBwaW5ncyI6Ijs7Ozs7OztBQUFBOztBQUNBOztBQUNBOztBQUNBOztBQUNBOztBQUNBOzs7O0FBRUEsTUFBTUEsU0FBUyxHQUFHLHFCQUFVQyxZQUFHRCxTQUFiLENBQWxCO0FBQ0EsTUFBTUUsUUFBUSxHQUFHLHFCQUFVRCxZQUFHQyxRQUFiLENBQWpCO0FBQ0EsTUFBTUMsTUFBTSxHQUFHLHFCQUFVQyxlQUFWLENBQWY7QUFFQSxNQUFNQyxLQUFLLEdBQUcsRUFBZDtBQUNBLE1BQU1DLFVBQVUsR0FBRyxFQUFuQjtBQUVBLE1BQU1DLE9BQU8sR0FBRyxLQUFoQjtBQUVBLE1BQU1DLEVBQUUsR0FBRztBQUNULFFBQU1DLElBQU4sQ0FBV0MsUUFBWCxFQUFxQjtBQUNuQixRQUFJO0FBQ0YsWUFBTUMsSUFBSSxHQUFHLE1BQU1ULFFBQVEsQ0FBQ1EsUUFBRCxFQUFXLE1BQVgsQ0FBM0I7O0FBQ0EsWUFBTUUsSUFBSSxHQUFHQyxjQUFNQyxLQUFOLENBQVlILElBQUksQ0FBQ0ksUUFBTCxFQUFaLENBQWI7O0FBQ0EsYUFBT0gsSUFBUDtBQUNELEtBSkQsQ0FJRSxPQUFNSSxHQUFOLEVBQVc7QUFDWEMsTUFBQUEsT0FBTyxDQUFDQyxHQUFSLENBQVksVUFBWixFQUF3QkYsR0FBeEI7QUFDRDtBQUNGLEdBVFE7O0FBV1Q7QUFDQSxRQUFNRyxLQUFOLENBQVlULFFBQVosRUFBc0JDLElBQXRCLEVBQTRCUyxNQUFNLEdBQUcsSUFBckMsRUFBMkM7QUFDekMsUUFBSTtBQUNGLFVBQUlmLEtBQUssQ0FBQ0ssUUFBRCxDQUFMLEtBQW9CLElBQXhCLEVBQThCO0FBQzVCLFlBQUlILE9BQUosRUFBYTtBQUNYVSxVQUFBQSxPQUFPLENBQUNDLEdBQVIsQ0FBYSxzQkFBcUJSLFFBQVMsRUFBM0M7QUFDRDs7QUFFREosUUFBQUEsVUFBVSxDQUFDSSxRQUFELENBQVYsR0FBdUJDLElBQXZCLENBTDRCLENBTTVCO0FBQ0E7O0FBQ0EsZUFBT1UsT0FBTyxDQUFDQyxPQUFSLEVBQVA7QUFDRCxPQVRELE1BU087QUFDTGpCLFFBQUFBLEtBQUssQ0FBQ0ssUUFBRCxDQUFMLEdBQWtCLElBQWxCOztBQUVBLFlBQUlILE9BQUosRUFBYTtBQUNYVSxVQUFBQSxPQUFPLENBQUNDLEdBQVIsQ0FBYSx1QkFBc0JLLGNBQUtDLE9BQUwsQ0FBYWQsUUFBYixDQUF1QixFQUExRDtBQUNBTyxVQUFBQSxPQUFPLENBQUNDLEdBQVIsQ0FBYSxzQkFBcUJSLFFBQVMsRUFBM0M7QUFDRCxTQU5JLENBUUw7OztBQUNBLGNBQU0scUJBQU9hLGNBQUtDLE9BQUwsQ0FBYWQsUUFBYixDQUFQLENBQU4sQ0FUSyxDQVVMOztBQUNBLGNBQU1FLElBQUksR0FBR1EsTUFBTSxHQUFHUCxjQUFNWSxTQUFOLENBQWdCZCxJQUFoQixFQUFzQixJQUF0QixFQUE0QixDQUE1QixDQUFILEdBQW9DRSxjQUFNWSxTQUFOLENBQWdCZCxJQUFoQixDQUF2RDtBQUVBLGNBQU1YLFNBQVMsQ0FBQ1UsUUFBRCxFQUFXRSxJQUFYLEVBQWlCLE1BQWpCLENBQWY7QUFFQVAsUUFBQUEsS0FBSyxDQUFDSyxRQUFELENBQUwsR0FBa0IsS0FBbEI7O0FBRUEsWUFBSUosVUFBVSxDQUFDSSxRQUFELENBQWQsRUFBMEI7QUFDeEIsY0FBSUgsT0FBSixFQUFhO0FBQ1hVLFlBQUFBLE9BQU8sQ0FBQ0MsR0FBUixDQUFhLHNCQUFxQlIsUUFBUyxFQUEzQztBQUNEOztBQUVELGdCQUFNQyxJQUFJLEdBQUdMLFVBQVUsQ0FBQ0ksUUFBRCxDQUF2QjtBQUNBLGlCQUFPSixVQUFVLENBQUNJLFFBQUQsQ0FBakI7QUFDQSxnQkFBTSxLQUFLUyxLQUFMLENBQVdULFFBQVgsRUFBcUJDLElBQXJCLENBQU47QUFDRDtBQUNGO0FBQ0YsS0FyQ0QsQ0FxQ0UsT0FBTUssR0FBTixFQUFXO0FBQ1hDLE1BQUFBLE9BQU8sQ0FBQ0MsR0FBUixDQUFZLFdBQVosRUFBeUJGLEdBQXpCO0FBQ0Q7QUFDRixHQXJEUTs7QUF1RFQsUUFBTVUsTUFBTixDQUFhaEIsUUFBYixFQUF1QjtBQUNyQixRQUFJO0FBQ0YsWUFBTVAsTUFBTSxDQUFDTyxRQUFELENBQVo7QUFDRCxLQUZELENBRUUsT0FBTU0sR0FBTixFQUFXO0FBQ1hDLE1BQUFBLE9BQU8sQ0FBQ0MsR0FBUixDQUFZLFlBQVosRUFBMEJGLEdBQTFCO0FBQ0Q7QUFDRjs7QUE3RFEsQ0FBWDtlQWdFZVIsRSIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCBmcyBmcm9tICdmcyc7XG5pbXBvcnQgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCB7IHByb21pc2lmeSB9IGZyb20gJ3V0aWwnO1xuaW1wb3J0IEpTT041IGZyb20gJ2pzb241JztcbmltcG9ydCByaW1yYWYgZnJvbSAncmltcmFmJztcbmltcG9ydCBta2RpcnAgZnJvbSAnbWtkaXJwJztcblxuY29uc3Qgd3JpdGVGaWxlID0gcHJvbWlzaWZ5KGZzLndyaXRlRmlsZSk7XG5jb25zdCByZWFkRmlsZSA9IHByb21pc2lmeShmcy5yZWFkRmlsZSk7XG5jb25zdCB1bmxpbmsgPSBwcm9taXNpZnkocmltcmFmKTtcblxuY29uc3QgbG9ja3MgPSB7fTtcbmNvbnN0IHdyaXRlUXVldWUgPSB7fTtcblxuY29uc3QgVkVSQk9TRSA9IGZhbHNlO1xuXG5jb25zdCBkYiA9IHtcbiAgYXN5bmMgcmVhZChmdWxscGF0aCkge1xuICAgIHRyeSB7XG4gICAgICBjb25zdCBkYXRhID0gYXdhaXQgcmVhZEZpbGUoZnVsbHBhdGgsICd1dGY4Jyk7XG4gICAgICBjb25zdCBqc29uID0gSlNPTjUucGFyc2UoZGF0YS50b1N0cmluZygpKTtcbiAgICAgIHJldHVybiBqc29uO1xuICAgIH0gY2F0Y2goZXJyKSB7XG4gICAgICBjb25zb2xlLmxvZygnZGI6OnJlYWQnLCBlcnIpO1xuICAgIH1cbiAgfSxcblxuICAvLyBAdG9kbyAtIHdlIG5lZWQgdG8gcXVldWUgd3JpdGUgY2FsbHMgYmVjYXVzZSBpdCBjYW4gbGVhZCB0byBmaWxlIGNvcnJ1cHRpb25cbiAgYXN5bmMgd3JpdGUoZnVsbHBhdGgsIGRhdGEsIGZvcm1hdCA9IHRydWUpIHtcbiAgICB0cnkge1xuICAgICAgaWYgKGxvY2tzW2Z1bGxwYXRoXSA9PT0gdHJ1ZSkge1xuICAgICAgICBpZiAoVkVSQk9TRSkge1xuICAgICAgICAgIGNvbnNvbGUubG9nKGBbZGIud3JpdGVdIGVucXVldWUgJHtmdWxscGF0aH1gKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHdyaXRlUXVldWVbZnVsbHBhdGhdID0gZGF0YTtcbiAgICAgICAgLy8gQHRvZG8gLSB0aGlzIGlzIG5vdCBjbGVhbiwgYXMgaXQgd2lsbCByZXNvbHZlIGJlZm9yZSB0aGUgZmlyc3RcbiAgICAgICAgLy8gd3JpdGUgZW5kcy4uLiB0aGlzIHNob3VsZCBiZSBoYW5kbGVkIHByb3Blcmx5XG4gICAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGxvY2tzW2Z1bGxwYXRoXSA9IHRydWU7XG5cbiAgICAgICAgaWYgKFZFUkJPU0UpIHtcbiAgICAgICAgICBjb25zb2xlLmxvZyhgW2RiLndyaXRlXSBlbnN1cmluZyAke3BhdGguZGlybmFtZShmdWxscGF0aCl9YCk7XG4gICAgICAgICAgY29uc29sZS5sb2coYFtkYi53cml0ZV0gd3JpdGluZyAke2Z1bGxwYXRofWApO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gY3JlYXRlIGRpcmVjdG9yeSBpZiBub3QgZXhpc3RzXG4gICAgICAgIGF3YWl0IG1rZGlycChwYXRoLmRpcm5hbWUoZnVsbHBhdGgpKTtcbiAgICAgICAgLy8gd3JpdGUgdGhlIGZpbGVcbiAgICAgICAgY29uc3QganNvbiA9IGZvcm1hdCA/IEpTT041LnN0cmluZ2lmeShkYXRhLCBudWxsLCAyKSA6IEpTT041LnN0cmluZ2lmeShkYXRhKTtcblxuICAgICAgICBhd2FpdCB3cml0ZUZpbGUoZnVsbHBhdGgsIGpzb24sICd1dGY4Jyk7XG5cbiAgICAgICAgbG9ja3NbZnVsbHBhdGhdID0gZmFsc2U7XG5cbiAgICAgICAgaWYgKHdyaXRlUXVldWVbZnVsbHBhdGhdKSB7XG4gICAgICAgICAgaWYgKFZFUkJPU0UpIHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbZGIud3JpdGVdIGRlcXVldWUgJHtmdWxscGF0aH1gKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBjb25zdCBkYXRhID0gd3JpdGVRdWV1ZVtmdWxscGF0aF07XG4gICAgICAgICAgZGVsZXRlIHdyaXRlUXVldWVbZnVsbHBhdGhdO1xuICAgICAgICAgIGF3YWl0IHRoaXMud3JpdGUoZnVsbHBhdGgsIGRhdGEpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBjYXRjaChlcnIpIHtcbiAgICAgIGNvbnNvbGUubG9nKCdkYjo6d3JpdGUnLCBlcnIpO1xuICAgIH1cbiAgfSxcblxuICBhc3luYyBkZWxldGUoZnVsbHBhdGgpIHtcbiAgICB0cnkge1xuICAgICAgYXdhaXQgdW5saW5rKGZ1bGxwYXRoKTtcbiAgICB9IGNhdGNoKGVycikge1xuICAgICAgY29uc29sZS5sb2coJ2RiOjpkZWxldGUnLCBlcnIpO1xuICAgIH1cbiAgfSxcbn07XG5cbmV4cG9ydCBkZWZhdWx0IGRiO1xuIl19