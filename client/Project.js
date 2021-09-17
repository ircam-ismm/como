"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _Sessions = _interopRequireDefault(require("./Sessions.js"));

var _Players = _interopRequireDefault(require("./Players.js"));

var _Graph = _interopRequireDefault(require("../common/Graph.js"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

class Project {
  constructor(como) {
    this.como = como;
  }

  async init() {
    this.state = await this.como.client.stateManager.attach('project');
    this.players = new _Players.default(this.como);
    this.sessions = new _Sessions.default(this.como);

    if (this.state.get('preloadAudioFiles')) {
      const activeAudioFiles = this.state.get('activeAudioFiles');
      const filesToLoad = {};
      activeAudioFiles.forEach(file => filesToLoad[file.name] = file.url);
      await this.como.experience.plugins['audio-buffer-loader'].load(filesToLoad);
    }
  }

  subscribe(func) {
    const unsubscribe = this.state.subscribe(func);
    return unsubscribe;
  }

  getValues() {
    return this.state.getValues();
  }

  get(name) {
    return this.state.get(name);
  }

  async createSession(sessionName, graphPreset) {
    return new Promise((resolve, reject) => {
      const ackChannel = `como:project:createSession:ack`;
      const errChannel = `como:project:createSession:err`;

      const resolvePromise = value => {
        this.como.client.socket.removeAllListeners(ackChannel);
        this.como.client.socket.removeAllListeners(errChannel);
        resolve(value);
      };

      this.como.client.socket.addListener(ackChannel, resolvePromise);
      this.como.client.socket.addListener(errChannel, err => {
        console.log('project:createSession error', err);
        resolvePromise(null);
      });
      this.como.client.socket.send(`como:project:createSession:req`, sessionName, graphPreset);
    });
  }

  async deleteSession(sessionId) {
    return new Promise((resolve, reject) => {
      const ackChannel = `como:project:deleteSession:ack`;
      const errChannel = `como:project:deleteSession:err`;

      const resolvePromise = value => {
        this.como.client.socket.removeAllListeners(ackChannel);
        this.como.client.socket.removeAllListeners(errChannel);
        resolve(value);
      };

      this.como.client.socket.addListener(ackChannel, resolvePromise);
      this.como.client.socket.addListener(errChannel, err => {
        console.log('project:deleteSession error', err);
        resolvePromise(null);
      });
      this.como.client.socket.send(`como:project:deleteSession:req`, sessionId);
    });
  }

  async createStreamRoute(fromSourceId, toNodeId) {
    return new Promise((resolve, reject) => {
      const ackChannel = `como:routing:createStreamRoute:ack`;
      const errChannel = `como:routing:createStreamRoute:err`;

      const resolvePromise = value => {
        this.como.client.socket.removeAllListeners(ackChannel);
        this.como.client.socket.removeAllListeners(errChannel);
        resolve(value);
      };

      this.como.client.socket.addListener(ackChannel, resolvePromise);
      this.como.client.socket.addListener(errChannel, err => {
        console.log('routing:createStreamRoute error', err);
        resolvePromise(null);
      });
      this.como.client.socket.send(`como:routing:createStreamRoute:req`, fromSourceId, toNodeId);
    });
  }

  async deleteStreamRoute(fromSourceId, toNodeId) {
    return new Promise((resolve, reject) => {
      const ackChannel = `como:routing:deleteStreamRoute:ack`;
      const errChannel = `como:routing:deleteStreamRoute:err`;

      const resolvePromise = value => {
        this.como.client.socket.removeAllListeners(ackChannel);
        this.como.client.socket.removeAllListeners(errChannel);
        resolve(value);
      };

      this.como.client.socket.addListener(ackChannel, resolvePromise);
      this.como.client.socket.addListener(errChannel, err => {
        console.log('routing:deleteStreamRoute error', err);
        resolvePromise(null);
      });
      this.como.client.socket.send(`como:routing:deleteStreamRoute:req`, fromSourceId, toNodeId);
    });
  }

  propagateStreamFrame(frame) {
    this.como.client.socket.sendBinary('stream', frame);
  }
  /**
   * @param {Int} playerId - Id of the player in the como application, the
   *  given `id` should be unique. In most case, the node id
   *  (e.g. soudnworks.client.id) will be a good choice.
   */


  async createPlayer(playerId = null) {
    return this.players.create(playerId);
  }
  /**
   * @note - this API is not a good thing, it prevents to add user / application
   * defined modules
   */


  async createGraph(session, player, slave) {
    const graphDescription = session.get('graph');
    const graph = new _Graph.default(this.como, graphDescription, session, player, slave);
    await graph.init();
    return graph;
  }

}

var _default = Project;
exports.default = _default;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9jbGllbnQvUHJvamVjdC5qcyJdLCJuYW1lcyI6WyJQcm9qZWN0IiwiY29uc3RydWN0b3IiLCJjb21vIiwiaW5pdCIsInN0YXRlIiwiY2xpZW50Iiwic3RhdGVNYW5hZ2VyIiwiYXR0YWNoIiwicGxheWVycyIsIlBsYXllcnMiLCJzZXNzaW9ucyIsIlNlc3Npb25zIiwiZ2V0IiwiYWN0aXZlQXVkaW9GaWxlcyIsImZpbGVzVG9Mb2FkIiwiZm9yRWFjaCIsImZpbGUiLCJuYW1lIiwidXJsIiwiZXhwZXJpZW5jZSIsInBsdWdpbnMiLCJsb2FkIiwic3Vic2NyaWJlIiwiZnVuYyIsInVuc3Vic2NyaWJlIiwiZ2V0VmFsdWVzIiwiY3JlYXRlU2Vzc2lvbiIsInNlc3Npb25OYW1lIiwiZ3JhcGhQcmVzZXQiLCJQcm9taXNlIiwicmVzb2x2ZSIsInJlamVjdCIsImFja0NoYW5uZWwiLCJlcnJDaGFubmVsIiwicmVzb2x2ZVByb21pc2UiLCJ2YWx1ZSIsInNvY2tldCIsInJlbW92ZUFsbExpc3RlbmVycyIsImFkZExpc3RlbmVyIiwiZXJyIiwiY29uc29sZSIsImxvZyIsInNlbmQiLCJkZWxldGVTZXNzaW9uIiwic2Vzc2lvbklkIiwiY3JlYXRlU3RyZWFtUm91dGUiLCJmcm9tU291cmNlSWQiLCJ0b05vZGVJZCIsImRlbGV0ZVN0cmVhbVJvdXRlIiwicHJvcGFnYXRlU3RyZWFtRnJhbWUiLCJmcmFtZSIsInNlbmRCaW5hcnkiLCJjcmVhdGVQbGF5ZXIiLCJwbGF5ZXJJZCIsImNyZWF0ZSIsImNyZWF0ZUdyYXBoIiwic2Vzc2lvbiIsInBsYXllciIsInNsYXZlIiwiZ3JhcGhEZXNjcmlwdGlvbiIsImdyYXBoIiwiR3JhcGgiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7QUFBQTs7QUFDQTs7QUFDQTs7OztBQUVBLE1BQU1BLE9BQU4sQ0FBYztBQUNaQyxFQUFBQSxXQUFXLENBQUNDLElBQUQsRUFBTztBQUNoQixTQUFLQSxJQUFMLEdBQVlBLElBQVo7QUFDRDs7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TCxVQUFwQyxFQUFnRE0sR0FBRyxJQUFJO0FBQ3JEQyxRQUFBQSxPQUFPLENBQUNDLEdBQVIsQ0FBWSxpQ0FBWixFQUErQ0YsR0FBL0M7QUFDQUwsUUFBQUEsY0FBYyxDQUFDLElBQUQsQ0FBZDtBQUNELE9BSEQ7QUFLQSxXQUFLaEMsSUFBTCxDQUFVRyxNQUFWLENBQWlCK0IsTUFBakIsQ0FBd0JNLElBQXhCLENBQThCLG9DQUE5QixFQUFtRUksWUFBbkUsRUFBaUZDLFFBQWpGO0FBQ0QsS0FqQk0sQ0FBUDtBQWtCRDs7QUFFREUsRUFBQUEsb0JBQW9CLENBQUNDLEtBQUQsRUFBUTtBQUMxQixTQUFLaEQsSUFBTCxDQUFVRyxNQUFWLENBQWlCK0IsTUFBakIsQ0FBd0JlLFVBQXhCLENBQW1DLFFBQW5DLEVBQTZDRCxLQUE3QztBQUNEO0FBRUQ7QUFDRjtBQUNBO0FBQ0E7QUFDQTs7O0FBQ29CLFFBQVpFLFlBQVksQ0FBQ0MsUUFBUSxHQUFHLElBQVosRUFBa0I7QUFDbEMsV0FBTyxLQUFLN0MsT0FBTCxDQUFhOEMsTUFBYixDQUFvQkQsUUFBcEIsQ0FBUDtBQUNEO0FBRUQ7QUFDRjtBQUNBO0FBQ0E7OztBQUNtQixRQUFYRSxXQUFXLENBQUNDLE9BQUQsRUFBVUMsTUFBVixFQUFrQkMsS0FBbEIsRUFBeUI7QUFDeEMsVUFBTUMsZ0JBQWdCLEdBQUdILE9BQU8sQ0FBQzVDLEdBQVIsQ0FBWSxPQUFaLENBQXpCO0FBQ0EsVUFBTWdELEtBQUssR0FBRyxJQUFJQyxjQUFKLENBQVUsS0FBSzNELElBQWYsRUFBcUJ5RCxnQkFBckIsRUFBdUNILE9BQXZDLEVBQWdEQyxNQUFoRCxFQUF3REMsS0FBeEQsQ0FBZDtBQUNBLFVBQU1FLEtBQUssQ0FBQ3pELElBQU4sRUFBTjtBQUVBLFdBQU95RCxLQUFQO0FBQ0Q7O0FBMUlXOztlQTZJQzVELE8iLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgU2Vzc2lvbnMgZnJvbSAnLi9TZXNzaW9ucy5qcyc7XG5pbXBvcnQgUGxheWVycyBmcm9tICcuL1BsYXllcnMuanMnO1xuaW1wb3J0IEdyYXBoIGZyb20gJy4uL2NvbW1vbi9HcmFwaC5qcyc7XG5cbmNsYXNzIFByb2plY3Qge1xuICBjb25zdHJ1Y3Rvcihjb21vKSB7XG4gICAgdGhpcy5jb21vID0gY29tbztcbiAgfVxuXG4gIGFzeW5jIGluaXQoKSB7XG4gICAgdGhpcy5zdGF0ZSA9IGF3YWl0IHRoaXMuY29tby5jbGllbnQuc3RhdGVNYW5hZ2VyLmF0dGFjaCgncHJvamVjdCcpO1xuICAgIHRoaXMucGxheWVycyA9IG5ldyBQbGF5ZXJzKHRoaXMuY29tbyk7XG4gICAgdGhpcy5zZXNzaW9ucyA9IG5ldyBTZXNzaW9ucyh0aGlzLmNvbW8pO1xuXG4gICAgaWYgKHRoaXMuc3RhdGUuZ2V0KCdwcmVsb2FkQXVkaW9GaWxlcycpKSB7XG4gICAgICBjb25zdCBhY3RpdmVBdWRpb0ZpbGVzID0gdGhpcy5zdGF0ZS5nZXQoJ2FjdGl2ZUF1ZGlvRmlsZXMnKTtcbiAgICAgIGNvbnN0IGZpbGVzVG9Mb2FkID0ge307XG4gICAgICBhY3RpdmVBdWRpb0ZpbGVzLmZvckVhY2goZmlsZSA9PiBmaWxlc1RvTG9hZFtmaWxlLm5hbWVdID0gZmlsZS51cmwpO1xuICAgICAgYXdhaXQgdGhpcy5jb21vLmV4cGVyaWVuY2UucGx1Z2luc1snYXVkaW8tYnVmZmVyLWxvYWRlciddLmxvYWQoZmlsZXNUb0xvYWQpO1xuICAgIH1cbiAgfVxuXG4gIHN1YnNjcmliZShmdW5jKSB7XG4gICAgY29uc3QgdW5zdWJzY3JpYmUgPSB0aGlzLnN0YXRlLnN1YnNjcmliZShmdW5jKTtcbiAgICByZXR1cm4gdW5zdWJzY3JpYmU7XG4gIH1cblxuICBnZXRWYWx1ZXMoKSB7XG4gICAgcmV0dXJuIHRoaXMuc3RhdGUuZ2V0VmFsdWVzKCk7XG4gIH1cblxuICBnZXQobmFtZSkge1xuICAgIHJldHVybiB0aGlzLnN0YXRlLmdldChuYW1lKTtcbiAgfVxuXG4gIGFzeW5jIGNyZWF0ZVNlc3Npb24oc2Vzc2lvbk5hbWUsIGdyYXBoUHJlc2V0KSB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgIGNvbnN0IGFja0NoYW5uZWwgPSBgY29tbzpwcm9qZWN0OmNyZWF0ZVNlc3Npb246YWNrYDtcbiAgICAgIGNvbnN0IGVyckNoYW5uZWwgPSBgY29tbzpwcm9qZWN0OmNyZWF0ZVNlc3Npb246ZXJyYDtcblxuICAgICAgY29uc3QgcmVzb2x2ZVByb21pc2UgPSB2YWx1ZSA9PiB7XG4gICAgICAgIHRoaXMuY29tby5jbGllbnQuc29ja2V0LnJlbW92ZUFsbExpc3RlbmVycyhhY2tDaGFubmVsKTtcbiAgICAgICAgdGhpcy5jb21vLmNsaWVudC5zb2NrZXQucmVtb3ZlQWxsTGlzdGVuZXJzKGVyckNoYW5uZWwpO1xuICAgICAgICByZXNvbHZlKHZhbHVlKTtcbiAgICAgIH1cblxuICAgICAgdGhpcy5jb21vLmNsaWVudC5zb2NrZXQuYWRkTGlzdGVuZXIoYWNrQ2hhbm5lbCwgcmVzb2x2ZVByb21pc2UpO1xuICAgICAgdGhpcy5jb21vLmNsaWVudC5zb2NrZXQuYWRkTGlzdGVuZXIoZXJyQ2hhbm5lbCwgZXJyID0+IHtcbiAgICAgICAgY29uc29sZS5sb2coJ3Byb2plY3Q6Y3JlYXRlU2Vzc2lvbiBlcnJvcicsIGVycik7XG4gICAgICAgIHJlc29sdmVQcm9taXNlKG51bGwpO1xuICAgICAgfSk7XG5cbiAgICAgIHRoaXMuY29tby5jbGllbnQuc29ja2V0LnNlbmQoYGNvbW86cHJvamVjdDpjcmVhdGVTZXNzaW9uOnJlcWAsIHNlc3Npb25OYW1lLCBncmFwaFByZXNldCk7XG4gICAgfSk7XG4gIH1cblxuICBhc3luYyBkZWxldGVTZXNzaW9uKHNlc3Npb25JZCkge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICBjb25zdCBhY2tDaGFubmVsID0gYGNvbW86cHJvamVjdDpkZWxldGVTZXNzaW9uOmFja2A7XG4gICAgICBjb25zdCBlcnJDaGFubmVsID0gYGNvbW86cHJvamVjdDpkZWxldGVTZXNzaW9uOmVycmA7XG5cbiAgICAgIGNvbnN0IHJlc29sdmVQcm9taXNlID0gdmFsdWUgPT4ge1xuICAgICAgICB0aGlzLmNvbW8uY2xpZW50LnNvY2tldC5yZW1vdmVBbGxMaXN0ZW5lcnMoYWNrQ2hhbm5lbCk7XG4gICAgICAgIHRoaXMuY29tby5jbGllbnQuc29ja2V0LnJlbW92ZUFsbExpc3RlbmVycyhlcnJDaGFubmVsKTtcbiAgICAgICAgcmVzb2x2ZSh2YWx1ZSk7XG4gICAgICB9XG5cbiAgICAgIHRoaXMuY29tby5jbGllbnQuc29ja2V0LmFkZExpc3RlbmVyKGFja0NoYW5uZWwsIHJlc29sdmVQcm9taXNlKTtcbiAgICAgIHRoaXMuY29tby5jbGllbnQuc29ja2V0LmFkZExpc3RlbmVyKGVyckNoYW5uZWwsIGVyciA9PiB7XG4gICAgICAgIGNvbnNvbGUubG9nKCdwcm9qZWN0OmRlbGV0ZVNlc3Npb24gZXJyb3InLCBlcnIpO1xuICAgICAgICByZXNvbHZlUHJvbWlzZShudWxsKTtcbiAgICAgIH0pO1xuXG4gICAgICB0aGlzLmNvbW8uY2xpZW50LnNvY2tldC5zZW5kKGBjb21vOnByb2plY3Q6ZGVsZXRlU2Vzc2lvbjpyZXFgLCBzZXNzaW9uSWQpO1xuICAgIH0pO1xuICB9XG5cbiAgYXN5bmMgY3JlYXRlU3RyZWFtUm91dGUoZnJvbVNvdXJjZUlkLCB0b05vZGVJZCkge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICBjb25zdCBhY2tDaGFubmVsID0gYGNvbW86cm91dGluZzpjcmVhdGVTdHJlYW1Sb3V0ZTphY2tgO1xuICAgICAgY29uc3QgZXJyQ2hhbm5lbCA9IGBjb21vOnJvdXRpbmc6Y3JlYXRlU3RyZWFtUm91dGU6ZXJyYDtcblxuICAgICAgY29uc3QgcmVzb2x2ZVByb21pc2UgPSB2YWx1ZSA9PiB7XG4gICAgICAgIHRoaXMuY29tby5jbGllbnQuc29ja2V0LnJlbW92ZUFsbExpc3RlbmVycyhhY2tDaGFubmVsKTtcbiAgICAgICAgdGhpcy5jb21vLmNsaWVudC5zb2NrZXQucmVtb3ZlQWxsTGlzdGVuZXJzKGVyckNoYW5uZWwpO1xuICAgICAgICByZXNvbHZlKHZhbHVlKTtcbiAgICAgIH1cblxuICAgICAgdGhpcy5jb21vLmNsaWVudC5zb2NrZXQuYWRkTGlzdGVuZXIoYWNrQ2hhbm5lbCwgcmVzb2x2ZVByb21pc2UpO1xuICAgICAgdGhpcy5jb21vLmNsaWVudC5zb2NrZXQuYWRkTGlzdGVuZXIoZXJyQ2hhbm5lbCwgZXJyID0+IHtcbiAgICAgICAgY29uc29sZS5sb2coJ3JvdXRpbmc6Y3JlYXRlU3RyZWFtUm91dGUgZXJyb3InLCBlcnIpO1xuICAgICAgICByZXNvbHZlUHJvbWlzZShudWxsKTtcbiAgICAgIH0pO1xuXG4gICAgICB0aGlzLmNvbW8uY2xpZW50LnNvY2tldC5zZW5kKGBjb21vOnJvdXRpbmc6Y3JlYXRlU3RyZWFtUm91dGU6cmVxYCwgZnJvbVNvdXJjZUlkLCB0b05vZGVJZCk7XG4gICAgfSk7XG4gIH1cblxuICBhc3luYyBkZWxldGVTdHJlYW1Sb3V0ZShmcm9tU291cmNlSWQsIHRvTm9kZUlkKSB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgIGNvbnN0IGFja0NoYW5uZWwgPSBgY29tbzpyb3V0aW5nOmRlbGV0ZVN0cmVhbVJvdXRlOmFja2A7XG4gICAgICBjb25zdCBlcnJDaGFubmVsID0gYGNvbW86cm91dGluZzpkZWxldGVTdHJlYW1Sb3V0ZTplcnJgO1xuXG4gICAgICBjb25zdCByZXNvbHZlUHJvbWlzZSA9IHZhbHVlID0+IHtcbiAgICAgICAgdGhpcy5jb21vLmNsaWVudC5zb2NrZXQucmVtb3ZlQWxsTGlzdGVuZXJzKGFja0NoYW5uZWwpO1xuICAgICAgICB0aGlzLmNvbW8uY2xpZW50LnNvY2tldC5yZW1vdmVBbGxMaXN0ZW5lcnMoZXJyQ2hhbm5lbCk7XG4gICAgICAgIHJlc29sdmUodmFsdWUpO1xuICAgICAgfVxuXG4gICAgICB0aGlzLmNvbW8uY2xpZW50LnNvY2tldC5hZGRMaXN0ZW5lcihhY2tDaGFubmVsLCByZXNvbHZlUHJvbWlzZSk7XG4gICAgICB0aGlzLmNvbW8uY2xpZW50LnNvY2tldC5hZGRMaXN0ZW5lcihlcnJDaGFubmVsLCBlcnIgPT4ge1xuICAgICAgICBjb25zb2xlLmxvZygncm91dGluZzpkZWxldGVTdHJlYW1Sb3V0ZSBlcnJvcicsIGVycik7XG4gICAgICAgIHJlc29sdmVQcm9taXNlKG51bGwpO1xuICAgICAgfSk7XG5cbiAgICAgIHRoaXMuY29tby5jbGllbnQuc29ja2V0LnNlbmQoYGNvbW86cm91dGluZzpkZWxldGVTdHJlYW1Sb3V0ZTpyZXFgLCBmcm9tU291cmNlSWQsIHRvTm9kZUlkKTtcbiAgICB9KTtcbiAgfVxuXG4gIHByb3BhZ2F0ZVN0cmVhbUZyYW1lKGZyYW1lKSB7XG4gICAgdGhpcy5jb21vLmNsaWVudC5zb2NrZXQuc2VuZEJpbmFyeSgnc3RyZWFtJywgZnJhbWUpXG4gIH1cblxuICAvKipcbiAgICogQHBhcmFtIHtJbnR9IHBsYXllcklkIC0gSWQgb2YgdGhlIHBsYXllciBpbiB0aGUgY29tbyBhcHBsaWNhdGlvbiwgdGhlXG4gICAqICBnaXZlbiBgaWRgIHNob3VsZCBiZSB1bmlxdWUuIEluIG1vc3QgY2FzZSwgdGhlIG5vZGUgaWRcbiAgICogIChlLmcuIHNvdWRud29ya3MuY2xpZW50LmlkKSB3aWxsIGJlIGEgZ29vZCBjaG9pY2UuXG4gICAqL1xuICBhc3luYyBjcmVhdGVQbGF5ZXIocGxheWVySWQgPSBudWxsKSB7XG4gICAgcmV0dXJuIHRoaXMucGxheWVycy5jcmVhdGUocGxheWVySWQpO1xuICB9XG5cbiAgLyoqXG4gICAqIEBub3RlIC0gdGhpcyBBUEkgaXMgbm90IGEgZ29vZCB0aGluZywgaXQgcHJldmVudHMgdG8gYWRkIHVzZXIgLyBhcHBsaWNhdGlvblxuICAgKiBkZWZpbmVkIG1vZHVsZXNcbiAgICovXG4gIGFzeW5jIGNyZWF0ZUdyYXBoKHNlc3Npb24sIHBsYXllciwgc2xhdmUpIHtcbiAgICBjb25zdCBncmFwaERlc2NyaXB0aW9uID0gc2Vzc2lvbi5nZXQoJ2dyYXBoJyk7XG4gICAgY29uc3QgZ3JhcGggPSBuZXcgR3JhcGgodGhpcy5jb21vLCBncmFwaERlc2NyaXB0aW9uLCBzZXNzaW9uLCBwbGF5ZXIsIHNsYXZlKTtcbiAgICBhd2FpdCBncmFwaC5pbml0KCk7XG5cbiAgICByZXR1cm4gZ3JhcGg7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgUHJvamVjdDtcbiJdfQ==