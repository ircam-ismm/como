"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _path = _interopRequireDefault(require("path"));

var _fs = _interopRequireDefault(require("fs"));

var _uuid = require("uuid");

var _xmmNode = _interopRequireDefault(require("xmm-node"));

var _rapidMixAdapters = _interopRequireDefault(require("rapid-mix-adapters"));

var _db = _interopRequireDefault(require("./utils/db"));

var _diffArrays = _interopRequireDefault(require("../common/utils/diffArrays.js"));

var _Graph = _interopRequireDefault(require("../common/Graph.js"));

var _OfflineSource = _interopRequireDefault(require("../common/sources/OfflineSource.js"));

var _lodash = _interopRequireDefault(require("lodash.clonedeep"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// import XmmProcessor from '../common/libs/mano/XmmProcessor.js';
class Session {
  /** factory methods */
  static async create(como, id, name, graph, fsAudioFiles) {
    const session = new Session(como, id);
    await session.init({
      name,
      graph
    });
    await session.updateAudioFilesFromFileSystem(fsAudioFiles); // by default (to be backward usage compatible):
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
    await session.set({
      labels,
      labelAudioFileTable
    });
    await session.persist();
    return session;
  }

  static async fromFileSystem(como, dirname, fsAudioFiles) {
    // @note - version 0.0.0 (cf.metas)
    const metas = await _db.default.read(_path.default.join(dirname, 'metas.json'));
    const dataGraph = await _db.default.read(_path.default.join(dirname, `graph-data.json`));
    const audioGraph = await _db.default.read(_path.default.join(dirname, `graph-audio.json`));
    const labels = await _db.default.read(_path.default.join(dirname, 'labels.json'));
    const labelAudioFileTable = await _db.default.read(_path.default.join(dirname, 'label-audio-files-table.json'));
    const learningConfig = await _db.default.read(_path.default.join(dirname, 'ml-config.json'));
    const examples = await _db.default.read(_path.default.join(dirname, '.ml-examples.json'));
    const model = await _db.default.read(_path.default.join(dirname, '.ml-model.json'));
    const audioFiles = await _db.default.read(_path.default.join(dirname, '.audio-files.json')); // remove examples that are not in labels

    let saveExamples = false;
    console.log(''); // just a line break in the console

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
      graph: {
        data: dataGraph,
        audio: audioGraph
      },
      labels,
      labelAudioFileTable,
      learningConfig,
      examples,
      model,
      audioFiles
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
    this.directory = _path.default.join(this.como.projectDirectory, 'sessions', id);
    this.xmmInstances = {
      'gmm': new _xmmNode.default('gmm'),
      'hhmm': new _xmmNode.default('hhmm')
    };
  }

  async persist(key = null) {
    const values = this.state.getValues();

    if (key === null || key === 'name') {
      const {
        id,
        name
      } = values;
      await _db.default.write(_path.default.join(this.directory, 'metas.json'), {
        id,
        name,
        version: '0.0.0'
      });
    }

    if (key === null || key === 'labels') {
      const {
        labels
      } = values;
      await _db.default.write(_path.default.join(this.directory, 'labels.json'), labels);
    }

    if (key === null || key === 'labelAudioFileTable') {
      const {
        labelAudioFileTable
      } = values;
      await _db.default.write(_path.default.join(this.directory, 'label-audio-files-table.json'), labelAudioFileTable);
    }

    if (key === null || key === 'graph' || key === 'graphOptions') {
      // reapply current graph options into graph definitions
      const {
        graph,
        graphOptions
      } = values;
      const types = ['data', 'audio'];

      for (let i = 0; i < types.length; i++) {
        const type = types[i];
        const subGraph = graph[type];
        subGraph.modules.forEach(desc => {
          if (Object.keys(graphOptions[desc.id]).length) {
            desc.options = graphOptions[desc.id];
          }
        });
        await _db.default.write(_path.default.join(this.directory, `graph-${type}.json`), subGraph);
      }
    }

    if (key === null || key === 'learningConfig') {
      const {
        learningConfig
      } = values;
      await _db.default.write(_path.default.join(this.directory, 'ml-config.json'), learningConfig);
    } // generated files, keep them hidden


    if (key === null || key === 'examples') {
      const {
        examples
      } = values;
      await _db.default.write(_path.default.join(this.directory, '.ml-examples.json'), examples, false);
    }

    if (key === null || key === 'processedExamples') {
      const {
        processedExamples
      } = values;
      await _db.default.write(_path.default.join(this.directory, '.ml-processed-examples.debug.json'), processedExamples, false);
    }

    if (key === null || key === 'model') {
      const {
        model
      } = values;
      await _db.default.write(_path.default.join(this.directory, '.ml-model.json'), model, false);
    }

    if (key === null || key === 'audioFiles') {
      const {
        audioFiles
      } = values;
      await _db.default.write(_path.default.join(this.directory, '.audio-files.json'), audioFiles, false);
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
    initValues.id = this.id; // extract graph options from graph definition

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

          case 'learningConfig':
            {
              this.updateModel();
              break;
            }
        }

        await this.persist(name);
      }
    }); // init graph

    const graphDescription = this.state.get('graph');
    const dataGraph = (0, _lodash.default)(graphDescription.data);
    dataGraph.modules.forEach(module => {
      if (module.type === 'MLDecoder') {
        module.type = 'Buffer';
      }
    });
    this.graph = new _Graph.default(this.como, {
      data: dataGraph
    }, this, null, true);
    await this.graph.init(); // init model

    await this.updateModel();
  }

  async updateAudioFilesFromFileSystem(audioFileTree) {
    const {
      audioFiles,
      labelAudioFileTable
    } = this.state.getValues();
    const {
      deleted,
      created
    } = (0, _diffArrays.default)(audioFiles, audioFileTree, f => f.url);
    created.forEach(createdFile => {
      const copy = Object.assign({}, createdFile);
      copy.active = true;
      audioFiles.push(copy); // create label and default [label, file] row entry

      this.createLabel(createdFile.name);
      this.createLabelAudioFileRow([createdFile.name, createdFile.name]);
    });
    deleted.forEach(deletedFile => {
      const index = audioFiles.findIndex(f => f.url === deletedFile.url);
      audioFiles.splice(index, 1); // delete label

      this.deleteLabel(deletedFile.name); // delete rows where audio file appears

      const rows = labelAudioFileTable.filter(r => r[1] === deletedFile.name);
      rows.forEach(row => this.deleteLabelAudioFileRow(row));
    });
    await this.state.set({
      audioFiles
    });
  }

  addExample(example) {
    const uuid = (0, _uuid.v4)();
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
      labels.push(label); // console.log('> labels', labels);

      this.state.set({
        labels
      });
    }
  }

  updateLabel(oldLabel, newLabel) {
    const {
      labels,
      labelAudioFileTable,
      examples
    } = this.state.getValues();

    if (labels.indexOf(oldLabel) !== -1 && labels.indexOf(newLabel) === -1) {
      const updatedLabels = labels.map(label => label === oldLabel ? newLabel : label);
      const updatedTable = labelAudioFileTable.map(row => {
        if (row[0] === oldLabel) {
          row[0] = newLabel;
        }

        return row;
      }); // updates labels of existing examples

      for (let uuid in examples) {
        const example = examples[uuid];

        if (example.label === oldLabel) {
          example.label = newLabel;
        }
      }

      this.updateModel(examples);
      this.state.set({
        labels: updatedLabels,
        labelAudioFileTable: updatedTable
      });
    }
  }

  deleteLabel(label) {
    const {
      labels,
      labelAudioFileTable,
      examples
    } = this.state.getValues();

    if (labels.indexOf(label) !== -1) {
      // clean label / audio file table
      const filteredLabels = labels.filter(l => l !== label);
      const filteredTable = labelAudioFileTable.filter(row => row[0] !== label);
      this.clearExamples(label); // this retrains the model

      this.state.set({
        labels: filteredLabels,
        labelAudioFileTable: filteredTable
      });
    }
  }

  toggleAudioFile(filename, active) {
    const {
      audioFiles,
      labelAudioFileTable
    } = this.state.getValues();
    const audioFile = audioFiles.find(f => f.name === filename);
    audioFile.active = active;
    const updatedTable = labelAudioFileTable.filter(row => row[1] !== filename);
    this.state.set({
      audioFiles,
      labelAudioFileTable: updatedTable
    });
  }

  createLabelAudioFileRow(row) {
    const labelAudioFileTable = this.state.get('labelAudioFileTable');
    const index = labelAudioFileTable.findIndex(r => r[0] === row[0] && r[1] === row[1]);

    if (index === -1) {
      labelAudioFileTable.push(row);
      this.state.set({
        labelAudioFileTable
      });
    }
  }

  deleteLabelAudioFileRow(row) {
    const labelAudioFileTable = this.state.get('labelAudioFileTable');
    const filteredTable = labelAudioFileTable.filter(r => {
      return r[0] === row[0] && r[1] === row[1] ? false : true;
    });
    this.state.set({
      labelAudioFileTable: filteredTable
    });
  }

  async updateModel(examples = null) {
    if (examples === null) {
      examples = this.state.get('examples');
    } // ---------------------------------------


    const logPrefix = `[session "${this.state.get('id')}"]`; // ---------------------------------------

    const labels = Object.values(examples).map(d => d.label).filter((d, i, arr) => arr.indexOf(d) === i);
    console.log(`\n${logPrefix} > UPDATE MODEL - labels:`, labels); // ---------------------------------------

    const processingStartTime = new Date().getTime();
    console.log(`${logPrefix} processing start\t(# examples: ${Object.keys(examples).length})`); // ---------------------------------------
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
      console.log(`\n${logPrefix} > graph does not contain any MLDecoder, abort traning...`);
      return Promise.resolve();
    } // const buffer = graph.getModule(bufferId);


    let offlineSource; // @note - mimic rapid-mix API, remove / update later

    const rapidMixExamples = {
      docType: 'rapid-mix:ml-training-set',
      docVersion: '1.0.0',
      payload: {
        inputDimension: 0,
        outputDimension: 0,
        data: []
      }
    }; // for persistency, display

    const processedExamples = {}; // process examples raw data in pre-processing graph

    for (let uuid in examples) {
      const example = examples[uuid];
      offlineSource = new _OfflineSource.default(example.input);
      this.graph.setSource(offlineSource); // run the graph offline, this MUST be synchronous

      offlineSource.run();
      const transformedStream = buffer.getData();

      if (example.input.length !== transformedStream.length) {
        throw new Error(`${logPrefix} Error: incoherent example processing for example ${uuid}`);
      }

      this.graph.removeSource(offlineSource);
      buffer.reset();
      const processedExample = {
        label: example.label,
        output: example.output,
        input: transformedStream
      }; // add to processed examples

      rapidMixExamples.payload.data.push(processedExample);
      processedExamples[uuid] = processedExample;
    }

    if (rapidMixExamples.payload.data[0]) {
      rapidMixExamples.payload.inputDimension = rapidMixExamples.payload.data[0].input[0].length;
    } // ---------------------------------------


    const processingTime = new Date().getTime() - processingStartTime;
    console.log(`${logPrefix} processing end\t\t(${processingTime}ms)`); // ---------------------------------------

    const trainingStartTime = new Date().getTime();
    const numInputDimensions = rapidMixExamples.payload.inputDimension;
    console.log(`${logPrefix} training start\t\t(# input dimensions: ${numInputDimensions})`); // ---------------------------------------
    // train model
    // @todo - clean this f****** messy Mano / RapidMix / Xmm convertion

    const xmmTrainingSet = _rapidMixAdapters.default.rapidMixToXmmTrainingSet(rapidMixExamples);

    const learningConfig = this.state.get('learningConfig'); // mano

    const xmmConfig = _rapidMixAdapters.default.rapidMixToXmmConfig(learningConfig); // xmm


    console.log(logPrefix, 'xmm config', xmmConfig); // get (gmm|hhmm) xmm instance

    const xmm = this.xmmInstances[learningConfig.payload.modelType];
    xmm.setConfig(xmmConfig);
    xmm.setTrainingSet(xmmTrainingSet); // console.log(xmm.getConfig());

    return new Promise((resolve, reject) => {
      xmm.train((err, model) => {
        if (err) {
          reject(err);
        }

        const rapidMixModel = _rapidMixAdapters.default.xmmToRapidMixModel(model);

        this.state.set({
          examples,
          processedExamples,
          model: rapidMixModel
        }); // ---------------------------------------

        const trainingTime = new Date().getTime() - trainingStartTime;
        console.log(`${logPrefix} training end\t\t(${trainingTime}ms)`); // ---------------------------------------

        resolve();
      });
    });
  }

}

var _default = Session;
exports.default = _default;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9zZXJ2ZXIvU2Vzc2lvbi5qcyJdLCJuYW1lcyI6WyJTZXNzaW9uIiwiY3JlYXRlIiwiY29tbyIsImlkIiwibmFtZSIsImdyYXBoIiwiZnNBdWRpb0ZpbGVzIiwic2Vzc2lvbiIsImluaXQiLCJ1cGRhdGVBdWRpb0ZpbGVzRnJvbUZpbGVTeXN0ZW0iLCJyZWdpc3RlcmVkQXVkaW9GaWxlcyIsImdldCIsImxhYmVscyIsImxhYmVsQXVkaW9GaWxlVGFibGUiLCJmb3JFYWNoIiwiYXVkaW9GaWxlIiwibGFiZWwiLCJyb3ciLCJwdXNoIiwic2V0IiwicGVyc2lzdCIsImZyb21GaWxlU3lzdGVtIiwiZGlybmFtZSIsIm1ldGFzIiwiZGIiLCJyZWFkIiwicGF0aCIsImpvaW4iLCJkYXRhR3JhcGgiLCJhdWRpb0dyYXBoIiwibGVhcm5pbmdDb25maWciLCJleGFtcGxlcyIsIm1vZGVsIiwiYXVkaW9GaWxlcyIsInNhdmVFeGFtcGxlcyIsImNvbnNvbGUiLCJsb2ciLCJ1dWlkIiwiaW5kZXhPZiIsIndhcm4iLCJjb25maWciLCJkYXRhIiwiYXVkaW8iLCJjb25zdHJ1Y3RvciIsImRpcmVjdG9yeSIsInByb2plY3REaXJlY3RvcnkiLCJ4bW1JbnN0YW5jZXMiLCJ4bW0iLCJrZXkiLCJ2YWx1ZXMiLCJzdGF0ZSIsImdldFZhbHVlcyIsIndyaXRlIiwidmVyc2lvbiIsImdyYXBoT3B0aW9ucyIsInR5cGVzIiwiaSIsImxlbmd0aCIsInR5cGUiLCJzdWJHcmFwaCIsIm1vZHVsZXMiLCJkZXNjIiwiT2JqZWN0Iiwia2V5cyIsIm9wdGlvbnMiLCJwcm9jZXNzZWRFeGFtcGxlcyIsInVwZGF0ZXMiLCJzdWJzY3JpYmUiLCJmdW5jIiwiZGVsZXRlIiwiZGV0YWNoIiwiaW5pdFZhbHVlcyIsInJlZHVjZSIsImFjYyIsInNlcnZlciIsInN0YXRlTWFuYWdlciIsImVudHJpZXMiLCJwcm9qZWN0IiwiX3VwZGF0ZVNlc3Npb25zT3ZlcnZpZXciLCJ1cGRhdGVNb2RlbCIsImdyYXBoRGVzY3JpcHRpb24iLCJtb2R1bGUiLCJHcmFwaCIsImF1ZGlvRmlsZVRyZWUiLCJkZWxldGVkIiwiY3JlYXRlZCIsImYiLCJ1cmwiLCJjcmVhdGVkRmlsZSIsImNvcHkiLCJhc3NpZ24iLCJhY3RpdmUiLCJjcmVhdGVMYWJlbCIsImNyZWF0ZUxhYmVsQXVkaW9GaWxlUm93IiwiZGVsZXRlZEZpbGUiLCJpbmRleCIsImZpbmRJbmRleCIsInNwbGljZSIsImRlbGV0ZUxhYmVsIiwicm93cyIsImZpbHRlciIsInIiLCJkZWxldGVMYWJlbEF1ZGlvRmlsZVJvdyIsImFkZEV4YW1wbGUiLCJleGFtcGxlIiwiZGVsZXRlRXhhbXBsZSIsImNsZWFyRXhhbXBsZXMiLCJjbGVhcmVkRXhhbXBsZXMiLCJ1cGRhdGVMYWJlbCIsIm9sZExhYmVsIiwibmV3TGFiZWwiLCJ1cGRhdGVkTGFiZWxzIiwibWFwIiwidXBkYXRlZFRhYmxlIiwiZmlsdGVyZWRMYWJlbHMiLCJsIiwiZmlsdGVyZWRUYWJsZSIsInRvZ2dsZUF1ZGlvRmlsZSIsImZpbGVuYW1lIiwiZmluZCIsImxvZ1ByZWZpeCIsImQiLCJhcnIiLCJwcm9jZXNzaW5nU3RhcnRUaW1lIiwiRGF0ZSIsImdldFRpbWUiLCJoYXNEZWNvZGVyIiwiYnVmZmVyIiwiUHJvbWlzZSIsInJlc29sdmUiLCJvZmZsaW5lU291cmNlIiwicmFwaWRNaXhFeGFtcGxlcyIsImRvY1R5cGUiLCJkb2NWZXJzaW9uIiwicGF5bG9hZCIsImlucHV0RGltZW5zaW9uIiwib3V0cHV0RGltZW5zaW9uIiwiT2ZmbGluZVNvdXJjZSIsImlucHV0Iiwic2V0U291cmNlIiwicnVuIiwidHJhbnNmb3JtZWRTdHJlYW0iLCJnZXREYXRhIiwiRXJyb3IiLCJyZW1vdmVTb3VyY2UiLCJyZXNldCIsInByb2Nlc3NlZEV4YW1wbGUiLCJvdXRwdXQiLCJwcm9jZXNzaW5nVGltZSIsInRyYWluaW5nU3RhcnRUaW1lIiwibnVtSW5wdXREaW1lbnNpb25zIiwieG1tVHJhaW5pbmdTZXQiLCJyYXBpZE1peEFkYXB0ZXJzIiwicmFwaWRNaXhUb1htbVRyYWluaW5nU2V0IiwieG1tQ29uZmlnIiwicmFwaWRNaXhUb1htbUNvbmZpZyIsIm1vZGVsVHlwZSIsInNldENvbmZpZyIsInNldFRyYWluaW5nU2V0IiwicmVqZWN0IiwidHJhaW4iLCJlcnIiLCJyYXBpZE1peE1vZGVsIiwieG1tVG9SYXBpZE1peE1vZGVsIiwidHJhaW5pbmdUaW1lIl0sIm1hcHBpbmdzIjoiOzs7Ozs7O0FBQUE7O0FBQ0E7O0FBQ0E7O0FBRUE7O0FBRUE7O0FBRUE7O0FBQ0E7O0FBQ0E7O0FBQ0E7O0FBQ0E7Ozs7QUFQQTtBQVNBLE1BQU1BLE9BQU4sQ0FBYztBQUVaO0FBQ21CLGVBQU5DLE1BQU0sQ0FBQ0MsSUFBRCxFQUFPQyxFQUFQLEVBQVdDLElBQVgsRUFBaUJDLEtBQWpCLEVBQXdCQyxZQUF4QixFQUFzQztBQUN2RCxVQUFNQyxPQUFPLEdBQUcsSUFBSVAsT0FBSixDQUFZRSxJQUFaLEVBQWtCQyxFQUFsQixDQUFoQjtBQUNBLFVBQU1JLE9BQU8sQ0FBQ0MsSUFBUixDQUFhO0FBQUVKLE1BQUFBLElBQUY7QUFBUUMsTUFBQUE7QUFBUixLQUFiLENBQU47QUFDQSxVQUFNRSxPQUFPLENBQUNFLDhCQUFSLENBQXVDSCxZQUF2QyxDQUFOLENBSHVELENBS3ZEO0FBQ0E7QUFDQTs7QUFDQSxVQUFNSSxvQkFBb0IsR0FBR0gsT0FBTyxDQUFDSSxHQUFSLENBQVksWUFBWixDQUE3QjtBQUNBLFVBQU1DLE1BQU0sR0FBRyxFQUFmO0FBQ0EsVUFBTUMsbUJBQW1CLEdBQUcsRUFBNUI7QUFFQUgsSUFBQUEsb0JBQW9CLENBQUNJLE9BQXJCLENBQTZCQyxTQUFTLElBQUk7QUFDeEMsWUFBTUMsS0FBSyxHQUFHRCxTQUFTLENBQUNYLElBQXhCO0FBQ0EsWUFBTWEsR0FBRyxHQUFHLENBQUNELEtBQUQsRUFBUUQsU0FBUyxDQUFDWCxJQUFsQixDQUFaO0FBQ0FRLE1BQUFBLE1BQU0sQ0FBQ00sSUFBUCxDQUFZRixLQUFaO0FBQ0FILE1BQUFBLG1CQUFtQixDQUFDSyxJQUFwQixDQUF5QkQsR0FBekI7QUFDRCxLQUxEO0FBT0EsVUFBTVYsT0FBTyxDQUFDWSxHQUFSLENBQVk7QUFBRVAsTUFBQUEsTUFBRjtBQUFVQyxNQUFBQTtBQUFWLEtBQVosQ0FBTjtBQUNBLFVBQU1OLE9BQU8sQ0FBQ2EsT0FBUixFQUFOO0FBRUEsV0FBT2IsT0FBUDtBQUNEOztBQUUwQixlQUFkYyxjQUFjLENBQUNuQixJQUFELEVBQU9vQixPQUFQLEVBQWdCaEIsWUFBaEIsRUFBOEI7QUFDdkQ7QUFDQSxVQUFNaUIsS0FBSyxHQUFHLE1BQU1DLFlBQUdDLElBQUgsQ0FBUUMsY0FBS0MsSUFBTCxDQUFVTCxPQUFWLEVBQW1CLFlBQW5CLENBQVIsQ0FBcEI7QUFDQSxVQUFNTSxTQUFTLEdBQUcsTUFBTUosWUFBR0MsSUFBSCxDQUFRQyxjQUFLQyxJQUFMLENBQVVMLE9BQVYsRUFBb0IsaUJBQXBCLENBQVIsQ0FBeEI7QUFDQSxVQUFNTyxVQUFVLEdBQUcsTUFBTUwsWUFBR0MsSUFBSCxDQUFRQyxjQUFLQyxJQUFMLENBQVVMLE9BQVYsRUFBb0Isa0JBQXBCLENBQVIsQ0FBekI7QUFDQSxVQUFNVixNQUFNLEdBQUcsTUFBTVksWUFBR0MsSUFBSCxDQUFRQyxjQUFLQyxJQUFMLENBQVVMLE9BQVYsRUFBbUIsYUFBbkIsQ0FBUixDQUFyQjtBQUNBLFVBQU1ULG1CQUFtQixHQUFHLE1BQU1XLFlBQUdDLElBQUgsQ0FBUUMsY0FBS0MsSUFBTCxDQUFVTCxPQUFWLEVBQW1CLDhCQUFuQixDQUFSLENBQWxDO0FBQ0EsVUFBTVEsY0FBYyxHQUFHLE1BQU1OLFlBQUdDLElBQUgsQ0FBUUMsY0FBS0MsSUFBTCxDQUFVTCxPQUFWLEVBQW1CLGdCQUFuQixDQUFSLENBQTdCO0FBQ0EsVUFBTVMsUUFBUSxHQUFHLE1BQU1QLFlBQUdDLElBQUgsQ0FBUUMsY0FBS0MsSUFBTCxDQUFVTCxPQUFWLEVBQW1CLG1CQUFuQixDQUFSLENBQXZCO0FBQ0EsVUFBTVUsS0FBSyxHQUFHLE1BQU1SLFlBQUdDLElBQUgsQ0FBUUMsY0FBS0MsSUFBTCxDQUFVTCxPQUFWLEVBQW1CLGdCQUFuQixDQUFSLENBQXBCO0FBQ0EsVUFBTVcsVUFBVSxHQUFHLE1BQU1ULFlBQUdDLElBQUgsQ0FBUUMsY0FBS0MsSUFBTCxDQUFVTCxPQUFWLEVBQW1CLG1CQUFuQixDQUFSLENBQXpCLENBVnVELENBWXZEOztBQUNBLFFBQUlZLFlBQVksR0FBRyxLQUFuQjtBQUNBQyxJQUFBQSxPQUFPLENBQUNDLEdBQVIsQ0FBWSxFQUFaLEVBZHVELENBY3RDOztBQUVqQixTQUFLLElBQUlDLElBQVQsSUFBaUJOLFFBQWpCLEVBQTJCO0FBQ3pCLFlBQU1mLEtBQUssR0FBR2UsUUFBUSxDQUFDTSxJQUFELENBQVIsQ0FBZXJCLEtBQTdCOztBQUNBLFVBQUlKLE1BQU0sQ0FBQzBCLE9BQVAsQ0FBZXRCLEtBQWYsTUFBMEIsQ0FBQyxDQUEvQixFQUFrQztBQUNoQ21CLFFBQUFBLE9BQU8sQ0FBQ0ksSUFBUixDQUFjLGFBQVloQixLQUFLLENBQUNuQixJQUFLLHNDQUFxQ1ksS0FBTSw0Q0FBMkNKLE1BQU0sQ0FBQ2UsSUFBUCxDQUFZLElBQVosQ0FBa0IsR0FBN0k7QUFFQSxlQUFPSSxRQUFRLENBQUNNLElBQUQsQ0FBZjtBQUNBSCxRQUFBQSxZQUFZLEdBQUcsSUFBZjtBQUNEO0FBQ0Y7O0FBRUQsVUFBTS9CLEVBQUUsR0FBR29CLEtBQUssQ0FBQ3BCLEVBQWpCO0FBQ0EsVUFBTXFDLE1BQU0sR0FBRztBQUNicEMsTUFBQUEsSUFBSSxFQUFFbUIsS0FBSyxDQUFDbkIsSUFEQztBQUViQyxNQUFBQSxLQUFLLEVBQUU7QUFBRW9DLFFBQUFBLElBQUksRUFBRWIsU0FBUjtBQUFtQmMsUUFBQUEsS0FBSyxFQUFFYjtBQUExQixPQUZNO0FBR2JqQixNQUFBQSxNQUhhO0FBSWJDLE1BQUFBLG1CQUphO0FBS2JpQixNQUFBQSxjQUxhO0FBTWJDLE1BQUFBLFFBTmE7QUFPYkMsTUFBQUEsS0FQYTtBQVFiQyxNQUFBQTtBQVJhLEtBQWY7QUFXQSxVQUFNMUIsT0FBTyxHQUFHLElBQUlQLE9BQUosQ0FBWUUsSUFBWixFQUFrQkMsRUFBbEIsQ0FBaEI7QUFDQSxVQUFNSSxPQUFPLENBQUNDLElBQVIsQ0FBYWdDLE1BQWIsQ0FBTjs7QUFFQSxRQUFJTixZQUFKLEVBQWtCO0FBQ2hCM0IsTUFBQUEsT0FBTyxDQUFDYSxPQUFSLENBQWdCLFVBQWhCO0FBQ0Q7O0FBRUQsVUFBTWIsT0FBTyxDQUFDRSw4QkFBUixDQUF1Q0gsWUFBdkMsQ0FBTjtBQUVBLFdBQU9DLE9BQVA7QUFDRDs7QUFFRG9DLEVBQUFBLFdBQVcsQ0FBQ3pDLElBQUQsRUFBT0MsRUFBUCxFQUFXO0FBQ3BCLFNBQUtELElBQUwsR0FBWUEsSUFBWjtBQUNBLFNBQUtDLEVBQUwsR0FBVUEsRUFBVjtBQUVBLFNBQUt5QyxTQUFMLEdBQWlCbEIsY0FBS0MsSUFBTCxDQUFVLEtBQUt6QixJQUFMLENBQVUyQyxnQkFBcEIsRUFBc0MsVUFBdEMsRUFBa0QxQyxFQUFsRCxDQUFqQjtBQUVBLFNBQUsyQyxZQUFMLEdBQW9CO0FBQ2xCLGFBQU8sSUFBSUMsZ0JBQUosQ0FBUSxLQUFSLENBRFc7QUFFbEIsY0FBUSxJQUFJQSxnQkFBSixDQUFRLE1BQVI7QUFGVSxLQUFwQjtBQUlEOztBQUVZLFFBQVAzQixPQUFPLENBQUM0QixHQUFHLEdBQUcsSUFBUCxFQUFhO0FBQ3hCLFVBQU1DLE1BQU0sR0FBRyxLQUFLQyxLQUFMLENBQVdDLFNBQVgsRUFBZjs7QUFFQSxRQUFJSCxHQUFHLEtBQUssSUFBUixJQUFnQkEsR0FBRyxLQUFLLE1BQTVCLEVBQW9DO0FBQ2xDLFlBQU07QUFBRTdDLFFBQUFBLEVBQUY7QUFBTUMsUUFBQUE7QUFBTixVQUFlNkMsTUFBckI7QUFDQSxZQUFNekIsWUFBRzRCLEtBQUgsQ0FBUzFCLGNBQUtDLElBQUwsQ0FBVSxLQUFLaUIsU0FBZixFQUEwQixZQUExQixDQUFULEVBQWtEO0FBQUV6QyxRQUFBQSxFQUFGO0FBQU1DLFFBQUFBLElBQU47QUFBWWlELFFBQUFBLE9BQU8sRUFBRTtBQUFyQixPQUFsRCxDQUFOO0FBQ0Q7O0FBRUQsUUFBSUwsR0FBRyxLQUFLLElBQVIsSUFBZ0JBLEdBQUcsS0FBSyxRQUE1QixFQUFzQztBQUNwQyxZQUFNO0FBQUVwQyxRQUFBQTtBQUFGLFVBQWFxQyxNQUFuQjtBQUNBLFlBQU16QixZQUFHNEIsS0FBSCxDQUFTMUIsY0FBS0MsSUFBTCxDQUFVLEtBQUtpQixTQUFmLEVBQTBCLGFBQTFCLENBQVQsRUFBbURoQyxNQUFuRCxDQUFOO0FBQ0Q7O0FBRUQsUUFBSW9DLEdBQUcsS0FBSyxJQUFSLElBQWdCQSxHQUFHLEtBQUsscUJBQTVCLEVBQW1EO0FBQ2pELFlBQU07QUFBRW5DLFFBQUFBO0FBQUYsVUFBMEJvQyxNQUFoQztBQUNBLFlBQU16QixZQUFHNEIsS0FBSCxDQUFTMUIsY0FBS0MsSUFBTCxDQUFVLEtBQUtpQixTQUFmLEVBQTBCLDhCQUExQixDQUFULEVBQW9FL0IsbUJBQXBFLENBQU47QUFDRDs7QUFFRCxRQUFJbUMsR0FBRyxLQUFLLElBQVIsSUFBZ0JBLEdBQUcsS0FBSyxPQUF4QixJQUFtQ0EsR0FBRyxLQUFLLGNBQS9DLEVBQStEO0FBQzdEO0FBQ0EsWUFBTTtBQUFFM0MsUUFBQUEsS0FBRjtBQUFTaUQsUUFBQUE7QUFBVCxVQUEwQkwsTUFBaEM7QUFDQSxZQUFNTSxLQUFLLEdBQUcsQ0FBQyxNQUFELEVBQVMsT0FBVCxDQUFkOztBQUVBLFdBQUssSUFBSUMsQ0FBQyxHQUFHLENBQWIsRUFBZ0JBLENBQUMsR0FBR0QsS0FBSyxDQUFDRSxNQUExQixFQUFrQ0QsQ0FBQyxFQUFuQyxFQUF1QztBQUNyQyxjQUFNRSxJQUFJLEdBQUdILEtBQUssQ0FBQ0MsQ0FBRCxDQUFsQjtBQUNBLGNBQU1HLFFBQVEsR0FBR3RELEtBQUssQ0FBQ3FELElBQUQsQ0FBdEI7QUFFQUMsUUFBQUEsUUFBUSxDQUFDQyxPQUFULENBQWlCOUMsT0FBakIsQ0FBeUIrQyxJQUFJLElBQUk7QUFDL0IsY0FBSUMsTUFBTSxDQUFDQyxJQUFQLENBQVlULFlBQVksQ0FBQ08sSUFBSSxDQUFDMUQsRUFBTixDQUF4QixFQUFtQ3NELE1BQXZDLEVBQStDO0FBQzdDSSxZQUFBQSxJQUFJLENBQUNHLE9BQUwsR0FBZVYsWUFBWSxDQUFDTyxJQUFJLENBQUMxRCxFQUFOLENBQTNCO0FBQ0Q7QUFDRixTQUpEO0FBTUEsY0FBTXFCLFlBQUc0QixLQUFILENBQVMxQixjQUFLQyxJQUFMLENBQVUsS0FBS2lCLFNBQWYsRUFBMkIsU0FBUWMsSUFBSyxPQUF4QyxDQUFULEVBQTBEQyxRQUExRCxDQUFOO0FBQ0Q7QUFDRjs7QUFFRCxRQUFJWCxHQUFHLEtBQUssSUFBUixJQUFnQkEsR0FBRyxLQUFLLGdCQUE1QixFQUE4QztBQUM1QyxZQUFNO0FBQUVsQixRQUFBQTtBQUFGLFVBQXFCbUIsTUFBM0I7QUFDQSxZQUFNekIsWUFBRzRCLEtBQUgsQ0FBUzFCLGNBQUtDLElBQUwsQ0FBVSxLQUFLaUIsU0FBZixFQUEwQixnQkFBMUIsQ0FBVCxFQUFzRGQsY0FBdEQsQ0FBTjtBQUNELEtBeEN1QixDQTBDeEI7OztBQUNBLFFBQUlrQixHQUFHLEtBQUssSUFBUixJQUFnQkEsR0FBRyxLQUFLLFVBQTVCLEVBQXdDO0FBQ3RDLFlBQU07QUFBRWpCLFFBQUFBO0FBQUYsVUFBZWtCLE1BQXJCO0FBQ0EsWUFBTXpCLFlBQUc0QixLQUFILENBQVMxQixjQUFLQyxJQUFMLENBQVUsS0FBS2lCLFNBQWYsRUFBMEIsbUJBQTFCLENBQVQsRUFBeURiLFFBQXpELEVBQW1FLEtBQW5FLENBQU47QUFDRDs7QUFFRixRQUFJaUIsR0FBRyxLQUFLLElBQVIsSUFBZ0JBLEdBQUcsS0FBSyxtQkFBNUIsRUFBaUQ7QUFDOUMsWUFBTTtBQUFFaUIsUUFBQUE7QUFBRixVQUF3QmhCLE1BQTlCO0FBQ0EsWUFBTXpCLFlBQUc0QixLQUFILENBQVMxQixjQUFLQyxJQUFMLENBQVUsS0FBS2lCLFNBQWYsRUFBMEIsbUNBQTFCLENBQVQsRUFBeUVxQixpQkFBekUsRUFBNEYsS0FBNUYsQ0FBTjtBQUNEOztBQUVELFFBQUlqQixHQUFHLEtBQUssSUFBUixJQUFnQkEsR0FBRyxLQUFLLE9BQTVCLEVBQXFDO0FBQ25DLFlBQU07QUFBRWhCLFFBQUFBO0FBQUYsVUFBWWlCLE1BQWxCO0FBQ0EsWUFBTXpCLFlBQUc0QixLQUFILENBQVMxQixjQUFLQyxJQUFMLENBQVUsS0FBS2lCLFNBQWYsRUFBMEIsZ0JBQTFCLENBQVQsRUFBc0RaLEtBQXRELEVBQTZELEtBQTdELENBQU47QUFDRDs7QUFFRCxRQUFJZ0IsR0FBRyxLQUFLLElBQVIsSUFBZ0JBLEdBQUcsS0FBSyxZQUE1QixFQUEwQztBQUN4QyxZQUFNO0FBQUVmLFFBQUFBO0FBQUYsVUFBaUJnQixNQUF2QjtBQUNBLFlBQU16QixZQUFHNEIsS0FBSCxDQUFTMUIsY0FBS0MsSUFBTCxDQUFVLEtBQUtpQixTQUFmLEVBQTBCLG1CQUExQixDQUFULEVBQXlEWCxVQUF6RCxFQUFxRSxLQUFyRSxDQUFOO0FBQ0Q7QUFDRjs7QUFFRHRCLEVBQUFBLEdBQUcsQ0FBQ1AsSUFBRCxFQUFPO0FBQ1IsV0FBTyxLQUFLOEMsS0FBTCxDQUFXdkMsR0FBWCxDQUFlUCxJQUFmLENBQVA7QUFDRDs7QUFFRCtDLEVBQUFBLFNBQVMsR0FBRztBQUNWLFdBQU8sS0FBS0QsS0FBTCxDQUFXQyxTQUFYLEVBQVA7QUFDRDs7QUFFUSxRQUFIaEMsR0FBRyxDQUFDK0MsT0FBRCxFQUFVO0FBQ2pCLFVBQU0sS0FBS2hCLEtBQUwsQ0FBVy9CLEdBQVgsQ0FBZStDLE9BQWYsQ0FBTjtBQUNEOztBQUVEQyxFQUFBQSxTQUFTLENBQUNDLElBQUQsRUFBTztBQUNkLFdBQU8sS0FBS2xCLEtBQUwsQ0FBV2lCLFNBQVgsQ0FBcUJDLElBQXJCLENBQVA7QUFDRDs7QUFFVyxRQUFOQyxNQUFNLEdBQUc7QUFDYixVQUFNLEtBQUtuQixLQUFMLENBQVdvQixNQUFYLEVBQU47QUFDRDtBQUVEO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUFDWSxRQUFKOUQsSUFBSSxDQUFDK0QsVUFBRCxFQUFhO0FBQ3JCQSxJQUFBQSxVQUFVLENBQUNwRSxFQUFYLEdBQWdCLEtBQUtBLEVBQXJCLENBRHFCLENBRXJCOztBQUNBLFVBQU15RCxPQUFPLEdBQUcsQ0FBQyxHQUFHVyxVQUFVLENBQUNsRSxLQUFYLENBQWlCb0MsSUFBakIsQ0FBc0JtQixPQUExQixFQUFtQyxHQUFHVyxVQUFVLENBQUNsRSxLQUFYLENBQWlCcUMsS0FBakIsQ0FBdUJrQixPQUE3RCxDQUFoQjtBQUVBVyxJQUFBQSxVQUFVLENBQUNqQixZQUFYLEdBQTBCTSxPQUFPLENBQUNZLE1BQVIsQ0FBZSxDQUFDQyxHQUFELEVBQU1aLElBQU4sS0FBZTtBQUN0RFksTUFBQUEsR0FBRyxDQUFDWixJQUFJLENBQUMxRCxFQUFOLENBQUgsR0FBZTBELElBQUksQ0FBQ0csT0FBTCxJQUFnQixFQUEvQjtBQUNBLGFBQU9TLEdBQVA7QUFDRCxLQUh5QixFQUd2QixFQUh1QixDQUExQjtBQUtBLFNBQUt2QixLQUFMLEdBQWEsTUFBTSxLQUFLaEQsSUFBTCxDQUFVd0UsTUFBVixDQUFpQkMsWUFBakIsQ0FBOEIxRSxNQUE5QixDQUFzQyxTQUF0QyxFQUFnRHNFLFVBQWhELENBQW5CO0FBRUEsU0FBS3JCLEtBQUwsQ0FBV2lCLFNBQVgsQ0FBcUIsTUFBTUQsT0FBTixJQUFpQjtBQUNwQyxXQUFLLElBQUksQ0FBQzlELElBQUQsRUFBTzZDLE1BQVAsQ0FBVCxJQUEyQmEsTUFBTSxDQUFDYyxPQUFQLENBQWVWLE9BQWYsQ0FBM0IsRUFBb0Q7QUFDbEQsZ0JBQVE5RCxJQUFSO0FBQ0UsZUFBSyxNQUFMO0FBQ0UsaUJBQUtGLElBQUwsQ0FBVTJFLE9BQVYsQ0FBa0JDLHVCQUFsQjs7QUFDQTs7QUFDRixlQUFLLGdCQUFMO0FBQXVCO0FBQ3JCLG1CQUFLQyxXQUFMO0FBQ0E7QUFDRDtBQVBIOztBQVVBLGNBQU0sS0FBSzNELE9BQUwsQ0FBYWhCLElBQWIsQ0FBTjtBQUNEO0FBQ0YsS0FkRCxFQVpxQixDQTRCckI7O0FBQ0EsVUFBTTRFLGdCQUFnQixHQUFHLEtBQUs5QixLQUFMLENBQVd2QyxHQUFYLENBQWUsT0FBZixDQUF6QjtBQUNBLFVBQU1pQixTQUFTLEdBQUcscUJBQVVvRCxnQkFBZ0IsQ0FBQ3ZDLElBQTNCLENBQWxCO0FBRUFiLElBQUFBLFNBQVMsQ0FBQ2dDLE9BQVYsQ0FBa0I5QyxPQUFsQixDQUEwQm1FLE1BQU0sSUFBSTtBQUNsQyxVQUFJQSxNQUFNLENBQUN2QixJQUFQLEtBQWdCLFdBQXBCLEVBQWlDO0FBQy9CdUIsUUFBQUEsTUFBTSxDQUFDdkIsSUFBUCxHQUFjLFFBQWQ7QUFDRDtBQUNGLEtBSkQ7QUFNQSxTQUFLckQsS0FBTCxHQUFhLElBQUk2RSxjQUFKLENBQVUsS0FBS2hGLElBQWYsRUFBcUI7QUFBRXVDLE1BQUFBLElBQUksRUFBRWI7QUFBUixLQUFyQixFQUEwQyxJQUExQyxFQUFnRCxJQUFoRCxFQUFzRCxJQUF0RCxDQUFiO0FBQ0EsVUFBTSxLQUFLdkIsS0FBTCxDQUFXRyxJQUFYLEVBQU4sQ0F2Q3FCLENBeUNyQjs7QUFDQSxVQUFNLEtBQUt1RSxXQUFMLEVBQU47QUFDRDs7QUFFbUMsUUFBOUJ0RSw4QkFBOEIsQ0FBQzBFLGFBQUQsRUFBZ0I7QUFDbEQsVUFBTTtBQUFFbEQsTUFBQUEsVUFBRjtBQUFjcEIsTUFBQUE7QUFBZCxRQUFzQyxLQUFLcUMsS0FBTCxDQUFXQyxTQUFYLEVBQTVDO0FBQ0EsVUFBTTtBQUFFaUMsTUFBQUEsT0FBRjtBQUFXQyxNQUFBQTtBQUFYLFFBQXVCLHlCQUFXcEQsVUFBWCxFQUF1QmtELGFBQXZCLEVBQXNDRyxDQUFDLElBQUlBLENBQUMsQ0FBQ0MsR0FBN0MsQ0FBN0I7QUFFQUYsSUFBQUEsT0FBTyxDQUFDdkUsT0FBUixDQUFnQjBFLFdBQVcsSUFBSTtBQUM3QixZQUFNQyxJQUFJLEdBQUczQixNQUFNLENBQUM0QixNQUFQLENBQWMsRUFBZCxFQUFrQkYsV0FBbEIsQ0FBYjtBQUNBQyxNQUFBQSxJQUFJLENBQUNFLE1BQUwsR0FBYyxJQUFkO0FBRUExRCxNQUFBQSxVQUFVLENBQUNmLElBQVgsQ0FBZ0J1RSxJQUFoQixFQUo2QixDQU03Qjs7QUFDQSxXQUFLRyxXQUFMLENBQWlCSixXQUFXLENBQUNwRixJQUE3QjtBQUNBLFdBQUt5Rix1QkFBTCxDQUE2QixDQUFDTCxXQUFXLENBQUNwRixJQUFiLEVBQW1Cb0YsV0FBVyxDQUFDcEYsSUFBL0IsQ0FBN0I7QUFDRCxLQVREO0FBV0FnRixJQUFBQSxPQUFPLENBQUN0RSxPQUFSLENBQWdCZ0YsV0FBVyxJQUFJO0FBQzdCLFlBQU1DLEtBQUssR0FBRzlELFVBQVUsQ0FBQytELFNBQVgsQ0FBcUJWLENBQUMsSUFBSUEsQ0FBQyxDQUFDQyxHQUFGLEtBQVVPLFdBQVcsQ0FBQ1AsR0FBaEQsQ0FBZDtBQUNBdEQsTUFBQUEsVUFBVSxDQUFDZ0UsTUFBWCxDQUFrQkYsS0FBbEIsRUFBeUIsQ0FBekIsRUFGNkIsQ0FJN0I7O0FBQ0EsV0FBS0csV0FBTCxDQUFpQkosV0FBVyxDQUFDMUYsSUFBN0IsRUFMNkIsQ0FNN0I7O0FBQ0EsWUFBTStGLElBQUksR0FBR3RGLG1CQUFtQixDQUFDdUYsTUFBcEIsQ0FBMkJDLENBQUMsSUFBSUEsQ0FBQyxDQUFDLENBQUQsQ0FBRCxLQUFTUCxXQUFXLENBQUMxRixJQUFyRCxDQUFiO0FBQ0ErRixNQUFBQSxJQUFJLENBQUNyRixPQUFMLENBQWFHLEdBQUcsSUFBSSxLQUFLcUYsdUJBQUwsQ0FBNkJyRixHQUE3QixDQUFwQjtBQUNELEtBVEQ7QUFXQSxVQUFNLEtBQUtpQyxLQUFMLENBQVcvQixHQUFYLENBQWU7QUFBRWMsTUFBQUE7QUFBRixLQUFmLENBQU47QUFDRDs7QUFFRHNFLEVBQUFBLFVBQVUsQ0FBQ0MsT0FBRCxFQUFVO0FBQ2xCLFVBQU1uRSxJQUFJLEdBQUcsZUFBYjtBQUNBLFVBQU1OLFFBQVEsR0FBRyxLQUFLbUIsS0FBTCxDQUFXdkMsR0FBWCxDQUFlLFVBQWYsQ0FBakI7QUFDQW9CLElBQUFBLFFBQVEsQ0FBQ00sSUFBRCxDQUFSLEdBQWlCbUUsT0FBakI7QUFFQSxTQUFLekIsV0FBTCxDQUFpQmhELFFBQWpCO0FBQ0Q7O0FBRUQwRSxFQUFBQSxhQUFhLENBQUNwRSxJQUFELEVBQU87QUFDbEIsVUFBTU4sUUFBUSxHQUFHLEtBQUttQixLQUFMLENBQVd2QyxHQUFYLENBQWUsVUFBZixDQUFqQjs7QUFFQSxRQUFJMEIsSUFBSSxJQUFJTixRQUFaLEVBQXNCO0FBQ3BCLGFBQU9BLFFBQVEsQ0FBQ00sSUFBRCxDQUFmO0FBQ0EsV0FBSzBDLFdBQUwsQ0FBaUJoRCxRQUFqQjtBQUNEO0FBQ0Y7O0FBRUQyRSxFQUFBQSxhQUFhLENBQUMxRixLQUFLLEdBQUcsSUFBVCxFQUFlO0FBQzFCLFVBQU0yRixlQUFlLEdBQUcsRUFBeEI7O0FBRUEsUUFBSTNGLEtBQUssS0FBSyxJQUFkLEVBQW9CO0FBQ2xCLFlBQU1lLFFBQVEsR0FBRyxLQUFLbUIsS0FBTCxDQUFXdkMsR0FBWCxDQUFlLFVBQWYsQ0FBakI7O0FBRUEsV0FBSyxJQUFJMEIsSUFBVCxJQUFpQk4sUUFBakIsRUFBMkI7QUFDekIsWUFBSUEsUUFBUSxDQUFDTSxJQUFELENBQVIsQ0FBZXJCLEtBQWYsS0FBeUJBLEtBQTdCLEVBQW9DO0FBQ2xDMkYsVUFBQUEsZUFBZSxDQUFDdEUsSUFBRCxDQUFmLEdBQXdCTixRQUFRLENBQUNNLElBQUQsQ0FBaEM7QUFDRDtBQUNGO0FBQ0Y7O0FBRUQsU0FBSzBDLFdBQUwsQ0FBaUI0QixlQUFqQjtBQUNEOztBQUVEZixFQUFBQSxXQUFXLENBQUM1RSxLQUFELEVBQVE7QUFDakIsVUFBTUosTUFBTSxHQUFHLEtBQUtzQyxLQUFMLENBQVd2QyxHQUFYLENBQWUsUUFBZixDQUFmOztBQUVBLFFBQUlDLE1BQU0sQ0FBQzBCLE9BQVAsQ0FBZXRCLEtBQWYsTUFBMEIsQ0FBQyxDQUEvQixFQUFrQztBQUNoQ0osTUFBQUEsTUFBTSxDQUFDTSxJQUFQLENBQVlGLEtBQVosRUFEZ0MsQ0FFaEM7O0FBQ0EsV0FBS2tDLEtBQUwsQ0FBVy9CLEdBQVgsQ0FBZTtBQUFFUCxRQUFBQTtBQUFGLE9BQWY7QUFDRDtBQUNGOztBQUVEZ0csRUFBQUEsV0FBVyxDQUFDQyxRQUFELEVBQVdDLFFBQVgsRUFBcUI7QUFDOUIsVUFBTTtBQUFFbEcsTUFBQUEsTUFBRjtBQUFVQyxNQUFBQSxtQkFBVjtBQUErQmtCLE1BQUFBO0FBQS9CLFFBQTRDLEtBQUttQixLQUFMLENBQVdDLFNBQVgsRUFBbEQ7O0FBRUEsUUFBSXZDLE1BQU0sQ0FBQzBCLE9BQVAsQ0FBZXVFLFFBQWYsTUFBNkIsQ0FBQyxDQUE5QixJQUFtQ2pHLE1BQU0sQ0FBQzBCLE9BQVAsQ0FBZXdFLFFBQWYsTUFBNkIsQ0FBQyxDQUFyRSxFQUF3RTtBQUN0RSxZQUFNQyxhQUFhLEdBQUduRyxNQUFNLENBQUNvRyxHQUFQLENBQVdoRyxLQUFLLElBQUlBLEtBQUssS0FBSzZGLFFBQVYsR0FBcUJDLFFBQXJCLEdBQWdDOUYsS0FBcEQsQ0FBdEI7QUFDQSxZQUFNaUcsWUFBWSxHQUFHcEcsbUJBQW1CLENBQUNtRyxHQUFwQixDQUF3Qi9GLEdBQUcsSUFBSTtBQUNsRCxZQUFJQSxHQUFHLENBQUMsQ0FBRCxDQUFILEtBQVc0RixRQUFmLEVBQXlCO0FBQ3ZCNUYsVUFBQUEsR0FBRyxDQUFDLENBQUQsQ0FBSCxHQUFTNkYsUUFBVDtBQUNEOztBQUVELGVBQU83RixHQUFQO0FBQ0QsT0FOb0IsQ0FBckIsQ0FGc0UsQ0FVdEU7O0FBQ0EsV0FBSyxJQUFJb0IsSUFBVCxJQUFpQk4sUUFBakIsRUFBMkI7QUFDekIsY0FBTXlFLE9BQU8sR0FBR3pFLFFBQVEsQ0FBQ00sSUFBRCxDQUF4Qjs7QUFFQSxZQUFJbUUsT0FBTyxDQUFDeEYsS0FBUixLQUFrQjZGLFFBQXRCLEVBQWdDO0FBQzlCTCxVQUFBQSxPQUFPLENBQUN4RixLQUFSLEdBQWdCOEYsUUFBaEI7QUFDRDtBQUNGOztBQUVELFdBQUsvQixXQUFMLENBQWlCaEQsUUFBakI7QUFDQSxXQUFLbUIsS0FBTCxDQUFXL0IsR0FBWCxDQUFlO0FBQ2JQLFFBQUFBLE1BQU0sRUFBRW1HLGFBREs7QUFFYmxHLFFBQUFBLG1CQUFtQixFQUFFb0c7QUFGUixPQUFmO0FBSUQ7QUFDRjs7QUFFRGYsRUFBQUEsV0FBVyxDQUFDbEYsS0FBRCxFQUFRO0FBQ2pCLFVBQU07QUFBRUosTUFBQUEsTUFBRjtBQUFVQyxNQUFBQSxtQkFBVjtBQUErQmtCLE1BQUFBO0FBQS9CLFFBQTRDLEtBQUttQixLQUFMLENBQVdDLFNBQVgsRUFBbEQ7O0FBRUEsUUFBSXZDLE1BQU0sQ0FBQzBCLE9BQVAsQ0FBZXRCLEtBQWYsTUFBMEIsQ0FBQyxDQUEvQixFQUFrQztBQUNoQztBQUNBLFlBQU1rRyxjQUFjLEdBQUd0RyxNQUFNLENBQUN3RixNQUFQLENBQWNlLENBQUMsSUFBSUEsQ0FBQyxLQUFLbkcsS0FBekIsQ0FBdkI7QUFDQSxZQUFNb0csYUFBYSxHQUFHdkcsbUJBQW1CLENBQUN1RixNQUFwQixDQUEyQm5GLEdBQUcsSUFBSUEsR0FBRyxDQUFDLENBQUQsQ0FBSCxLQUFXRCxLQUE3QyxDQUF0QjtBQUVBLFdBQUswRixhQUFMLENBQW1CMUYsS0FBbkIsRUFMZ0MsQ0FLTDs7QUFDM0IsV0FBS2tDLEtBQUwsQ0FBVy9CLEdBQVgsQ0FBZTtBQUNiUCxRQUFBQSxNQUFNLEVBQUVzRyxjQURLO0FBRWJyRyxRQUFBQSxtQkFBbUIsRUFBRXVHO0FBRlIsT0FBZjtBQUlEO0FBQ0Y7O0FBRURDLEVBQUFBLGVBQWUsQ0FBQ0MsUUFBRCxFQUFXM0IsTUFBWCxFQUFtQjtBQUNoQyxVQUFNO0FBQUUxRCxNQUFBQSxVQUFGO0FBQWNwQixNQUFBQTtBQUFkLFFBQXNDLEtBQUtxQyxLQUFMLENBQVdDLFNBQVgsRUFBNUM7QUFFQSxVQUFNcEMsU0FBUyxHQUFHa0IsVUFBVSxDQUFDc0YsSUFBWCxDQUFnQmpDLENBQUMsSUFBSUEsQ0FBQyxDQUFDbEYsSUFBRixLQUFXa0gsUUFBaEMsQ0FBbEI7QUFDQXZHLElBQUFBLFNBQVMsQ0FBQzRFLE1BQVYsR0FBbUJBLE1BQW5CO0FBRUEsVUFBTXNCLFlBQVksR0FBR3BHLG1CQUFtQixDQUFDdUYsTUFBcEIsQ0FBMkJuRixHQUFHLElBQUlBLEdBQUcsQ0FBQyxDQUFELENBQUgsS0FBV3FHLFFBQTdDLENBQXJCO0FBRUEsU0FBS3BFLEtBQUwsQ0FBVy9CLEdBQVgsQ0FBZTtBQUNiYyxNQUFBQSxVQURhO0FBRWJwQixNQUFBQSxtQkFBbUIsRUFBRW9HO0FBRlIsS0FBZjtBQUlEOztBQUVEcEIsRUFBQUEsdUJBQXVCLENBQUM1RSxHQUFELEVBQU07QUFDM0IsVUFBTUosbUJBQW1CLEdBQUcsS0FBS3FDLEtBQUwsQ0FBV3ZDLEdBQVgsQ0FBZSxxQkFBZixDQUE1QjtBQUNBLFVBQU1vRixLQUFLLEdBQUdsRixtQkFBbUIsQ0FBQ21GLFNBQXBCLENBQThCSyxDQUFDLElBQUlBLENBQUMsQ0FBQyxDQUFELENBQUQsS0FBU3BGLEdBQUcsQ0FBQyxDQUFELENBQVosSUFBbUJvRixDQUFDLENBQUMsQ0FBRCxDQUFELEtBQVNwRixHQUFHLENBQUMsQ0FBRCxDQUFsRSxDQUFkOztBQUVBLFFBQUk4RSxLQUFLLEtBQUssQ0FBQyxDQUFmLEVBQWtCO0FBQ2hCbEYsTUFBQUEsbUJBQW1CLENBQUNLLElBQXBCLENBQXlCRCxHQUF6QjtBQUNBLFdBQUtpQyxLQUFMLENBQVcvQixHQUFYLENBQWU7QUFBRU4sUUFBQUE7QUFBRixPQUFmO0FBQ0Q7QUFDRjs7QUFFRHlGLEVBQUFBLHVCQUF1QixDQUFDckYsR0FBRCxFQUFNO0FBQzNCLFVBQU1KLG1CQUFtQixHQUFHLEtBQUtxQyxLQUFMLENBQVd2QyxHQUFYLENBQWUscUJBQWYsQ0FBNUI7QUFDQSxVQUFNeUcsYUFBYSxHQUFHdkcsbUJBQW1CLENBQUN1RixNQUFwQixDQUEyQkMsQ0FBQyxJQUFJO0FBQ3BELGFBQU9BLENBQUMsQ0FBQyxDQUFELENBQUQsS0FBU3BGLEdBQUcsQ0FBQyxDQUFELENBQVosSUFBbUJvRixDQUFDLENBQUMsQ0FBRCxDQUFELEtBQVNwRixHQUFHLENBQUMsQ0FBRCxDQUEvQixHQUFxQyxLQUFyQyxHQUE2QyxJQUFwRDtBQUNELEtBRnFCLENBQXRCO0FBSUEsU0FBS2lDLEtBQUwsQ0FBVy9CLEdBQVgsQ0FBZTtBQUFFTixNQUFBQSxtQkFBbUIsRUFBRXVHO0FBQXZCLEtBQWY7QUFDRDs7QUFFZ0IsUUFBWHJDLFdBQVcsQ0FBQ2hELFFBQVEsR0FBRyxJQUFaLEVBQWtCO0FBQ2pDLFFBQUlBLFFBQVEsS0FBSyxJQUFqQixFQUF1QjtBQUNyQkEsTUFBQUEsUUFBUSxHQUFHLEtBQUttQixLQUFMLENBQVd2QyxHQUFYLENBQWUsVUFBZixDQUFYO0FBQ0QsS0FIZ0MsQ0FLakM7OztBQUNBLFVBQU02RyxTQUFTLEdBQUksYUFBWSxLQUFLdEUsS0FBTCxDQUFXdkMsR0FBWCxDQUFlLElBQWYsQ0FBcUIsSUFBcEQsQ0FOaUMsQ0FPakM7O0FBQ0EsVUFBTUMsTUFBTSxHQUFHa0QsTUFBTSxDQUFDYixNQUFQLENBQWNsQixRQUFkLEVBQXdCaUYsR0FBeEIsQ0FBNEJTLENBQUMsSUFBSUEsQ0FBQyxDQUFDekcsS0FBbkMsRUFBMENvRixNQUExQyxDQUFpRCxDQUFDcUIsQ0FBRCxFQUFJakUsQ0FBSixFQUFPa0UsR0FBUCxLQUFlQSxHQUFHLENBQUNwRixPQUFKLENBQVltRixDQUFaLE1BQW1CakUsQ0FBbkYsQ0FBZjtBQUNBckIsSUFBQUEsT0FBTyxDQUFDQyxHQUFSLENBQWEsS0FBSW9GLFNBQVUsMkJBQTNCLEVBQXVENUcsTUFBdkQsRUFUaUMsQ0FVakM7O0FBQ0EsVUFBTStHLG1CQUFtQixHQUFHLElBQUlDLElBQUosR0FBV0MsT0FBWCxFQUE1QjtBQUNBMUYsSUFBQUEsT0FBTyxDQUFDQyxHQUFSLENBQWEsR0FBRW9GLFNBQVUsbUNBQWtDMUQsTUFBTSxDQUFDQyxJQUFQLENBQVloQyxRQUFaLEVBQXNCMEIsTUFBTyxHQUF4RixFQVppQyxDQWFqQztBQUVBO0FBQ0E7QUFDQTs7QUFDQSxRQUFJcUUsVUFBVSxHQUFHLEtBQWpCO0FBQ0EsUUFBSUMsTUFBTSxHQUFHLElBQWI7O0FBRUEsU0FBSyxJQUFJNUgsRUFBVCxJQUFlLEtBQUtFLEtBQUwsQ0FBV3VELE9BQTFCLEVBQW1DO0FBQ2pDLFlBQU1xQixNQUFNLEdBQUcsS0FBSzVFLEtBQUwsQ0FBV3VELE9BQVgsQ0FBbUJ6RCxFQUFuQixDQUFmOztBQUVBLFVBQUk4RSxNQUFNLENBQUN2QixJQUFQLEtBQWdCLFFBQXBCLEVBQThCO0FBQzVCb0UsUUFBQUEsVUFBVSxHQUFHLElBQWI7QUFDQUMsUUFBQUEsTUFBTSxHQUFHOUMsTUFBVDtBQUNEO0FBQ0Y7O0FBRUQsUUFBSThDLE1BQU0sS0FBSyxJQUFmLEVBQXFCO0FBQ25CNUYsTUFBQUEsT0FBTyxDQUFDQyxHQUFSLENBQWEsS0FBSW9GLFNBQVUsMkRBQTNCO0FBQ0EsYUFBT1EsT0FBTyxDQUFDQyxPQUFSLEVBQVA7QUFDRCxLQWpDZ0MsQ0FtQ2pDOzs7QUFDQSxRQUFJQyxhQUFKLENBcENpQyxDQXNDakM7O0FBQ0EsVUFBTUMsZ0JBQWdCLEdBQUc7QUFDdkJDLE1BQUFBLE9BQU8sRUFBRSwyQkFEYztBQUV2QkMsTUFBQUEsVUFBVSxFQUFFLE9BRlc7QUFHdkJDLE1BQUFBLE9BQU8sRUFBRTtBQUNQQyxRQUFBQSxjQUFjLEVBQUUsQ0FEVDtBQUVQQyxRQUFBQSxlQUFlLEVBQUUsQ0FGVjtBQUdQL0YsUUFBQUEsSUFBSSxFQUFFO0FBSEM7QUFIYyxLQUF6QixDQXZDaUMsQ0FpRGpDOztBQUNBLFVBQU13QixpQkFBaUIsR0FBRyxFQUExQixDQWxEaUMsQ0FvRGpDOztBQUNBLFNBQUssSUFBSTVCLElBQVQsSUFBaUJOLFFBQWpCLEVBQTJCO0FBQ3pCLFlBQU15RSxPQUFPLEdBQUd6RSxRQUFRLENBQUNNLElBQUQsQ0FBeEI7QUFFQTZGLE1BQUFBLGFBQWEsR0FBRyxJQUFJTyxzQkFBSixDQUFrQmpDLE9BQU8sQ0FBQ2tDLEtBQTFCLENBQWhCO0FBQ0EsV0FBS3JJLEtBQUwsQ0FBV3NJLFNBQVgsQ0FBcUJULGFBQXJCLEVBSnlCLENBTXpCOztBQUNBQSxNQUFBQSxhQUFhLENBQUNVLEdBQWQ7QUFDQSxZQUFNQyxpQkFBaUIsR0FBR2QsTUFBTSxDQUFDZSxPQUFQLEVBQTFCOztBQUVBLFVBQUl0QyxPQUFPLENBQUNrQyxLQUFSLENBQWNqRixNQUFkLEtBQXlCb0YsaUJBQWlCLENBQUNwRixNQUEvQyxFQUF1RDtBQUNyRCxjQUFNLElBQUlzRixLQUFKLENBQVcsR0FBRXZCLFNBQVUscURBQW9EbkYsSUFBSyxFQUFoRixDQUFOO0FBQ0Q7O0FBRUQsV0FBS2hDLEtBQUwsQ0FBVzJJLFlBQVgsQ0FBd0JkLGFBQXhCO0FBQ0FILE1BQUFBLE1BQU0sQ0FBQ2tCLEtBQVA7QUFFQSxZQUFNQyxnQkFBZ0IsR0FBRztBQUN2QmxJLFFBQUFBLEtBQUssRUFBRXdGLE9BQU8sQ0FBQ3hGLEtBRFE7QUFFdkJtSSxRQUFBQSxNQUFNLEVBQUUzQyxPQUFPLENBQUMyQyxNQUZPO0FBR3ZCVCxRQUFBQSxLQUFLLEVBQUVHO0FBSGdCLE9BQXpCLENBakJ5QixDQXNCekI7O0FBQ0FWLE1BQUFBLGdCQUFnQixDQUFDRyxPQUFqQixDQUF5QjdGLElBQXpCLENBQThCdkIsSUFBOUIsQ0FBbUNnSSxnQkFBbkM7QUFDQWpGLE1BQUFBLGlCQUFpQixDQUFDNUIsSUFBRCxDQUFqQixHQUEwQjZHLGdCQUExQjtBQUNEOztBQUVELFFBQUlmLGdCQUFnQixDQUFDRyxPQUFqQixDQUF5QjdGLElBQXpCLENBQThCLENBQTlCLENBQUosRUFBc0M7QUFDcEMwRixNQUFBQSxnQkFBZ0IsQ0FBQ0csT0FBakIsQ0FBeUJDLGNBQXpCLEdBQTBDSixnQkFBZ0IsQ0FBQ0csT0FBakIsQ0FBeUI3RixJQUF6QixDQUE4QixDQUE5QixFQUFpQ2lHLEtBQWpDLENBQXVDLENBQXZDLEVBQTBDakYsTUFBcEY7QUFDRCxLQWxGZ0MsQ0FvRmpDOzs7QUFDQSxVQUFNMkYsY0FBYyxHQUFHLElBQUl4QixJQUFKLEdBQVdDLE9BQVgsS0FBdUJGLG1CQUE5QztBQUNBeEYsSUFBQUEsT0FBTyxDQUFDQyxHQUFSLENBQWEsR0FBRW9GLFNBQVUsdUJBQXNCNEIsY0FBZSxLQUE5RCxFQXRGaUMsQ0F1RmpDOztBQUNBLFVBQU1DLGlCQUFpQixHQUFHLElBQUl6QixJQUFKLEdBQVdDLE9BQVgsRUFBMUI7QUFDQSxVQUFNeUIsa0JBQWtCLEdBQUduQixnQkFBZ0IsQ0FBQ0csT0FBakIsQ0FBeUJDLGNBQXBEO0FBQ0FwRyxJQUFBQSxPQUFPLENBQUNDLEdBQVIsQ0FBYSxHQUFFb0YsU0FBVSwyQ0FBMEM4QixrQkFBbUIsR0FBdEYsRUExRmlDLENBMkZqQztBQUVBO0FBQ0E7O0FBQ0EsVUFBTUMsY0FBYyxHQUFHQywwQkFBaUJDLHdCQUFqQixDQUEwQ3RCLGdCQUExQyxDQUF2Qjs7QUFFQSxVQUFNckcsY0FBYyxHQUFHLEtBQUtvQixLQUFMLENBQVd2QyxHQUFYLENBQWUsZ0JBQWYsQ0FBdkIsQ0FqR2lDLENBaUd3Qjs7QUFDekQsVUFBTStJLFNBQVMsR0FBR0YsMEJBQWlCRyxtQkFBakIsQ0FBcUM3SCxjQUFyQyxDQUFsQixDQWxHaUMsQ0FrR3VDOzs7QUFDeEVLLElBQUFBLE9BQU8sQ0FBQ0MsR0FBUixDQUFZb0YsU0FBWixFQUF1QixZQUF2QixFQUFxQ2tDLFNBQXJDLEVBbkdpQyxDQW9HakM7O0FBQ0EsVUFBTTNHLEdBQUcsR0FBRyxLQUFLRCxZQUFMLENBQWtCaEIsY0FBYyxDQUFDd0csT0FBZixDQUF1QnNCLFNBQXpDLENBQVo7QUFFQTdHLElBQUFBLEdBQUcsQ0FBQzhHLFNBQUosQ0FBY0gsU0FBZDtBQUNBM0csSUFBQUEsR0FBRyxDQUFDK0csY0FBSixDQUFtQlAsY0FBbkIsRUF4R2lDLENBeUdqQzs7QUFFQSxXQUFPLElBQUl2QixPQUFKLENBQVksQ0FBQ0MsT0FBRCxFQUFVOEIsTUFBVixLQUFxQjtBQUN0Q2hILE1BQUFBLEdBQUcsQ0FBQ2lILEtBQUosQ0FBVSxDQUFDQyxHQUFELEVBQU1qSSxLQUFOLEtBQWdCO0FBQ3hCLFlBQUlpSSxHQUFKLEVBQVM7QUFDUEYsVUFBQUEsTUFBTSxDQUFDRSxHQUFELENBQU47QUFDRDs7QUFFRCxjQUFNQyxhQUFhLEdBQUdWLDBCQUFpQlcsa0JBQWpCLENBQW9DbkksS0FBcEMsQ0FBdEI7O0FBRUEsYUFBS2tCLEtBQUwsQ0FBVy9CLEdBQVgsQ0FBZTtBQUNiWSxVQUFBQSxRQURhO0FBRWJrQyxVQUFBQSxpQkFGYTtBQUdiakMsVUFBQUEsS0FBSyxFQUFFa0k7QUFITSxTQUFmLEVBUHdCLENBYXhCOztBQUNBLGNBQU1FLFlBQVksR0FBRyxJQUFJeEMsSUFBSixHQUFXQyxPQUFYLEtBQXVCd0IsaUJBQTVDO0FBQ0FsSCxRQUFBQSxPQUFPLENBQUNDLEdBQVIsQ0FBYSxHQUFFb0YsU0FBVSxxQkFBb0I0QyxZQUFhLEtBQTFELEVBZndCLENBZ0J4Qjs7QUFFQW5DLFFBQUFBLE9BQU87QUFDUixPQW5CRDtBQW9CRCxLQXJCTSxDQUFQO0FBc0JEOztBQTdmVzs7ZUFnZ0JDakksTyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0IGZzIGZyb20gJ2ZzJztcbmltcG9ydCB7IHY0IGFzIHV1aWR2NCB9IGZyb20gJ3V1aWQnO1xuXG5pbXBvcnQgeG1tIGZyb20gJ3htbS1ub2RlJztcbi8vIGltcG9ydCBYbW1Qcm9jZXNzb3IgZnJvbSAnLi4vY29tbW9uL2xpYnMvbWFuby9YbW1Qcm9jZXNzb3IuanMnO1xuaW1wb3J0IHJhcGlkTWl4QWRhcHRlcnMgZnJvbSAncmFwaWQtbWl4LWFkYXB0ZXJzJztcblxuaW1wb3J0IGRiIGZyb20gJy4vdXRpbHMvZGInO1xuaW1wb3J0IGRpZmZBcnJheXMgZnJvbSAnLi4vY29tbW9uL3V0aWxzL2RpZmZBcnJheXMuanMnO1xuaW1wb3J0IEdyYXBoIGZyb20gJy4uL2NvbW1vbi9HcmFwaC5qcyc7XG5pbXBvcnQgT2ZmbGluZVNvdXJjZSBmcm9tICcuLi9jb21tb24vc291cmNlcy9PZmZsaW5lU291cmNlLmpzJztcbmltcG9ydCBjbG9uZWRlZXAgZnJvbSAnbG9kYXNoLmNsb25lZGVlcCc7XG5cbmNsYXNzIFNlc3Npb24ge1xuXG4gIC8qKiBmYWN0b3J5IG1ldGhvZHMgKi9cbiAgc3RhdGljIGFzeW5jIGNyZWF0ZShjb21vLCBpZCwgbmFtZSwgZ3JhcGgsIGZzQXVkaW9GaWxlcykge1xuICAgIGNvbnN0IHNlc3Npb24gPSBuZXcgU2Vzc2lvbihjb21vLCBpZCk7XG4gICAgYXdhaXQgc2Vzc2lvbi5pbml0KHsgbmFtZSwgZ3JhcGggfSk7XG4gICAgYXdhaXQgc2Vzc2lvbi51cGRhdGVBdWRpb0ZpbGVzRnJvbUZpbGVTeXN0ZW0oZnNBdWRpb0ZpbGVzKTtcblxuICAgIC8vIGJ5IGRlZmF1bHQgKHRvIGJlIGJhY2t3YXJkIHVzYWdlIGNvbXBhdGlibGUpOlxuICAgIC8vIC0gbGFiZWxzIGFyZSB0aGUgYXVkaW8gZmlsZXMgbmFtZXMgd2l0aG91dCBleHRlbnNpb25cbiAgICAvLyAtIGEgcm93IDxsYWJlbCwgYXVkaW9GaWxlPiBpcyBpbnNlcnRlZCBpbiB0aGUgYGxhYmVsQXVkaW9GaWxlVGFibGVgXG4gICAgY29uc3QgcmVnaXN0ZXJlZEF1ZGlvRmlsZXMgPSBzZXNzaW9uLmdldCgnYXVkaW9GaWxlcycpO1xuICAgIGNvbnN0IGxhYmVscyA9IFtdO1xuICAgIGNvbnN0IGxhYmVsQXVkaW9GaWxlVGFibGUgPSBbXTtcblxuICAgIHJlZ2lzdGVyZWRBdWRpb0ZpbGVzLmZvckVhY2goYXVkaW9GaWxlID0+IHtcbiAgICAgIGNvbnN0IGxhYmVsID0gYXVkaW9GaWxlLm5hbWU7XG4gICAgICBjb25zdCByb3cgPSBbbGFiZWwsIGF1ZGlvRmlsZS5uYW1lXTtcbiAgICAgIGxhYmVscy5wdXNoKGxhYmVsKTtcbiAgICAgIGxhYmVsQXVkaW9GaWxlVGFibGUucHVzaChyb3cpO1xuICAgIH0pO1xuXG4gICAgYXdhaXQgc2Vzc2lvbi5zZXQoeyBsYWJlbHMsIGxhYmVsQXVkaW9GaWxlVGFibGUgfSk7XG4gICAgYXdhaXQgc2Vzc2lvbi5wZXJzaXN0KCk7XG5cbiAgICByZXR1cm4gc2Vzc2lvbjtcbiAgfVxuXG4gIHN0YXRpYyBhc3luYyBmcm9tRmlsZVN5c3RlbShjb21vLCBkaXJuYW1lLCBmc0F1ZGlvRmlsZXMpIHtcbiAgICAvLyBAbm90ZSAtIHZlcnNpb24gMC4wLjAgKGNmLm1ldGFzKVxuICAgIGNvbnN0IG1ldGFzID0gYXdhaXQgZGIucmVhZChwYXRoLmpvaW4oZGlybmFtZSwgJ21ldGFzLmpzb24nKSk7XG4gICAgY29uc3QgZGF0YUdyYXBoID0gYXdhaXQgZGIucmVhZChwYXRoLmpvaW4oZGlybmFtZSwgYGdyYXBoLWRhdGEuanNvbmApKTtcbiAgICBjb25zdCBhdWRpb0dyYXBoID0gYXdhaXQgZGIucmVhZChwYXRoLmpvaW4oZGlybmFtZSwgYGdyYXBoLWF1ZGlvLmpzb25gKSk7XG4gICAgY29uc3QgbGFiZWxzID0gYXdhaXQgZGIucmVhZChwYXRoLmpvaW4oZGlybmFtZSwgJ2xhYmVscy5qc29uJykpO1xuICAgIGNvbnN0IGxhYmVsQXVkaW9GaWxlVGFibGUgPSBhd2FpdCBkYi5yZWFkKHBhdGguam9pbihkaXJuYW1lLCAnbGFiZWwtYXVkaW8tZmlsZXMtdGFibGUuanNvbicpKTtcbiAgICBjb25zdCBsZWFybmluZ0NvbmZpZyA9IGF3YWl0IGRiLnJlYWQocGF0aC5qb2luKGRpcm5hbWUsICdtbC1jb25maWcuanNvbicpKTtcbiAgICBjb25zdCBleGFtcGxlcyA9IGF3YWl0IGRiLnJlYWQocGF0aC5qb2luKGRpcm5hbWUsICcubWwtZXhhbXBsZXMuanNvbicpKTtcbiAgICBjb25zdCBtb2RlbCA9IGF3YWl0IGRiLnJlYWQocGF0aC5qb2luKGRpcm5hbWUsICcubWwtbW9kZWwuanNvbicpKTtcbiAgICBjb25zdCBhdWRpb0ZpbGVzID0gYXdhaXQgZGIucmVhZChwYXRoLmpvaW4oZGlybmFtZSwgJy5hdWRpby1maWxlcy5qc29uJykpO1xuXG4gICAgLy8gcmVtb3ZlIGV4YW1wbGVzIHRoYXQgYXJlIG5vdCBpbiBsYWJlbHNcbiAgICBsZXQgc2F2ZUV4YW1wbGVzID0gZmFsc2U7XG4gICAgY29uc29sZS5sb2coJycpOyAvLyBqdXN0IGEgbGluZSBicmVhayBpbiB0aGUgY29uc29sZVxuXG4gICAgZm9yIChsZXQgdXVpZCBpbiBleGFtcGxlcykge1xuICAgICAgY29uc3QgbGFiZWwgPSBleGFtcGxlc1t1dWlkXS5sYWJlbDtcbiAgICAgIGlmIChsYWJlbHMuaW5kZXhPZihsYWJlbCkgPT09IC0xKSB7XG4gICAgICAgIGNvbnNvbGUud2FybihgW3Nlc3Npb24gXCIke21ldGFzLm5hbWV9XCJdID4gV0FSTklORyAtIEV4YW1wbGUgd2l0aCBsYWJlbCBcIiR7bGFiZWx9XCIgZGVsZXRlZCwgbGFiZWwgZG9lcyBleGlzdHMgaW4gbGFiZWxzOiBbJHtsYWJlbHMuam9pbignLCAnKX1dYCk7XG5cbiAgICAgICAgZGVsZXRlIGV4YW1wbGVzW3V1aWRdO1xuICAgICAgICBzYXZlRXhhbXBsZXMgPSB0cnVlO1xuICAgICAgfVxuICAgIH1cblxuICAgIGNvbnN0IGlkID0gbWV0YXMuaWQ7XG4gICAgY29uc3QgY29uZmlnID0ge1xuICAgICAgbmFtZTogbWV0YXMubmFtZSxcbiAgICAgIGdyYXBoOiB7IGRhdGE6IGRhdGFHcmFwaCwgYXVkaW86IGF1ZGlvR3JhcGggfSxcbiAgICAgIGxhYmVscyxcbiAgICAgIGxhYmVsQXVkaW9GaWxlVGFibGUsXG4gICAgICBsZWFybmluZ0NvbmZpZyxcbiAgICAgIGV4YW1wbGVzLFxuICAgICAgbW9kZWwsXG4gICAgICBhdWRpb0ZpbGVzLFxuICAgIH07XG5cbiAgICBjb25zdCBzZXNzaW9uID0gbmV3IFNlc3Npb24oY29tbywgaWQpO1xuICAgIGF3YWl0IHNlc3Npb24uaW5pdChjb25maWcpO1xuXG4gICAgaWYgKHNhdmVFeGFtcGxlcykge1xuICAgICAgc2Vzc2lvbi5wZXJzaXN0KCdleGFtcGxlcycpO1xuICAgIH1cblxuICAgIGF3YWl0IHNlc3Npb24udXBkYXRlQXVkaW9GaWxlc0Zyb21GaWxlU3lzdGVtKGZzQXVkaW9GaWxlcyk7XG5cbiAgICByZXR1cm4gc2Vzc2lvbjtcbiAgfVxuXG4gIGNvbnN0cnVjdG9yKGNvbW8sIGlkKSB7XG4gICAgdGhpcy5jb21vID0gY29tbztcbiAgICB0aGlzLmlkID0gaWQ7XG5cbiAgICB0aGlzLmRpcmVjdG9yeSA9IHBhdGguam9pbih0aGlzLmNvbW8ucHJvamVjdERpcmVjdG9yeSwgJ3Nlc3Npb25zJywgaWQpO1xuXG4gICAgdGhpcy54bW1JbnN0YW5jZXMgPSB7XG4gICAgICAnZ21tJzogbmV3IHhtbSgnZ21tJyksXG4gICAgICAnaGhtbSc6IG5ldyB4bW0oJ2hobW0nKSxcbiAgICB9O1xuICB9XG5cbiAgYXN5bmMgcGVyc2lzdChrZXkgPSBudWxsKSB7XG4gICAgY29uc3QgdmFsdWVzID0gdGhpcy5zdGF0ZS5nZXRWYWx1ZXMoKTtcblxuICAgIGlmIChrZXkgPT09IG51bGwgfHwga2V5ID09PSAnbmFtZScpIHtcbiAgICAgIGNvbnN0IHsgaWQsIG5hbWUgfSA9IHZhbHVlcztcbiAgICAgIGF3YWl0IGRiLndyaXRlKHBhdGguam9pbih0aGlzLmRpcmVjdG9yeSwgJ21ldGFzLmpzb24nKSwgeyBpZCwgbmFtZSwgdmVyc2lvbjogJzAuMC4wJyB9KTtcbiAgICB9XG5cbiAgICBpZiAoa2V5ID09PSBudWxsIHx8IGtleSA9PT0gJ2xhYmVscycpIHtcbiAgICAgIGNvbnN0IHsgbGFiZWxzIH0gPSB2YWx1ZXM7XG4gICAgICBhd2FpdCBkYi53cml0ZShwYXRoLmpvaW4odGhpcy5kaXJlY3RvcnksICdsYWJlbHMuanNvbicpLCBsYWJlbHMpO1xuICAgIH1cblxuICAgIGlmIChrZXkgPT09IG51bGwgfHwga2V5ID09PSAnbGFiZWxBdWRpb0ZpbGVUYWJsZScpIHtcbiAgICAgIGNvbnN0IHsgbGFiZWxBdWRpb0ZpbGVUYWJsZSB9ID0gdmFsdWVzO1xuICAgICAgYXdhaXQgZGIud3JpdGUocGF0aC5qb2luKHRoaXMuZGlyZWN0b3J5LCAnbGFiZWwtYXVkaW8tZmlsZXMtdGFibGUuanNvbicpLCBsYWJlbEF1ZGlvRmlsZVRhYmxlKTtcbiAgICB9XG5cbiAgICBpZiAoa2V5ID09PSBudWxsIHx8IGtleSA9PT0gJ2dyYXBoJyB8fCBrZXkgPT09ICdncmFwaE9wdGlvbnMnKSB7XG4gICAgICAvLyByZWFwcGx5IGN1cnJlbnQgZ3JhcGggb3B0aW9ucyBpbnRvIGdyYXBoIGRlZmluaXRpb25zXG4gICAgICBjb25zdCB7IGdyYXBoLCBncmFwaE9wdGlvbnMgfSA9IHZhbHVlcztcbiAgICAgIGNvbnN0IHR5cGVzID0gWydkYXRhJywgJ2F1ZGlvJ107XG5cbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdHlwZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgY29uc3QgdHlwZSA9IHR5cGVzW2ldO1xuICAgICAgICBjb25zdCBzdWJHcmFwaCA9IGdyYXBoW3R5cGVdO1xuXG4gICAgICAgIHN1YkdyYXBoLm1vZHVsZXMuZm9yRWFjaChkZXNjID0+IHtcbiAgICAgICAgICBpZiAoT2JqZWN0LmtleXMoZ3JhcGhPcHRpb25zW2Rlc2MuaWRdKS5sZW5ndGgpIHtcbiAgICAgICAgICAgIGRlc2Mub3B0aW9ucyA9IGdyYXBoT3B0aW9uc1tkZXNjLmlkXTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGF3YWl0IGRiLndyaXRlKHBhdGguam9pbih0aGlzLmRpcmVjdG9yeSwgYGdyYXBoLSR7dHlwZX0uanNvbmApLCBzdWJHcmFwaCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKGtleSA9PT0gbnVsbCB8fCBrZXkgPT09ICdsZWFybmluZ0NvbmZpZycpIHtcbiAgICAgIGNvbnN0IHsgbGVhcm5pbmdDb25maWcgfSA9IHZhbHVlcztcbiAgICAgIGF3YWl0IGRiLndyaXRlKHBhdGguam9pbih0aGlzLmRpcmVjdG9yeSwgJ21sLWNvbmZpZy5qc29uJyksIGxlYXJuaW5nQ29uZmlnKTtcbiAgICB9XG5cbiAgICAvLyBnZW5lcmF0ZWQgZmlsZXMsIGtlZXAgdGhlbSBoaWRkZW5cbiAgICBpZiAoa2V5ID09PSBudWxsIHx8IGtleSA9PT0gJ2V4YW1wbGVzJykge1xuICAgICAgY29uc3QgeyBleGFtcGxlcyB9ID0gdmFsdWVzO1xuICAgICAgYXdhaXQgZGIud3JpdGUocGF0aC5qb2luKHRoaXMuZGlyZWN0b3J5LCAnLm1sLWV4YW1wbGVzLmpzb24nKSwgZXhhbXBsZXMsIGZhbHNlKTtcbiAgICB9XG5cbiAgIGlmIChrZXkgPT09IG51bGwgfHwga2V5ID09PSAncHJvY2Vzc2VkRXhhbXBsZXMnKSB7XG4gICAgICBjb25zdCB7IHByb2Nlc3NlZEV4YW1wbGVzIH0gPSB2YWx1ZXM7XG4gICAgICBhd2FpdCBkYi53cml0ZShwYXRoLmpvaW4odGhpcy5kaXJlY3RvcnksICcubWwtcHJvY2Vzc2VkLWV4YW1wbGVzLmRlYnVnLmpzb24nKSwgcHJvY2Vzc2VkRXhhbXBsZXMsIGZhbHNlKTtcbiAgICB9XG5cbiAgICBpZiAoa2V5ID09PSBudWxsIHx8IGtleSA9PT0gJ21vZGVsJykge1xuICAgICAgY29uc3QgeyBtb2RlbCB9ID0gdmFsdWVzO1xuICAgICAgYXdhaXQgZGIud3JpdGUocGF0aC5qb2luKHRoaXMuZGlyZWN0b3J5LCAnLm1sLW1vZGVsLmpzb24nKSwgbW9kZWwsIGZhbHNlKTtcbiAgICB9XG5cbiAgICBpZiAoa2V5ID09PSBudWxsIHx8IGtleSA9PT0gJ2F1ZGlvRmlsZXMnKSB7XG4gICAgICBjb25zdCB7IGF1ZGlvRmlsZXMgfSA9IHZhbHVlcztcbiAgICAgIGF3YWl0IGRiLndyaXRlKHBhdGguam9pbih0aGlzLmRpcmVjdG9yeSwgJy5hdWRpby1maWxlcy5qc29uJyksIGF1ZGlvRmlsZXMsIGZhbHNlKTtcbiAgICB9XG4gIH1cblxuICBnZXQobmFtZSkge1xuICAgIHJldHVybiB0aGlzLnN0YXRlLmdldChuYW1lKTtcbiAgfVxuXG4gIGdldFZhbHVlcygpIHtcbiAgICByZXR1cm4gdGhpcy5zdGF0ZS5nZXRWYWx1ZXMoKTtcbiAgfVxuXG4gIGFzeW5jIHNldCh1cGRhdGVzKSB7XG4gICAgYXdhaXQgdGhpcy5zdGF0ZS5zZXQodXBkYXRlcyk7XG4gIH1cblxuICBzdWJzY3JpYmUoZnVuYykge1xuICAgIHJldHVybiB0aGlzLnN0YXRlLnN1YnNjcmliZShmdW5jKTtcbiAgfVxuXG4gIGFzeW5jIGRlbGV0ZSgpIHtcbiAgICBhd2FpdCB0aGlzLnN0YXRlLmRldGFjaCgpO1xuICB9XG5cbiAgLyoqXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBpbml0VmFsdWVzXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBpbml0VmFsdWVzLmlkXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBpbml0VmFsdWVzLm5hbWVcbiAgICogQHBhcmFtIHtPYmplY3R9IGluaXRWYWx1ZXMuZ3JhcGhcbiAgICogQHBhcmFtIHtPYmplY3R9IFtpbml0VmFsdWVzLm1vZGVsXVxuICAgKiBAcGFyYW0ge09iamVjdH0gW2luaXRWYWx1ZXMuZXhhbXBsZXNdXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBbaW5pdFZhbHVlcy5sZWFybmluZ0NvbmZpZ11cbiAgICogQHBhcmFtIHtPYmplY3R9IFtpbml0VmFsdWVzLmF1ZGlvRmlsZXNdXG4gICAqL1xuICBhc3luYyBpbml0KGluaXRWYWx1ZXMpIHtcbiAgICBpbml0VmFsdWVzLmlkID0gdGhpcy5pZDtcbiAgICAvLyBleHRyYWN0IGdyYXBoIG9wdGlvbnMgZnJvbSBncmFwaCBkZWZpbml0aW9uXG4gICAgY29uc3QgbW9kdWxlcyA9IFsuLi5pbml0VmFsdWVzLmdyYXBoLmRhdGEubW9kdWxlcywgLi4uaW5pdFZhbHVlcy5ncmFwaC5hdWRpby5tb2R1bGVzXTtcblxuICAgIGluaXRWYWx1ZXMuZ3JhcGhPcHRpb25zID0gbW9kdWxlcy5yZWR1Y2UoKGFjYywgZGVzYykgPT4ge1xuICAgICAgYWNjW2Rlc2MuaWRdID0gZGVzYy5vcHRpb25zIHx8IHt9O1xuICAgICAgcmV0dXJuIGFjYztcbiAgICB9LCB7fSk7XG5cbiAgICB0aGlzLnN0YXRlID0gYXdhaXQgdGhpcy5jb21vLnNlcnZlci5zdGF0ZU1hbmFnZXIuY3JlYXRlKGBzZXNzaW9uYCwgaW5pdFZhbHVlcyk7XG5cbiAgICB0aGlzLnN0YXRlLnN1YnNjcmliZShhc3luYyB1cGRhdGVzID0+IHtcbiAgICAgIGZvciAobGV0IFtuYW1lLCB2YWx1ZXNdIG9mIE9iamVjdC5lbnRyaWVzKHVwZGF0ZXMpKSB7XG4gICAgICAgIHN3aXRjaCAobmFtZSkge1xuICAgICAgICAgIGNhc2UgJ25hbWUnOlxuICAgICAgICAgICAgdGhpcy5jb21vLnByb2plY3QuX3VwZGF0ZVNlc3Npb25zT3ZlcnZpZXcoKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIGNhc2UgJ2xlYXJuaW5nQ29uZmlnJzoge1xuICAgICAgICAgICAgdGhpcy51cGRhdGVNb2RlbCgpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgYXdhaXQgdGhpcy5wZXJzaXN0KG5hbWUpO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgLy8gaW5pdCBncmFwaFxuICAgIGNvbnN0IGdyYXBoRGVzY3JpcHRpb24gPSB0aGlzLnN0YXRlLmdldCgnZ3JhcGgnKTtcbiAgICBjb25zdCBkYXRhR3JhcGggPSBjbG9uZWRlZXAoZ3JhcGhEZXNjcmlwdGlvbi5kYXRhKTtcblxuICAgIGRhdGFHcmFwaC5tb2R1bGVzLmZvckVhY2gobW9kdWxlID0+IHtcbiAgICAgIGlmIChtb2R1bGUudHlwZSA9PT0gJ01MRGVjb2RlcicpIHtcbiAgICAgICAgbW9kdWxlLnR5cGUgPSAnQnVmZmVyJztcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIHRoaXMuZ3JhcGggPSBuZXcgR3JhcGgodGhpcy5jb21vLCB7IGRhdGE6IGRhdGFHcmFwaCB9LCB0aGlzLCBudWxsLCB0cnVlKTtcbiAgICBhd2FpdCB0aGlzLmdyYXBoLmluaXQoKTtcblxuICAgIC8vIGluaXQgbW9kZWxcbiAgICBhd2FpdCB0aGlzLnVwZGF0ZU1vZGVsKCk7XG4gIH1cblxuICBhc3luYyB1cGRhdGVBdWRpb0ZpbGVzRnJvbUZpbGVTeXN0ZW0oYXVkaW9GaWxlVHJlZSkge1xuICAgIGNvbnN0IHsgYXVkaW9GaWxlcywgbGFiZWxBdWRpb0ZpbGVUYWJsZSB9ID0gdGhpcy5zdGF0ZS5nZXRWYWx1ZXMoKTtcbiAgICBjb25zdCB7IGRlbGV0ZWQsIGNyZWF0ZWQgfSA9IGRpZmZBcnJheXMoYXVkaW9GaWxlcywgYXVkaW9GaWxlVHJlZSwgZiA9PiBmLnVybCk7XG5cbiAgICBjcmVhdGVkLmZvckVhY2goY3JlYXRlZEZpbGUgPT4ge1xuICAgICAgY29uc3QgY29weSA9IE9iamVjdC5hc3NpZ24oe30sIGNyZWF0ZWRGaWxlKTtcbiAgICAgIGNvcHkuYWN0aXZlID0gdHJ1ZTtcblxuICAgICAgYXVkaW9GaWxlcy5wdXNoKGNvcHkpO1xuXG4gICAgICAvLyBjcmVhdGUgbGFiZWwgYW5kIGRlZmF1bHQgW2xhYmVsLCBmaWxlXSByb3cgZW50cnlcbiAgICAgIHRoaXMuY3JlYXRlTGFiZWwoY3JlYXRlZEZpbGUubmFtZSk7XG4gICAgICB0aGlzLmNyZWF0ZUxhYmVsQXVkaW9GaWxlUm93KFtjcmVhdGVkRmlsZS5uYW1lLCBjcmVhdGVkRmlsZS5uYW1lXSk7XG4gICAgfSk7XG5cbiAgICBkZWxldGVkLmZvckVhY2goZGVsZXRlZEZpbGUgPT4ge1xuICAgICAgY29uc3QgaW5kZXggPSBhdWRpb0ZpbGVzLmZpbmRJbmRleChmID0+IGYudXJsID09PSBkZWxldGVkRmlsZS51cmwpO1xuICAgICAgYXVkaW9GaWxlcy5zcGxpY2UoaW5kZXgsIDEpO1xuXG4gICAgICAvLyBkZWxldGUgbGFiZWxcbiAgICAgIHRoaXMuZGVsZXRlTGFiZWwoZGVsZXRlZEZpbGUubmFtZSk7XG4gICAgICAvLyBkZWxldGUgcm93cyB3aGVyZSBhdWRpbyBmaWxlIGFwcGVhcnNcbiAgICAgIGNvbnN0IHJvd3MgPSBsYWJlbEF1ZGlvRmlsZVRhYmxlLmZpbHRlcihyID0+IHJbMV0gPT09IGRlbGV0ZWRGaWxlLm5hbWUpO1xuICAgICAgcm93cy5mb3JFYWNoKHJvdyA9PiB0aGlzLmRlbGV0ZUxhYmVsQXVkaW9GaWxlUm93KHJvdykpO1xuICAgIH0pO1xuXG4gICAgYXdhaXQgdGhpcy5zdGF0ZS5zZXQoeyBhdWRpb0ZpbGVzIH0pO1xuICB9XG5cbiAgYWRkRXhhbXBsZShleGFtcGxlKSB7XG4gICAgY29uc3QgdXVpZCA9IHV1aWR2NCgpO1xuICAgIGNvbnN0IGV4YW1wbGVzID0gdGhpcy5zdGF0ZS5nZXQoJ2V4YW1wbGVzJyk7XG4gICAgZXhhbXBsZXNbdXVpZF0gPSBleGFtcGxlO1xuXG4gICAgdGhpcy51cGRhdGVNb2RlbChleGFtcGxlcyk7XG4gIH1cblxuICBkZWxldGVFeGFtcGxlKHV1aWQpIHtcbiAgICBjb25zdCBleGFtcGxlcyA9IHRoaXMuc3RhdGUuZ2V0KCdleGFtcGxlcycpO1xuXG4gICAgaWYgKHV1aWQgaW4gZXhhbXBsZXMpIHtcbiAgICAgIGRlbGV0ZSBleGFtcGxlc1t1dWlkXTtcbiAgICAgIHRoaXMudXBkYXRlTW9kZWwoZXhhbXBsZXMpO1xuICAgIH1cbiAgfVxuXG4gIGNsZWFyRXhhbXBsZXMobGFiZWwgPSBudWxsKSB7XG4gICAgY29uc3QgY2xlYXJlZEV4YW1wbGVzID0ge307XG5cbiAgICBpZiAobGFiZWwgIT09IG51bGwpIHtcbiAgICAgIGNvbnN0IGV4YW1wbGVzID0gdGhpcy5zdGF0ZS5nZXQoJ2V4YW1wbGVzJyk7XG5cbiAgICAgIGZvciAobGV0IHV1aWQgaW4gZXhhbXBsZXMpIHtcbiAgICAgICAgaWYgKGV4YW1wbGVzW3V1aWRdLmxhYmVsICE9PSBsYWJlbCkge1xuICAgICAgICAgIGNsZWFyZWRFeGFtcGxlc1t1dWlkXSA9IGV4YW1wbGVzW3V1aWRdO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgdGhpcy51cGRhdGVNb2RlbChjbGVhcmVkRXhhbXBsZXMpO1xuICB9XG5cbiAgY3JlYXRlTGFiZWwobGFiZWwpIHtcbiAgICBjb25zdCBsYWJlbHMgPSB0aGlzLnN0YXRlLmdldCgnbGFiZWxzJyk7XG5cbiAgICBpZiAobGFiZWxzLmluZGV4T2YobGFiZWwpID09PSAtMSkge1xuICAgICAgbGFiZWxzLnB1c2gobGFiZWwpO1xuICAgICAgLy8gY29uc29sZS5sb2coJz4gbGFiZWxzJywgbGFiZWxzKTtcbiAgICAgIHRoaXMuc3RhdGUuc2V0KHsgbGFiZWxzIH0pO1xuICAgIH1cbiAgfVxuXG4gIHVwZGF0ZUxhYmVsKG9sZExhYmVsLCBuZXdMYWJlbCkge1xuICAgIGNvbnN0IHsgbGFiZWxzLCBsYWJlbEF1ZGlvRmlsZVRhYmxlLCBleGFtcGxlcyB9ID0gdGhpcy5zdGF0ZS5nZXRWYWx1ZXMoKTtcblxuICAgIGlmIChsYWJlbHMuaW5kZXhPZihvbGRMYWJlbCkgIT09IC0xICYmIGxhYmVscy5pbmRleE9mKG5ld0xhYmVsKSA9PT0gLTEpIHtcbiAgICAgIGNvbnN0IHVwZGF0ZWRMYWJlbHMgPSBsYWJlbHMubWFwKGxhYmVsID0+IGxhYmVsID09PSBvbGRMYWJlbCA/IG5ld0xhYmVsIDogbGFiZWwpO1xuICAgICAgY29uc3QgdXBkYXRlZFRhYmxlID0gbGFiZWxBdWRpb0ZpbGVUYWJsZS5tYXAocm93ID0+IHtcbiAgICAgICAgaWYgKHJvd1swXSA9PT0gb2xkTGFiZWwpIHtcbiAgICAgICAgICByb3dbMF0gPSBuZXdMYWJlbDtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiByb3c7XG4gICAgICB9KTtcblxuICAgICAgLy8gdXBkYXRlcyBsYWJlbHMgb2YgZXhpc3RpbmcgZXhhbXBsZXNcbiAgICAgIGZvciAobGV0IHV1aWQgaW4gZXhhbXBsZXMpIHtcbiAgICAgICAgY29uc3QgZXhhbXBsZSA9IGV4YW1wbGVzW3V1aWRdO1xuXG4gICAgICAgIGlmIChleGFtcGxlLmxhYmVsID09PSBvbGRMYWJlbCkge1xuICAgICAgICAgIGV4YW1wbGUubGFiZWwgPSBuZXdMYWJlbDtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICB0aGlzLnVwZGF0ZU1vZGVsKGV4YW1wbGVzKTtcbiAgICAgIHRoaXMuc3RhdGUuc2V0KHtcbiAgICAgICAgbGFiZWxzOiB1cGRhdGVkTGFiZWxzLFxuICAgICAgICBsYWJlbEF1ZGlvRmlsZVRhYmxlOiB1cGRhdGVkVGFibGUsXG4gICAgICB9KTtcbiAgICB9XG4gIH1cblxuICBkZWxldGVMYWJlbChsYWJlbCkge1xuICAgIGNvbnN0IHsgbGFiZWxzLCBsYWJlbEF1ZGlvRmlsZVRhYmxlLCBleGFtcGxlcyB9ID0gdGhpcy5zdGF0ZS5nZXRWYWx1ZXMoKTtcblxuICAgIGlmIChsYWJlbHMuaW5kZXhPZihsYWJlbCkgIT09IC0xKSB7XG4gICAgICAvLyBjbGVhbiBsYWJlbCAvIGF1ZGlvIGZpbGUgdGFibGVcbiAgICAgIGNvbnN0IGZpbHRlcmVkTGFiZWxzID0gbGFiZWxzLmZpbHRlcihsID0+IGwgIT09IGxhYmVsKTtcbiAgICAgIGNvbnN0IGZpbHRlcmVkVGFibGUgPSBsYWJlbEF1ZGlvRmlsZVRhYmxlLmZpbHRlcihyb3cgPT4gcm93WzBdICE9PSBsYWJlbCk7XG5cbiAgICAgIHRoaXMuY2xlYXJFeGFtcGxlcyhsYWJlbCk7IC8vIHRoaXMgcmV0cmFpbnMgdGhlIG1vZGVsXG4gICAgICB0aGlzLnN0YXRlLnNldCh7XG4gICAgICAgIGxhYmVsczogZmlsdGVyZWRMYWJlbHMsXG4gICAgICAgIGxhYmVsQXVkaW9GaWxlVGFibGU6IGZpbHRlcmVkVGFibGUsXG4gICAgICB9KTtcbiAgICB9XG4gIH1cblxuICB0b2dnbGVBdWRpb0ZpbGUoZmlsZW5hbWUsIGFjdGl2ZSkge1xuICAgIGNvbnN0IHsgYXVkaW9GaWxlcywgbGFiZWxBdWRpb0ZpbGVUYWJsZSB9ID0gdGhpcy5zdGF0ZS5nZXRWYWx1ZXMoKTtcblxuICAgIGNvbnN0IGF1ZGlvRmlsZSA9IGF1ZGlvRmlsZXMuZmluZChmID0+IGYubmFtZSA9PT0gZmlsZW5hbWUpO1xuICAgIGF1ZGlvRmlsZS5hY3RpdmUgPSBhY3RpdmU7XG5cbiAgICBjb25zdCB1cGRhdGVkVGFibGUgPSBsYWJlbEF1ZGlvRmlsZVRhYmxlLmZpbHRlcihyb3cgPT4gcm93WzFdICE9PSBmaWxlbmFtZSk7XG5cbiAgICB0aGlzLnN0YXRlLnNldCh7XG4gICAgICBhdWRpb0ZpbGVzLFxuICAgICAgbGFiZWxBdWRpb0ZpbGVUYWJsZTogdXBkYXRlZFRhYmxlLFxuICAgIH0pO1xuICB9XG5cbiAgY3JlYXRlTGFiZWxBdWRpb0ZpbGVSb3cocm93KSB7XG4gICAgY29uc3QgbGFiZWxBdWRpb0ZpbGVUYWJsZSA9IHRoaXMuc3RhdGUuZ2V0KCdsYWJlbEF1ZGlvRmlsZVRhYmxlJyk7XG4gICAgY29uc3QgaW5kZXggPSBsYWJlbEF1ZGlvRmlsZVRhYmxlLmZpbmRJbmRleChyID0+IHJbMF0gPT09IHJvd1swXSAmJiByWzFdID09PSByb3dbMV0pO1xuXG4gICAgaWYgKGluZGV4ID09PSAtMSkge1xuICAgICAgbGFiZWxBdWRpb0ZpbGVUYWJsZS5wdXNoKHJvdyk7XG4gICAgICB0aGlzLnN0YXRlLnNldCh7IGxhYmVsQXVkaW9GaWxlVGFibGUgfSk7XG4gICAgfVxuICB9XG5cbiAgZGVsZXRlTGFiZWxBdWRpb0ZpbGVSb3cocm93KSB7XG4gICAgY29uc3QgbGFiZWxBdWRpb0ZpbGVUYWJsZSA9IHRoaXMuc3RhdGUuZ2V0KCdsYWJlbEF1ZGlvRmlsZVRhYmxlJyk7XG4gICAgY29uc3QgZmlsdGVyZWRUYWJsZSA9IGxhYmVsQXVkaW9GaWxlVGFibGUuZmlsdGVyKHIgPT4ge1xuICAgICAgcmV0dXJuIHJbMF0gPT09IHJvd1swXSAmJiByWzFdID09PSByb3dbMV0gPyBmYWxzZSA6IHRydWU7XG4gICAgfSk7XG5cbiAgICB0aGlzLnN0YXRlLnNldCh7IGxhYmVsQXVkaW9GaWxlVGFibGU6IGZpbHRlcmVkVGFibGUgfSk7XG4gIH1cblxuICBhc3luYyB1cGRhdGVNb2RlbChleGFtcGxlcyA9IG51bGwpIHtcbiAgICBpZiAoZXhhbXBsZXMgPT09IG51bGwpIHtcbiAgICAgIGV4YW1wbGVzID0gdGhpcy5zdGF0ZS5nZXQoJ2V4YW1wbGVzJyk7XG4gICAgfVxuXG4gICAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gICAgY29uc3QgbG9nUHJlZml4ID0gYFtzZXNzaW9uIFwiJHt0aGlzLnN0YXRlLmdldCgnaWQnKX1cIl1gO1xuICAgIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgIGNvbnN0IGxhYmVscyA9IE9iamVjdC52YWx1ZXMoZXhhbXBsZXMpLm1hcChkID0+IGQubGFiZWwpLmZpbHRlcigoZCwgaSwgYXJyKSA9PiBhcnIuaW5kZXhPZihkKSA9PT0gaSk7XG4gICAgY29uc29sZS5sb2coYFxcbiR7bG9nUHJlZml4fSA+IFVQREFURSBNT0RFTCAtIGxhYmVsczpgLCBsYWJlbHMpO1xuICAgIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgIGNvbnN0IHByb2Nlc3NpbmdTdGFydFRpbWUgPSBuZXcgRGF0ZSgpLmdldFRpbWUoKTtcbiAgICBjb25zb2xlLmxvZyhgJHtsb2dQcmVmaXh9IHByb2Nlc3Npbmcgc3RhcnRcXHQoIyBleGFtcGxlczogJHtPYmplY3Qua2V5cyhleGFtcGxlcykubGVuZ3RofSlgKTtcbiAgICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuICAgIC8vIHJlcGxhY2UgTUxEZWNvZGVyIHcvIERlc3RCdWZmZXIgaW4gZ3JhcGggZm9yIHJlY29yZGluZyB0cmFuc2Zvcm1lZCBzdHJlYW1cbiAgICAvLyBAbm90ZSAtIHRoaXMgY2FuIG9ubHkgd29yayB3LyAxIG9yIDAgZGVjb2RlcixcbiAgICAvLyBAdG9kbyAtIGhhbmRsZSBjYXNlcyB3LyAyIG9yIG1vcmUgZGVjb2RlcnMgbGF0ZXIuXG4gICAgbGV0IGhhc0RlY29kZXIgPSBmYWxzZTtcbiAgICBsZXQgYnVmZmVyID0gbnVsbDtcblxuICAgIGZvciAobGV0IGlkIGluIHRoaXMuZ3JhcGgubW9kdWxlcykge1xuICAgICAgY29uc3QgbW9kdWxlID0gdGhpcy5ncmFwaC5tb2R1bGVzW2lkXTtcblxuICAgICAgaWYgKG1vZHVsZS50eXBlID09PSAnQnVmZmVyJykge1xuICAgICAgICBoYXNEZWNvZGVyID0gdHJ1ZTtcbiAgICAgICAgYnVmZmVyID0gbW9kdWxlO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChidWZmZXIgPT09IG51bGwpIHtcbiAgICAgIGNvbnNvbGUubG9nKGBcXG4ke2xvZ1ByZWZpeH0gPiBncmFwaCBkb2VzIG5vdCBjb250YWluIGFueSBNTERlY29kZXIsIGFib3J0IHRyYW5pbmcuLi5gKTtcbiAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoKTtcbiAgICB9XG5cbiAgICAvLyBjb25zdCBidWZmZXIgPSBncmFwaC5nZXRNb2R1bGUoYnVmZmVySWQpO1xuICAgIGxldCBvZmZsaW5lU291cmNlO1xuXG4gICAgLy8gQG5vdGUgLSBtaW1pYyByYXBpZC1taXggQVBJLCByZW1vdmUgLyB1cGRhdGUgbGF0ZXJcbiAgICBjb25zdCByYXBpZE1peEV4YW1wbGVzID0ge1xuICAgICAgZG9jVHlwZTogJ3JhcGlkLW1peDptbC10cmFpbmluZy1zZXQnLFxuICAgICAgZG9jVmVyc2lvbjogJzEuMC4wJyxcbiAgICAgIHBheWxvYWQ6IHtcbiAgICAgICAgaW5wdXREaW1lbnNpb246IDAsXG4gICAgICAgIG91dHB1dERpbWVuc2lvbjogMCxcbiAgICAgICAgZGF0YTogW10sXG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gZm9yIHBlcnNpc3RlbmN5LCBkaXNwbGF5XG4gICAgY29uc3QgcHJvY2Vzc2VkRXhhbXBsZXMgPSB7fVxuXG4gICAgLy8gcHJvY2VzcyBleGFtcGxlcyByYXcgZGF0YSBpbiBwcmUtcHJvY2Vzc2luZyBncmFwaFxuICAgIGZvciAobGV0IHV1aWQgaW4gZXhhbXBsZXMpIHtcbiAgICAgIGNvbnN0IGV4YW1wbGUgPSBleGFtcGxlc1t1dWlkXTtcblxuICAgICAgb2ZmbGluZVNvdXJjZSA9IG5ldyBPZmZsaW5lU291cmNlKGV4YW1wbGUuaW5wdXQpO1xuICAgICAgdGhpcy5ncmFwaC5zZXRTb3VyY2Uob2ZmbGluZVNvdXJjZSk7XG5cbiAgICAgIC8vIHJ1biB0aGUgZ3JhcGggb2ZmbGluZSwgdGhpcyBNVVNUIGJlIHN5bmNocm9ub3VzXG4gICAgICBvZmZsaW5lU291cmNlLnJ1bigpO1xuICAgICAgY29uc3QgdHJhbnNmb3JtZWRTdHJlYW0gPSBidWZmZXIuZ2V0RGF0YSgpO1xuXG4gICAgICBpZiAoZXhhbXBsZS5pbnB1dC5sZW5ndGggIT09IHRyYW5zZm9ybWVkU3RyZWFtLmxlbmd0aCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYCR7bG9nUHJlZml4fSBFcnJvcjogaW5jb2hlcmVudCBleGFtcGxlIHByb2Nlc3NpbmcgZm9yIGV4YW1wbGUgJHt1dWlkfWApO1xuICAgICAgfVxuXG4gICAgICB0aGlzLmdyYXBoLnJlbW92ZVNvdXJjZShvZmZsaW5lU291cmNlKTtcbiAgICAgIGJ1ZmZlci5yZXNldCgpO1xuXG4gICAgICBjb25zdCBwcm9jZXNzZWRFeGFtcGxlID0ge1xuICAgICAgICBsYWJlbDogZXhhbXBsZS5sYWJlbCxcbiAgICAgICAgb3V0cHV0OiBleGFtcGxlLm91dHB1dCxcbiAgICAgICAgaW5wdXQ6IHRyYW5zZm9ybWVkU3RyZWFtLFxuICAgICAgfTtcbiAgICAgIC8vIGFkZCB0byBwcm9jZXNzZWQgZXhhbXBsZXNcbiAgICAgIHJhcGlkTWl4RXhhbXBsZXMucGF5bG9hZC5kYXRhLnB1c2gocHJvY2Vzc2VkRXhhbXBsZSk7XG4gICAgICBwcm9jZXNzZWRFeGFtcGxlc1t1dWlkXSA9IHByb2Nlc3NlZEV4YW1wbGU7XG4gICAgfVxuXG4gICAgaWYgKHJhcGlkTWl4RXhhbXBsZXMucGF5bG9hZC5kYXRhWzBdKSB7XG4gICAgICByYXBpZE1peEV4YW1wbGVzLnBheWxvYWQuaW5wdXREaW1lbnNpb24gPSByYXBpZE1peEV4YW1wbGVzLnBheWxvYWQuZGF0YVswXS5pbnB1dFswXS5sZW5ndGg7XG4gICAgfVxuXG4gICAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gICAgY29uc3QgcHJvY2Vzc2luZ1RpbWUgPSBuZXcgRGF0ZSgpLmdldFRpbWUoKSAtIHByb2Nlc3NpbmdTdGFydFRpbWU7XG4gICAgY29uc29sZS5sb2coYCR7bG9nUHJlZml4fSBwcm9jZXNzaW5nIGVuZFxcdFxcdCgke3Byb2Nlc3NpbmdUaW1lfW1zKWApO1xuICAgIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgIGNvbnN0IHRyYWluaW5nU3RhcnRUaW1lID0gbmV3IERhdGUoKS5nZXRUaW1lKCk7XG4gICAgY29uc3QgbnVtSW5wdXREaW1lbnNpb25zID0gcmFwaWRNaXhFeGFtcGxlcy5wYXlsb2FkLmlucHV0RGltZW5zaW9uO1xuICAgIGNvbnNvbGUubG9nKGAke2xvZ1ByZWZpeH0gdHJhaW5pbmcgc3RhcnRcXHRcXHQoIyBpbnB1dCBkaW1lbnNpb25zOiAke251bUlucHV0RGltZW5zaW9uc30pYCk7XG4gICAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbiAgICAvLyB0cmFpbiBtb2RlbFxuICAgIC8vIEB0b2RvIC0gY2xlYW4gdGhpcyBmKioqKioqIG1lc3N5IE1hbm8gLyBSYXBpZE1peCAvIFhtbSBjb252ZXJ0aW9uXG4gICAgY29uc3QgeG1tVHJhaW5pbmdTZXQgPSByYXBpZE1peEFkYXB0ZXJzLnJhcGlkTWl4VG9YbW1UcmFpbmluZ1NldChyYXBpZE1peEV4YW1wbGVzKTtcblxuICAgIGNvbnN0IGxlYXJuaW5nQ29uZmlnID0gdGhpcy5zdGF0ZS5nZXQoJ2xlYXJuaW5nQ29uZmlnJyk7IC8vIG1hbm9cbiAgICBjb25zdCB4bW1Db25maWcgPSByYXBpZE1peEFkYXB0ZXJzLnJhcGlkTWl4VG9YbW1Db25maWcobGVhcm5pbmdDb25maWcpOyAvLyB4bW1cbiAgICBjb25zb2xlLmxvZyhsb2dQcmVmaXgsICd4bW0gY29uZmlnJywgeG1tQ29uZmlnKTtcbiAgICAvLyBnZXQgKGdtbXxoaG1tKSB4bW0gaW5zdGFuY2VcbiAgICBjb25zdCB4bW0gPSB0aGlzLnhtbUluc3RhbmNlc1tsZWFybmluZ0NvbmZpZy5wYXlsb2FkLm1vZGVsVHlwZV07XG5cbiAgICB4bW0uc2V0Q29uZmlnKHhtbUNvbmZpZyk7XG4gICAgeG1tLnNldFRyYWluaW5nU2V0KHhtbVRyYWluaW5nU2V0KTtcbiAgICAvLyBjb25zb2xlLmxvZyh4bW0uZ2V0Q29uZmlnKCkpO1xuXG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgIHhtbS50cmFpbigoZXJyLCBtb2RlbCkgPT4ge1xuICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgcmVqZWN0KGVycik7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCByYXBpZE1peE1vZGVsID0gcmFwaWRNaXhBZGFwdGVycy54bW1Ub1JhcGlkTWl4TW9kZWwobW9kZWwpO1xuXG4gICAgICAgIHRoaXMuc3RhdGUuc2V0KHtcbiAgICAgICAgICBleGFtcGxlcyxcbiAgICAgICAgICBwcm9jZXNzZWRFeGFtcGxlcyxcbiAgICAgICAgICBtb2RlbDogcmFwaWRNaXhNb2RlbCxcbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gICAgICAgIGNvbnN0IHRyYWluaW5nVGltZSA9IG5ldyBEYXRlKCkuZ2V0VGltZSgpIC0gdHJhaW5pbmdTdGFydFRpbWU7XG4gICAgICAgIGNvbnNvbGUubG9nKGAke2xvZ1ByZWZpeH0gdHJhaW5pbmcgZW5kXFx0XFx0KCR7dHJhaW5pbmdUaW1lfW1zKWApO1xuICAgICAgICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuICAgICAgICByZXNvbHZlKCk7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBTZXNzaW9uO1xuIl19