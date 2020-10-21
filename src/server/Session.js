import path from 'path';
import fs from 'fs';
import { uuid as uuidv4 } from 'uuidv4';

import xmm from 'xmm-node';
import XmmProcessor from '../common/libs/mano/XmmProcessor.js';
import rapidMixAdapters from 'rapid-mix-adapters';

import db from './utils/db';
import diffArrays from '../common/utils/diffArrays.js';
import Graph from '../common/Graph.js';
import OfflineSource from '../common/sources/OfflineSource.js';
import clonedeep from 'lodash.clonedeep';

class Session {

  /** factory methods */
  static async create(como, id, name, graph, audioFiles) {
    const session = new Session(como, id);
    await session.init({ name, graph });
    await session.updateAudioFilesFromFileSystem(audioFiles);

    await session.persist();
    return session;
  }

  static async fromFileSystem(como, dirname, audioFiles) {
    let configFileExists;
    let id;
    let config;

    // facilitate moving from old config format to new one
    if (fs.existsSync(path.join(dirname, 'config.json'))) {
      const json = await db.read(path.join(dirname, 'config.json'));
      id = json.id;
      config = json;
      configFileExists = true;
    } else {
      // version 0.0.0
      const metas = await db.read(path.join(dirname, 'metas.json'));
      const dataGraph = await db.read(path.join(dirname, `graph-data.json`));
      const audioGraph = await db.read(path.join(dirname, `graph-audio.json`));
      const learningConfig = await db.read(path.join(dirname, 'ml-config.json'));
      const examples = await db.read(path.join(dirname, '.ml-examples.json'));
      const model = await db.read(path.join(dirname, '.ml-model.json'));

      id = metas.id;
      config = {
        name: metas.name,
        graph: { data: dataGraph, audio: audioGraph },
        learningConfig,
        examples,
        model,
      };
      configFileExists = false;
    }

    const session = new Session(como, id);
    await session.init(config);
    await session.updateAudioFilesFromFileSystem(audioFiles);

    // delete old config file
    if (configFileExists) {
      await db.delete(path.join(dirname, 'config.json'));
    }

    return session;
  }

  constructor(como, id) {
    this.como = como;
    this.id = id;

    this.directory = path.join(this.como.projectDirectory, 'sessions', id);

    this.xmmInstances = {
      'gmm': new xmm('gmm'),
      'hhmm': new xmm('hhmm'),
    };
    // @note - only used for config formatting
    // this should be simplified, the translation between xmm / mano / rapidmix
    // config format is really messy
    this.processor = new XmmProcessor();
  }

  async persist(key = null) {
    const values = this.state.getValues();

    if (key === null || key === 'name') {
      const { id, name } = values;
      await db.write(path.join(this.directory, 'metas.json'), { id, name, version: '0.0.0' });
    }

    if (key === null || key === 'graph' || key === 'graphOptions') {
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

    if (key === null || key === 'learningConfig') {
      const { learningConfig } = values;
      await db.write(path.join(this.directory, 'ml-config.json'), learningConfig);
    }

    // generated files, keep them hidden
    if (key === null || key === 'examples') {
      const { examples } = values;
      await db.write(path.join(this.directory, '.ml-examples.json'), examples, false);
    }

    if (key === null || key === 'model') {
      const { model } = values;
      await db.write(path.join(this.directory, '.ml-model.json'), model, false);
    }

    if (key === null || key === 'audioFiles') {
      const { audioFiles } = values;
      await db.write(path.join(this.directory, '.audio-files.json'), audioFiles, false);
    }
  }

  get(name) {
    return this.state.get(name);
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
      acc[desc.id] = desc.options || {};
      return acc;
    }, {});

    this.state = await this.como.server.stateManager.create(`session`, initValues);

    this.state.subscribe(async updates => {
      for (let [name, values] of Object.entries(updates)) {
        switch (name) {
          // if updates['audioFiles'] => handle labels (old / new) and retrain model if needed
          // @todo - we should also take into account the `active` label
          // @note - this should probably be cleaned up when updated from file system too, TBC
          case 'audioFiles': {
            const examples = this.state.get('examples');
            const labels = values.map(file => file.label);
            let dirty = false;
            // delete examples with a label that does not exists anymore
            for (let uuid in examples) {
              const exampleLabel = examples[uuid].label;

              if (labels.indexOf(exampleLabel) === -1) {
                delete examples[uuid];
                dirty = true;
              }
            }

            if (dirty) {
              this._updateModel(examples);
            }
            break;
          }

          case 'graphOptionsEvent': {
            const graphOptions = this.state.get('graphOptions');

            for (let moduleId in values) {
              // delete scriptParams on scriptName change
              if ('scriptName' in values[moduleId]) {
                delete graphOptions[moduleId].scriptParams;
                // @todo - update the model when a dataScript is upated...
                // this._updateModel(this.state.get('examples'));
              }

              Object.assign(graphOptions[moduleId], values[moduleId]);
            }

            this.state.set({ graphOptions });

            // forward event to players attached to the session
            Array.from(this.como.project.players.values())
              .filter(player => player.get('sessionId') === this.id)
              .forEach(player => player.set({ graphOptionsEvent: values }));

            break;
          }

          case 'learningConfig': {
            const examples = this.state.get('examples');
            this._updateModel(examples);
            break;
          }
        }

        await this.persist(name);
      }
    });

    // init model
    const examples = this.state.get('examples');
    await this._updateModel(examples);
  }

  async updateAudioFilesFromFileSystem(audioFileTree) {
    const audioFiles = this.state.get('audioFiles');
    const { deleted, created } = diffArrays(audioFiles, audioFileTree, f => f.url);
    // created
    created.forEach(createdFile => {
      const copy = Object.assign({}, createdFile);
      copy.active = true;
      copy.label = createdFile.name;

      audioFiles.push(copy);
    });

    // deleted
    deleted.forEach(deletedFile => {
      const index = audioFiles.findIndex(f => f.url === deletedFile.url);
      audioFiles.splice(index, 1);
    });

    await this.state.set({ audioFiles });
  }

  addExample(example) {
    const uuid = uuidv4();
    const examples = this.state.get('examples');
    examples[uuid] = example;

    this._updateModel(examples);
  }

  deleteExample(uuid) {
    const examples = this.state.get('examples');

    if (uuid in examples) {
      delete examples[uuid];
      this._updateModel(examples);
    }
  }

  clearExamples() {
    const examples = {};
    this._updateModel(examples);
  }

  clearLabel(label) {
    const examples = this.state.get('examples');

    for (let uuid in examples) {
      const example = examples[uuid];

      if (example.label === label) {
        delete examples[uuid];
      }
    }

    this._updateModel(examples);
  }

  async _updateModel(examples) {
    // ---------------------------------------
    const logPrefix = `[session "${this.state.get('id')}"]`;
    // ---------------------------------------
    const labels = Object.values(examples).map(d => d.label).filter((d, i, arr) => arr.indexOf(d) === i);
    console.log(`\n${logPrefix} > UPDATE MODEL - labels:`, labels);
    // ---------------------------------------
    const processingStartTime = new Date().getTime();
    console.log(`${logPrefix} processing start\t(# examples: ${Object.keys(examples).length})`);
    // ---------------------------------------

    const graphDescription = this.state.get('graph');
    const graphData = clonedeep(graphDescription.data);

    // replace MLDecoder w/ DestBuffer in graph for recording transformed stream
    // @note - we concentrate on case w/ 1 or 0 decoder,
    //         we will handle cases w/ 2 or more decoders later.
    let hasDecoder = false;
    let bufferId = null;

    graphData.modules.forEach(module => {
      if (module.type === 'MLDecoder') {
        module.type = 'Buffer';

        hasDecoder = true;
        bufferId = module.id;
      }
    });

    if (!hasDecoder) {
      console.log(`\n${logPrefix} > graph does not contain any MLDecoder, abort traning...`);
      return Promise.resolve();
    }

    const graph = new Graph(this.como, { data: graphData }, this, null, true);
    await graph.init();

    const buffer = graph.getModule(bufferId);
    let offlineSource;

    // @note - mimic rapid-mix API, remove / update later
    const processedExamples = {
      docType: 'rapid-mix:ml-training-set',
      docVersion: '1.0.0',
      payload: {
        inputDimension: 0,
        outputDimension: 0,
        data: [],
      }
    }

    // process examples raw data in pre-processing graph
    for (let uuid in examples) {
      const example = examples[uuid];

      offlineSource = new OfflineSource(example.input);
      graph.setSource(offlineSource);

      // run the graph offline, this MUST be synchronous
      offlineSource.run();
      const transformedStream = buffer.getData();

      if (example.input.length !== transformedStream.length) {
        throw new Error(`${logPrefix} Error: incoherent example processing for example ${uuid}`);
      }

      graph.removeSource(offlineSource);
      buffer.reset();

      // add to processed examples
      processedExamples.payload.data.push({
        label: example.label,
        output: example.output,
        input: transformedStream,
      });
    }

    if (processedExamples.payload.data[0]) {
      processedExamples.payload.inputDimension = processedExamples.payload.data[0].input[0].length;
    }

    // ---------------------------------------
    const processingTime = new Date().getTime() - processingStartTime;
    console.log(`${logPrefix} processing end\t\t(${processingTime}ms)`);
    // ---------------------------------------
    const trainingStartTime = new Date().getTime();
    const numInputDimensions = processedExamples.payload.inputDimension;
    console.log(`${logPrefix} training start\t\t(# input dimensions: ${numInputDimensions})`);
    // ---------------------------------------

    // train model
    // @todo - clean this f****** messy Mano / RapidMix / Xmm convertion
    const xmmTrainingSet = rapidMixAdapters.rapidMixToXmmTrainingSet(processedExamples);

    const learningConfig = this.state.get('learningConfig'); // mano
    this.processor.setConfig(learningConfig)
    const rapidMixConfig = this.processor.getConfig(); // rapidMix
    const xmmConfig = rapidMixAdapters.rapidMixToXmmConfig(rapidMixConfig); // xmm

    // get (gmm|hhmm) xmm instance
    const xmm = this.xmmInstances[learningConfig.payload.modelType];

    xmm.setConfig(xmmConfig);
    xmm.setTrainingSet(xmmTrainingSet);


    return new Promise((resolve, reject) => {
      xmm.train((err, model) => {
        if (err) {
          reject(err);
        }

        const rapidMixModel = rapidMixAdapters.xmmToRapidMixModel(model);
        this.state.set({ examples: examples, model: rapidMixModel });

        // ---------------------------------------
        const trainingTime = new Date().getTime() - trainingStartTime;
        console.log(`${logPrefix} training end\t\t(${trainingTime}ms)`);
        // ---------------------------------------

        resolve();
      });
    });
  }
}

export default Session;
