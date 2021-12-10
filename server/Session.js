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
      labels.push(label);
      console.log('> labels', labels);
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9zZXJ2ZXIvU2Vzc2lvbi5qcyJdLCJuYW1lcyI6WyJTZXNzaW9uIiwiY3JlYXRlIiwiY29tbyIsImlkIiwibmFtZSIsImdyYXBoIiwiZnNBdWRpb0ZpbGVzIiwic2Vzc2lvbiIsImluaXQiLCJ1cGRhdGVBdWRpb0ZpbGVzRnJvbUZpbGVTeXN0ZW0iLCJyZWdpc3RlcmVkQXVkaW9GaWxlcyIsImdldCIsImxhYmVscyIsImxhYmVsQXVkaW9GaWxlVGFibGUiLCJmb3JFYWNoIiwiYXVkaW9GaWxlIiwibGFiZWwiLCJyb3ciLCJwdXNoIiwic2V0IiwicGVyc2lzdCIsImZyb21GaWxlU3lzdGVtIiwiZGlybmFtZSIsIm1ldGFzIiwiZGIiLCJyZWFkIiwicGF0aCIsImpvaW4iLCJkYXRhR3JhcGgiLCJhdWRpb0dyYXBoIiwibGVhcm5pbmdDb25maWciLCJleGFtcGxlcyIsIm1vZGVsIiwiYXVkaW9GaWxlcyIsInNhdmVFeGFtcGxlcyIsImNvbnNvbGUiLCJsb2ciLCJ1dWlkIiwiaW5kZXhPZiIsIndhcm4iLCJjb25maWciLCJkYXRhIiwiYXVkaW8iLCJjb25zdHJ1Y3RvciIsImRpcmVjdG9yeSIsInByb2plY3REaXJlY3RvcnkiLCJ4bW1JbnN0YW5jZXMiLCJ4bW0iLCJrZXkiLCJ2YWx1ZXMiLCJzdGF0ZSIsImdldFZhbHVlcyIsIndyaXRlIiwidmVyc2lvbiIsImdyYXBoT3B0aW9ucyIsInR5cGVzIiwiaSIsImxlbmd0aCIsInR5cGUiLCJzdWJHcmFwaCIsIm1vZHVsZXMiLCJkZXNjIiwiT2JqZWN0Iiwia2V5cyIsIm9wdGlvbnMiLCJwcm9jZXNzZWRFeGFtcGxlcyIsInVwZGF0ZXMiLCJzdWJzY3JpYmUiLCJmdW5jIiwiZGVsZXRlIiwiZGV0YWNoIiwiaW5pdFZhbHVlcyIsInJlZHVjZSIsImFjYyIsInNlcnZlciIsInN0YXRlTWFuYWdlciIsImVudHJpZXMiLCJ1cGRhdGVNb2RlbCIsImdyYXBoRGVzY3JpcHRpb24iLCJtb2R1bGUiLCJHcmFwaCIsImF1ZGlvRmlsZVRyZWUiLCJkZWxldGVkIiwiY3JlYXRlZCIsImYiLCJ1cmwiLCJjcmVhdGVkRmlsZSIsImNvcHkiLCJhc3NpZ24iLCJhY3RpdmUiLCJjcmVhdGVMYWJlbCIsImNyZWF0ZUxhYmVsQXVkaW9GaWxlUm93IiwiZGVsZXRlZEZpbGUiLCJpbmRleCIsImZpbmRJbmRleCIsInNwbGljZSIsImRlbGV0ZUxhYmVsIiwicm93cyIsImZpbHRlciIsInIiLCJkZWxldGVMYWJlbEF1ZGlvRmlsZVJvdyIsImFkZEV4YW1wbGUiLCJleGFtcGxlIiwiZGVsZXRlRXhhbXBsZSIsImNsZWFyRXhhbXBsZXMiLCJjbGVhcmVkRXhhbXBsZXMiLCJ1cGRhdGVMYWJlbCIsIm9sZExhYmVsIiwibmV3TGFiZWwiLCJ1cGRhdGVkTGFiZWxzIiwibWFwIiwidXBkYXRlZFRhYmxlIiwiZmlsdGVyZWRMYWJlbHMiLCJsIiwiZmlsdGVyZWRUYWJsZSIsInRvZ2dsZUF1ZGlvRmlsZSIsImZpbGVuYW1lIiwiZmluZCIsImxvZ1ByZWZpeCIsImQiLCJhcnIiLCJwcm9jZXNzaW5nU3RhcnRUaW1lIiwiRGF0ZSIsImdldFRpbWUiLCJoYXNEZWNvZGVyIiwiYnVmZmVyIiwiUHJvbWlzZSIsInJlc29sdmUiLCJvZmZsaW5lU291cmNlIiwicmFwaWRNaXhFeGFtcGxlcyIsImRvY1R5cGUiLCJkb2NWZXJzaW9uIiwicGF5bG9hZCIsImlucHV0RGltZW5zaW9uIiwib3V0cHV0RGltZW5zaW9uIiwiT2ZmbGluZVNvdXJjZSIsImlucHV0Iiwic2V0U291cmNlIiwicnVuIiwidHJhbnNmb3JtZWRTdHJlYW0iLCJnZXREYXRhIiwiRXJyb3IiLCJyZW1vdmVTb3VyY2UiLCJyZXNldCIsInByb2Nlc3NlZEV4YW1wbGUiLCJvdXRwdXQiLCJwcm9jZXNzaW5nVGltZSIsInRyYWluaW5nU3RhcnRUaW1lIiwibnVtSW5wdXREaW1lbnNpb25zIiwieG1tVHJhaW5pbmdTZXQiLCJyYXBpZE1peEFkYXB0ZXJzIiwicmFwaWRNaXhUb1htbVRyYWluaW5nU2V0IiwieG1tQ29uZmlnIiwicmFwaWRNaXhUb1htbUNvbmZpZyIsIm1vZGVsVHlwZSIsInNldENvbmZpZyIsInNldFRyYWluaW5nU2V0IiwicmVqZWN0IiwidHJhaW4iLCJlcnIiLCJyYXBpZE1peE1vZGVsIiwieG1tVG9SYXBpZE1peE1vZGVsIiwidHJhaW5pbmdUaW1lIl0sIm1hcHBpbmdzIjoiOzs7Ozs7O0FBQUE7O0FBQ0E7O0FBQ0E7O0FBRUE7O0FBRUE7O0FBRUE7O0FBQ0E7O0FBQ0E7O0FBQ0E7O0FBQ0E7Ozs7QUFQQTtBQVNBLE1BQU1BLE9BQU4sQ0FBYztBQUVaO0FBQ21CLGVBQU5DLE1BQU0sQ0FBQ0MsSUFBRCxFQUFPQyxFQUFQLEVBQVdDLElBQVgsRUFBaUJDLEtBQWpCLEVBQXdCQyxZQUF4QixFQUFzQztBQUN2RCxVQUFNQyxPQUFPLEdBQUcsSUFBSVAsT0FBSixDQUFZRSxJQUFaLEVBQWtCQyxFQUFsQixDQUFoQjtBQUNBLFVBQU1JLE9BQU8sQ0FBQ0MsSUFBUixDQUFhO0FBQUVKLE1BQUFBLElBQUY7QUFBUUMsTUFBQUE7QUFBUixLQUFiLENBQU47QUFDQSxVQUFNRSxPQUFPLENBQUNFLDhCQUFSLENBQXVDSCxZQUF2QyxDQUFOLENBSHVELENBS3ZEO0FBQ0E7QUFDQTs7QUFDQSxVQUFNSSxvQkFBb0IsR0FBR0gsT0FBTyxDQUFDSSxHQUFSLENBQVksWUFBWixDQUE3QjtBQUNBLFVBQU1DLE1BQU0sR0FBRyxFQUFmO0FBQ0EsVUFBTUMsbUJBQW1CLEdBQUcsRUFBNUI7QUFFQUgsSUFBQUEsb0JBQW9CLENBQUNJLE9BQXJCLENBQTZCQyxTQUFTLElBQUk7QUFDeEMsWUFBTUMsS0FBSyxHQUFHRCxTQUFTLENBQUNYLElBQXhCO0FBQ0EsWUFBTWEsR0FBRyxHQUFHLENBQUNELEtBQUQsRUFBUUQsU0FBUyxDQUFDWCxJQUFsQixDQUFaO0FBQ0FRLE1BQUFBLE1BQU0sQ0FBQ00sSUFBUCxDQUFZRixLQUFaO0FBQ0FILE1BQUFBLG1CQUFtQixDQUFDSyxJQUFwQixDQUF5QkQsR0FBekI7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QUFmLEVBUHdCLENBYXhCOztBQUNBLGNBQU1FLFlBQVksR0FBRyxJQUFJeEMsSUFBSixHQUFXQyxPQUFYLEtBQXVCd0IsaUJBQTVDO0FBQ0FoSCxRQUFBQSxPQUFPLENBQUNDLEdBQVIsQ0FBYSxHQUFFa0YsU0FBVSxxQkFBb0I0QyxZQUFhLEtBQTFELEVBZndCLENBZ0J4Qjs7QUFFQW5DLFFBQUFBLE9BQU87QUFDUixPQW5CRDtBQW9CRCxLQXJCTSxDQUFQO0FBc0JEOztBQTNmVzs7ZUE4ZkMvSCxPIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgZnMgZnJvbSAnZnMnO1xuaW1wb3J0IHsgdjQgYXMgdXVpZHY0IH0gZnJvbSAndXVpZCc7XG5cbmltcG9ydCB4bW0gZnJvbSAneG1tLW5vZGUnO1xuLy8gaW1wb3J0IFhtbVByb2Nlc3NvciBmcm9tICcuLi9jb21tb24vbGlicy9tYW5vL1htbVByb2Nlc3Nvci5qcyc7XG5pbXBvcnQgcmFwaWRNaXhBZGFwdGVycyBmcm9tICdyYXBpZC1taXgtYWRhcHRlcnMnO1xuXG5pbXBvcnQgZGIgZnJvbSAnLi91dGlscy9kYic7XG5pbXBvcnQgZGlmZkFycmF5cyBmcm9tICcuLi9jb21tb24vdXRpbHMvZGlmZkFycmF5cy5qcyc7XG5pbXBvcnQgR3JhcGggZnJvbSAnLi4vY29tbW9uL0dyYXBoLmpzJztcbmltcG9ydCBPZmZsaW5lU291cmNlIGZyb20gJy4uL2NvbW1vbi9zb3VyY2VzL09mZmxpbmVTb3VyY2UuanMnO1xuaW1wb3J0IGNsb25lZGVlcCBmcm9tICdsb2Rhc2guY2xvbmVkZWVwJztcblxuY2xhc3MgU2Vzc2lvbiB7XG5cbiAgLyoqIGZhY3RvcnkgbWV0aG9kcyAqL1xuICBzdGF0aWMgYXN5bmMgY3JlYXRlKGNvbW8sIGlkLCBuYW1lLCBncmFwaCwgZnNBdWRpb0ZpbGVzKSB7XG4gICAgY29uc3Qgc2Vzc2lvbiA9IG5ldyBTZXNzaW9uKGNvbW8sIGlkKTtcbiAgICBhd2FpdCBzZXNzaW9uLmluaXQoeyBuYW1lLCBncmFwaCB9KTtcbiAgICBhd2FpdCBzZXNzaW9uLnVwZGF0ZUF1ZGlvRmlsZXNGcm9tRmlsZVN5c3RlbShmc0F1ZGlvRmlsZXMpO1xuXG4gICAgLy8gYnkgZGVmYXVsdCAodG8gYmUgYmFja3dhcmQgdXNhZ2UgY29tcGF0aWJsZSk6XG4gICAgLy8gLSBsYWJlbHMgYXJlIHRoZSBhdWRpbyBmaWxlcyBuYW1lcyB3aXRob3V0IGV4dGVuc2lvblxuICAgIC8vIC0gYSByb3cgPGxhYmVsLCBhdWRpb0ZpbGU+IGlzIGluc2VydGVkIGluIHRoZSBgbGFiZWxBdWRpb0ZpbGVUYWJsZWBcbiAgICBjb25zdCByZWdpc3RlcmVkQXVkaW9GaWxlcyA9IHNlc3Npb24uZ2V0KCdhdWRpb0ZpbGVzJyk7XG4gICAgY29uc3QgbGFiZWxzID0gW107XG4gICAgY29uc3QgbGFiZWxBdWRpb0ZpbGVUYWJsZSA9IFtdO1xuXG4gICAgcmVnaXN0ZXJlZEF1ZGlvRmlsZXMuZm9yRWFjaChhdWRpb0ZpbGUgPT4ge1xuICAgICAgY29uc3QgbGFiZWwgPSBhdWRpb0ZpbGUubmFtZTtcbiAgICAgIGNvbnN0IHJvdyA9IFtsYWJlbCwgYXVkaW9GaWxlLm5hbWVdO1xuICAgICAgbGFiZWxzLnB1c2gobGFiZWwpO1xuICAgICAgbGFiZWxBdWRpb0ZpbGVUYWJsZS5wdXNoKHJvdyk7XG4gICAgfSk7XG5cbiAgICBhd2FpdCBzZXNzaW9uLnNldCh7IGxhYmVscywgbGFiZWxBdWRpb0ZpbGVUYWJsZSB9KTtcbiAgICBhd2FpdCBzZXNzaW9uLnBlcnNpc3QoKTtcblxuICAgIHJldHVybiBzZXNzaW9uO1xuICB9XG5cbiAgc3RhdGljIGFzeW5jIGZyb21GaWxlU3lzdGVtKGNvbW8sIGRpcm5hbWUsIGZzQXVkaW9GaWxlcykge1xuICAgIC8vIEBub3RlIC0gdmVyc2lvbiAwLjAuMCAoY2YubWV0YXMpXG4gICAgY29uc3QgbWV0YXMgPSBhd2FpdCBkYi5yZWFkKHBhdGguam9pbihkaXJuYW1lLCAnbWV0YXMuanNvbicpKTtcbiAgICBjb25zdCBkYXRhR3JhcGggPSBhd2FpdCBkYi5yZWFkKHBhdGguam9pbihkaXJuYW1lLCBgZ3JhcGgtZGF0YS5qc29uYCkpO1xuICAgIGNvbnN0IGF1ZGlvR3JhcGggPSBhd2FpdCBkYi5yZWFkKHBhdGguam9pbihkaXJuYW1lLCBgZ3JhcGgtYXVkaW8uanNvbmApKTtcbiAgICBjb25zdCBsYWJlbHMgPSBhd2FpdCBkYi5yZWFkKHBhdGguam9pbihkaXJuYW1lLCAnbGFiZWxzLmpzb24nKSk7XG4gICAgY29uc3QgbGFiZWxBdWRpb0ZpbGVUYWJsZSA9IGF3YWl0IGRiLnJlYWQocGF0aC5qb2luKGRpcm5hbWUsICdsYWJlbC1hdWRpby1maWxlcy10YWJsZS5qc29uJykpO1xuICAgIGNvbnN0IGxlYXJuaW5nQ29uZmlnID0gYXdhaXQgZGIucmVhZChwYXRoLmpvaW4oZGlybmFtZSwgJ21sLWNvbmZpZy5qc29uJykpO1xuICAgIGNvbnN0IGV4YW1wbGVzID0gYXdhaXQgZGIucmVhZChwYXRoLmpvaW4oZGlybmFtZSwgJy5tbC1leGFtcGxlcy5qc29uJykpO1xuICAgIGNvbnN0IG1vZGVsID0gYXdhaXQgZGIucmVhZChwYXRoLmpvaW4oZGlybmFtZSwgJy5tbC1tb2RlbC5qc29uJykpO1xuICAgIGNvbnN0IGF1ZGlvRmlsZXMgPSBhd2FpdCBkYi5yZWFkKHBhdGguam9pbihkaXJuYW1lLCAnLmF1ZGlvLWZpbGVzLmpzb24nKSk7XG5cbiAgICAvLyByZW1vdmUgZXhhbXBsZXMgdGhhdCBhcmUgbm90IGluIGxhYmVsc1xuICAgIGxldCBzYXZlRXhhbXBsZXMgPSBmYWxzZTtcbiAgICBjb25zb2xlLmxvZygnJyk7IC8vIGp1c3QgYSBsaW5lIGJyZWFrIGluIHRoZSBjb25zb2xlXG5cbiAgICBmb3IgKGxldCB1dWlkIGluIGV4YW1wbGVzKSB7XG4gICAgICBjb25zdCBsYWJlbCA9IGV4YW1wbGVzW3V1aWRdLmxhYmVsO1xuICAgICAgaWYgKGxhYmVscy5pbmRleE9mKGxhYmVsKSA9PT0gLTEpIHtcbiAgICAgICAgY29uc29sZS53YXJuKGBbc2Vzc2lvbiBcIiR7bWV0YXMubmFtZX1cIl0gPiBXQVJOSU5HIC0gRXhhbXBsZSB3aXRoIGxhYmVsIFwiJHtsYWJlbH1cIiBkZWxldGVkLCBsYWJlbCBkb2VzIGV4aXN0cyBpbiBsYWJlbHM6IFske2xhYmVscy5qb2luKCcsICcpfV1gKTtcblxuICAgICAgICBkZWxldGUgZXhhbXBsZXNbdXVpZF07XG4gICAgICAgIHNhdmVFeGFtcGxlcyA9IHRydWU7XG4gICAgICB9XG4gICAgfVxuXG4gICAgY29uc3QgaWQgPSBtZXRhcy5pZDtcbiAgICBjb25zdCBjb25maWcgPSB7XG4gICAgICBuYW1lOiBtZXRhcy5uYW1lLFxuICAgICAgZ3JhcGg6IHsgZGF0YTogZGF0YUdyYXBoLCBhdWRpbzogYXVkaW9HcmFwaCB9LFxuICAgICAgbGFiZWxzLFxuICAgICAgbGFiZWxBdWRpb0ZpbGVUYWJsZSxcbiAgICAgIGxlYXJuaW5nQ29uZmlnLFxuICAgICAgZXhhbXBsZXMsXG4gICAgICBtb2RlbCxcbiAgICAgIGF1ZGlvRmlsZXMsXG4gICAgfTtcblxuICAgIGNvbnN0IHNlc3Npb24gPSBuZXcgU2Vzc2lvbihjb21vLCBpZCk7XG4gICAgYXdhaXQgc2Vzc2lvbi5pbml0KGNvbmZpZyk7XG5cbiAgICBpZiAoc2F2ZUV4YW1wbGVzKSB7XG4gICAgICBzZXNzaW9uLnBlcnNpc3QoJ2V4YW1wbGVzJyk7XG4gICAgfVxuXG4gICAgYXdhaXQgc2Vzc2lvbi51cGRhdGVBdWRpb0ZpbGVzRnJvbUZpbGVTeXN0ZW0oZnNBdWRpb0ZpbGVzKTtcblxuICAgIHJldHVybiBzZXNzaW9uO1xuICB9XG5cbiAgY29uc3RydWN0b3IoY29tbywgaWQpIHtcbiAgICB0aGlzLmNvbW8gPSBjb21vO1xuICAgIHRoaXMuaWQgPSBpZDtcblxuICAgIHRoaXMuZGlyZWN0b3J5ID0gcGF0aC5qb2luKHRoaXMuY29tby5wcm9qZWN0RGlyZWN0b3J5LCAnc2Vzc2lvbnMnLCBpZCk7XG5cbiAgICB0aGlzLnhtbUluc3RhbmNlcyA9IHtcbiAgICAgICdnbW0nOiBuZXcgeG1tKCdnbW0nKSxcbiAgICAgICdoaG1tJzogbmV3IHhtbSgnaGhtbScpLFxuICAgIH07XG4gIH1cblxuICBhc3luYyBwZXJzaXN0KGtleSA9IG51bGwpIHtcbiAgICBjb25zdCB2YWx1ZXMgPSB0aGlzLnN0YXRlLmdldFZhbHVlcygpO1xuXG4gICAgaWYgKGtleSA9PT0gbnVsbCB8fCBrZXkgPT09ICduYW1lJykge1xuICAgICAgY29uc3QgeyBpZCwgbmFtZSB9ID0gdmFsdWVzO1xuICAgICAgYXdhaXQgZGIud3JpdGUocGF0aC5qb2luKHRoaXMuZGlyZWN0b3J5LCAnbWV0YXMuanNvbicpLCB7IGlkLCBuYW1lLCB2ZXJzaW9uOiAnMC4wLjAnIH0pO1xuICAgIH1cblxuICAgIGlmIChrZXkgPT09IG51bGwgfHwga2V5ID09PSAnbGFiZWxzJykge1xuICAgICAgY29uc3QgeyBsYWJlbHMgfSA9IHZhbHVlcztcbiAgICAgIGF3YWl0IGRiLndyaXRlKHBhdGguam9pbih0aGlzLmRpcmVjdG9yeSwgJ2xhYmVscy5qc29uJyksIGxhYmVscyk7XG4gICAgfVxuXG4gICAgaWYgKGtleSA9PT0gbnVsbCB8fCBrZXkgPT09ICdsYWJlbEF1ZGlvRmlsZVRhYmxlJykge1xuICAgICAgY29uc3QgeyBsYWJlbEF1ZGlvRmlsZVRhYmxlIH0gPSB2YWx1ZXM7XG4gICAgICBhd2FpdCBkYi53cml0ZShwYXRoLmpvaW4odGhpcy5kaXJlY3RvcnksICdsYWJlbC1hdWRpby1maWxlcy10YWJsZS5qc29uJyksIGxhYmVsQXVkaW9GaWxlVGFibGUpO1xuICAgIH1cblxuICAgIGlmIChrZXkgPT09IG51bGwgfHwga2V5ID09PSAnZ3JhcGgnIHx8IGtleSA9PT0gJ2dyYXBoT3B0aW9ucycpIHtcbiAgICAgIC8vIHJlYXBwbHkgY3VycmVudCBncmFwaCBvcHRpb25zIGludG8gZ3JhcGggZGVmaW5pdGlvbnNcbiAgICAgIGNvbnN0IHsgZ3JhcGgsIGdyYXBoT3B0aW9ucyB9ID0gdmFsdWVzO1xuICAgICAgY29uc3QgdHlwZXMgPSBbJ2RhdGEnLCAnYXVkaW8nXTtcblxuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0eXBlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICBjb25zdCB0eXBlID0gdHlwZXNbaV07XG4gICAgICAgIGNvbnN0IHN1YkdyYXBoID0gZ3JhcGhbdHlwZV07XG5cbiAgICAgICAgc3ViR3JhcGgubW9kdWxlcy5mb3JFYWNoKGRlc2MgPT4ge1xuICAgICAgICAgIGlmIChPYmplY3Qua2V5cyhncmFwaE9wdGlvbnNbZGVzYy5pZF0pLmxlbmd0aCkge1xuICAgICAgICAgICAgZGVzYy5vcHRpb25zID0gZ3JhcGhPcHRpb25zW2Rlc2MuaWRdO1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cbiAgICAgICAgYXdhaXQgZGIud3JpdGUocGF0aC5qb2luKHRoaXMuZGlyZWN0b3J5LCBgZ3JhcGgtJHt0eXBlfS5qc29uYCksIHN1YkdyYXBoKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoa2V5ID09PSBudWxsIHx8IGtleSA9PT0gJ2xlYXJuaW5nQ29uZmlnJykge1xuICAgICAgY29uc3QgeyBsZWFybmluZ0NvbmZpZyB9ID0gdmFsdWVzO1xuICAgICAgYXdhaXQgZGIud3JpdGUocGF0aC5qb2luKHRoaXMuZGlyZWN0b3J5LCAnbWwtY29uZmlnLmpzb24nKSwgbGVhcm5pbmdDb25maWcpO1xuICAgIH1cblxuICAgIC8vIGdlbmVyYXRlZCBmaWxlcywga2VlcCB0aGVtIGhpZGRlblxuICAgIGlmIChrZXkgPT09IG51bGwgfHwga2V5ID09PSAnZXhhbXBsZXMnKSB7XG4gICAgICBjb25zdCB7IGV4YW1wbGVzIH0gPSB2YWx1ZXM7XG4gICAgICBhd2FpdCBkYi53cml0ZShwYXRoLmpvaW4odGhpcy5kaXJlY3RvcnksICcubWwtZXhhbXBsZXMuanNvbicpLCBleGFtcGxlcywgZmFsc2UpO1xuICAgIH1cblxuICAgaWYgKGtleSA9PT0gbnVsbCB8fCBrZXkgPT09ICdwcm9jZXNzZWRFeGFtcGxlcycpIHtcbiAgICAgIGNvbnN0IHsgcHJvY2Vzc2VkRXhhbXBsZXMgfSA9IHZhbHVlcztcbiAgICAgIGF3YWl0IGRiLndyaXRlKHBhdGguam9pbih0aGlzLmRpcmVjdG9yeSwgJy5tbC1wcm9jZXNzZWQtZXhhbXBsZXMuZGVidWcuanNvbicpLCBwcm9jZXNzZWRFeGFtcGxlcywgZmFsc2UpO1xuICAgIH1cblxuICAgIGlmIChrZXkgPT09IG51bGwgfHwga2V5ID09PSAnbW9kZWwnKSB7XG4gICAgICBjb25zdCB7IG1vZGVsIH0gPSB2YWx1ZXM7XG4gICAgICBhd2FpdCBkYi53cml0ZShwYXRoLmpvaW4odGhpcy5kaXJlY3RvcnksICcubWwtbW9kZWwuanNvbicpLCBtb2RlbCwgZmFsc2UpO1xuICAgIH1cblxuICAgIGlmIChrZXkgPT09IG51bGwgfHwga2V5ID09PSAnYXVkaW9GaWxlcycpIHtcbiAgICAgIGNvbnN0IHsgYXVkaW9GaWxlcyB9ID0gdmFsdWVzO1xuICAgICAgYXdhaXQgZGIud3JpdGUocGF0aC5qb2luKHRoaXMuZGlyZWN0b3J5LCAnLmF1ZGlvLWZpbGVzLmpzb24nKSwgYXVkaW9GaWxlcywgZmFsc2UpO1xuICAgIH1cbiAgfVxuXG4gIGdldChuYW1lKSB7XG4gICAgcmV0dXJuIHRoaXMuc3RhdGUuZ2V0KG5hbWUpO1xuICB9XG5cbiAgZ2V0VmFsdWVzKCkge1xuICAgIHJldHVybiB0aGlzLnN0YXRlLmdldFZhbHVlcygpO1xuICB9XG5cbiAgYXN5bmMgc2V0KHVwZGF0ZXMpIHtcbiAgICBhd2FpdCB0aGlzLnN0YXRlLnNldCh1cGRhdGVzKTtcbiAgfVxuXG4gIHN1YnNjcmliZShmdW5jKSB7XG4gICAgcmV0dXJuIHRoaXMuc3RhdGUuc3Vic2NyaWJlKGZ1bmMpO1xuICB9XG5cbiAgYXN5bmMgZGVsZXRlKCkge1xuICAgIGF3YWl0IHRoaXMuc3RhdGUuZGV0YWNoKCk7XG4gIH1cblxuICAvKipcbiAgICogQHBhcmFtIHtPYmplY3R9IGluaXRWYWx1ZXNcbiAgICogQHBhcmFtIHtPYmplY3R9IGluaXRWYWx1ZXMuaWRcbiAgICogQHBhcmFtIHtPYmplY3R9IGluaXRWYWx1ZXMubmFtZVxuICAgKiBAcGFyYW0ge09iamVjdH0gaW5pdFZhbHVlcy5ncmFwaFxuICAgKiBAcGFyYW0ge09iamVjdH0gW2luaXRWYWx1ZXMubW9kZWxdXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBbaW5pdFZhbHVlcy5leGFtcGxlc11cbiAgICogQHBhcmFtIHtPYmplY3R9IFtpbml0VmFsdWVzLmxlYXJuaW5nQ29uZmlnXVxuICAgKiBAcGFyYW0ge09iamVjdH0gW2luaXRWYWx1ZXMuYXVkaW9GaWxlc11cbiAgICovXG4gIGFzeW5jIGluaXQoaW5pdFZhbHVlcykge1xuICAgIGluaXRWYWx1ZXMuaWQgPSB0aGlzLmlkO1xuICAgIC8vIGV4dHJhY3QgZ3JhcGggb3B0aW9ucyBmcm9tIGdyYXBoIGRlZmluaXRpb25cbiAgICBjb25zdCBtb2R1bGVzID0gWy4uLmluaXRWYWx1ZXMuZ3JhcGguZGF0YS5tb2R1bGVzLCAuLi5pbml0VmFsdWVzLmdyYXBoLmF1ZGlvLm1vZHVsZXNdO1xuXG4gICAgaW5pdFZhbHVlcy5ncmFwaE9wdGlvbnMgPSBtb2R1bGVzLnJlZHVjZSgoYWNjLCBkZXNjKSA9PiB7XG4gICAgICBhY2NbZGVzYy5pZF0gPSBkZXNjLm9wdGlvbnMgfHwge307XG4gICAgICByZXR1cm4gYWNjO1xuICAgIH0sIHt9KTtcblxuICAgIHRoaXMuc3RhdGUgPSBhd2FpdCB0aGlzLmNvbW8uc2VydmVyLnN0YXRlTWFuYWdlci5jcmVhdGUoYHNlc3Npb25gLCBpbml0VmFsdWVzKTtcblxuICAgIHRoaXMuc3RhdGUuc3Vic2NyaWJlKGFzeW5jIHVwZGF0ZXMgPT4ge1xuICAgICAgZm9yIChsZXQgW25hbWUsIHZhbHVlc10gb2YgT2JqZWN0LmVudHJpZXModXBkYXRlcykpIHtcbiAgICAgICAgc3dpdGNoIChuYW1lKSB7XG4gICAgICAgICAgY2FzZSAnbGVhcm5pbmdDb25maWcnOiB7XG4gICAgICAgICAgICB0aGlzLnVwZGF0ZU1vZGVsKCk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBhd2FpdCB0aGlzLnBlcnNpc3QobmFtZSk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICAvLyBpbml0IGdyYXBoXG4gICAgY29uc3QgZ3JhcGhEZXNjcmlwdGlvbiA9IHRoaXMuc3RhdGUuZ2V0KCdncmFwaCcpO1xuICAgIGNvbnN0IGRhdGFHcmFwaCA9IGNsb25lZGVlcChncmFwaERlc2NyaXB0aW9uLmRhdGEpO1xuXG4gICAgZGF0YUdyYXBoLm1vZHVsZXMuZm9yRWFjaChtb2R1bGUgPT4ge1xuICAgICAgaWYgKG1vZHVsZS50eXBlID09PSAnTUxEZWNvZGVyJykge1xuICAgICAgICBtb2R1bGUudHlwZSA9ICdCdWZmZXInO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgdGhpcy5ncmFwaCA9IG5ldyBHcmFwaCh0aGlzLmNvbW8sIHsgZGF0YTogZGF0YUdyYXBoIH0sIHRoaXMsIG51bGwsIHRydWUpO1xuICAgIGF3YWl0IHRoaXMuZ3JhcGguaW5pdCgpO1xuXG4gICAgLy8gaW5pdCBtb2RlbFxuICAgIGF3YWl0IHRoaXMudXBkYXRlTW9kZWwoKTtcbiAgfVxuXG4gIGFzeW5jIHVwZGF0ZUF1ZGlvRmlsZXNGcm9tRmlsZVN5c3RlbShhdWRpb0ZpbGVUcmVlKSB7XG4gICAgY29uc3QgeyBhdWRpb0ZpbGVzLCBsYWJlbEF1ZGlvRmlsZVRhYmxlIH0gPSB0aGlzLnN0YXRlLmdldFZhbHVlcygpO1xuICAgIGNvbnN0IHsgZGVsZXRlZCwgY3JlYXRlZCB9ID0gZGlmZkFycmF5cyhhdWRpb0ZpbGVzLCBhdWRpb0ZpbGVUcmVlLCBmID0+IGYudXJsKTtcblxuICAgIGNyZWF0ZWQuZm9yRWFjaChjcmVhdGVkRmlsZSA9PiB7XG4gICAgICBjb25zdCBjb3B5ID0gT2JqZWN0LmFzc2lnbih7fSwgY3JlYXRlZEZpbGUpO1xuICAgICAgY29weS5hY3RpdmUgPSB0cnVlO1xuXG4gICAgICBhdWRpb0ZpbGVzLnB1c2goY29weSk7XG5cbiAgICAgIC8vIGNyZWF0ZSBsYWJlbCBhbmQgZGVmYXVsdCBbbGFiZWwsIGZpbGVdIHJvdyBlbnRyeVxuICAgICAgdGhpcy5jcmVhdGVMYWJlbChjcmVhdGVkRmlsZS5uYW1lKTtcbiAgICAgIHRoaXMuY3JlYXRlTGFiZWxBdWRpb0ZpbGVSb3coW2NyZWF0ZWRGaWxlLm5hbWUsIGNyZWF0ZWRGaWxlLm5hbWVdKTtcbiAgICB9KTtcblxuICAgIGRlbGV0ZWQuZm9yRWFjaChkZWxldGVkRmlsZSA9PiB7XG4gICAgICBjb25zdCBpbmRleCA9IGF1ZGlvRmlsZXMuZmluZEluZGV4KGYgPT4gZi51cmwgPT09IGRlbGV0ZWRGaWxlLnVybCk7XG4gICAgICBhdWRpb0ZpbGVzLnNwbGljZShpbmRleCwgMSk7XG5cbiAgICAgIC8vIGRlbGV0ZSBsYWJlbFxuICAgICAgdGhpcy5kZWxldGVMYWJlbChkZWxldGVkRmlsZS5uYW1lKTtcbiAgICAgIC8vIGRlbGV0ZSByb3dzIHdoZXJlIGF1ZGlvIGZpbGUgYXBwZWFyc1xuICAgICAgY29uc3Qgcm93cyA9IGxhYmVsQXVkaW9GaWxlVGFibGUuZmlsdGVyKHIgPT4gclsxXSA9PT0gZGVsZXRlZEZpbGUubmFtZSk7XG4gICAgICByb3dzLmZvckVhY2gocm93ID0+IHRoaXMuZGVsZXRlTGFiZWxBdWRpb0ZpbGVSb3cocm93KSk7XG4gICAgfSk7XG5cbiAgICBhd2FpdCB0aGlzLnN0YXRlLnNldCh7IGF1ZGlvRmlsZXMgfSk7XG4gIH1cblxuICBhZGRFeGFtcGxlKGV4YW1wbGUpIHtcbiAgICBjb25zdCB1dWlkID0gdXVpZHY0KCk7XG4gICAgY29uc3QgZXhhbXBsZXMgPSB0aGlzLnN0YXRlLmdldCgnZXhhbXBsZXMnKTtcbiAgICBleGFtcGxlc1t1dWlkXSA9IGV4YW1wbGU7XG5cbiAgICB0aGlzLnVwZGF0ZU1vZGVsKGV4YW1wbGVzKTtcbiAgfVxuXG4gIGRlbGV0ZUV4YW1wbGUodXVpZCkge1xuICAgIGNvbnN0IGV4YW1wbGVzID0gdGhpcy5zdGF0ZS5nZXQoJ2V4YW1wbGVzJyk7XG5cbiAgICBpZiAodXVpZCBpbiBleGFtcGxlcykge1xuICAgICAgZGVsZXRlIGV4YW1wbGVzW3V1aWRdO1xuICAgICAgdGhpcy51cGRhdGVNb2RlbChleGFtcGxlcyk7XG4gICAgfVxuICB9XG5cbiAgY2xlYXJFeGFtcGxlcyhsYWJlbCA9IG51bGwpIHtcbiAgICBjb25zdCBjbGVhcmVkRXhhbXBsZXMgPSB7fTtcblxuICAgIGlmIChsYWJlbCAhPT0gbnVsbCkge1xuICAgICAgY29uc3QgZXhhbXBsZXMgPSB0aGlzLnN0YXRlLmdldCgnZXhhbXBsZXMnKTtcblxuICAgICAgZm9yIChsZXQgdXVpZCBpbiBleGFtcGxlcykge1xuICAgICAgICBpZiAoZXhhbXBsZXNbdXVpZF0ubGFiZWwgIT09IGxhYmVsKSB7XG4gICAgICAgICAgY2xlYXJlZEV4YW1wbGVzW3V1aWRdID0gZXhhbXBsZXNbdXVpZF07XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICB0aGlzLnVwZGF0ZU1vZGVsKGNsZWFyZWRFeGFtcGxlcyk7XG4gIH1cblxuICBjcmVhdGVMYWJlbChsYWJlbCkge1xuICAgIGNvbnN0IGxhYmVscyA9IHRoaXMuc3RhdGUuZ2V0KCdsYWJlbHMnKTtcblxuICAgIGlmIChsYWJlbHMuaW5kZXhPZihsYWJlbCkgPT09IC0xKSB7XG4gICAgICBsYWJlbHMucHVzaChsYWJlbCk7XG5cbiAgICAgIGNvbnNvbGUubG9nKCc+IGxhYmVscycsIGxhYmVscyk7XG4gICAgICB0aGlzLnN0YXRlLnNldCh7IGxhYmVscyB9KTtcbiAgICB9XG4gIH1cblxuICB1cGRhdGVMYWJlbChvbGRMYWJlbCwgbmV3TGFiZWwpIHtcbiAgICBjb25zdCB7IGxhYmVscywgbGFiZWxBdWRpb0ZpbGVUYWJsZSwgZXhhbXBsZXMgfSA9IHRoaXMuc3RhdGUuZ2V0VmFsdWVzKCk7XG5cbiAgICBpZiAobGFiZWxzLmluZGV4T2Yob2xkTGFiZWwpICE9PSAtMSAmJiBsYWJlbHMuaW5kZXhPZihuZXdMYWJlbCkgPT09IC0xKSB7XG4gICAgICBjb25zdCB1cGRhdGVkTGFiZWxzID0gbGFiZWxzLm1hcChsYWJlbCA9PiBsYWJlbCA9PT0gb2xkTGFiZWwgPyBuZXdMYWJlbCA6IGxhYmVsKTtcbiAgICAgIGNvbnN0IHVwZGF0ZWRUYWJsZSA9IGxhYmVsQXVkaW9GaWxlVGFibGUubWFwKHJvdyA9PiB7XG4gICAgICAgIGlmIChyb3dbMF0gPT09IG9sZExhYmVsKSB7XG4gICAgICAgICAgcm93WzBdID0gbmV3TGFiZWw7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gcm93O1xuICAgICAgfSk7XG5cbiAgICAgIC8vIHVwZGF0ZXMgbGFiZWxzIG9mIGV4aXN0aW5nIGV4YW1wbGVzXG4gICAgICBmb3IgKGxldCB1dWlkIGluIGV4YW1wbGVzKSB7XG4gICAgICAgIGNvbnN0IGV4YW1wbGUgPSBleGFtcGxlc1t1dWlkXTtcblxuICAgICAgICBpZiAoZXhhbXBsZS5sYWJlbCA9PT0gb2xkTGFiZWwpIHtcbiAgICAgICAgICBleGFtcGxlLmxhYmVsID0gbmV3TGFiZWw7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgdGhpcy51cGRhdGVNb2RlbChleGFtcGxlcyk7XG4gICAgICB0aGlzLnN0YXRlLnNldCh7XG4gICAgICAgIGxhYmVsczogdXBkYXRlZExhYmVscyxcbiAgICAgICAgbGFiZWxBdWRpb0ZpbGVUYWJsZTogdXBkYXRlZFRhYmxlLFxuICAgICAgfSk7XG4gICAgfVxuICB9XG5cbiAgZGVsZXRlTGFiZWwobGFiZWwpIHtcbiAgICBjb25zdCB7IGxhYmVscywgbGFiZWxBdWRpb0ZpbGVUYWJsZSwgZXhhbXBsZXMgfSA9IHRoaXMuc3RhdGUuZ2V0VmFsdWVzKCk7XG5cbiAgICBpZiAobGFiZWxzLmluZGV4T2YobGFiZWwpICE9PSAtMSkge1xuICAgICAgLy8gY2xlYW4gbGFiZWwgLyBhdWRpbyBmaWxlIHRhYmxlXG4gICAgICBjb25zdCBmaWx0ZXJlZExhYmVscyA9IGxhYmVscy5maWx0ZXIobCA9PiBsICE9PSBsYWJlbCk7XG4gICAgICBjb25zdCBmaWx0ZXJlZFRhYmxlID0gbGFiZWxBdWRpb0ZpbGVUYWJsZS5maWx0ZXIocm93ID0+IHJvd1swXSAhPT0gbGFiZWwpO1xuXG4gICAgICB0aGlzLmNsZWFyRXhhbXBsZXMobGFiZWwpOyAvLyB0aGlzIHJldHJhaW5zIHRoZSBtb2RlbFxuICAgICAgdGhpcy5zdGF0ZS5zZXQoe1xuICAgICAgICBsYWJlbHM6IGZpbHRlcmVkTGFiZWxzLFxuICAgICAgICBsYWJlbEF1ZGlvRmlsZVRhYmxlOiBmaWx0ZXJlZFRhYmxlLFxuICAgICAgfSk7XG4gICAgfVxuICB9XG5cbiAgdG9nZ2xlQXVkaW9GaWxlKGZpbGVuYW1lLCBhY3RpdmUpIHtcbiAgICBjb25zdCB7IGF1ZGlvRmlsZXMsIGxhYmVsQXVkaW9GaWxlVGFibGUgfSA9IHRoaXMuc3RhdGUuZ2V0VmFsdWVzKCk7XG5cbiAgICBjb25zdCBhdWRpb0ZpbGUgPSBhdWRpb0ZpbGVzLmZpbmQoZiA9PiBmLm5hbWUgPT09IGZpbGVuYW1lKTtcbiAgICBhdWRpb0ZpbGUuYWN0aXZlID0gYWN0aXZlO1xuXG4gICAgY29uc3QgdXBkYXRlZFRhYmxlID0gbGFiZWxBdWRpb0ZpbGVUYWJsZS5maWx0ZXIocm93ID0+IHJvd1sxXSAhPT0gZmlsZW5hbWUpO1xuXG4gICAgdGhpcy5zdGF0ZS5zZXQoe1xuICAgICAgYXVkaW9GaWxlcyxcbiAgICAgIGxhYmVsQXVkaW9GaWxlVGFibGU6IHVwZGF0ZWRUYWJsZSxcbiAgICB9KTtcbiAgfVxuXG4gIGNyZWF0ZUxhYmVsQXVkaW9GaWxlUm93KHJvdykge1xuICAgIGNvbnN0IGxhYmVsQXVkaW9GaWxlVGFibGUgPSB0aGlzLnN0YXRlLmdldCgnbGFiZWxBdWRpb0ZpbGVUYWJsZScpO1xuICAgIGNvbnN0IGluZGV4ID0gbGFiZWxBdWRpb0ZpbGVUYWJsZS5maW5kSW5kZXgociA9PiByWzBdID09PSByb3dbMF0gJiYgclsxXSA9PT0gcm93WzFdKTtcblxuICAgIGlmIChpbmRleCA9PT0gLTEpIHtcbiAgICAgIGxhYmVsQXVkaW9GaWxlVGFibGUucHVzaChyb3cpO1xuICAgICAgdGhpcy5zdGF0ZS5zZXQoeyBsYWJlbEF1ZGlvRmlsZVRhYmxlIH0pO1xuICAgIH1cbiAgfVxuXG4gIGRlbGV0ZUxhYmVsQXVkaW9GaWxlUm93KHJvdykge1xuICAgIGNvbnN0IGxhYmVsQXVkaW9GaWxlVGFibGUgPSB0aGlzLnN0YXRlLmdldCgnbGFiZWxBdWRpb0ZpbGVUYWJsZScpO1xuICAgIGNvbnN0IGZpbHRlcmVkVGFibGUgPSBsYWJlbEF1ZGlvRmlsZVRhYmxlLmZpbHRlcihyID0+IHtcbiAgICAgIHJldHVybiByWzBdID09PSByb3dbMF0gJiYgclsxXSA9PT0gcm93WzFdID8gZmFsc2UgOiB0cnVlO1xuICAgIH0pO1xuXG4gICAgdGhpcy5zdGF0ZS5zZXQoeyBsYWJlbEF1ZGlvRmlsZVRhYmxlOiBmaWx0ZXJlZFRhYmxlIH0pO1xuICB9XG5cbiAgYXN5bmMgdXBkYXRlTW9kZWwoZXhhbXBsZXMgPSBudWxsKSB7XG4gICAgaWYgKGV4YW1wbGVzID09PSBudWxsKSB7XG4gICAgICBleGFtcGxlcyA9IHRoaXMuc3RhdGUuZ2V0KCdleGFtcGxlcycpO1xuICAgIH1cblxuICAgIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgIGNvbnN0IGxvZ1ByZWZpeCA9IGBbc2Vzc2lvbiBcIiR7dGhpcy5zdGF0ZS5nZXQoJ2lkJyl9XCJdYDtcbiAgICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgICBjb25zdCBsYWJlbHMgPSBPYmplY3QudmFsdWVzKGV4YW1wbGVzKS5tYXAoZCA9PiBkLmxhYmVsKS5maWx0ZXIoKGQsIGksIGFycikgPT4gYXJyLmluZGV4T2YoZCkgPT09IGkpO1xuICAgIGNvbnNvbGUubG9nKGBcXG4ke2xvZ1ByZWZpeH0gPiBVUERBVEUgTU9ERUwgLSBsYWJlbHM6YCwgbGFiZWxzKTtcbiAgICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgICBjb25zdCBwcm9jZXNzaW5nU3RhcnRUaW1lID0gbmV3IERhdGUoKS5nZXRUaW1lKCk7XG4gICAgY29uc29sZS5sb2coYCR7bG9nUHJlZml4fSBwcm9jZXNzaW5nIHN0YXJ0XFx0KCMgZXhhbXBsZXM6ICR7T2JqZWN0LmtleXMoZXhhbXBsZXMpLmxlbmd0aH0pYCk7XG4gICAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbiAgICAvLyByZXBsYWNlIE1MRGVjb2RlciB3LyBEZXN0QnVmZmVyIGluIGdyYXBoIGZvciByZWNvcmRpbmcgdHJhbnNmb3JtZWQgc3RyZWFtXG4gICAgLy8gQG5vdGUgLSB0aGlzIGNhbiBvbmx5IHdvcmsgdy8gMSBvciAwIGRlY29kZXIsXG4gICAgLy8gQHRvZG8gLSBoYW5kbGUgY2FzZXMgdy8gMiBvciBtb3JlIGRlY29kZXJzIGxhdGVyLlxuICAgIGxldCBoYXNEZWNvZGVyID0gZmFsc2U7XG4gICAgbGV0IGJ1ZmZlciA9IG51bGw7XG5cbiAgICBmb3IgKGxldCBpZCBpbiB0aGlzLmdyYXBoLm1vZHVsZXMpIHtcbiAgICAgIGNvbnN0IG1vZHVsZSA9IHRoaXMuZ3JhcGgubW9kdWxlc1tpZF07XG5cbiAgICAgIGlmIChtb2R1bGUudHlwZSA9PT0gJ0J1ZmZlcicpIHtcbiAgICAgICAgaGFzRGVjb2RlciA9IHRydWU7XG4gICAgICAgIGJ1ZmZlciA9IG1vZHVsZTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoYnVmZmVyID09PSBudWxsKSB7XG4gICAgICBjb25zb2xlLmxvZyhgXFxuJHtsb2dQcmVmaXh9ID4gZ3JhcGggZG9lcyBub3QgY29udGFpbiBhbnkgTUxEZWNvZGVyLCBhYm9ydCB0cmFuaW5nLi4uYCk7XG4gICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCk7XG4gICAgfVxuXG4gICAgLy8gY29uc3QgYnVmZmVyID0gZ3JhcGguZ2V0TW9kdWxlKGJ1ZmZlcklkKTtcbiAgICBsZXQgb2ZmbGluZVNvdXJjZTtcblxuICAgIC8vIEBub3RlIC0gbWltaWMgcmFwaWQtbWl4IEFQSSwgcmVtb3ZlIC8gdXBkYXRlIGxhdGVyXG4gICAgY29uc3QgcmFwaWRNaXhFeGFtcGxlcyA9IHtcbiAgICAgIGRvY1R5cGU6ICdyYXBpZC1taXg6bWwtdHJhaW5pbmctc2V0JyxcbiAgICAgIGRvY1ZlcnNpb246ICcxLjAuMCcsXG4gICAgICBwYXlsb2FkOiB7XG4gICAgICAgIGlucHV0RGltZW5zaW9uOiAwLFxuICAgICAgICBvdXRwdXREaW1lbnNpb246IDAsXG4gICAgICAgIGRhdGE6IFtdLFxuICAgICAgfVxuICAgIH1cblxuICAgIC8vIGZvciBwZXJzaXN0ZW5jeSwgZGlzcGxheVxuICAgIGNvbnN0IHByb2Nlc3NlZEV4YW1wbGVzID0ge31cblxuICAgIC8vIHByb2Nlc3MgZXhhbXBsZXMgcmF3IGRhdGEgaW4gcHJlLXByb2Nlc3NpbmcgZ3JhcGhcbiAgICBmb3IgKGxldCB1dWlkIGluIGV4YW1wbGVzKSB7XG4gICAgICBjb25zdCBleGFtcGxlID0gZXhhbXBsZXNbdXVpZF07XG5cbiAgICAgIG9mZmxpbmVTb3VyY2UgPSBuZXcgT2ZmbGluZVNvdXJjZShleGFtcGxlLmlucHV0KTtcbiAgICAgIHRoaXMuZ3JhcGguc2V0U291cmNlKG9mZmxpbmVTb3VyY2UpO1xuXG4gICAgICAvLyBydW4gdGhlIGdyYXBoIG9mZmxpbmUsIHRoaXMgTVVTVCBiZSBzeW5jaHJvbm91c1xuICAgICAgb2ZmbGluZVNvdXJjZS5ydW4oKTtcbiAgICAgIGNvbnN0IHRyYW5zZm9ybWVkU3RyZWFtID0gYnVmZmVyLmdldERhdGEoKTtcblxuICAgICAgaWYgKGV4YW1wbGUuaW5wdXQubGVuZ3RoICE9PSB0cmFuc2Zvcm1lZFN0cmVhbS5sZW5ndGgpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGAke2xvZ1ByZWZpeH0gRXJyb3I6IGluY29oZXJlbnQgZXhhbXBsZSBwcm9jZXNzaW5nIGZvciBleGFtcGxlICR7dXVpZH1gKTtcbiAgICAgIH1cblxuICAgICAgdGhpcy5ncmFwaC5yZW1vdmVTb3VyY2Uob2ZmbGluZVNvdXJjZSk7XG4gICAgICBidWZmZXIucmVzZXQoKTtcblxuICAgICAgY29uc3QgcHJvY2Vzc2VkRXhhbXBsZSA9IHtcbiAgICAgICAgbGFiZWw6IGV4YW1wbGUubGFiZWwsXG4gICAgICAgIG91dHB1dDogZXhhbXBsZS5vdXRwdXQsXG4gICAgICAgIGlucHV0OiB0cmFuc2Zvcm1lZFN0cmVhbSxcbiAgICAgIH07XG4gICAgICAvLyBhZGQgdG8gcHJvY2Vzc2VkIGV4YW1wbGVzXG4gICAgICByYXBpZE1peEV4YW1wbGVzLnBheWxvYWQuZGF0YS5wdXNoKHByb2Nlc3NlZEV4YW1wbGUpO1xuICAgICAgcHJvY2Vzc2VkRXhhbXBsZXNbdXVpZF0gPSBwcm9jZXNzZWRFeGFtcGxlO1xuICAgIH1cblxuICAgIGlmIChyYXBpZE1peEV4YW1wbGVzLnBheWxvYWQuZGF0YVswXSkge1xuICAgICAgcmFwaWRNaXhFeGFtcGxlcy5wYXlsb2FkLmlucHV0RGltZW5zaW9uID0gcmFwaWRNaXhFeGFtcGxlcy5wYXlsb2FkLmRhdGFbMF0uaW5wdXRbMF0ubGVuZ3RoO1xuICAgIH1cblxuICAgIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgIGNvbnN0IHByb2Nlc3NpbmdUaW1lID0gbmV3IERhdGUoKS5nZXRUaW1lKCkgLSBwcm9jZXNzaW5nU3RhcnRUaW1lO1xuICAgIGNvbnNvbGUubG9nKGAke2xvZ1ByZWZpeH0gcHJvY2Vzc2luZyBlbmRcXHRcXHQoJHtwcm9jZXNzaW5nVGltZX1tcylgKTtcbiAgICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgICBjb25zdCB0cmFpbmluZ1N0YXJ0VGltZSA9IG5ldyBEYXRlKCkuZ2V0VGltZSgpO1xuICAgIGNvbnN0IG51bUlucHV0RGltZW5zaW9ucyA9IHJhcGlkTWl4RXhhbXBsZXMucGF5bG9hZC5pbnB1dERpbWVuc2lvbjtcbiAgICBjb25zb2xlLmxvZyhgJHtsb2dQcmVmaXh9IHRyYWluaW5nIHN0YXJ0XFx0XFx0KCMgaW5wdXQgZGltZW5zaW9uczogJHtudW1JbnB1dERpbWVuc2lvbnN9KWApO1xuICAgIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4gICAgLy8gdHJhaW4gbW9kZWxcbiAgICAvLyBAdG9kbyAtIGNsZWFuIHRoaXMgZioqKioqKiBtZXNzeSBNYW5vIC8gUmFwaWRNaXggLyBYbW0gY29udmVydGlvblxuICAgIGNvbnN0IHhtbVRyYWluaW5nU2V0ID0gcmFwaWRNaXhBZGFwdGVycy5yYXBpZE1peFRvWG1tVHJhaW5pbmdTZXQocmFwaWRNaXhFeGFtcGxlcyk7XG5cbiAgICBjb25zdCBsZWFybmluZ0NvbmZpZyA9IHRoaXMuc3RhdGUuZ2V0KCdsZWFybmluZ0NvbmZpZycpOyAvLyBtYW5vXG4gICAgY29uc3QgeG1tQ29uZmlnID0gcmFwaWRNaXhBZGFwdGVycy5yYXBpZE1peFRvWG1tQ29uZmlnKGxlYXJuaW5nQ29uZmlnKTsgLy8geG1tXG4gICAgY29uc29sZS5sb2cobG9nUHJlZml4LCAneG1tIGNvbmZpZycsIHhtbUNvbmZpZyk7XG4gICAgLy8gZ2V0IChnbW18aGhtbSkgeG1tIGluc3RhbmNlXG4gICAgY29uc3QgeG1tID0gdGhpcy54bW1JbnN0YW5jZXNbbGVhcm5pbmdDb25maWcucGF5bG9hZC5tb2RlbFR5cGVdO1xuXG4gICAgeG1tLnNldENvbmZpZyh4bW1Db25maWcpO1xuICAgIHhtbS5zZXRUcmFpbmluZ1NldCh4bW1UcmFpbmluZ1NldCk7XG4gICAgLy8gY29uc29sZS5sb2coeG1tLmdldENvbmZpZygpKTtcblxuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICB4bW0udHJhaW4oKGVyciwgbW9kZWwpID0+IHtcbiAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgIHJlamVjdChlcnIpO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgcmFwaWRNaXhNb2RlbCA9IHJhcGlkTWl4QWRhcHRlcnMueG1tVG9SYXBpZE1peE1vZGVsKG1vZGVsKTtcblxuICAgICAgICB0aGlzLnN0YXRlLnNldCh7XG4gICAgICAgICAgZXhhbXBsZXMsXG4gICAgICAgICAgcHJvY2Vzc2VkRXhhbXBsZXMsXG4gICAgICAgICAgbW9kZWw6IHJhcGlkTWl4TW9kZWwsXG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgICAgICBjb25zdCB0cmFpbmluZ1RpbWUgPSBuZXcgRGF0ZSgpLmdldFRpbWUoKSAtIHRyYWluaW5nU3RhcnRUaW1lO1xuICAgICAgICBjb25zb2xlLmxvZyhgJHtsb2dQcmVmaXh9IHRyYWluaW5nIGVuZFxcdFxcdCgke3RyYWluaW5nVGltZX1tcylgKTtcbiAgICAgICAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbiAgICAgICAgcmVzb2x2ZSgpO1xuICAgICAgfSk7XG4gICAgfSk7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgU2Vzc2lvbjtcbiJdfQ==