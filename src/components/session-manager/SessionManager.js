import {
  GainNode,
} from 'isomorphic-web-audio-api';
import {
  isString,
  decibelToLinear,
} from '@ircam/sc-utils';

import ComoComponent from '../../core/ComoComponent.js';

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
class SessionManager extends ComoComponent {
  #sessions;
  #sessionAudioRouting = new Map(); // <uuid, { mute: GainNode, volume: GainNode }>

  /**
   * @hideconstructor
   * @param {ComoNode} como
   * @param {String} name
   */
  constructor(como, name) {
    super(como, name);

    if (!this.como.soundbankManager) {
      throw new Error(`Cannot construct PlayerManager: relies on 'como.soundbankManager'`);
    }
  }

  /**
   * SharedStateCollection of all existing sessions
   */
  get sessions() {
    return this.#sessions;
  }

  async start() {
    await super.start();

    this.#sessions = await this.como.stateManager.getCollection(`${this.name}:session`);
    this.#sessions.onUpdate((session, updates) => {
      const sessionId = session.get('uuid');

      if (this.#sessionAudioRouting.has(sessionId)) {
        const { mute, volume } = this.#sessionAudioRouting.get(sessionId);

        for (let [key, value] of Object.entries(updates)) {
          switch (key) {
            case 'mute': {
              const gain = value ? 0 : 1;
              mute.gain.setTargetAtTime(gain, this.como.audioContext.currentTime, 0.01);
              break;
            }
            case 'volume': {
              const gain = decibelToLinear(value);
              volume.gain.setTargetAtTime(gain, this.como.audioContext.currentTime, 0.01);
              break;
            }
            case 'soundbank': {
              // @todo - refresh cache
              break;
            }
          }
        }
      }
    });

    this.#sessions.onDetach(session => {
      const sessionId = session.get('uuid');

      if (this.#sessionAudioRouting.has(sessionId)) {
        const { mute, volume } = this.#sessionAudioRouting.get(sessionId);
        volume.disconnect();
        mute.disconnect();

        this.#sessionAudioRouting.delete(sessionId);
      }
    });
  }

  /**
   * Get a session SharedState from its unique id.
   *
   * @param {string} sessionId - Unique id of the session
   * @returns GainNode|null - returns null if session does not exists
   */
  getSession(sessionId) {
    const session = this.#sessions.find(session => session.get('uuid') === sessionId);

    if (!session) {
      return null;
    }

    return session;
  }

  /**
   * Get the audio destination of a session from its unique id.
   *
   * The audio bus is lazily created on first call of this function on a given node.
   *
   * @param {String} sessionId - Unique id of the session
   * @returns GainNode|null - returns null if session does not exists
   */
  getSessionBus(sessionId) {
    if (this.#sessionAudioRouting.has(sessionId)) {
      const { mute } = this.#sessionAudioRouting.get(sessionId);
      return mute;
    }

    const session = this.getSession(sessionId);

    if (!session) {
      return null;
    }

    const mute = new GainNode(this.como.audioContext, {
      gain: session.get('mute') ? 0 : 1,
    });
    const volume = new GainNode(this.como.audioContext, {
      gain: decibelToLinear(session.get('volume')),
    });

    mute.connect(volume).connect(this.como.audioContext.destination);
    this.#sessionAudioRouting.set(sessionId, { mute, volume });

    return mute;
  }

  /**
   * Get the AudioBuffers associated to the session
   *
   * @param {String} sessionId
   * @returns {Object<String, AudioBuffer>}
   */
  async getSessionSoundbank(sessionId) {
    const session = this.getSession(sessionId);

    if (!session) {
      return null;
    }

    const sessionSoundbank = session.get('soundbank');

    return await this.como.soundbankManager.getBuffers(sessionSoundbank);
  }

  /**
   * Create a new session in the current project
   *
   * @param {String} sessionName - Name of the session
   * @returns {String} Unique id of the new session
   */
  async createSession(sessionName) {
    if (!isString(sessionName)) {
      throw new Error('Cannot execute "createSession" on "SessionManager": argument 0 (sessionName) is not a string');
    }

    const exists = this.#sessions.find(session => session.get('name') === sessionName);

    if (exists) {
      throw new Error(`Cannot execute "createSession" on SessionManager: a session with name ${sessionName} already exists`);
    }

    const sessionId = await this.como.requestRfc(this.como.constants.SERVER_ID, `${this.name}:createSession`, { sessionName });
    // synchronous on server-side
    if (this.getSession(sessionId)) {
      return sessionId;
    } else {
      return new Promise((resolve) => {
        const unsubscribe = this.sessions.onAttach(state => {
          if (state.get('id') === sessionId) {
            unsubscribe();
            resolve(sessionId);
          }
        });
      });
    }
  }

  /**
   * Save the session in the filesystem
   *
   * @param {String} sessionId - Unique id of the session
   */
  async persistSession(sessionId) {
    if (!isString(sessionId)) {
      throw new Error('Cannot execute "persistSession" on "SessionManager": argument 0 (sessionId) is not a string');
    }

    return this.como.requestRfc(this.como.constants.SERVER_ID, `${this.name}:persistSession`, { sessionId });
  }

  /**
   * Change the name of the session
   *
   * @param {String} sessionId - Unique id of the session
   * @param {*} newName - New name of the session
   */
  async renameSession(sessionId, newName) {
    if (!isString(sessionId)) {
      throw new Error('Cannot execute "renameSession" on "SessionManager": argument 0 (sessionId) is not a string');
    }

    if (!isString(newName)) {
      throw new Error('Cannot execute "renameSession" on "SessionManager": argument 1 (newName) is not a string');
    }

    return this.como.requestRfc(this.como.constants.SERVER_ID, `${this.name}:renameSession`, { sessionId, newName });
  }

  /**
   * Delete the session
   * - All players within this session will be removed from it
   * - All associated files will be deleted
   *
   * @param {String} sessionId - Unique id of the session
   */
  async deleteSession(sessionId) {
    if (!isString(sessionId)) {
      throw new Error('Cannot execute "deleteSession" on "SessionManager": argument 0 (sessionId) is not a string');
    }

    return this.como.requestRfc(this.como.constants.SERVER_ID, `${this.name}:deleteSession`, { sessionId });
  }
}

export default SessionManager;
