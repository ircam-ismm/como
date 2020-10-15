import Player from './Player.js';

class Players {
  constructor(como) {
    this.como = como;
    // this._list = new Map();
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

    const playerState = await this.como.client.stateManager.create('player', { id: playerId });
    await playerState.set({ stateId: playerState.id, nodeId: this.como.client.id });

    const player = new Player(playerState);

    return player;
  }

  async attach(stateId) {
    const playerState = await this.como.client.stateManager.attach('player', stateId);
    const playerId = playerState.get('id');

    // playerState.onDetach(() => this._list.delete(playerId));
    // this._list.set(playerId, player);
    const player = new Player(playerState);

    return player;
  }
}

export default Players;
