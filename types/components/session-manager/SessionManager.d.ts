export default SessionManager;
/**
 * The SourceManager component is responsible for creating and managing
 * sessions within a project. At its core, a session the association of
 * a script and of a subset of the project soundfiles.
 *
 * Como players can be associated to session.
 *
 * Como sessions are represented as soundworks SharedState defined by the
 * following parameters:
 * - uuid - Unique id, stable across restarts
 * - name - User defined name
 * - defaultScript - The script associated with the session
 * - soundbank - The list of files associated to the session
 * - mute - Whether the audio output is muted
 * - volume - Volume of the audio output of the session
 */
declare class SessionManager extends ComoComponent {
    /**
     * @hideconstructor
     * @param {ComoNode} como
     * @param {String} name
     */
    constructor(como: ComoNode, name: string);
    /**
     * SharedStateCollection of all existing sessions
     */
    get sessions(): any;
    /**
     * Get a session SharedState from its unique id.
     *
     * @param {string} sessionId - Unique id of the session
     * @returns GainNode|null - returns null if session does not exists
     */
    getSession(sessionId: string): any;
    /**
     * Get the audio destination of a session from its unique id.
     *
     * The audio bus is lazily created on first call of this function on a given node.
     *
     * @param {String} sessionId - Unique id of the session
     * @returns GainNode|null - returns null if session does not exists
     */
    getSessionBus(sessionId: string): any;
    /**
     * Get the AudioBuffers associated to the session
     *
     * @param {String} sessionId
     * @returns {Object<String, AudioBuffer>}
     */
    getSessionSoundbank(sessionId: string): any;
    /**
     * Create a new session in the current project
     *
     * @param {String} sessionName - Name of the session
     * @returns {String} Unique id of the new session
     */
    createSession(sessionName: string): string;
    /**
     * Save the session in the filesystem
     *
     * @param {String} sessionId - Unique id of the session
     */
    persistSession(sessionId: string): Promise<any>;
    /**
     * Change the name of the session
     *
     * @param {String} sessionId - Unique id of the session
     * @param {*} newName - New name of the session
     */
    renameSession(sessionId: string, newName: any): Promise<any>;
    /**
     * Delete the session
     * - All players within this session will be removed from it
     * - All associated files will be deleted
     *
     * @param {String} sessionId - Unique id of the session
     */
    deleteSession(sessionId: string): Promise<any>;
    #private;
}
import ComoComponent from '../../core/ComoComponent.js';
//# sourceMappingURL=SessionManager.d.ts.map