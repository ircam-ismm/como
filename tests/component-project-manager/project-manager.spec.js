import { assert } from 'chai';
import path from 'node:path';
import fs from 'node:fs';

import { delay } from '@ircam/sc-utils';

import { Server } from '@soundworks/core/server.js';
import { Client } from '@soundworks/core/client.js';

import ComoClient from '../../src/core/ComoClient.js';
import ComoServer from '../../src/core/ComoServer.js';

import config from '../config.js';

const thisDirectory = path.join('tests', 'component-project-manager');
const projectsDirname = path.join(thisDirectory, 'output');
const templateDirname = path.join(thisDirectory, 'template');

describe('# ProjectManager', () => {
  let client, server;

  beforeEach(async () => {
    const _server = new Server(config);
    server = new ComoServer(_server, { projectsDirname });
    await server.start();

    const _client = new Client({ role: 'test', ...config });
    client = new ComoClient(_client);
    await client.start();
  });

  afterEach(async () => {
    await client.stop();
    await server.stop();
  });

  describe('## init', () => {
    it(`should parse and list existing projects`, async () => {
      const clone = structuredClone(config);
      clone.env.port = 8082;
      const _server = new Server(clone);
      const server = new ComoServer(_server, {
        projectsDirname: path.join(thisDirectory, 'init')
      });
      await server.start();

      assert.equal(server.projectManager.projects.size, 1);

      assert.deepEqual(
        server.projectManager.projects.getValues(),
        [
          {
            name: 'Test',
            slug: 'test',
            dirname: 'tests/component-project-manager/init/test'
          }
        ]
      );

      await server.stop();
    });
  });

  describe('## createProject', () => {
    const projectName = 'Test';

    after(() => {
      fs.rmSync(projectsDirname, { recursive: true, force: true });
    });

    it('## should throw if project name is not a string', async () => {
      let errored = false;
      try {
        await client.projectManager.createProject(null, null);
      } catch (err) {
        console.log(err.message);
        errored = true;
      }
      assert.isTrue(errored);
    });

    it('## should throw if template pathname is not null or not a string', async () => {
      let errored = false;
      try {
        await client.projectManager.createProject('test', {});
      } catch (err) {
        console.log(err.message);
        errored = true;
      }
      assert.isTrue(errored);
    });

    it('## should throw if template pathname is not a directory', async () => {
      let errored = false;
      try {
        await client.projectManager.createProject('test', 'niap');
      } catch (err) {
        console.log(err.message);
        errored = true;
      }
      assert.isTrue(errored);
    });

    it('## should create a project', async () => {
      await client.projectManager.createProject(projectName, templateDirname);

      await delay(10);

      const project = client.projectManager.projects.find(p => p.get('name') === projectName);
      assert.isDefined(project);
      assert.isTrue(fs.existsSync(project.get('dirname')));
      // ensure same file structure
      const files = fs.readdirSync(templateDirname, { recursive: true });
      for (let file of files) {
        assert.isTrue(fs.existsSync(path.join(project.get('dirname'), file)));
      }
      // ensure project file exists
      assert.isTrue(fs.existsSync(path.join(project.get('dirname'), server.constants.PROJECT_INFOS_FILENAME)));
    });

    it('## should throw if project with same name/slug already exists', async () => {
      let errored = false;
      try {
        await client.projectManager.createProject(projectName, templateDirname);
      } catch (err) {
        console.log(err.message);
        errored = true;
      }
      assert.isTrue(errored);
    });
  });

  describe('## renameProject', () => {
    after(() => {
      fs.rmSync(projectsDirname, { recursive: true, force: true });
    });

    it('should rename project properly', async () => {
      await server.projectManager.createProject('Test', templateDirname);
      const project = server.projectManager.projects.find(p => p.get('name') === 'Test');
      const oldDirname = project.get('dirname');

      await server.projectManager.renameProject('Test', 'Coucou');

      assert.isFalse(fs.existsSync(oldDirname));

      assert.isTrue(fs.existsSync(project.get('dirname')));
      assert.equal(project.get('name'), 'Coucou');
      assert.equal(project.get('slug'), 'coucou');
    });
  });

  describe('## deleteProject', () => {
    after(() => {
      fs.rmSync(projectsDirname, { recursive: true, force: true });
    });

    it('should rename project properly', async () => {
      await server.projectManager.createProject('Test', templateDirname);
      const project = server.projectManager.projects.find(p => p.get('name') === 'Test');
      const dirname = project.get('dirname');

      await server.projectManager.deleteProject('Test', 'Coucou');

      assert.isFalse(fs.existsSync(dirname));
      assert.equal(server.projectManager.projects.size, 0);
    });
  });
});
