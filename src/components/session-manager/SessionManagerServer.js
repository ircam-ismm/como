import path from 'node:path';
import fs from 'node:fs';
import fsPromises from 'node:fs/promises';

import { v4 as uuidv4 } from 'uuid';
import filenamify from 'filenamify';

import SessionManager from './SessionManager.js';
import sessionDescription from './session-description.js';

function serializeSession(session) {
  const description = session.getDescription();
  const values = session.getValues();

  for (let name in description) {
    const persist = description[name].metas?.persist;
    if (!persist) {
      delete values[name];
    }
  }

  return JSON.stringify(values, null, 2);
}

export default class SessionManagerServer extends SessionManager {
  #currentSessions = new Set();

  constructor(como, name) {
    super(como, name);

    this.como.setRfcHandler(`${this.name}:createSession`, this.#createSession);
    this.como.setRfcHandler(`${this.name}:persistSession`, this.#persistSession);
    this.como.setRfcHandler(`${this.name}:renameSession`, this.#renameSession);
    this.como.setRfcHandler(`${this.name}:deleteSession`, this.#deleteSession);
  }

  async init() {
    await super.init();

    await this.como.stateManager.defineClass(`${this.name}:session`, sessionDescription);
    this.como.stateManager.registerUpdateHook(`${this.name}:session`, updates => {
      let dirty = false;
      for (let name in updates) {
        const persist = sessionDescription[name].metas?.persist;
        if (persist) {
          dirty = true;
        }
      }

      return {
        ...updates,
        dirty,
      }
    });
  }

  async start() {
    await super.start();

    // if a soundfile is deleted, remove it from the soundbank of all sessions
    this.como.soundbankManager.onUpdate(async ({ tree, events }) => {
      if (!events) {
        return;
      }

      for (let event of events) {
        if (event.type === 'delete') {
          for (let session of this.sessions) {
            const soundbank = new Set(session.get('soundbank'));
            soundbank.delete(event.node.relPath);
            await session.set({ soundbank: Array.from(soundbank) });
            await this.persistSession(session.get('uuid'));
          }
        }
      }
    });

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

    const pathname = this.#getPathname(sessionName);
    const json = serializeSession(session);

    await fsPromises.writeFile(pathname, json);

    this.#currentSessions.add(session);

    return sessionId;
  }

  #persistSession = async ({ sessionId }) => {
    const session = this.getSession(sessionId);

    if (!session) {
      throw new Error(`Cannot execute "deleteSession" on SessionManager: session with uuid: ${sessionId} does not exists`);
    }

    const pathname = this.#getPathname(session.get('name'));
    const json = serializeSession(session);

    await fsPromises.writeFile(pathname, json);
    await session.set({ dirty: false });
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
