import {
  GainNode,
} from 'isomorphic-web-audio-api';

import ComoComponent from '../../core/ComoComponent.js';

export default class SessionManager extends ComoComponent {
  #sessions;
  #sessionAudioRouting
  #filesystem;

  constructor(como, name) {
    super(como, name);

    this.
  }

  get sessions() {
    return this.#sessions;
  }

  get filesystem() {
    return this.#filesystem;
  }

  async start() {
    await super.start();

    this.#sessions = await this.como.stateManager.getCollection(`${this.name}:session`);
    this.#sessions.onAttach(({ uuid }) => {

    });
  }

  // sessionExists(sessionName) {
  //   return !!this.getSession(sessionName);
  // }

  getSession(sessionId) {
    return this.#sessions.find(session => session.get('uuid') === sessionId);
  }

  async createSession(sessionName) {
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
    return this.como.requestRfc(this.como.constants.SERVER_ID, `${this.name}:persistSession`, { sessionId });
  }

  async renameSession(sessionId, newName) {
    return this.como.requestRfc(this.como.constants.SERVER_ID, `${this.name}:renameSession`, { sessionId, newName });
  }

  async deleteSession(sessionId) {
    return this.como.requestRfc(this.como.constants.SERVER_ID, `${this.name}:deleteSession`, { sessionId });
  }
}
