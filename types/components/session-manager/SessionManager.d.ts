export default class SessionManager extends ComoComponent {
    get sessions(): any;
    /**
     * Return the session.
     *
     * @param {string} sessionId - Id of the session
     * @returns GainNode|null - return null if session does not exists
     */
    getSession(sessionId: string): any;
    /**
     * Return the session audio bus.
     *
     * The audio bus is lazily created on first call of this function.
     *
     * @param {string} sessionId - Id of the session
     * @returns GainNode|null - return null if session does not exists
     */
    getSessionBus(sessionId: string): any;
    getSessionSoundbank(sessionId: any): Promise<any>;
    createSession(sessionName: any): Promise<any>;
    persistSession(sessionId: any): Promise<any>;
    renameSession(sessionId: any, newName: any): Promise<any>;
    deleteSession(sessionId: any): Promise<any>;
    #private;
}
import ComoComponent from '../../core/ComoComponent.js';
//# sourceMappingURL=SessionManager.d.ts.map