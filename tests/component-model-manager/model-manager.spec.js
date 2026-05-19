import { assert } from 'chai';
import path from 'node:path';
import fs from 'node:fs';

import { Server } from '@soundworks/core/server.js';
import { Client } from '@soundworks/core/client.js';
import { delay } from '@ircam/sc-utils';

import ComoClient from '../../src/core/ComoClient.js';
import ComoServer from '../../src/core/ComoServer.js';

import config from '../config.js';

const testDirectory = path.join('tests');
const projectsDirname = path.join(testDirectory, 'projects');

describe('#ModelManager', () => {
  let client, server;

  beforeEach(async function() {
    this.timeout(5 * 1000);

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
  });

  describe('## async getModel(modelId)', () => {
    afterEach(async () => {
      fs.rmSync(path.join(projectsDirname, 'test', 'models'), { recursive: true, force: true });
    });

    it('should create a new Model if not exists', async () => {
      const modelId = 'test';
      const model = await client.modelManager.getModel(modelId);
      assert.equal(model.state.get('id'), modelId);
      assert.isNotNull(model.state.get('config'));
      assert.isNotNull(model.state.get('parameters'));
      assert.deepEqual(model.state.get('infos'), {});
    });

    it('should retrieve an existing Model if exists', async () => {
      const modelId = 'test';
      const model1 = await server.modelManager.getModel(modelId);
      const model2 = await client.modelManager.getModel(modelId);

      assert.equal(model1.state.id, model2.state.id); // same underlying shared state
      assert.equal(model1.state.get('id'), model2.state.get('id'));
      assert.deepEqual(model1.state.get('config'), model2.state.get('config'));
      assert.deepEqual(model1.state.get('parameters'), model2.state.get('parameters'));
      assert.deepEqual(model1.state.get('infos'), model2.state.get('infos'));

      assert.equal(server.modelManager.models.size, 1);
      assert.equal(client.modelManager.models.size, 1);
    });
  });

  describe(`## async addExample(label, input)`, () => {
    afterEach(async () => {
      fs.rmSync(path.join(projectsDirname, 'test', 'models'), { recursive: true, force: true });
    });

    it('should add examples to model', async () => {
      const modelId = 'test';
      const inputDimension = 3;
      const model = await client.modelManager.getModel(modelId);

      {
        let example = [];
        for (let i = 0; i < 1000; i += 1) {
          const frame = Array.from(Array(inputDimension), () => Math.random()); // get data from somewhere
          example.push(frame);
        }

        await model.addExample('one', example);

        const parameters = model.state.get('parameters');
        assert.equal(parameters.inputDimension, inputDimension);
        assert.isDefined(parameters.classes['one']);

        const infos = model.state.get('infos');
        assert.equal(infos['one'].numExamples, 1);
      }

      // second example of same class
      {
        let example = [];
        for (let i = 0; i < 1000; i += 1) {
          const frame = Array.from(Array(inputDimension), () => Math.random()); // get data from somewhere
          example.push(frame);
        }

        await model.addExample('one', example);

        const parameters = model.state.get('parameters');
        assert.equal(parameters.inputDimension, inputDimension);
        assert.isDefined(parameters.classes['one']);

        const infos = model.state.get('infos');
        assert.equal(infos['one'].numExamples, 2);
      }

       // example of another class
      {
        let example = [];
        for (let i = 0; i < 1000; i += 1) {
          const frame = Array.from(Array(inputDimension), () => Math.random() + 1); // get data from somewhere
          example.push(frame);
        }

        await model.addExample('two', example);

        const parameters = model.state.get('parameters');
        assert.equal(parameters.inputDimension, inputDimension);
        assert.isDefined(parameters.classes['one']);
        assert.isDefined(parameters.classes['two']);

        const infos = model.state.get('infos');
        assert.equal(infos['one'].numExamples, 2);
        assert.equal(infos['one'].uuids.length, 2);
        assert.equal(infos['two'].numExamples, 1);
        assert.equal(infos['two'].uuids.length, 1);
      }
    });
  });

  describe(`## async deleteExamples(uuid)`, () => {
    afterEach(async () => {
      fs.rmSync(path.join(projectsDirname, 'test', 'models'), { recursive: true, force: true });
    });

    it('should remove examples with given label', async () => {
      const modelId = 'test';
      const inputDimension = 3;
      const model = await client.modelManager.getModel(modelId);

      for (let [index, label] of Object.entries(['one', 'two', 'two'])) {
        const example = [];
        for (let i = 0; i < 1000; i += 1) {
          const frame = Array.from(Array(inputDimension), () => Math.random() + parseInt(index)); // get data from somewhere
          example.push(frame);
        }

        await model.addExample(label, example);
      }

      {
        const infos = model.state.get('infos');
        const twoUuid = infos['two'].uuids[0];
        await model.deleteExample(twoUuid);
      }

      {
        const parameters = model.state.get('parameters');
        assert.equal(parameters.inputDimension, inputDimension);
        assert.isDefined(parameters.classes['one']);
        assert.isDefined(parameters.classes['two']);

        const infos = model.state.get('infos');
        assert.equal(infos['one'].numExamples, 1);
        assert.equal(infos['one'].uuids.length, 1);
        assert.equal(infos['two'].numExamples, 1);
        assert.equal(infos['two'].uuids.length, 1);
      }

      {
        const infos = model.state.get('infos');
        const twoUuid = infos['two'].uuids[0];
        await model.deleteExample(twoUuid);
      }

      {
        const parameters = model.state.get('parameters');
        assert.equal(parameters.inputDimension, inputDimension);
        assert.isDefined(parameters.classes['one']);
        assert.isUndefined(parameters.classes['two']);

        const infos = model.state.get('infos');
        assert.equal(infos['one'].numExamples, 1);
        assert.equal(infos['one'].uuids.length, 1);
        assert.isUndefined(infos['two']);
        assert.isUndefined(infos['two']);
      }
    });
  });

  describe(`## async clearExamples(label = null)`, () => {
    afterEach(async () => {
      fs.rmSync(path.join(projectsDirname, 'test', 'models'), { recursive: true, force: true });
    });

    it('should remove examples with given label', async () => {
      const modelId = 'test';
      const inputDimension = 3;
      const model = await client.modelManager.getModel(modelId);

      for (let [index, label] of Object.entries(['one', 'two'])) {
        const example = [];
        for (let i = 0; i < 1000; i += 1) {
          const frame = Array.from(Array(inputDimension), () => Math.random() + parseInt(index)); // get data from somewhere
          example.push(frame);
        }

        await model.addExample(label, example);
      }

      await model.clearExamples('one');

      const parameters = model.state.get('parameters');
      assert.equal(parameters.inputDimension, inputDimension);
      assert.isUndefined(parameters.classes['one']);
      assert.isDefined(parameters.classes['two']);

      const infos = model.state.get('infos');
      assert.isUndefined(infos['one']);
      assert.equal(infos['two'].numExamples, 1);
    });

    it('should remove all examples if label is null', async () => {
      const modelId = 'test';
      const inputDimension = 3;
      const model = await client.modelManager.getModel(modelId);

      for (let [index, label] of Object.entries(['one', 'two'])) {
        const example = [];
        for (let i = 0; i < 1000; i += 1) {
          const frame = Array.from(Array(inputDimension), () => Math.random() + parseInt(index)); // get data from somewhere
          example.push(frame);
        }

        await model.addExample(label, example);
      }

      await model.clearExamples();

      const parameters = model.state.get('parameters');
      // model has been emptied, then inputDimension is 0
      assert.equal(parameters.inputDimension, 0);
      assert.isUndefined(parameters.classes['one']);
      assert.isUndefined(parameters.classes['two']);

      const infos = model.state.get('infos');
      assert.isUndefined(infos['one']);
      assert.isUndefined(infos['two']);
    });
  });

  describe(`## persist & load models`, () => {
    after(async () => {
      fs.rmSync(path.join(projectsDirname, 'test', 'models'), { recursive: true, force: true });
    });

    it('should properly store model when updated', async () => {
      const modelId = 'test';
      const inputDimension = 3;
      const model = await client.modelManager.getModel(modelId);

      for (let [index, label] of Object.entries(['one', 'two'])) {
        const example = [];
        for (let i = 0; i < 1000; i += 1) {
          const frame = Array.from(Array(inputDimension), () => Math.random() + parseInt(index)); // get data from somewhere
          example.push(frame);
        }

        await model.addExample(label, example);
      }

      // update file after `addExample`
      {
        const modelPathname = path.join(projectsDirname, 'test', 'models', `${model.state.get('uuid')}.json`);
        assert.isTrue(fs.existsSync(modelPathname));

        const data = JSON.parse(fs.readFileSync(modelPathname).toString());
        assert.equal(data.uuid, model.state.get('uuid'));
        assert.equal(data.id, model.state.get('id'));
        // as this is nested object, let's compare the stringified version
        assert.equal(JSON.stringify(data.parameters), JSON.stringify(model.state.get('parameters')));
        assert.equal(data.examples.length, 2);
        // infos are not stored but should be recomputed
        assert.isDefined(model.state.get('infos'));
      }

      await model.clearExamples('one');

      // update file after `clearExamples`
      {
        const modelPathname = path.join(projectsDirname, 'test', 'models', `${model.state.get('uuid')}.json`);
        assert.isTrue(fs.existsSync(modelPathname));

        const data = JSON.parse(fs.readFileSync(modelPathname).toString());
        assert.equal(data.uuid, model.state.get('uuid'));
        assert.equal(data.id, model.state.get('id'));
        // as this is nested object, let's compare the stringified version
        assert.equal(JSON.stringify(data.parameters), JSON.stringify(model.state.get('parameters')));
        assert.equal(data.examples.length, 1);
        // infos are not stored but should be recomputed
        assert.isDefined(model.state.get('infos'));
      }
    });

    it('should properly reload model at startup', async () => {
      // this should retrieve the stored model from previous test
      const modelId = 'test';
      const model = await client.modelManager.getModel(modelId);

      const modelPathname = path.join(projectsDirname, 'test', 'models', `${model.state.get('uuid')}.json`);
      assert.isTrue(fs.existsSync(modelPathname));

      const data = JSON.parse(fs.readFileSync(modelPathname).toString());
      assert.equal(data.uuid, model.state.get('uuid'));
      assert.equal(data.id, model.state.get('id'));
      // as this is nested object, let's compare the stringified version
      assert.equal(JSON.stringify(data.parameters), JSON.stringify(model.state.get('parameters')));
      assert.equal(data.examples.length, 1);
      // infos are not stored but should be recomputed
      assert.isDefined(model.state.get('infos'));
    });
  });
});
