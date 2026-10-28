import path from 'node:path';
import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

import { isString } from '@ircam/sc-utils';
import filenamify from 'filenamify';

import ModelManager from './ModelManager.js';
import PrivateModel from './PrivateModel.js';
import modelDescription from './model-description.js';

import { XmmWorker } from './algorithms/xmm-worker.js';
import { presets } from './algorithms/xmm-lib.js';

function examplesInfos(examples) {
  const infos = {};

  examples.forEach(example => {
    if (!infos[example.label]) {
      infos[example.label] = {
        numExamples: 0,
        uuids: [],
      };
    }

    infos[example.label].uuids.push(example.uuid);
    infos[example.label].numExamples += 1;
  });

  return infos;
}

/**
 * Server-side representation of the {@link ModelManager}
 *
 * @extends {ModelManager}
 */
class ModelManagerServer extends ModelManager {
  #privateModels = new Map();
  #algorithms = {};

  constructor(como, name) {
    super(como, name);

    this.como.setRfcHandler(`${this.name}:createModel`, this.#createModelHandler);
    this.como.setRfcHandler(`${this.name}:deleteModel`, this.#deleteModelHandler);
    this.como.setRfcHandler(`${this.name}:addExample`, this.#addExampleHandler);
    this.como.setRfcHandler(`${this.name}:deleteExample`, this.#deleteExampleHandler);
    this.como.setRfcHandler(`${this.name}:clearExamples`, this.#clearExamplesHandler);
  }

  /** @private */
  get algorithms() {
    return this.#algorithms;
  }

  async init() {
    await super.init();

    await this.como.stateManager.defineClass(`${this.name}:model`, modelDescription);

    await this.como.stateManager.registerUpdateHook(`${this.name}:model`, (updates, currentValues) => {
      if ('parameters' in updates) {
        const { id } = currentValues;
        const privateModel = this.#privateModels.get(id);
        const infos = examplesInfos(privateModel.examples);

        return {
          infos,
          ...updates,
        };
      }
    });
  }

  async start() {
    await super.start();

    this.#algorithms['xmm'] = new XmmWorker();
    await this.#algorithms['xmm'].init();
  }

  async stop() {
    for (let worker of Object.values(this.#algorithms)) {
      await worker.terminate();
    }

    await super.stop();
  }

  /**
   * @private
   * @todo - share w/ SessionManager and others?
   */
  async setProject(dirname) {
    // drop current models
    for (let privateModel of Object.values(this.#privateModels)) {
      await privateModel.delete();
    }

    this.#privateModels.clear();

    if (dirname !== null) {
      const modelsDirname = path.join(dirname, this.como.constants.PROJECT_MODELS_DIRNAME);

      if (!fs.existsSync(modelsDirname)) {
        await fsPromises.mkdir(modelsDirname, { recursive: true });
      }

      const files = await fsPromises.readdir(modelsDirname);
      const modelFiles = files
        .map(filename => path.join(modelsDirname, filename))
        .filter(pathname => pathname.endsWith('.json'))
        .filter(pathname => fs.statSync(pathname).isFile());

      if (modelFiles.length === 0) {
        return;
      }

      const { promise, resolve } = Promise.withResolvers();

      const unsubscribe = this.models.onAttach(() => {
        if (this.models.length === modelFiles.length) {
          unsubscribe();
          resolve();
        }
      });

      for (let pathname of modelFiles) {
        const blob = await fsPromises.readFile(pathname);
        const data = JSON.parse(blob.toString());
        const { uuid, id, config, parameters, examples } = data;
        const infos = examplesInfos(examples);
        const state = await this.como.stateManager.create(`${this.name}:model`, {
          uuid,
          id,
          config,
          parameters,
          infos,
        });
        // do not re-train, just use on stored parameters
        const model = new PrivateModel(this, state, examples);

        this.#privateModels.set(id, model);
      }

      return promise;
    }
  }


  #getPathname(model) {
    const modelId = model.state.get('id');
    const projectDirname = this.como.project.get('dirname');
    const modelDirname = path.join(projectDirname, this.como.constants.PROJECT_MODELS_DIRNAME);
    const modelFilename = `${filenamify(modelId).toLowerCase()}.json`;
    return path.join(modelDirname, modelFilename);
  }

  /** @private */
  async persist(model) {
    const {
      uuid,
      id,
      config,
      parameters,
    } = model.state.getValuesUnsafe();

    const pathname = this.#getPathname(model);

    const json = JSON.stringify({
      uuid,
      id,
      config,
      parameters,
      examples: model.examples,
    }, null, 2);

    await fsPromises.writeFile(pathname, json);
  }

  #createModelHandler = async ({ modelId, preset = 'postures' }) => {
    if (presets[preset] === undefined) {
      console.warn(`Cannot execute "createModel" on ModelManager:: Invalid preset "${preset}" while creating model "${modelId}" (valid presets are ${Object.keys(presets).join(', ')} - falling back to "postures" preset)`);
      preset = 'postures';
    }

    const state = await this.como.stateManager.create(`${this.name}:model`, {
      uuid: randomUUID(),
      id: modelId,
      config: presets[preset],
    });

    const model = new PrivateModel(this, state);
    this.#privateModels.set(modelId, model);
    // train after storing in Map, because update hook relies on the Map
    await model.train();

    return modelId;
  };

  #deleteModelHandler = async ({ modelId }) => {
    const model = this.#privateModels.get(modelId);

    if (!model) {
      throw new Error(`Cannot execute "deleteModel" on ModelManager: model with id "${modelId}" does not exists`);
    }

    await model.delete();
    const pathname = this.#getPathname(model);

    await fsPromises.rm(pathname, { force: true });
  };

  #addExampleHandler = async ({ modelId, label, example }) => {
    const model = this.#privateModels.get(modelId);

    if (!model) {
      throw new Error(`Cannot execute "addExample" on ModelManager: model with id "${modelId}" does not exists`);
    }

    if (!isString(label)) {
      throw new Error(`Cannot execute "addExample" on ModelManager (model: "${modelId}"): label "${label}" is not a string `);
    }

    if (!Array.isArray(example)) {
      throw new Error(`Cannot execute "addExample" on ModelManager (model: "${modelId}", label: ${label}): example is not an array`);
    }

    return await model.addExample(label, example);
  };

  #deleteExampleHandler = async ({ modelId, exampleUuid }) => {
    const model = this.#privateModels.get(modelId);

    if (!model) {
      throw new Error(`Cannot execute "deleteExample" on ModelManager: model with id "${modelId}" does not exists`);
    }

    if (!isString(exampleUuid)) {
      throw new Error(`Cannot execute "addExample" on ModelManager (model: "${modelId}"): Example id ("${exampleUuid}") is not a string`);
    }

    return await model.deleteExample(exampleUuid);
  };

  #clearExamplesHandler = async ({ modelId, label = null }) => {
    const model = this.#privateModels.get(modelId);

    if (!model) {
      throw new Error(`Cannot execute "clearExamples" on ModelManager: model with id "${modelId}" does not exists`);
    }

    if (label !== null && !isString(label)) {
      throw new Error(`Cannot execute "addExample" on ModelManager (model: "${modelId}"): label ("${label}") is not a string`);
    }

    return await model.clearExamples(label);
  };
}

export default ModelManagerServer;
