
class Players {
  constructor(como) {
    this.como = como;
    this._list = new Map();
  }

  observe(callback) {
    return this.como.client.stateManager.observe((schemaName, stateId, nodeId) => {
      if (schemaName === 'player') {
        callback(stateId, nodeId);
      }
    });
  }

  async attach(stateId) {
    const player = await this.como.client.stateManager.attach('player', stateId);
    const playerId = player.get('id');

    player.onDetach(() => this._list.delete(playerId));
    this._list.set(playerId, player);

    return player;
  }

  // get(playerId) {
  //   return this._list.get(playerId);
  // }
}

export default Players;
