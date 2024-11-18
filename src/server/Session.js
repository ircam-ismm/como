import path from 'path';
import { Worker } from 'node:worker_threads';

import { v4 as uuidv4 } from 'uuid';
import * as xmm from 'xmmjs';

import db from './utils/db';
import diffArrays from '../common/utils/diffArrays.js';
import Graph from '../common/Graph.js';
import OfflineSource from '../common/sources/OfflineSource.js';
import clonedeep from 'lodash.clonedeep';
// pure ESM module....
// import { counter } from '@ircam/sc-utils';

function counter(from = 0, to = Number.MAX_SAFE_INTEGER, step = 1) {
  if (step === 0) {
    // just return `from` forever
    function* iter() { while(true) yield from }
    const sequence = iter();

    return () => sequence.next().value;
  }

  const start = step > 0 ? Math.min(from, to) : Math.max(from, to);
  const end = step > 0 ? Math.max(from, to) : Math.min(from, to);
  // note that Number.MAX_SAFE_INTEGER will wrap properly
  // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/MAX_SAFE_INTEGER
  function* iter() {
    for (let i = start; true; i += step) {
      if ((step > 0 && i > end) || (step < 0 && i < end)) {
        i = start
      }

      yield i;
    }
  }
  const sequence = iter();

  return () => sequence.next().value;
}

const xmmWorker = `
const { parentPort } = require('node:worker_threads');
const xmm = require('xmmjs');

parentPort.on('message', event => {
  const { promiseId, learningConfig, processedExamples, multiclass } = event;
  const keys = Object.keys(processedExamples);
  let trainingSet;

  if (keys.length === 0) {
    // no examples, create empty training set
    trainingSet = xmm.TrainingSet({ inputDimension: 0 });
  } else {
    keys.forEach((uuid, index) => {
      const { label, input, output } = processedExamples[uuid];

      if (index === 0) {
        const inputDimension = input[0].length;
        trainingSet = xmm.TrainingSet({ inputDimension });
      }

      // create and populate phrase
      const phrase = trainingSet.push(index, label);
      input.forEach(frame => phrase.push(frame));
    });
  }

  switch (learningConfig.modelType) {
    case 'gmm': {
      const config = {
        gaussians: learningConfig.gaussians,
        regularization: {
          relative: learningConfig.relativeRegularization,
          absolute: learningConfig.absoluteRegularization,
        },
        covarianceMode: learningConfig.covarianceMode,
      };

      const model = multiclass
        ? xmm.trainMulticlassGMM(trainingSet, config)
        : xmm.trainGMM(trainingSet, config);

      parentPort.postMessage({ promiseId, model });
      break;
    }
    case 'hhmm': {
      const config = {
        states: learningConfig.states,
        gaussians: learningConfig.gaussians,
        regularization: {
          relative: learningConfig.relativeRegularization,
          absolute: learningConfig.absoluteRegularization,
        },
        covarianceMode: learningConfig.covarianceMode,
      };

      const model = multiclass
        ? xmm.trainMulticlassHMM(trainingSet, config)
        : xmm.trainHMM(trainingSet, config);

      parentPort.postMessage({ promiseId, model });
      break;
    }
    default: {
      parentPort.postMessage({ err: 'Invalid model type "' + learningConfig.modelType + '", should be gmm or hhmm' });
      break;
    }
  }
});
`;

class Session {

  /** factory methods */
  static async create(como, id, name, graph, fsAudioFiles) {
    const session = new Session(como, id);
    await session.init({ name, graph });
    await session.updateAudioFilesFromFileSystem(fsAudioFiles);

    // by default (to be backward usage compatible):
    // - labels are the audio files names without extension
    // - a row <label, audioFile> is inserted in the `labelAudioFileTable`
    const registeredAudioFiles = session.get('audioFiles');
    const labels = [];
    const labelAudioFileTable = [];

    registeredAudioFiles.forEach(audioFile => {
      const label = audioFile.name;
      const row = [label, audioFile.name];
      labels.push(label);
      labelAudioFileTable.push(row);
    });

    await session.set({ labels, labelAudioFileTable });
    await session.persist();

    return session;
  }

  static async fromFileSystem(como, dirname, fsAudioFiles) {
    // @note - version 0.0.0 (cf.metas)
    const metas = await db.read(path.join(dirname, 'metas.json'));
    const dataGraph = await db.read(path.join(dirname, `graph-data.json`));
    const audioGraph = await db.read(path.join(dirname, `graph-audio.json`));
    const labels = await db.read(path.join(dirname, 'labels.json'));
    const labelAudioFileTable = await db.read(path.join(dirname, 'label-audio-files-table.json'));
    const learningConfig = await db.read(path.join(dirname, 'ml-config.json'));
    const examples = await db.read(path.join(dirname, '.ml-examples.json'));
    const model = await db.read(path.join(dirname, '.ml-model.json'));
    const audioFiles = await db.read(path.join(dirname, '.audio-files.json'));

    // remove examples that are not in labels
    let saveExamples = false;
    // just a line break in the console
    console.log('');

    for (let uuid in examples) {
      const label = examples[uuid].label;
      if (labels.indexOf(label) === -1) {
        console.warn(`[session "${metas.name}"] > WARNING - Example with label "${label}" deleted, label does exists in labels: [${labels.join(', ')}]`);

        delete examples[uuid];
        saveExamples = true;
      }
    }

    const id = metas.id;
    const config = {
      name: metas.name,
      graph: { data: dataGraph, audio: audioGraph },
      labels,
      labelAudioFileTable,
      learningConfig,
      examples,
      model,
      audioFiles,
    };

    const session = new Session(como, id);
    await session.init(config);

    if (saveExamples) {
      session.persist('examples');
    }

    await session.updateAudioFilesFromFileSystem(fsAudioFiles);

    return session;
  }

  constructor(como, id) {
    this.como = como;
    this.id = id;

    this.directory = path.join(this.como.projectDirectory, 'sessions', id);

    this.xmmWorker = new Worker(xmmWorker, { eval: true });
    this.promiseIdGen = counter();
    this.workerPromises = new Map();

    this.xmmWorker.on('message', event => {
      const { promiseId, model, err } = event;
      const { resolve, reject } = this.workerPromises.get(promiseId);
      this.workerPromises.delete(promiseId)

      if (err) {
        const error = new Error(err);
        reject(error);
      } else {
        resolve(model);
      }
    });
  }

  async persist(key = null) {
    const values = this.state.getValues();

    if (key === null || key === 'name') {
      const { id, name } = values;
      await db.write(path.join(this.directory, 'metas.json'), { id, name, version: '0.0.0' });
    }

    if (key === null || key === 'labels') {
      const { labels } = values;
      await db.write(path.join(this.directory, 'labels.json'), labels);
    }

    if (key === null || key === 'labelAudioFileTable') {
      const { labelAudioFileTable } = values;
      await db.write(path.join(this.directory, 'label-audio-files-table.json'), labelAudioFileTable);
    }

    if (key === null || key === 'graph' || key === 'graphOptions') {
      // reapply current graph options into graph definitions
      const { graph, graphOptions } = values;
      const types = ['data', 'audio'];

      for (let i = 0; i < types.length; i++) {
        const type = types[i];
        const subGraph = graph[type];

        subGraph.modules.forEach(desc => {
          if (Object.keys(graphOptions[desc.id]).length) {
            desc.options = graphOptions[desc.id];
          }
        });

        await db.write(path.join(this.directory, `graph-${type}.json`), subGraph);
      }
    }

    if (key === null || key === 'learningConfig') {
      const { learningConfig } = values;
      await db.write(path.join(this.directory, 'ml-config.json'), learningConfig);
    }

    // generated files, keep them hidden
    if (key === null || key === 'examples') {
      const { examples } = values;
      await db.write(path.join(this.directory, '.ml-examples.json'), examples, false);
    }

    if (key === null || key === 'model') {
      const { model } = values;
      await db.write(path.join(this.directory, '.ml-model.json'), model, false);
    }

    if (key === null || key === 'audioFiles') {
      const { audioFiles } = values;
      await db.write(path.join(this.directory, '.audio-files.json'), audioFiles, false);
    }
  }

  get(name) {
    return this.state.get(name);
  }

  getValues() {
    return this.state.getValues();
  }

  async set(updates) {
    await this.state.set(updates);
  }

  subscribe(func) {
    return this.state.subscribe(func);
  }

  async delete() {
    await this.state.detach();
    this.xmmWorker.terminate();
  }

  /**
   * @param {Object} initValues
   * @param {Object} initValues.id
   * @param {Object} initValues.name
   * @param {Object} initValues.graph
   * @param {Object} [initValues.model]
   * @param {Object} [initValues.examples]
   * @param {Object} [initValues.learningConfig]
   * @param {Object} [initValues.audioFiles]
   */
  async init(initValues) {
    initValues.id = this.id;
    // extract graph options from graph definition
    const modules = [...initValues.graph.data.modules, ...initValues.graph.audio.modules];

    initValues.graphOptions = modules.reduce((acc, desc) => {
      acc[desc.id] = desc.options || {};
      return acc;
    }, {});

    this.state = await this.como.server.stateManager.create(`session`, initValues);

    this.state.subscribe(async updates => {
      for (let [name, values] of Object.entries(updates)) {
        switch (name) {
          case 'name':
            this.como.project._updateSessionsOverview();
            break;
          case 'learningConfig': {
            const examples = this.state.get('examples');
            const processedExamples = this._getProcessedExamples(examples);
            const model = await this._updateFullModel(processedExamples);
            this.state.set({ model });
            break;
          }
        }

        await this.persist(name);
      }
    });

    // init graph
    const graphDescription = this.state.get('graph');
    const dataGraph = clonedeep(graphDescription.data);

    // replace decoder with a buffer, to be used as an input for training
    dataGraph.modules.forEach(module => {
      if (module.type === 'MLDecoder') {
        module.type = 'Buffer';
      }
    });

    this.graph = new Graph(this.como, { data: dataGraph }, this, null, true);
    await this.graph.init();

    // create an empty model when the session is created but do not re-train
    // model on startup, just rely on stored one
    if (this.state.get('model') === null) {
      const examples = this.state.get('examples');
      const processedExamples = this._getProcessedExamples(examples);
      const model = await this._updateFullModel(processedExamples);
      this.state.set({ model });
    }
  }

  async updateAudioFilesFromFileSystem(audioFileTree) {
    const { audioFiles, labelAudioFileTable } = this.state.getValues();
    const { deleted, created } = diffArrays(audioFiles, audioFileTree, f => f.url);

    created.forEach(createdFile => {
      const copy = Object.assign({}, createdFile);
      copy.active = true;

      audioFiles.push(copy);

      // create label and default [label, file] row entry
      this.createLabel(createdFile.name);
      this.createLabelAudioFileRow([createdFile.name, createdFile.name]);
    });

    deleted.forEach(deletedFile => {
      const index = audioFiles.findIndex(f => f.url === deletedFile.url);
      audioFiles.splice(index, 1);

      // delete label
      this.deleteLabel(deletedFile.name);
      // delete rows where audio file appears
      const rows = labelAudioFileTable.filter(r => r[1] === deletedFile.name);
      rows.forEach(row => this.deleteLabelAudioFileRow(row));
    });

    await this.state.set({ audioFiles });
  }

  async addExample(example) {
    const uuid = uuidv4();
    const label = example.label;
    const examples = this.state.get('examples');
    examples[uuid] = example;

    const processedExamples = this._getProcessedExamples(examples, label);
    const model = await this._updateModelForLabel(processedExamples, label);
    this.state.set({ examples, model });
  }

  async deleteExample(uuid) {
    const examples = this.state.get('examples');

    if (uuid in examples) {
      const label = examples[uuid].label;
      delete examples[uuid];

      const processedExamples = this._getProcessedExamples(examples, label);
      const model = await this._updateFullModel(processedExamples, label);
      this.state.set({ examples, model });
    }
  }

  async clearExamples(label = null) {
    if (label === null) {
      // update with empty model
      const examples = {};
      const processedExamples = this._getProcessedExamples(examples);
      const model = await this._updateFullModel(processedExamples);
      this.state.set({ examples, model });
    } else {
      const examples = {};
      const oldExamples = this.state.get('examples');

      for (let uuid in oldExamples) {
        if (oldExamples[uuid].label !== label) {
          examples[uuid] = oldExamples[uuid];
        }
      }
      // just remove the class from the model
      const model = this.state.get('model');
      delete model.classes[label];

      this.state.set({ examples, model });
    }
  }

  async retrain() {
    const examples = this.state.get('examples');
    const processedExamples = this._getProcessedExamples(examples);
    const model = await this._updateFullModel(processedExamples);
    this.state.set({ model });
  }

  createLabel(label) {
    const labels = this.state.get('labels');

    if (labels.indexOf(label) === -1) {
      labels.push(label);
      this.state.set({ labels });
    }
  }

  updateLabel(oldLabel, newLabel) {
    const labels = this.state.get('labels');
    const labelAudioFileTable = this.state.get('labelAudioFileTable');
    const examples = this.state.get('examples');

    if (labels.indexOf(oldLabel) !== -1 && labels.indexOf(newLabel) === -1) {
      const updatedLabels = labels.map(label => label === oldLabel ? newLabel : label);
      const updatedTable = labelAudioFileTable.map(row => {
        if (row[0] === oldLabel) {
          row[0] = newLabel;
        }

        return row;
      });

      // updates labels of existing examples
      for (let uuid in examples) {
        const example = examples[uuid];

        if (example.label === oldLabel) {
          example.label = newLabel;
        }
      }

      // just switch the class name in the model
      const model = this.state.get('model');
      model.classes[newLabel] = model.classes[oldLabel];
      delete model.classes[oldLabel];

      this.state.set({
        examples,
        model,
        labels: updatedLabels,
        labelAudioFileTable: updatedTable,
      });
    }
  }

  deleteLabel(label) {
    const labels = this.state.get('labels');
    const labelAudioFileTable = this.state.get('labelAudioFileTable');

    if (label === null) {
      this.clearExamples();
      this.state.set({
        labels: [],
        labelAudioFileTable: [],
      });
    } else if (labels.indexOf(label) !== -1) {
      // clean label / audio file table
      const filteredLabels = labels.filter(l => l !== label);
      const filteredTable = labelAudioFileTable.filter(row => row[0] !== label);

      this.clearExamples(label); // retrain the model
      this.state.set({
        labels: filteredLabels,
        labelAudioFileTable: filteredTable,
      });
    }
  }

  toggleAudioFile(filename, active) {
    const { audioFiles, labelAudioFileTable } = this.state.getValues();

    const audioFile = audioFiles.find(f => f.name === filename);
    audioFile.active = active;

    const updatedTable = labelAudioFileTable.filter(row => row[1] !== filename);

    this.state.set({
      audioFiles,
      labelAudioFileTable: updatedTable,
    });
  }

  createLabelAudioFileRow(row) {
    const labelAudioFileTable = this.state.get('labelAudioFileTable');
    const index = labelAudioFileTable.findIndex(r => r[0] === row[0] && r[1] === row[1]);

    if (index === -1) {
      labelAudioFileTable.push(row);
      this.state.set({ labelAudioFileTable });
    }
  }

  deleteLabelAudioFileRow(row) {
    const labelAudioFileTable = this.state.get('labelAudioFileTable');
    const filteredTable = labelAudioFileTable.filter(r => {
      return r[0] === row[0] && r[1] === row[1] ? false : true;
    });

    this.state.set({ labelAudioFileTable: filteredTable });
  }

  // process recorded examples through offline graph and return a list of processed examples
  _getProcessedExamples(examples, label = null) {
    const logPrefix = `[session "${this.state.get('id')}"]`;
    const labels = label !== null
     ? [label]
     : Object.values(examples).map(d => d.label).filter((d, i, arr) => arr.indexOf(d) === i);

    const processingStartTime = new Date().getTime();

    console.log(`\n${logPrefix} > UPDATE MODEL - labels:`, labels);
    console.log(`${logPrefix} processing start`);
    // lake sure we have a recording buffer in the graph, in place of MLDecoder
    let buffer = null;

    for (let id in this.graph.modules) {
      const module = this.graph.modules[id];

      if (module.type === 'Buffer') {
        buffer = module;
      }
    }

    if (buffer === null) {
      // if the graph does not have any ml capabilities (cf. cmoo-vox)
      // just return an empty training set that the app behaves as expected
      console.log(`\n${logPrefix} > graph does not contain any MLDecoder, abort training...`);
      return new xmm.TrainingSet({ inputDimension: 0 });
    }

    let offlineSource;
    // for persistency
    const processedExamples = {};
    // we need to know the input dimension to create the training set, so we do it later
    // let trainingSet = null;
    let inputDimension = 0;

    // process examples raw data in pre-processing graph
    Object.keys(examples).forEach((uuid, index) => {
      // pass the example through the graph to have the transformed stream
      const example = examples[uuid];

      // if label given, process only the related examples
      if (label !== null && example.label !== label) {
        return;
      }

      offlineSource = new OfflineSource(example.input);
      this.graph.setSource(offlineSource);
      // run the graph offline, this MUST be synchronous
      offlineSource.run();
      const transformedStream = buffer.getData();

      if (example.input.length !== transformedStream.length) {
        throw new Error(`${logPrefix} Error: incoherent example processing for example ${uuid}`);
      }

      this.graph.removeSource(offlineSource);
      buffer.reset();

      processedExamples[uuid] = {
        label: example.label,
        output: example.output,
        input: transformedStream,
      };

      if (index === 0) {
        inputDimension = transformedStream[0].length;
      }
    });

    // persists processed examples for debug
    // @note - do not await, this is debug stuff
    db.write(path.join(this.directory, '.ml-processed-examples.debug.json'), processedExamples, false);

    const processingTime = new Date().getTime() - processingStartTime;
    console.log(`${logPrefix} processing end - ${processingTime}ms - trainingSet size: ${Object.keys(processedExamples).length} - input dimension: ${inputDimension} - labels: ${labels}`);

    return processedExamples;
  }

  async _updateModelForLabel(processedExamples, label) {
    const logPrefix = `[session "${this.state.get('id')}"]`;
    const trainingStartTime = new Date().getTime();

    console.log(`${logPrefix} training start for label ${label}`);

    // train model
    const learningConfig = this.state.get('learningConfig').payload;
    const model = this.state.get('model');

    const partialModel = await new Promise((resolve, reject) => {
      const promiseId = this.promiseIdGen();
      const msg = { promiseId, learningConfig, processedExamples, multiclass: false };
      this.workerPromises.set(promiseId, { resolve, reject });
      this.xmmWorker.postMessage(msg);
    });

    model.classes[label] = partialModel;

    const trainingTime = new Date().getTime() - trainingStartTime;
    console.log(`${logPrefix} training end\t\t(${trainingTime}ms)`);

    return model;
  }

  async _updateFullModel(processedExamples) {
    const logPrefix = `[session "${this.state.get('id')}"]`;
    const trainingStartTime = new Date().getTime();
    console.log(`${logPrefix} training start`);

    // train model
    const learningConfig = this.state.get('learningConfig').payload;

    const model = await new Promise((resolve, reject) => {
      const promiseId = this.promiseIdGen();
      const msg = { promiseId, learningConfig, processedExamples, multiclass: true };
      this.workerPromises.set(promiseId, { resolve, reject });
      this.xmmWorker.postMessage(msg);
    });

    const trainingTime = new Date().getTime() - trainingStartTime;
    console.log(`${logPrefix} training end - ${trainingTime}ms`);

    return model;
  }
}

export default Session;
