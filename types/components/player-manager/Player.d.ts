export default Player;
/**
 * The `Player` class represents a full-featured player instance defined as a link
 * between a {@link ComoSource} and a {@link ComoScript}.
 *
 * A player is always instantiated on a given {@ComoNode}, although it si possible to
 * create a mirror of a Player on a different node.
 */
declare class Player {
    /**
     * @hideconstructor
     * @param {*} como
     * @param {*} sourceId
     */
    constructor(como: any, sourceId: any, id?: any);
    /**
     * Id of the player
     * @type {String}
     */
    get id(): string;
    /**
     * Id of the como node
     * @type {String}
     */
    get nodeId(): string;
    /**
     * Source of the player
     * @type {SharedState}
     */
    get source(): SharedState;
    /**
     * Underlying state of the player.
     * @type {SharedState}
     */
    get state(): SharedState;
    /** @private */
    private init;
    /**
     * Delete the player
     */
    delete(): Promise<void>;
    /**
     * Set the script associated to this player
     * @param {String} [scriptName=null] - Name of the script. If null just exit
     *  from current script.
     */
    setScript(scriptName?: string): Promise<void>;
    #private;
}
//# sourceMappingURL=Player.d.ts.map