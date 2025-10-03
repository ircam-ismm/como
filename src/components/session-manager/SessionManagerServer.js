import path from 'node:path';
import fs from 'node:fs';
import fsPromises from 'node:fs/promises';

import { v4 as uuidv4 } from 'uuid';
import filenamify from 'filenamify';

import SessionManager from './SessionManager.js';
import sessionDescription from './session-description.js';

export default class SessionManagerServer extends SessionManager {
  #currentSessions = new Set();

  constructor(como, name) {
    super(como, name);

    this.como.setRfcHandler(`${this.name}:createSession`, this.#createSession)
    this.como.setRfcHandler(`${this.name}:persistSession`, this.#persistSession)
    this.como.setRfcHandler(`${this.name}:renameSession`, this.#renameSession)
    this.como.setRfcHandler(`${this.name}:deleteSession`, this.#deleteSession)
  }

  async init() {
    await super.init();

    await this.como.stateManager.defineClass(`${this.name}:session`, sessionDescription);
  }

  async start() {
    await super.start();
  }

  async setProject(dirname) {
    // delete all existing states
    for (let session of this.#currentSessions.entries()) {
      await session.delete();
    }

    this.#currentSessions.clear();

    if (dirname !== null) {
      const sessionDirname = path.join(dirname, this.como.constants.PROJECT_SESSIONS_DIRNAME);

      if (!fs.existsSync(sessionDirname)) {
        await fsPromises.mkdir(sessionDirname, { recursive: true });
      }

      const files = await fsPromises.readdir(sessionDirname);
      const sessionFiles = files
        .map(filename => path.join(sessionDirname, filename))
        .filter(pathname => pathname.endsWith('.json'))
        .filter(pathname => fs.statSync(pathname));

      if (sessionFiles.length === 0) {
        return;
      }
      // return once all states are in the collection
      return new Promise(async resolve => {
        const unsubscribe = this.sessions.onAttach(_ => {
          if (this.sessions.length === sessionFiles.length) {
            unsubscribe();
            resolve();
          }
        });

        for (let pathname of sessionFiles) {
          const blob = await fsPromises.readFile(pathname);
          const data = JSON.parse(blob.toString());
          const state = await this.como.stateManager.create(`${this.name}:session`, data);
          this.#currentSessions.add(state);
        }
      });
    }
  }

  #getPathname(sessionName) {
    const projectDirname = this.como.project.get('dirname');
    const sessionDirname = path.join(projectDirname, this.como.constants.PROJECT_SESSIONS_DIRNAME);
    const sessionFilename = `${filenamify(sessionName).toLowerCase()}.json`;
    return path.join(sessionDirname, sessionFilename);
  }

  #createSession = async ({ sessionName }) => {
    const sessionId = uuidv4();
    const session = await this.como.stateManager.create(`${this.name}:session`, {
      uuid: sessionId,
      name: sessionName,
    });

    const json = JSON.stringify(session.getValues(), null, 2);
    await fsPromises.writeFile(this.#getPathname(sessionName), json);

    this.#currentSessions.add(session);

    return sessionId;
  }

  #persistSession = async ({ sessionId }) => {
    const session = this.getSession(sessionId);

    if (!session) {
      throw new Error(`Cannot execute "deleteSession" on SessionManager: session with uuid: ${sessionId} does not exists`);
    }

    const filename = this.#getPathname(session.get('name'));
    const data = JSON.stringify(session.getValues());

    await fsPromises.writeFile(filename, data);
  }

  #renameSession = async ({ sessionId, newName }) => {
    const session = this.getSession(sessionId);

    if (!session) {
      throw new Error(`Cannot execute "deleteSession" on SessionManager: session with uuid: ${sessionId} does not exists`);
    }

    const oldFilename = this.#getPathname(session.get('name'));
    const newFilename = this.#getPathname(newName);

    await fsPromises.rename(oldFilename, newFilename);
    await session.set({ name: newName });
    await this.#persistSession({ sessionId });
  }

  #deleteSession = async ({ sessionId }) => {
    const ownedSession = Array.from(this.#currentSessions).find(session => session.get('uuid') === sessionId);

    if (!ownedSession) {
      throw new Error(`Cannot execute "deleteSession" on SessionManager: session with uuid: ${sessionId} does not exists`);
    }

    const sessionName = ownedSession.get('name');
    await ownedSession.delete();
    const pathname = this.#getPathname(sessionName);
    await fsPromises.rm(pathname, { force: true });
  }
}
