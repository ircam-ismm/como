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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9jbGllbnQvUGxheWVycy5qcyJdLCJuYW1lcyI6WyJQbGF5ZXJzIiwiY29uc3RydWN0b3IiLCJjb21vIiwib2JzZXJ2ZSIsImNhbGxiYWNrIiwiY2xpZW50Iiwic3RhdGVNYW5hZ2VyIiwic2NoZW1hTmFtZSIsInN0YXRlSWQiLCJub2RlSWQiLCJjcmVhdGUiLCJwbGF5ZXJJZCIsIkVycm9yIiwicGxheWVyU3RhdGUiLCJpZCIsInNldCIsInBsYXllciIsIlBsYXllciIsImF0dGFjaCIsImdldCJdLCJtYXBwaW5ncyI6Ijs7Ozs7OztBQUFBOzs7O0FBRUEsTUFBTUEsT0FBTixDQUFjO0FBQ1pDLEVBQUFBLFdBQVcsQ0FBQ0MsSUFBRCxFQUFPO0FBQ2hCLFNBQUtBLElBQUwsR0FBWUEsSUFBWixDQURnQixDQUVoQjtBQUNEOztBQUVEQyxFQUFBQSxPQUFPLENBQUNDLFFBQUQsRUFBVztBQUNoQixXQUFPLEtBQUtGLElBQUwsQ0FBVUcsTUFBVixDQUFpQkMsWUFBakIsQ0FBOEJILE9BQTlCLENBQXNDLENBQUNJLFVBQUQsRUFBYUMsT0FBYixFQUFzQkMsTUFBdEIsS0FBaUM7QUFDNUUsVUFBSUYsVUFBVSxLQUFLLFFBQW5CLEVBQTZCO0FBQzNCSCxRQUFBQSxRQUFRLENBQUNJLE9BQUQsRUFBVUMsTUFBVixDQUFSO0FBQ0Q7QUFDRixLQUpNLENBQVA7QUFLRDs7QUFFRCxRQUFNQyxNQUFOLENBQWFDLFFBQWIsRUFBdUI7QUFDckIsUUFBSUEsUUFBUSxLQUFLLElBQWpCLEVBQXVCO0FBQ3JCLFlBQU0sSUFBSUMsS0FBSixDQUFXLHlFQUFYLENBQU47QUFDRDs7QUFFRCxVQUFNQyxXQUFXLEdBQUcsTUFBTSxLQUFLWCxJQUFMLENBQVVHLE1BQVYsQ0FBaUJDLFlBQWpCLENBQThCSSxNQUE5QixDQUFxQyxRQUFyQyxFQUErQztBQUFFSSxNQUFBQSxFQUFFLEVBQUVIO0FBQU4sS0FBL0MsQ0FBMUI7QUFDQSxVQUFNRSxXQUFXLENBQUNFLEdBQVosQ0FBZ0I7QUFBRVAsTUFBQUEsT0FBTyxFQUFFSyxXQUFXLENBQUNDLEVBQXZCO0FBQTJCTCxNQUFBQSxNQUFNLEVBQUUsS0FBS1AsSUFBTCxDQUFVRyxNQUFWLENBQWlCUztBQUFwRCxLQUFoQixDQUFOO0FBRUEsVUFBTUUsTUFBTSxHQUFHLElBQUlDLGVBQUosQ0FBV0osV0FBWCxDQUFmO0FBRUEsV0FBT0csTUFBUDtBQUNEOztBQUVELFFBQU1FLE1BQU4sQ0FBYVYsT0FBYixFQUFzQjtBQUNwQixVQUFNSyxXQUFXLEdBQUcsTUFBTSxLQUFLWCxJQUFMLENBQVVHLE1BQVYsQ0FBaUJDLFlBQWpCLENBQThCWSxNQUE5QixDQUFxQyxRQUFyQyxFQUErQ1YsT0FBL0MsQ0FBMUI7QUFDQSxVQUFNRyxRQUFRLEdBQUdFLFdBQVcsQ0FBQ00sR0FBWixDQUFnQixJQUFoQixDQUFqQixDQUZvQixDQUlwQjtBQUNBOztBQUNBLFVBQU1ILE1BQU0sR0FBRyxJQUFJQyxlQUFKLENBQVdKLFdBQVgsQ0FBZjtBQUVBLFdBQU9HLE1BQVA7QUFDRDs7QUFwQ1c7O2VBdUNDaEIsTyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCBQbGF5ZXIgZnJvbSAnLi9QbGF5ZXIuanMnO1xuXG5jbGFzcyBQbGF5ZXJzIHtcbiAgY29uc3RydWN0b3IoY29tbykge1xuICAgIHRoaXMuY29tbyA9IGNvbW87XG4gICAgLy8gdGhpcy5fbGlzdCA9IG5ldyBNYXAoKTtcbiAgfVxuXG4gIG9ic2VydmUoY2FsbGJhY2spIHtcbiAgICByZXR1cm4gdGhpcy5jb21vLmNsaWVudC5zdGF0ZU1hbmFnZXIub2JzZXJ2ZSgoc2NoZW1hTmFtZSwgc3RhdGVJZCwgbm9kZUlkKSA9PiB7XG4gICAgICBpZiAoc2NoZW1hTmFtZSA9PT0gJ3BsYXllcicpIHtcbiAgICAgICAgY2FsbGJhY2soc3RhdGVJZCwgbm9kZUlkKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIGFzeW5jIGNyZWF0ZShwbGF5ZXJJZCkge1xuICAgIGlmIChwbGF5ZXJJZCA9PT0gbnVsbCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBwcm9qZWN0LmNyZWF0ZVBsYXllcihwbGF5ZXJJZCkgLSBcImlkXCIgaXMgbWFuZGF0b3J5IGFuZCBzaG91bGQgYmUgdW5pcXVlYCk7XG4gICAgfVxuXG4gICAgY29uc3QgcGxheWVyU3RhdGUgPSBhd2FpdCB0aGlzLmNvbW8uY2xpZW50LnN0YXRlTWFuYWdlci5jcmVhdGUoJ3BsYXllcicsIHsgaWQ6IHBsYXllcklkIH0pO1xuICAgIGF3YWl0IHBsYXllclN0YXRlLnNldCh7IHN0YXRlSWQ6IHBsYXllclN0YXRlLmlkLCBub2RlSWQ6IHRoaXMuY29tby5jbGllbnQuaWQgfSk7XG5cbiAgICBjb25zdCBwbGF5ZXIgPSBuZXcgUGxheWVyKHBsYXllclN0YXRlKTtcblxuICAgIHJldHVybiBwbGF5ZXI7XG4gIH1cblxuICBhc3luYyBhdHRhY2goc3RhdGVJZCkge1xuICAgIGNvbnN0IHBsYXllclN0YXRlID0gYXdhaXQgdGhpcy5jb21vLmNsaWVudC5zdGF0ZU1hbmFnZXIuYXR0YWNoKCdwbGF5ZXInLCBzdGF0ZUlkKTtcbiAgICBjb25zdCBwbGF5ZXJJZCA9IHBsYXllclN0YXRlLmdldCgnaWQnKTtcblxuICAgIC8vIHBsYXllclN0YXRlLm9uRGV0YWNoKCgpID0+IHRoaXMuX2xpc3QuZGVsZXRlKHBsYXllcklkKSk7XG4gICAgLy8gdGhpcy5fbGlzdC5zZXQocGxheWVySWQsIHBsYXllcik7XG4gICAgY29uc3QgcGxheWVyID0gbmV3IFBsYXllcihwbGF5ZXJTdGF0ZSk7XG5cbiAgICByZXR1cm4gcGxheWVyO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IFBsYXllcnM7XG4iXX0=