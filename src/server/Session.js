import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import * as xmm from 'xmmjs';

import db from './utils/db';
import diffArrays from '../common/utils/diffArrays.js';
import Graph from '../common/Graph.js';
import OfflineSource from '../common/sources/OfflineSource.js';
import clonedeep from 'lodash.clonedeep';

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

    // this.xmmInstances = {
    //   'gmm': new xmm('gmm'),
    //   'hhmm': new xmm('hhmm'),
    // };
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
            this.updateModel();
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

    // init model
    await this.updateModel();
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

  addExample(example) {
    const uuid = uuidv4();
    const examples = this.state.get('examples');
    examples[uuid] = example;

    this.updateModel(examples);
  }

  deleteExample(uuid) {
    const examples = this.state.get('examples');

    if (uuid in examples) {
      delete examples[uuid];
      this.updateModel(examples);
    }
  }

  clearExamples(label = null) {
    const clearedExamples = {};

    if (label !== null) {
      const examples = this.state.get('examples');

      for (let uuid in examples) {
        if (examples[uuid].label !== label) {
          clearedExamples[uuid] = examples[uuid];
        }
      }
    }

    this.updateModel(clearedExamples);
  }

  createLabel(label) {
    const labels = this.state.get('labels');

    if (labels.indexOf(label) === -1) {
      labels.push(label);
      // console.log('> labels', labels);
      this.state.set({ labels });
    }
  }

  updateLabel(oldLabel, newLabel) {
    const { labels, labelAudioFileTable, examples } = this.state.getValues();

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

      this.updateModel(examples);
      this.state.set({
        labels: updatedLabels,
        labelAudioFileTable: updatedTable,
      });
    }
  }

  deleteLabel(label) {
    const { labels, labelAudioFileTable, examples } = this.state.getValues();
    if (label === null) {
      console.log('clear all labels');
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

  async updateModel(examples = null) {
    if (examples === null) {
      examples = this.state.get('examples');
    }

    // ---------------------------------------
    const logPrefix = `[session "${this.state.get('id')}"]`;
    // ---------------------------------------
    const labels = Object.values(examples).map(d => d.label).filter((d, i, arr) => arr.indexOf(d) === i);
    console.log(`\n${logPrefix} > UPDATE MODEL - labels:`, labels);
    // ---------------------------------------
    const processingStartTime = new Date().getTime();
    console.log(`${logPrefix} processing start\t(# examples: ${Object.keys(examples).length})`);
    // ---------------------------------------

    // replace MLDecoder w/ DestBuffer in graph for recording transformed stream
    // @note - this can only work w/ 1 or 0 decoder,
    // @todo - handle cases w/ 2 or more decoders later.
    let hasDecoder = false;
    let buffer = null;

    for (let id in this.graph.modules) {
      const module = this.graph.modules[id];

      if (module.type === 'Buffer') {
        hasDecoder = true;
        buffer = module;
      }
    }

    if (buffer === null) {
      console.log(`\n${logPrefix} > graph does not contain any MLDecoder, abort training...`);
      return Promise.resolve();
    }

    let offlineSource;

    // @note - mimic rapid-mix API, remove / update later
    // const rapidMixExamples = {
    //   docType: 'rapid-mix:ml-training-set',
    //   docVersion: '1.0.0',
    //   payload: {
    //     inputDimension: 0,
    //     outputDimension: 0,
    //     data: [],
    //   }
    // }

    // for persistency
    const processedExamples = {};
    // we need to know the input dimension to create the training set, so we do it later
    let trainingSet = null;

    // process examples raw data in pre-processing graph
    Object.keys(examples).forEach((uuid, index) => {
      // pass the example through the graph to have the transformed stream
      const example = examples[uuid];

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

      // instanciate training set for this run
      if (trainingSet === null) {
        const inputDimension = transformedStream[0].length;
        trainingSet = xmm.TrainingSet({ inputDimension });
      }

      const phrase = trainingSet.push(index, example.label);
      // populate phrase with processed example data
      transformedStream.forEach(frame => phrase.push(frame));

      // for log
      processedExamples[uuid] = {
        label: example.label,
        output: example.output,
        input: transformedStream,
      };
    });

    // persists processed examples for debug
    await db.write(path.join(this.directory, '.ml-processed-examples.debug.json'), processedExamples, false);

    // if no examples, create an empty trainng set
    if (trainingSet === null) {
      trainingSet = xmm.TrainingSet({ inputDimension: 0 });
    }

    // ---------------------------------------
    const processingTime = new Date().getTime() - processingStartTime;
    console.log(`${logPrefix} processing end\t\t(${processingTime}ms)`);
    // ---------------------------------------
    const trainingStartTime = new Date().getTime();
    console.log(`${logPrefix} training start\t\t(# input dimensions: ${trainingSet.inputDimension})`);
    // ---------------------------------------

    // train model
    // ---------------------------------------
    /** `learningConfig`:
     *  {
     *    target: { name: 'xmm' },
     *    payload: {
     *      modelType: 'hhmm',
     *      gaussians: 1,
     *      absoluteRegularization: 0.1,
     *      relativeRegularization: 0.1,
     *      covarianceMode: 'full',
     *      hierarchical: true,
     *      states: 4,
     *      transitionMode: 'leftright', // this is weird
     *      regressionEstimator: 'full',
     *      likelihoodWindow: 10
     *    }
     *  }
     */
    const learningConfig = this.state.get('learningConfig').payload; // mano
    let model = null;

    if (learningConfig.modelType === 'gmm') {
      // https://xmmjs.netlify.app/#gmmconfiguration
      const config = {
        gaussians: learningConfig.gaussians,
        regularization: {
          relative: learningConfig.relativeRegularization,
          absolute: learningConfig.absoluteRegularization,
        },
        covarianceMode: learningConfig.covarianceMode,
      };

      model = xmm.trainMulticlassGMM(trainingSet, config);
    } else if (learningConfig.modelType === 'hhmm') {
      // https://xmmjs.netlify.app/#hmmconfiguration
      const config = {
        states: learningConfig.states,
        gaussians: learningConfig.gaussians,
        regularization: {
          relative: learningConfig.relativeRegularization,
          absolute: learningConfig.absoluteRegularization,
        },
        covarianceMode: learningConfig.covarianceMode,
      };

      model = xmm.trainMulticlassHMM(trainingSet, config);
    } else {
      console.error(`${logPrefix} undefined model type ${learningConfig.modelType}, should be gmm or hhmm`);
    }

    this.state.set({ examples, model });

    // ---------------------------------------
    const trainingTime = new Date().getTime() - trainingStartTime;
    console.log(`${logPrefix} training end\t\t(${trainingTime}ms)`);
    // ---------------------------------------
  }
}

export default Session;
