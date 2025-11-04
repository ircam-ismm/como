import { assert } from 'chai';
import path from 'node:path';
import fs from 'node:fs';

import { delay } from '@ircam/sc-utils';

import { Server } from '@soundworks/core/server.js';
import { Client } from '@soundworks/core/client.js';

import ComoClient from '../../src/core/ComoClient.js';
import ComoServer from '../../src/core/ComoServer.js';
import sessionDescription from '../../src/components/session-manager/session-description.js';

import config from '../config.js';

const testDirectory = path.join('tests');
const projectsDirname = path.join(testDirectory, 'projects');
const testProject = 'test';
const sessionsDirname = path.join(projectsDirname, testProject, 'sessions');

function filterPersistedParams(values, description = sessionDescription) {
  values = structuredClone(values);

  for (let name in description) {
    if (!description[name].metas?.persist) {
      delete values[name];
    }
  }

  return values;
}

describe('# SessionManager', () => {
  let client, server;

  beforeEach(async () => {
    if (!fs.existsSync(sessionsDirname)) {
      fs.mkdirSync(sessionsDirname);
    }

    const _server = new Server(config);
    server = new ComoServer(_server, { projectsDirname });
    await server.start();
    await server.setProject(path.join(projectsDirname, 'test'));

    const _client = new Client({ role: 'test', ...config });
    client = new ComoClient(_client);
    await client.start();
  });

  afterEach(async () => {
    await client.stop();
    await server.stop();

    fs.rmSync(sessionsDirname, { force: true, recursive: true });
  });

  describe('## component exists', () => {
    it('should be registered', async () => {
      assert.isDefined(server.sessionManager);
      assert.isDefined(client.sessionManager);
    })
  });

  // describe.only('## should start with stored sessions', () => {
  //   const testSessionFilename = path.join(sessionsDirname, 'recorded.json');
  //   const testSession = {
  //     uuid: 'abcde',
  //     name: 'Recorded',
  //     defaultScript: null,
  //     mute: false,
  //     volume: 0,
  //   };

  //   beforeEach(() => {
  //     fs.mkdirSync(sessionsDirname, { recursive: true });
  //     fs.writeFileSync(testSessionFilename, JSON.stringify(testSession), { parent: true });
  //   });

  //   afterEach(() => {
  //     fs.rmSync(testSessionFilename);
  //   });

  //   it('should instantiate recorded session at startup (server)', async () => {
  //     const clone = structuredClone(config);
  //     clone.env.port = 8082;
  //     const _server = new Server(clone);
  //     const server = new ComoServer(_server, { projectsDirname });

  //     await server.start();
  //     await server.setProject(path.join(projectsDirname, 'test'));

  //     assert.equal(server.sessionManager.sessions.size, 1);
  //     assert.deepEqual(
  //       server.sessionManager.sessions.getValues(),
  //       [testSession]
  //     );

  //     await server.stop();
  //   });

  //   // it('should instantiate recorded session at startup (client)', async () => {
  //   //   const clone = structuredClone(config);
  //   //   clone.env.port = 8082;
  //   //   const _server = new Server(clone);
  //   //   const server = new ComoServer(_server, { projectsDirname });
  //   //   await server.start();

  //   //   const _client = new Client({ role: 'test', ...clone });
  //   //   const client = new ComoClient(_client);
  //   //   await client.start();
  //   //   await client.setProject(path.join(projectsDirname, 'test'));

  //   //   await delay(10); // we can't be "await" synchronous in this case
  //   //   assert.equal(client.sessionManager.sessions.size, 1);
  //   //   assert.deepEqual(
  //   //     client.sessionManager.sessions.getValues(),
  //   //     [testSession]
  //   //   );

  //   //   await client.stop();
  //   //   await server.stop();
  //   // });
  // });

  describe('## createSession', () => {
    it('should create a session', async () => {
      const sessionId = await client.sessionManager.createSession('Coucou');
      const session = await client.sessionManager.getSession(sessionId);
      assert.isDefined(session);
      const sessionFile = path.join(projectsDirname, 'test', 'sessions', 'coucou.json');
      assert.isTrue(fs.existsSync(sessionFile));
      // make sure client fulfills once the session is in the collection
      assert.equal(client.sessionManager.sessions.size, 1);
    });
  });

  describe('## renameSession', () => {
    it('should create a session', async () => {
      const sessionId = await client.sessionManager.createSession('Coucou');
      const sessionFile = path.join(projectsDirname, 'test', 'sessions', 'coucou.json');
      assert.isTrue(fs.existsSync(sessionFile));
      const session = client.sessionManager.getSession(sessionId);
      const originalValues = session.getValues();

      await client.sessionManager.renameSession(sessionId, 'Test');

      assert.equal(session.get('name'), 'Test');
      const newFile = path.join(projectsDirname, 'test', 'sessions', 'test.json');
      assert.isFalse(fs.existsSync(sessionFile));
      assert.isTrue(fs.existsSync(newFile));

      originalValues.name = 'Test';

      const persisted = filterPersistedParams(originalValues);
      const json = JSON.parse(fs.readFileSync(newFile).toString());
      assert.deepEqual(persisted, json);
      assert.deepEqual(originalValues, session.getValues());
    });
  });

  describe('## persistSession', () => {
    it('should save session values', async () => {
      const sessionId = await client.sessionManager.createSession('Coucou');
      const session = await client.sessionManager.getSession(sessionId);
      await session.set({ mute: true });

      await client.sessionManager.persistSession(sessionId);

      const persisted = filterPersistedParams(session.getValues());
      const pathname = path.join(projectsDirname, 'test', 'sessions', 'coucou.json');
      const json = JSON.parse(fs.readFileSync(pathname).toString());
      assert.deepEqual(persisted, json);
    });
  });

  describe('## persistSession', () => {
    it('should save session values', async () => {
      const sessionId = await client.sessionManager.createSession('Coucou');
      const session = await client.sessionManager.getSession(sessionId);
      await session.set({ mute: true });

      await client.sessionManager.persistSession(sessionId);

      const persisted = filterPersistedParams(session.getValues());
      const pathname = path.join(projectsDirname, 'test', 'sessions', 'coucou.json');
      const json = JSON.parse(fs.readFileSync(pathname).toString());
      assert.isTrue(json.mute);
      assert.deepEqual(persisted, json);
    });
  });

  describe('## deleteSession', () => {
    it('should delete session state and file', async () => {
      const sessionId = await client.sessionManager.createSession('Coucou');
      const session = await client.sessionManager.getSession(sessionId);

      await delay(50);
      await client.sessionManager.deleteSession(sessionId);

      const pathname = path.join(projectsDirname, 'test', 'sessions', 'coucou.json');
      assert.isFalse(fs.existsSync(pathname));
      assert.equal(client.sessionManager.sessions.length, 0);
    });
  });
});
