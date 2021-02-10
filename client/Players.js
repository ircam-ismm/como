"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _Player = _interopRequireDefault(require("./Player.js"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

class Players {
  constructor(como) {
    this.como = como; // this._list = new Map();
  }

  observe(callback) {
    return this.como.client.stateManager.observe((schemaName, stateId, nodeId) => {
      if (schemaName === 'player') {
        callback(stateId, nodeId);
      }
    });
  }

  async create(playerId) {
    if (playerId === null) {
      throw new Error(`project.createPlayer(playerId) - "id" is mandatory and should be unique`);
    }

    const playerState = await this.como.client.stateManager.create('player', {
      id: playerId
    });
    await playerState.set({
      stateId: playerState.id,
      nodeId: this.como.client.id
    });
    const player = new _Player.default(playerState);
    return player;
  }

  async attach(stateId) {
    const playerState = await this.como.client.stateManager.attach('player', stateId);
    const playerId = playerState.get('id'); // playerState.onDetach(() => this._list.delete(playerId));
    // this._list.set(playerId, player);

    const player = new _Player.default(playerState);
    return player;
  }

}

var _default = Players;
exports.default = _default;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9jbGllbnQvUGxheWVycy5qcyJdLCJuYW1lcyI6WyJQbGF5ZXJzIiwiY29uc3RydWN0b3IiLCJjb21vIiwib2JzZXJ2ZSIsImNhbGxiYWNrIiwiY2xpZW50Iiwic3RhdGVNYW5hZ2VyIiwic2NoZW1hTmFtZSIsInN0YXRlSWQiLCJub2RlSWQiLCJjcmVhdGUiLCJwbGF5ZXJJZCIsIkVycm9yIiwicGxheWVyU3RhdGUiLCJpZCIsInNldCIsInBsYXllciIsIlBsYXllciIsImF0dGFjaCIsImdldCJdLCJtYXBwaW5ncyI6Ijs7Ozs7OztBQUFBOzs7O0FBRUEsTUFBTUEsT0FBTixDQUFjO0FBQ1pDLEVBQUFBLFdBQVcsQ0FBQ0MsSUFBRCxFQUFPO0FBQ2hCLFNBQUtBLElBQUwsR0FBWUEsSUFBWixDQURnQixDQUVoQjtBQUNEOztBQUVEQyxFQUFBQSxPQUFPLENBQUNDLFFBQUQsRUFBVztBQUNoQixXQUFPLEtBQUtGLElBQUwsQ0FBVUcsTUFBVixDQUFpQkMsWUFBakIsQ0FBOEJILE9BQTlCLENBQXNDLENBQUNJLFVBQUQsRUFBYUMsT0FBYixFQUFzQkMsTUFBdEIsS0FBaUM7QUFDNUUsVUFBSUYsVUFBVSxLQUFLLFFBQW5CLEVBQTZCO0FBQzNCSCxRQUFBQSxRQUFRLENBQUNJLE9BQUQsRUFBVUMsTUFBVixDQUFSO0FBQ0Q7QUFDRixLQUpNLENBQVA7QUFLRDs7QUFFVyxRQUFOQyxNQUFNLENBQUNDLFFBQUQsRUFBVztBQUNyQixRQUFJQSxRQUFRLEtBQUssSUFBakIsRUFBdUI7QUFDckIsWUFBTSxJQUFJQyxLQUFKLENBQVcseUVBQVgsQ0FBTjtBQUNEOztBQUVELFVBQU1DLFdBQVcsR0FBRyxNQUFNLEtBQUtYLElBQUwsQ0FBVUcsTUFBVixDQUFpQkMsWUFBakIsQ0FBOEJJLE1BQTlCLENBQXFDLFFBQXJDLEVBQStDO0FBQUVJLE1BQUFBLEVBQUUsRUFBRUg7QUFBTixLQUEvQyxDQUExQjtBQUNBLFVBQU1FLFdBQVcsQ0FBQ0UsR0FBWixDQUFnQjtBQUFFUCxNQUFBQSxPQUFPLEVBQUVLLFdBQVcsQ0FBQ0MsRUFBdkI7QUFBMkJMLE1BQUFBLE1BQU0sRUFBRSxLQUFLUCxJQUFMLENBQVVHLE1BQVYsQ0FBaUJTO0FBQXBELEtBQWhCLENBQU47QUFFQSxVQUFNRSxNQUFNLEdBQUcsSUFBSUMsZUFBSixDQUFXSixXQUFYLENBQWY7QUFFQSxXQUFPRyxNQUFQO0FBQ0Q7O0FBRVcsUUFBTkUsTUFBTSxDQUFDVixPQUFELEVBQVU7QUFDcEIsVUFBTUssV0FBVyxHQUFHLE1BQU0sS0FBS1gsSUFBTCxDQUFVRyxNQUFWLENBQWlCQyxZQUFqQixDQUE4QlksTUFBOUIsQ0FBcUMsUUFBckMsRUFBK0NWLE9BQS9DLENBQTFCO0FBQ0EsVUFBTUcsUUFBUSxHQUFHRSxXQUFXLENBQUNNLEdBQVosQ0FBZ0IsSUFBaEIsQ0FBakIsQ0FGb0IsQ0FJcEI7QUFDQTs7QUFDQSxVQUFNSCxNQUFNLEdBQUcsSUFBSUMsZUFBSixDQUFXSixXQUFYLENBQWY7QUFFQSxXQUFPRyxNQUFQO0FBQ0Q7O0FBcENXOztlQXVDQ2hCLE8iLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgUGxheWVyIGZyb20gJy4vUGxheWVyLmpzJztcblxuY2xhc3MgUGxheWVycyB7XG4gIGNvbnN0cnVjdG9yKGNvbW8pIHtcbiAgICB0aGlzLmNvbW8gPSBjb21vO1xuICAgIC8vIHRoaXMuX2xpc3QgPSBuZXcgTWFwKCk7XG4gIH1cblxuICBvYnNlcnZlKGNhbGxiYWNrKSB7XG4gICAgcmV0dXJuIHRoaXMuY29tby5jbGllbnQuc3RhdGVNYW5hZ2VyLm9ic2VydmUoKHNjaGVtYU5hbWUsIHN0YXRlSWQsIG5vZGVJZCkgPT4ge1xuICAgICAgaWYgKHNjaGVtYU5hbWUgPT09ICdwbGF5ZXInKSB7XG4gICAgICAgIGNhbGxiYWNrKHN0YXRlSWQsIG5vZGVJZCk7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICBhc3luYyBjcmVhdGUocGxheWVySWQpIHtcbiAgICBpZiAocGxheWVySWQgPT09IG51bGwpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgcHJvamVjdC5jcmVhdGVQbGF5ZXIocGxheWVySWQpIC0gXCJpZFwiIGlzIG1hbmRhdG9yeSBhbmQgc2hvdWxkIGJlIHVuaXF1ZWApO1xuICAgIH1cblxuICAgIGNvbnN0IHBsYXllclN0YXRlID0gYXdhaXQgdGhpcy5jb21vLmNsaWVudC5zdGF0ZU1hbmFnZXIuY3JlYXRlKCdwbGF5ZXInLCB7IGlkOiBwbGF5ZXJJZCB9KTtcbiAgICBhd2FpdCBwbGF5ZXJTdGF0ZS5zZXQoeyBzdGF0ZUlkOiBwbGF5ZXJTdGF0ZS5pZCwgbm9kZUlkOiB0aGlzLmNvbW8uY2xpZW50LmlkIH0pO1xuXG4gICAgY29uc3QgcGxheWVyID0gbmV3IFBsYXllcihwbGF5ZXJTdGF0ZSk7XG5cbiAgICByZXR1cm4gcGxheWVyO1xuICB9XG5cbiAgYXN5bmMgYXR0YWNoKHN0YXRlSWQpIHtcbiAgICBjb25zdCBwbGF5ZXJTdGF0ZSA9IGF3YWl0IHRoaXMuY29tby5jbGllbnQuc3RhdGVNYW5hZ2VyLmF0dGFjaCgncGxheWVyJywgc3RhdGVJZCk7XG4gICAgY29uc3QgcGxheWVySWQgPSBwbGF5ZXJTdGF0ZS5nZXQoJ2lkJyk7XG5cbiAgICAvLyBwbGF5ZXJTdGF0ZS5vbkRldGFjaCgoKSA9PiB0aGlzLl9saXN0LmRlbGV0ZShwbGF5ZXJJZCkpO1xuICAgIC8vIHRoaXMuX2xpc3Quc2V0KHBsYXllcklkLCBwbGF5ZXIpO1xuICAgIGNvbnN0IHBsYXllciA9IG5ldyBQbGF5ZXIocGxheWVyU3RhdGUpO1xuXG4gICAgcmV0dXJuIHBsYXllcjtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBQbGF5ZXJzO1xuIl19