import {
  GainNode,
} from 'isomorphic-web-audio-api';
import {
  isString,
  decibelToLinear,
} from '@ircam/sc-utils';

import ComoComponent from '../../core/ComoComponent.js';

export default class SessionManager extends ComoComponent {
  #sessions;
  #sessionAudioRouting = new Map(); // <uuid, { mute: GainNode, volume: GainNode }>

  constructor(como, name) {
    super(como, name);

    if (!this.como.soundbankManager) {
      throw new Error(`Cannot construct PlayerManager: relies on 'como.soundbankManager'`);
    }
  }

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
   * Return the session.
   *
   * @param {string} sessionId - Id of the session
   * @returns GainNode|null - return null if session does not exists
   */
  getSession(sessionId) {
    const session = this.#sessions.find(session => session.get('uuid') === sessionId);

    if (!session) {
      return null;
    }

    return session;
  }

  /**
   * Return the session audio bus.
   *
   * The audio bus is lazily created on first call of this function.
   *
   * @param {string} sessionId - Id of the session
   * @returns GainNode|null - return null if session does not exists
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

  async getSessionSoundbank(sessionId) {
    const session = this.getSession(sessionId);

    if (!session) {
      return null;
    }

    const sessionSoundbank = session.get('soundbank');

    return await this.como.soundbankManager.getBuffers(sessionSoundbank);
  }

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

  async persistSession(sessionId) {
    if (!isString(sessionId)) {
      throw new Error('Cannot execute "persistSession" on "SessionManager": argument 0 (sessionId) is not a string');
    }

    return this.como.requestRfc(this.como.constants.SERVER_ID, `${this.name}:persistSession`, { sessionId });
  }

  async renameSession(sessionId, newName) {
    if (!isString(sessionId)) {
      throw new Error('Cannot execute "renameSession" on "SessionManager": argument 0 (sessionId) is not a string');
    }

    if (!isString(newName)) {
      throw new Error('Cannot execute "renameSession" on "SessionManager": argument 1 (newName) is not a string');
    }

    return this.como.requestRfc(this.como.constants.SERVER_ID, `${this.name}:renameSession`, { sessionId, newName });
  }

  async deleteSession(sessionId) {
    if (!isString(sessionId)) {
      throw new Error('Cannot execute "deleteSession" on "SessionManager": argument 0 (sessionId) is not a string');
    }

    return this.como.requestRfc(this.como.constants.SERVER_ID, `${this.name}:deleteSession`, { sessionId });
  }
}
