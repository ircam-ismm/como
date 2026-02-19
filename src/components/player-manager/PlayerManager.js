import {
  isString,
} from '@ircam/sc-utils';

import ComoComponent from '../../core/ComoComponent.js';
import Player from './Player.js';

/**
 * The PlayerManager is responsible for the management of the players, which are
 * themselves defined as a link between a {@link ComoSource} and a {@link ComoScript}.
 *
 * The player manager gives access to the list of existing players, can create
 * full featured Player or mirrors of existing one (i.e. duplicate a player instance
 * on another node of the network)
 *
 * @see {@link Player}
 */
class PlayerManager extends ComoComponent {
  #ownedPlayers = new Set();
  #players; // collection of player states

  /**
   * @hideconstructor
   * @param {ComoNode} como
   * @param {String} name
   */
  constructor(como, name) {
    super(como, name);

    if (!this.como.sourceManager) {
      throw new Error(`Cannot construct PlayerManager: relies on 'como.sourceManager'`);
    }

    if (!this.como.scriptManager) {
      throw new Error(`Cannot construct PlayerManager: relies on 'como.scriptManager'`);
    }

    if (!this.como.sessionManager) {
      throw new Error(`Cannot construct PlayerManager: relies on 'como.sessionManager'`);
    }

    this.como.setRfcHandler(`${this.name}:createPlayer`, this.#createPlayer);
  }

  /**
   * The living collection of all players underlying shared states.
   *
   * @return {SharedStateCollection}
   */
  get players() {
    return this.#players;
  }

  /** @private */
  async start() {
    await super.start();

    this.#players = await this.como.stateManager.getCollection(`${this.name}:player`);
  }

  /**
   * Returns wether the player exists on the network
   *
   * @param {String} playerId
   * @returns {Boolean}
   */
  playerExists(playerId) {
    return !!this.players.find(player => player.get('id') === playerId);
  }

  /**
   * Create a player on a given {@link ComoNode}.
   *
   * @param {String} sourceId - Id of the source
   * @param {String} [scriptName=null] - Optional script name to load
   * @param {String} [nodeId=this.como.nodeId] - Optional id of the {@link ComoNode} where
   *  the player should be created, defaults to the node where the function is called
   * @returns {String} Id of the player
   */
  async createPlayer(sourceId, scriptName = null, nodeId = this.como.nodeId) {
    if (!this.como.sourceManager.sourceExists(sourceId)) {
      throw new Error(`Cannot execute "createPlayer" on PlayerManager: source with id ("${sourceId}") does not exists`);
    }

    return await this.como.requestRfc(nodeId, `${this.name}:createPlayer`, {
      sourceId,
      scriptName,
    });
  }

  /** @private */
  #createPlayer = async ({ sourceId, scriptName }) => {
    const player = new Player(this.como, sourceId, scriptName);
    await player.init();

    this.#ownedPlayers.add(player);

    return player.id;
  }

  /** @todo */
  async deletePlayer(playerId) {

  }

      // attach to exiting script shared state, if any, rather than creating a new instance
  /**
   * Get the full {@link Player} API access of a given player.
   *
   * If called on another {@link ComoNode}, ``getPlayerthis`` basically creates
   * a clone of the original player. Useful for example to duplicate the audio
   * of a node on another node.
   *
   * @param {String} playerId
   * @returns {Player|null}
   */
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
      const player = new Player(this.como, notOwned.get('sourceId'));
      await player.init(notOwned); // init with attached state from the collection
      return player;
    }

    return null;
  }

  /**
   * Get the underlying state of a player without the full {{@link Player} logic
   * and behavior.
   *
   * @param {String} playerId
   * @returns {Player|null}
   */
  async getPlayerState(playerId) {
    const player = this.players.find(player => player.get('id') === playerId);
    return player || null;
  }

  /**
   * Return the SharedState associated to the script assigned to the given player.
   *
   * Return null if the player is not associated to a script, or if the associated
   * script does not define a shared state.
   *
   * @param {String} playerId
   * @returns {SharedState|null}
   */
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

}

export default PlayerManager;
