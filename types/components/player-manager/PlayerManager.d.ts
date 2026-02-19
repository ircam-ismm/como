export default PlayerManager;
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
declare class PlayerManager extends ComoComponent {
    /**
     * @hideconstructor
     * @param {ComoNode} como
     * @param {String} name
     */
    constructor(como: ComoNode, name: string);
    /**
     * The living collection of all players underlying shared states.
     *
     * @return {SharedStateCollection}
     */
    get players(): SharedStateCollection;
    /**
     * Returns wether the player exists on the network
     *
     * @param {String} playerId
     * @returns {Boolean}
     */
    playerExists(playerId: string): boolean;
    /**
     * Create a player on a given {@link ComoNode}.
     *
     * @param {String} sourceId - Id of the source
     * @param {String} [scriptName=null] - Optional script name to load
     * @param {String} [nodeId=this.como.nodeId] - Optional id of the {@link ComoNode} where
     *  the player should be created, defaults to the node where the function is called
     * @returns {String} Id of the player
     */
    createPlayer(sourceId: string, scriptName?: string, nodeId?: string): string;
    /** @todo */
    deletePlayer(playerId: any): Promise<void>;
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
    getPlayer(playerId: string): Player | null;
    /**
     * Get the underlying state of a player without the full {{@link Player} logic
     * and behavior.
     *
     * @param {String} playerId
     * @returns {Player|null}
     */
    getPlayerState(playerId: string): Player | null;
    /**
     * Return the SharedState associated to the script assigned to the given player.
     *
     * Return null if the player is not associated to a script, or if the associated
     * script does not define a shared state.
     *
     * @param {String} playerId
     * @returns {SharedState|null}
     */
    getScriptSharedState(playerId: string): SharedState | null;
    #private;
}
import ComoComponent from '../../core/ComoComponent.js';
import Player from './Player.js';
//# sourceMappingURL=PlayerManager.d.ts.map