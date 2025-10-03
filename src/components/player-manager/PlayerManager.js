import {
  isString,
} from '@ircam/sc-utils';

import ComoComponent from '../../core/ComoComponent.js';
import Player from './Player.js';

export default class PlayerManager extends ComoComponent {
  #ownedPlayers = new Set();
  #players; // collection of player states

  constructor(como, name) {
    super(como, name);

    if (!this.como.sourceManager) {
      throw new Error(`Cannot construct PlayerManager: relies on 'como.sourceManager'`);
    }

    if (!this.como.scriptManager) {
      throw new Error(`Cannot construct PlayerManager: relies on 'como.scriptManager'`);
    }

    this.como.setRfcHandler(`${this.name}:createPlayer`, this.#createPlayer);
  }

  get players() {
    return this.#players;
  }

  async start() {
    await super.start();

    this.#players = await this.como.stateManager.getCollection(`${this.name}:player`);
  }

  playerExists(playerId) {
    return !!this.players.find(player => player.get('id') === playerId);
  }

    // attach to exiting script shared state, if any, rather than creating a new instance
  async getPlayer(playerId) {
    if (!isString(playerId)) {
      throw new Error(`Cannot execute "getPlayer" on PlayerManager: argument 1 ("${playerId}") is not a string`);
    }

    const owned = Array.from(this.#ownedPlayers).find(player => player.id === playerId);

    if (owned) {
      return owned;
    }

    const notOwned = this.players.find(player => player.get('id') === playerId);

    if (notOwned) {
      const player = new Player(this.como, notOwned.get('sourceId'), notOwned.get('script'));
      await player.init(notOwned); // init with attached state from the collection
      return player;
    }

    return null;
  }

  async getScriptSharedState(playerId) {
    const player = this.players.find(player => player.get('id') === playerId);

    if (!player) {
      throw new Error(`Cannot execute "getScriptSharedState" on PlayerManager: player (${playerId}) does not exist`);
    }

    const scriptSharedStateClassName = player.get('scriptSharedStateClassName');
    const scriptSharedStateId = player.get('scriptSharedStateId');

    if (scriptSharedStateClassName !== null) {
      const scriptState = await this.como.stateManager.attach(
        scriptSharedStateClassName,
        scriptSharedStateId
      );

      return scriptState;
    }

    return null;
  }

  async createPlayer(sourceId, scriptName = null, nodeId = this.como.nodeId) {
    if (!this.como.sourceManager.sourceExists(sourceId)) {
      throw new Error(`Cannot execute "createPlayer" on PlayerManager: source with id ("${sourceId}") does not exists`);
    }

    return await this.como.requestRfc(nodeId, `${this.name}:createPlayer`, {
      sourceId,
      scriptName,
    });
  }

  #createPlayer = async ({ sourceId, scriptName }) => {
    const player = new Player(this.como, sourceId, scriptName);
    await player.init();

    this.#ownedPlayers.add(player);

    return player.id;
  }

  async deletePlayer(playerId) {

  }
}
