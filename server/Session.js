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
    const audioFiles = await _db.default.read(_path.default.join(dirname, '.audio-files.json'));
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
          case 'graphOptionsEvent':
            {
              const graphOptions = this.state.get('graphOptions');

              for (let moduleId in values) {
                // delete scriptParams on scriptName change
                if ('scriptName' in values[moduleId]) {
                  delete graphOptions[moduleId].scriptParams; // @todo - update the model when a dataScript is updated...
                  // this.updateModel(this.state.get('examples'));
                }

                Object.assign(graphOptions[moduleId], values[moduleId]);
              }

              this.state.set({
                graphOptions
              }); // forward event to players attached to the session

              Array.from(this.como.project.players.values()).filter(player => player.get('sessionId') === this.id).forEach(player => player.set({
                graphOptionsEvent: values
              }));
              break;
            }

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
    const audioFiles = this.state.get('audioFiles');
    const {
      deleted,
      created
    } = (0, _diffArrays.default)(audioFiles, audioFileTree, f => f.url);
    created.forEach(createdFile => {
      const copy = Object.assign({}, createdFile);
      copy.active = true;
      audioFiles.push(copy);
    });
    deleted.forEach(deletedFile => {
      const index = audioFiles.findIndex(f => f.url === deletedFile.url);
      audioFiles.splice(index, 1);
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9zZXJ2ZXIvU2Vzc2lvbi5qcyJdLCJuYW1lcyI6WyJTZXNzaW9uIiwiY3JlYXRlIiwiY29tbyIsImlkIiwibmFtZSIsImdyYXBoIiwiZnNBdWRpb0ZpbGVzIiwic2Vzc2lvbiIsImluaXQiLCJ1cGRhdGVBdWRpb0ZpbGVzRnJvbUZpbGVTeXN0ZW0iLCJyZWdpc3RlcmVkQXVkaW9GaWxlcyIsImdldCIsImxhYmVscyIsImxhYmVsQXVkaW9GaWxlVGFibGUiLCJmb3JFYWNoIiwiYXVkaW9GaWxlIiwibGFiZWwiLCJyb3ciLCJwdXNoIiwic2V0IiwicGVyc2lzdCIsImZyb21GaWxlU3lzdGVtIiwiZGlybmFtZSIsIm1ldGFzIiwiZGIiLCJyZWFkIiwicGF0aCIsImpvaW4iLCJkYXRhR3JhcGgiLCJhdWRpb0dyYXBoIiwibGVhcm5pbmdDb25maWciLCJleGFtcGxlcyIsIm1vZGVsIiwiYXVkaW9GaWxlcyIsImNvbmZpZyIsImRhdGEiLCJhdWRpbyIsImNvbnN0cnVjdG9yIiwiZGlyZWN0b3J5IiwicHJvamVjdERpcmVjdG9yeSIsInhtbUluc3RhbmNlcyIsInhtbSIsImtleSIsInZhbHVlcyIsInN0YXRlIiwiZ2V0VmFsdWVzIiwid3JpdGUiLCJ2ZXJzaW9uIiwiZ3JhcGhPcHRpb25zIiwidHlwZXMiLCJpIiwibGVuZ3RoIiwidHlwZSIsInN1YkdyYXBoIiwibW9kdWxlcyIsImRlc2MiLCJPYmplY3QiLCJrZXlzIiwib3B0aW9ucyIsInByb2Nlc3NlZEV4YW1wbGVzIiwidXBkYXRlcyIsInN1YnNjcmliZSIsImZ1bmMiLCJkZWxldGUiLCJkZXRhY2giLCJpbml0VmFsdWVzIiwicmVkdWNlIiwiYWNjIiwic2VydmVyIiwic3RhdGVNYW5hZ2VyIiwiZW50cmllcyIsIm1vZHVsZUlkIiwic2NyaXB0UGFyYW1zIiwiYXNzaWduIiwiQXJyYXkiLCJmcm9tIiwicHJvamVjdCIsInBsYXllcnMiLCJmaWx0ZXIiLCJwbGF5ZXIiLCJncmFwaE9wdGlvbnNFdmVudCIsInVwZGF0ZU1vZGVsIiwiZ3JhcGhEZXNjcmlwdGlvbiIsIm1vZHVsZSIsIkdyYXBoIiwiYXVkaW9GaWxlVHJlZSIsImRlbGV0ZWQiLCJjcmVhdGVkIiwiZiIsInVybCIsImNyZWF0ZWRGaWxlIiwiY29weSIsImFjdGl2ZSIsImRlbGV0ZWRGaWxlIiwiaW5kZXgiLCJmaW5kSW5kZXgiLCJzcGxpY2UiLCJhZGRFeGFtcGxlIiwiZXhhbXBsZSIsInV1aWQiLCJkZWxldGVFeGFtcGxlIiwiY2xlYXJFeGFtcGxlcyIsImNsZWFyZWRFeGFtcGxlcyIsImNyZWF0ZUxhYmVsIiwiaW5kZXhPZiIsInVwZGF0ZUxhYmVsIiwib2xkTGFiZWwiLCJuZXdMYWJlbCIsInVwZGF0ZWRMYWJlbHMiLCJtYXAiLCJ1cGRhdGVkVGFibGUiLCJkZWxldGVMYWJlbCIsImZpbHRlcmVkTGFiZWxzIiwibCIsImZpbHRlcmVkVGFibGUiLCJ0b2dnbGVBdWRpb0ZpbGUiLCJmaWxlbmFtZSIsImZpbmQiLCJjcmVhdGVMYWJlbEF1ZGlvRmlsZVJvdyIsInIiLCJkZWxldGVMYWJlbEF1ZGlvRmlsZVJvdyIsImxvZ1ByZWZpeCIsImQiLCJhcnIiLCJjb25zb2xlIiwibG9nIiwicHJvY2Vzc2luZ1N0YXJ0VGltZSIsIkRhdGUiLCJnZXRUaW1lIiwiaGFzRGVjb2RlciIsImJ1ZmZlciIsIlByb21pc2UiLCJyZXNvbHZlIiwib2ZmbGluZVNvdXJjZSIsInJhcGlkTWl4RXhhbXBsZXMiLCJkb2NUeXBlIiwiZG9jVmVyc2lvbiIsInBheWxvYWQiLCJpbnB1dERpbWVuc2lvbiIsIm91dHB1dERpbWVuc2lvbiIsIk9mZmxpbmVTb3VyY2UiLCJpbnB1dCIsInNldFNvdXJjZSIsInJ1biIsInRyYW5zZm9ybWVkU3RyZWFtIiwiZ2V0RGF0YSIsIkVycm9yIiwicmVtb3ZlU291cmNlIiwicmVzZXQiLCJwcm9jZXNzZWRFeGFtcGxlIiwib3V0cHV0IiwicHJvY2Vzc2luZ1RpbWUiLCJ0cmFpbmluZ1N0YXJ0VGltZSIsIm51bUlucHV0RGltZW5zaW9ucyIsInhtbVRyYWluaW5nU2V0IiwicmFwaWRNaXhBZGFwdGVycyIsInJhcGlkTWl4VG9YbW1UcmFpbmluZ1NldCIsInhtbUNvbmZpZyIsInJhcGlkTWl4VG9YbW1Db25maWciLCJtb2RlbFR5cGUiLCJzZXRDb25maWciLCJzZXRUcmFpbmluZ1NldCIsInJlamVjdCIsInRyYWluIiwiZXJyIiwicmFwaWRNaXhNb2RlbCIsInhtbVRvUmFwaWRNaXhNb2RlbCIsInRyYWluaW5nVGltZSJdLCJtYXBwaW5ncyI6Ijs7Ozs7OztBQUFBOztBQUNBOztBQUNBOztBQUVBOztBQUVBOztBQUVBOztBQUNBOztBQUNBOztBQUNBOztBQUNBOzs7O0FBUEE7QUFTQSxNQUFNQSxPQUFOLENBQWM7QUFFWjtBQUNtQixlQUFOQyxNQUFNLENBQUNDLElBQUQsRUFBT0MsRUFBUCxFQUFXQyxJQUFYLEVBQWlCQyxLQUFqQixFQUF3QkMsWUFBeEIsRUFBc0M7QUFDdkQsVUFBTUMsT0FBTyxHQUFHLElBQUlQLE9BQUosQ0FBWUUsSUFBWixFQUFrQkMsRUFBbEIsQ0FBaEI7QUFDQSxVQUFNSSxPQUFPLENBQUNDLElBQVIsQ0FBYTtBQUFFSixNQUFBQSxJQUFGO0FBQVFDLE1BQUFBO0FBQVIsS0FBYixDQUFOO0FBQ0EsVUFBTUUsT0FBTyxDQUFDRSw4QkFBUixDQUF1Q0gsWUFBdkMsQ0FBTixDQUh1RCxDQUt2RDtBQUNBO0FBQ0E7O0FBQ0EsVUFBTUksb0JBQW9CLEdBQUdILE9BQU8sQ0FBQ0ksR0FBUixDQUFZLFlBQVosQ0FBN0I7QUFDQSxVQUFNQyxNQUFNLEdBQUcsRUFBZjtBQUNBLFVBQU1DLG1CQUFtQixHQUFHLEVBQTVCO0FBRUFILElBQUFBLG9CQUFvQixDQUFDSSxPQUFyQixDQUE2QkMsU0FBUyxJQUFJO0FBQ3hDLFlBQU1DLEtBQUssR0FBR0QsU0FBUyxDQUFDWCxJQUF4QjtBQUNBLFlBQU1hLEdBQUcsR0FBRyxDQUFDRCxLQUFELEVBQVFELFNBQVMsQ0FBQ1gsSUFBbEIsQ0FBWjtBQUNBUSxNQUFBQSxNQUFNLENBQUNN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bXBvcnQgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCBmcyBmcm9tICdmcyc7XG5pbXBvcnQgeyB2NCBhcyB1dWlkdjQgfSBmcm9tICd1dWlkJztcblxuaW1wb3J0IHhtbSBmcm9tICd4bW0tbm9kZSc7XG4vLyBpbXBvcnQgWG1tUHJvY2Vzc29yIGZyb20gJy4uL2NvbW1vbi9saWJzL21hbm8vWG1tUHJvY2Vzc29yLmpzJztcbmltcG9ydCByYXBpZE1peEFkYXB0ZXJzIGZyb20gJ3JhcGlkLW1peC1hZGFwdGVycyc7XG5cbmltcG9ydCBkYiBmcm9tICcuL3V0aWxzL2RiJztcbmltcG9ydCBkaWZmQXJyYXlzIGZyb20gJy4uL2NvbW1vbi91dGlscy9kaWZmQXJyYXlzLmpzJztcbmltcG9ydCBHcmFwaCBmcm9tICcuLi9jb21tb24vR3JhcGguanMnO1xuaW1wb3J0IE9mZmxpbmVTb3VyY2UgZnJvbSAnLi4vY29tbW9uL3NvdXJjZXMvT2ZmbGluZVNvdXJjZS5qcyc7XG5pbXBvcnQgY2xvbmVkZWVwIGZyb20gJ2xvZGFzaC5jbG9uZWRlZXAnO1xuXG5jbGFzcyBTZXNzaW9uIHtcblxuICAvKiogZmFjdG9yeSBtZXRob2RzICovXG4gIHN0YXRpYyBhc3luYyBjcmVhdGUoY29tbywgaWQsIG5hbWUsIGdyYXBoLCBmc0F1ZGlvRmlsZXMpIHtcbiAgICBjb25zdCBzZXNzaW9uID0gbmV3IFNlc3Npb24oY29tbywgaWQpO1xuICAgIGF3YWl0IHNlc3Npb24uaW5pdCh7IG5hbWUsIGdyYXBoIH0pO1xuICAgIGF3YWl0IHNlc3Npb24udXBkYXRlQXVkaW9GaWxlc0Zyb21GaWxlU3lzdGVtKGZzQXVkaW9GaWxlcyk7XG5cbiAgICAvLyBieSBkZWZhdWx0ICh0byBiZSBiYWNrd2FyZCB1c2FnZSBjb21wYXRpYmxlKTpcbiAgICAvLyAtIGxhYmVscyBhcmUgdGhlIGF1ZGlvIGZpbGVzIG5hbWVzIHdpdGhvdXQgZXh0ZW5zaW9uXG4gICAgLy8gLSBhIHJvdyA8bGFiZWwsIGF1ZGlvRmlsZT4gaXMgaW5zZXJ0ZWQgaW4gdGhlIGBsYWJlbEF1ZGlvRmlsZVRhYmxlYFxuICAgIGNvbnN0IHJlZ2lzdGVyZWRBdWRpb0ZpbGVzID0gc2Vzc2lvbi5nZXQoJ2F1ZGlvRmlsZXMnKTtcbiAgICBjb25zdCBsYWJlbHMgPSBbXTtcbiAgICBjb25zdCBsYWJlbEF1ZGlvRmlsZVRhYmxlID0gW107XG5cbiAgICByZWdpc3RlcmVkQXVkaW9GaWxlcy5mb3JFYWNoKGF1ZGlvRmlsZSA9PiB7XG4gICAgICBjb25zdCBsYWJlbCA9IGF1ZGlvRmlsZS5uYW1lO1xuICAgICAgY29uc3Qgcm93ID0gW2xhYmVsLCBhdWRpb0ZpbGUubmFtZV07XG4gICAgICBsYWJlbHMucHVzaChsYWJlbCk7XG4gICAgICBsYWJlbEF1ZGlvRmlsZVRhYmxlLnB1c2gocm93KTtcbiAgICB9KTtcblxuICAgIGF3YWl0IHNlc3Npb24uc2V0KHsgbGFiZWxzLCBsYWJlbEF1ZGlvRmlsZVRhYmxlIH0pO1xuICAgIGF3YWl0IHNlc3Npb24ucGVyc2lzdCgpO1xuXG4gICAgcmV0dXJuIHNlc3Npb247XG4gIH1cblxuICBzdGF0aWMgYXN5bmMgZnJvbUZpbGVTeXN0ZW0oY29tbywgZGlybmFtZSwgZnNBdWRpb0ZpbGVzKSB7XG4gICAgLy8gQG5vdGUgLSB2ZXJzaW9uIDAuMC4wIChjZi5tZXRhcylcbiAgICBjb25zdCBtZXRhcyA9IGF3YWl0IGRiLnJlYWQocGF0aC5qb2luKGRpcm5hbWUsICdtZXRhcy5qc29uJykpO1xuICAgIGNvbnN0IGRhdGFHcmFwaCA9IGF3YWl0IGRiLnJlYWQocGF0aC5qb2luKGRpcm5hbWUsIGBncmFwaC1kYXRhLmpzb25gKSk7XG4gICAgY29uc3QgYXVkaW9HcmFwaCA9IGF3YWl0IGRiLnJlYWQocGF0aC5qb2luKGRpcm5hbWUsIGBncmFwaC1hdWRpby5qc29uYCkpO1xuICAgIGNvbnN0IGxhYmVscyA9IGF3YWl0IGRiLnJlYWQocGF0aC5qb2luKGRpcm5hbWUsICdsYWJlbHMuanNvbicpKTtcbiAgICBjb25zdCBsYWJlbEF1ZGlvRmlsZVRhYmxlID0gYXdhaXQgZGIucmVhZChwYXRoLmpvaW4oZGlybmFtZSwgJ2xhYmVsLWF1ZGlvLWZpbGVzLXRhYmxlLmpzb24nKSk7XG4gICAgY29uc3QgbGVhcm5pbmdDb25maWcgPSBhd2FpdCBkYi5yZWFkKHBhdGguam9pbihkaXJuYW1lLCAnbWwtY29uZmlnLmpzb24nKSk7XG4gICAgY29uc3QgZXhhbXBsZXMgPSBhd2FpdCBkYi5yZWFkKHBhdGguam9pbihkaXJuYW1lLCAnLm1sLWV4YW1wbGVzLmpzb24nKSk7XG4gICAgY29uc3QgbW9kZWwgPSBhd2FpdCBkYi5yZWFkKHBhdGguam9pbihkaXJuYW1lLCAnLm1sLW1vZGVsLmpzb24nKSk7XG4gICAgY29uc3QgYXVkaW9GaWxlcyA9IGF3YWl0IGRiLnJlYWQocGF0aC5qb2luKGRpcm5hbWUsICcuYXVkaW8tZmlsZXMuanNvbicpKTtcblxuICAgIGNvbnN0IGlkID0gbWV0YXMuaWQ7XG4gICAgY29uc3QgY29uZmlnID0ge1xuICAgICAgbmFtZTogbWV0YXMubmFtZSxcbiAgICAgIGdyYXBoOiB7IGRhdGE6IGRhdGFHcmFwaCwgYXVkaW86IGF1ZGlvR3JhcGggfSxcbiAgICAgIGxhYmVscyxcbiAgICAgIGxhYmVsQXVkaW9GaWxlVGFibGUsXG4gICAgICBsZWFybmluZ0NvbmZpZyxcbiAgICAgIGV4YW1wbGVzLFxuICAgICAgbW9kZWwsXG4gICAgICBhdWRpb0ZpbGVzLFxuICAgIH07XG5cbiAgICBjb25zdCBzZXNzaW9uID0gbmV3IFNlc3Npb24oY29tbywgaWQpO1xuICAgIGF3YWl0IHNlc3Npb24uaW5pdChjb25maWcpO1xuICAgIGF3YWl0IHNlc3Npb24udXBkYXRlQXVkaW9GaWxlc0Zyb21GaWxlU3lzdGVtKGZzQXVkaW9GaWxlcyk7XG5cbiAgICByZXR1cm4gc2Vzc2lvbjtcbiAgfVxuXG4gIGNvbnN0cnVjdG9yKGNvbW8sIGlkKSB7XG4gICAgdGhpcy5jb21vID0gY29tbztcbiAgICB0aGlzLmlkID0gaWQ7XG5cbiAgICB0aGlzLmRpcmVjdG9yeSA9IHBhdGguam9pbih0aGlzLmNvbW8ucHJvamVjdERpcmVjdG9yeSwgJ3Nlc3Npb25zJywgaWQpO1xuXG4gICAgdGhpcy54bW1JbnN0YW5jZXMgPSB7XG4gICAgICAnZ21tJzogbmV3IHhtbSgnZ21tJyksXG4gICAgICAnaGhtbSc6IG5ldyB4bW0oJ2hobW0nKSxcbiAgICB9O1xuICB9XG5cbiAgYXN5bmMgcGVyc2lzdChrZXkgPSBudWxsKSB7XG4gICAgY29uc3QgdmFsdWVzID0gdGhpcy5zdGF0ZS5nZXRWYWx1ZXMoKTtcblxuICAgIGlmIChrZXkgPT09IG51bGwgfHzCoGtleSA9PT0gJ25hbWUnKSB7XG4gICAgICBjb25zdCB7IGlkLCBuYW1lIH0gPSB2YWx1ZXM7XG4gICAgICBhd2FpdCBkYi53cml0ZShwYXRoLmpvaW4odGhpcy5kaXJlY3RvcnksICdtZXRhcy5qc29uJyksIHsgaWQsIG5hbWUsIHZlcnNpb246ICcwLjAuMCcgfSk7XG4gICAgfVxuXG4gICAgaWYgKGtleSA9PT0gbnVsbCB8fMKga2V5ID09PSAnbGFiZWxzJykge1xuICAgICAgY29uc3QgeyBsYWJlbHMgfSA9IHZhbHVlcztcbiAgICAgIGF3YWl0IGRiLndyaXRlKHBhdGguam9pbih0aGlzLmRpcmVjdG9yeSwgJ2xhYmVscy5qc29uJyksIGxhYmVscyk7XG4gICAgfVxuXG4gICAgaWYgKGtleSA9PT0gbnVsbCB8fMKga2V5ID09PSAnbGFiZWxBdWRpb0ZpbGVUYWJsZScpIHtcbiAgICAgIGNvbnN0IHsgbGFiZWxBdWRpb0ZpbGVUYWJsZSB9ID0gdmFsdWVzO1xuICAgICAgYXdhaXQgZGIud3JpdGUocGF0aC5qb2luKHRoaXMuZGlyZWN0b3J5LCAnbGFiZWwtYXVkaW8tZmlsZXMtdGFibGUuanNvbicpLCBsYWJlbEF1ZGlvRmlsZVRhYmxlKTtcbiAgICB9XG5cbiAgICBpZiAoa2V5ID09PSBudWxsIHx8wqBrZXkgPT09ICdncmFwaCcgfHzCoGtleSA9PT0gJ2dyYXBoT3B0aW9ucycpIHtcbiAgICAgIC8vIHJlYXBwbHkgY3VycmVudCBncmFwaCBvcHRpb25zIGludG8gZ3JhcGggZGVmaW5pdGlvbnNcbiAgICAgIGNvbnN0IHsgZ3JhcGgsIGdyYXBoT3B0aW9ucyB9ID0gdmFsdWVzO1xuICAgICAgY29uc3QgdHlwZXMgPSBbJ2RhdGEnLCAnYXVkaW8nXTtcblxuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0eXBlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICBjb25zdCB0eXBlID0gdHlwZXNbaV07XG4gICAgICAgIGNvbnN0IHN1YkdyYXBoID0gZ3JhcGhbdHlwZV07XG5cbiAgICAgICAgc3ViR3JhcGgubW9kdWxlcy5mb3JFYWNoKGRlc2MgPT4ge1xuICAgICAgICAgIGlmIChPYmplY3Qua2V5cyhncmFwaE9wdGlvbnNbZGVzYy5pZF0pLmxlbmd0aCkge1xuICAgICAgICAgICAgZGVzYy5vcHRpb25zID0gZ3JhcGhPcHRpb25zW2Rlc2MuaWRdO1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cbiAgICAgICAgYXdhaXQgZGIud3JpdGUocGF0aC5qb2luKHRoaXMuZGlyZWN0b3J5LCBgZ3JhcGgtJHt0eXBlfS5qc29uYCksIHN1YkdyYXBoKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoa2V5ID09PSBudWxsIHx8wqBrZXkgPT09ICdsZWFybmluZ0NvbmZpZycpIHtcbiAgICAgIGNvbnN0IHsgbGVhcm5pbmdDb25maWcgfSA9IHZhbHVlcztcbiAgICAgIGF3YWl0IGRiLndyaXRlKHBhdGguam9pbih0aGlzLmRpcmVjdG9yeSwgJ21sLWNvbmZpZy5qc29uJyksIGxlYXJuaW5nQ29uZmlnKTtcbiAgICB9XG5cbiAgICAvLyBnZW5lcmF0ZWQgZmlsZXMsIGtlZXAgdGhlbSBoaWRkZW5cbiAgICBpZiAoa2V5ID09PSBudWxsIHx8wqBrZXkgPT09ICdleGFtcGxlcycpIHtcbiAgICAgIGNvbnN0IHsgZXhhbXBsZXMgfSA9IHZhbHVlcztcbiAgICAgIGF3YWl0IGRiLndyaXRlKHBhdGguam9pbih0aGlzLmRpcmVjdG9yeSwgJy5tbC1leGFtcGxlcy5qc29uJyksIGV4YW1wbGVzLCBmYWxzZSk7XG4gICAgfVxuXG4gICBpZiAoa2V5ID09PSBudWxsIHx8wqBrZXkgPT09ICdwcm9jZXNzZWRFeGFtcGxlcycpIHtcbiAgICAgIGNvbnN0IHsgcHJvY2Vzc2VkRXhhbXBsZXMgfSA9IHZhbHVlcztcbiAgICAgIGF3YWl0IGRiLndyaXRlKHBhdGguam9pbih0aGlzLmRpcmVjdG9yeSwgJy5tbC1wcm9jZXNzZWQtZXhhbXBsZXMuZGVidWcuanNvbicpLCBwcm9jZXNzZWRFeGFtcGxlcywgZmFsc2UpO1xuICAgIH1cblxuICAgIGlmIChrZXkgPT09IG51bGwgfHzCoGtleSA9PT0gJ21vZGVsJykge1xuICAgICAgY29uc3QgeyBtb2RlbCB9ID0gdmFsdWVzO1xuICAgICAgYXdhaXQgZGIud3JpdGUocGF0aC5qb2luKHRoaXMuZGlyZWN0b3J5LCAnLm1sLW1vZGVsLmpzb24nKSwgbW9kZWwsIGZhbHNlKTtcbiAgICB9XG5cbiAgICBpZiAoa2V5ID09PSBudWxsIHx8wqBrZXkgPT09ICdhdWRpb0ZpbGVzJykge1xuICAgICAgY29uc3QgeyBhdWRpb0ZpbGVzIH0gPSB2YWx1ZXM7XG4gICAgICBhd2FpdCBkYi53cml0ZShwYXRoLmpvaW4odGhpcy5kaXJlY3RvcnksICcuYXVkaW8tZmlsZXMuanNvbicpLCBhdWRpb0ZpbGVzLCBmYWxzZSk7XG4gICAgfVxuICB9XG5cbiAgZ2V0KG5hbWUpIHtcbiAgICByZXR1cm4gdGhpcy5zdGF0ZS5nZXQobmFtZSk7XG4gIH1cblxuICBnZXRWYWx1ZXMoKSB7XG4gICAgcmV0dXJuIHRoaXMuc3RhdGUuZ2V0VmFsdWVzKCk7XG4gIH1cblxuICBhc3luYyBzZXQodXBkYXRlcykge1xuICAgIGF3YWl0IHRoaXMuc3RhdGUuc2V0KHVwZGF0ZXMpO1xuICB9XG5cbiAgc3Vic2NyaWJlKGZ1bmMpIHtcbiAgICByZXR1cm4gdGhpcy5zdGF0ZS5zdWJzY3JpYmUoZnVuYyk7XG4gIH1cblxuICBhc3luYyBkZWxldGUoKSB7XG4gICAgYXdhaXQgdGhpcy5zdGF0ZS5kZXRhY2goKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBAcGFyYW0ge09iamVjdH0gaW5pdFZhbHVlc1xuICAgKiBAcGFyYW0ge09iamVjdH0gaW5pdFZhbHVlcy5pZFxuICAgKiBAcGFyYW0ge09iamVjdH0gaW5pdFZhbHVlcy5uYW1lXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBpbml0VmFsdWVzLmdyYXBoXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBbaW5pdFZhbHVlcy5tb2RlbF1cbiAgICogQHBhcmFtIHtPYmplY3R9IFtpbml0VmFsdWVzLmV4YW1wbGVzXVxuICAgKiBAcGFyYW0ge09iamVjdH0gW2luaXRWYWx1ZXMubGVhcm5pbmdDb25maWddXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBbaW5pdFZhbHVlcy5hdWRpb0ZpbGVzXVxuICAgKi9cbiAgYXN5bmMgaW5pdChpbml0VmFsdWVzKSB7XG4gICAgaW5pdFZhbHVlcy5pZCA9IHRoaXMuaWQ7XG4gICAgLy8gZXh0cmFjdCBncmFwaCBvcHRpb25zIGZyb20gZ3JhcGggZGVmaW5pdGlvblxuICAgIGNvbnN0IG1vZHVsZXMgPSBbLi4uaW5pdFZhbHVlcy5ncmFwaC5kYXRhLm1vZHVsZXMsIC4uLmluaXRWYWx1ZXMuZ3JhcGguYXVkaW8ubW9kdWxlc107XG5cbiAgICBpbml0VmFsdWVzLmdyYXBoT3B0aW9ucyA9IG1vZHVsZXMucmVkdWNlKChhY2MsIGRlc2MpID0+IHtcbiAgICAgIGFjY1tkZXNjLmlkXSA9IGRlc2Mub3B0aW9ucyB8fMKge307XG4gICAgICByZXR1cm4gYWNjO1xuICAgIH0sIHt9KTtcblxuICAgIHRoaXMuc3RhdGUgPSBhd2FpdCB0aGlzLmNvbW8uc2VydmVyLnN0YXRlTWFuYWdlci5jcmVhdGUoYHNlc3Npb25gLCBpbml0VmFsdWVzKTtcblxuICAgIHRoaXMuc3RhdGUuc3Vic2NyaWJlKGFzeW5jIHVwZGF0ZXMgPT4ge1xuICAgICAgZm9yIChsZXQgW25hbWUsIHZhbHVlc10gb2YgT2JqZWN0LmVudHJpZXModXBkYXRlcykpIHtcbiAgICAgICAgc3dpdGNoIChuYW1lKSB7XG4gICAgICAgICAgY2FzZSAnZ3JhcGhPcHRpb25zRXZlbnQnOiB7XG4gICAgICAgICAgICBjb25zdCBncmFwaE9wdGlvbnMgPSB0aGlzLnN0YXRlLmdldCgnZ3JhcGhPcHRpb25zJyk7XG5cbiAgICAgICAgICAgIGZvciAobGV0IG1vZHVsZUlkIGluIHZhbHVlcykge1xuICAgICAgICAgICAgICAvLyBkZWxldGUgc2NyaXB0UGFyYW1zIG9uIHNjcmlwdE5hbWUgY2hhbmdlXG4gICAgICAgICAgICAgIGlmICgnc2NyaXB0TmFtZScgaW4gdmFsdWVzW21vZHVsZUlkXSkge1xuICAgICAgICAgICAgICAgIGRlbGV0ZSBncmFwaE9wdGlvbnNbbW9kdWxlSWRdLnNjcmlwdFBhcmFtcztcbiAgICAgICAgICAgICAgICAvLyBAdG9kbyAtIHVwZGF0ZSB0aGUgbW9kZWwgd2hlbiBhIGRhdGFTY3JpcHQgaXMgdXBkYXRlZC4uLlxuICAgICAgICAgICAgICAgIC8vIHRoaXMudXBkYXRlTW9kZWwodGhpcy5zdGF0ZS5nZXQoJ2V4YW1wbGVzJykpO1xuICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgT2JqZWN0LmFzc2lnbihncmFwaE9wdGlvbnNbbW9kdWxlSWRdLCB2YWx1ZXNbbW9kdWxlSWRdKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhpcy5zdGF0ZS5zZXQoeyBncmFwaE9wdGlvbnMgfSk7XG5cbiAgICAgICAgICAgIC8vIGZvcndhcmQgZXZlbnQgdG8gcGxheWVycyBhdHRhY2hlZCB0byB0aGUgc2Vzc2lvblxuICAgICAgICAgICAgQXJyYXkuZnJvbSh0aGlzLmNvbW8ucHJvamVjdC5wbGF5ZXJzLnZhbHVlcygpKVxuICAgICAgICAgICAgICAuZmlsdGVyKHBsYXllciA9PiBwbGF5ZXIuZ2V0KCdzZXNzaW9uSWQnKSA9PT0gdGhpcy5pZClcbiAgICAgICAgICAgICAgLmZvckVhY2gocGxheWVyID0+IHBsYXllci5zZXQoeyBncmFwaE9wdGlvbnNFdmVudDogdmFsdWVzIH0pKTtcblxuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgY2FzZSAnbGVhcm5pbmdDb25maWcnOiB7XG4gICAgICAgICAgICB0aGlzLnVwZGF0ZU1vZGVsKCk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBhd2FpdCB0aGlzLnBlcnNpc3QobmFtZSk7XG4gICAgICB9XG4gICAgfSk7XG5cblxuICAgIC8vIGluaXQgZ3JhcGhcbiAgICBjb25zdCBncmFwaERlc2NyaXB0aW9uID0gdGhpcy5zdGF0ZS5nZXQoJ2dyYXBoJyk7XG4gICAgY29uc3QgZGF0YUdyYXBoID0gY2xvbmVkZWVwKGdyYXBoRGVzY3JpcHRpb24uZGF0YSk7XG5cbiAgICBkYXRhR3JhcGgubW9kdWxlcy5mb3JFYWNoKG1vZHVsZSA9PiB7XG4gICAgICBpZiAobW9kdWxlLnR5cGUgPT09ICdNTERlY29kZXInKSB7XG4gICAgICAgIG1vZHVsZS50eXBlID0gJ0J1ZmZlcic7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICB0aGlzLmdyYXBoID0gbmV3IEdyYXBoKHRoaXMuY29tbywgeyBkYXRhOiBkYXRhR3JhcGggfSwgdGhpcywgbnVsbCwgdHJ1ZSk7XG4gICAgYXdhaXQgdGhpcy5ncmFwaC5pbml0KCk7XG5cbiAgICAvLyBpbml0IG1vZGVsXG4gICAgYXdhaXQgdGhpcy51cGRhdGVNb2RlbCgpO1xuICB9XG5cbiAgYXN5bmMgdXBkYXRlQXVkaW9GaWxlc0Zyb21GaWxlU3lzdGVtKGF1ZGlvRmlsZVRyZWUpIHtcbiAgICBjb25zdCBhdWRpb0ZpbGVzID0gdGhpcy5zdGF0ZS5nZXQoJ2F1ZGlvRmlsZXMnKTtcbiAgICBjb25zdCB7IGRlbGV0ZWQsIGNyZWF0ZWQgfSA9IGRpZmZBcnJheXMoYXVkaW9GaWxlcywgYXVkaW9GaWxlVHJlZSwgZiA9PiBmLnVybCk7XG5cbiAgICBjcmVhdGVkLmZvckVhY2goY3JlYXRlZEZpbGUgPT4ge1xuICAgICAgY29uc3QgY29weSA9IE9iamVjdC5hc3NpZ24oe30sIGNyZWF0ZWRGaWxlKTtcbiAgICAgIGNvcHkuYWN0aXZlID0gdHJ1ZTtcblxuICAgICAgYXVkaW9GaWxlcy5wdXNoKGNvcHkpO1xuICAgIH0pO1xuXG4gICAgZGVsZXRlZC5mb3JFYWNoKGRlbGV0ZWRGaWxlID0+IHtcbiAgICAgIGNvbnN0IGluZGV4ID0gYXVkaW9GaWxlcy5maW5kSW5kZXgoZiA9PiBmLnVybCA9PT0gZGVsZXRlZEZpbGUudXJsKTtcbiAgICAgIGF1ZGlvRmlsZXMuc3BsaWNlKGluZGV4LCAxKTtcbiAgICB9KTtcblxuICAgIGF3YWl0IHRoaXMuc3RhdGUuc2V0KHsgYXVkaW9GaWxlcyB9KTtcbiAgfVxuXG4gIGFkZEV4YW1wbGUoZXhhbXBsZSkge1xuICAgIGNvbnN0IHV1aWQgPSB1dWlkdjQoKTtcbiAgICBjb25zdCBleGFtcGxlcyA9IHRoaXMuc3RhdGUuZ2V0KCdleGFtcGxlcycpO1xuICAgIGV4YW1wbGVzW3V1aWRdID0gZXhhbXBsZTtcblxuICAgIHRoaXMudXBkYXRlTW9kZWwoZXhhbXBsZXMpO1xuICB9XG5cbiAgZGVsZXRlRXhhbXBsZSh1dWlkKSB7XG4gICAgY29uc3QgZXhhbXBsZXMgPSB0aGlzLnN0YXRlLmdldCgnZXhhbXBsZXMnKTtcblxuICAgIGlmICh1dWlkIGluIGV4YW1wbGVzKSB7XG4gICAgICBkZWxldGUgZXhhbXBsZXNbdXVpZF07XG4gICAgICB0aGlzLnVwZGF0ZU1vZGVsKGV4YW1wbGVzKTtcbiAgICB9XG4gIH1cblxuICBjbGVhckV4YW1wbGVzKGxhYmVsID0gbnVsbCkge1xuICAgIGNvbnN0IGNsZWFyZWRFeGFtcGxlcyA9IHt9O1xuXG4gICAgaWYgKGxhYmVsICE9PSBudWxsKSB7XG4gICAgICBjb25zdCBleGFtcGxlcyA9IHRoaXMuc3RhdGUuZ2V0KCdleGFtcGxlcycpO1xuXG4gICAgICBmb3IgKGxldCB1dWlkIGluIGV4YW1wbGVzKSB7XG4gICAgICAgIGlmIChleGFtcGxlc1t1dWlkXS5sYWJlbCAhPT0gbGFiZWwpIHtcbiAgICAgICAgICBjbGVhcmVkRXhhbXBsZXNbdXVpZF0gPSBleGFtcGxlc1t1dWlkXTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIHRoaXMudXBkYXRlTW9kZWwoY2xlYXJlZEV4YW1wbGVzKTtcbiAgfVxuXG4gIGNyZWF0ZUxhYmVsKGxhYmVsKSB7XG4gICAgY29uc3QgbGFiZWxzID0gdGhpcy5zdGF0ZS5nZXQoJ2xhYmVscycpO1xuXG4gICAgaWYgKGxhYmVscy5pbmRleE9mKGxhYmVsKSA9PT0gLTEpIHtcbiAgICAgIGxhYmVscy5wdXNoKGxhYmVsKTtcblxuICAgICAgdGhpcy5zdGF0ZS5zZXQoeyBsYWJlbHMgfSk7XG4gICAgfVxuICB9XG5cbiAgdXBkYXRlTGFiZWwob2xkTGFiZWwsIG5ld0xhYmVsKSB7XG4gICAgY29uc3QgeyBsYWJlbHMsIGxhYmVsQXVkaW9GaWxlVGFibGUsIGV4YW1wbGVzIH0gPSB0aGlzLnN0YXRlLmdldFZhbHVlcygpO1xuXG4gICAgaWYgKGxhYmVscy5pbmRleE9mKG9sZExhYmVsKSAhPT0gLTEgJiYgbGFiZWxzLmluZGV4T2YobmV3TGFiZWwpID09PSAtMSkge1xuICAgICAgY29uc3QgdXBkYXRlZExhYmVscyA9IGxhYmVscy5tYXAobGFiZWwgPT4gbGFiZWwgPT09IG9sZExhYmVsID8gbmV3TGFiZWwgOiBsYWJlbCk7XG4gICAgICBjb25zdCB1cGRhdGVkVGFibGUgPSBsYWJlbEF1ZGlvRmlsZVRhYmxlLm1hcChyb3cgPT4ge1xuICAgICAgICBpZiAocm93WzBdID09PSBvbGRMYWJlbCkge1xuICAgICAgICAgIHJvd1swXSA9IG5ld0xhYmVsO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHJvdztcbiAgICAgIH0pO1xuXG4gICAgICAvLyB1cGRhdGVzIGxhYmVscyBvZiBleGlzdGluZyBleGFtcGxlc1xuICAgICAgZm9yIChsZXQgdXVpZCBpbiBleGFtcGxlcykge1xuICAgICAgICBjb25zdCBleGFtcGxlID0gZXhhbXBsZXNbdXVpZF07XG5cbiAgICAgICAgaWYgKGV4YW1wbGUubGFiZWwgPT09IG9sZExhYmVsKSB7XG4gICAgICAgICAgZXhhbXBsZS5sYWJlbCA9IG5ld0xhYmVsO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIHRoaXMudXBkYXRlTW9kZWwoZXhhbXBsZXMpO1xuICAgICAgdGhpcy5zdGF0ZS5zZXQoe1xuICAgICAgICBsYWJlbHM6IHVwZGF0ZWRMYWJlbHMsXG4gICAgICAgIGxhYmVsQXVkaW9GaWxlVGFibGU6IHVwZGF0ZWRUYWJsZSxcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuXG4gIGRlbGV0ZUxhYmVsKGxhYmVsKSB7XG4gICAgY29uc3QgeyBsYWJlbHMsIGxhYmVsQXVkaW9GaWxlVGFibGUsIGV4YW1wbGVzIH0gPSB0aGlzLnN0YXRlLmdldFZhbHVlcygpO1xuXG4gICAgaWYgKGxhYmVscy5pbmRleE9mKGxhYmVsKSAhPT0gLTEpIHtcbiAgICAgIC8vIGNsZWFuIGxhYmVsIC8gYXVkaW8gZmlsZSB0YWJsZVxuICAgICAgY29uc3QgZmlsdGVyZWRMYWJlbHMgPSBsYWJlbHMuZmlsdGVyKGwgPT4gbCAhPT0gbGFiZWwpO1xuICAgICAgY29uc3QgZmlsdGVyZWRUYWJsZSA9IGxhYmVsQXVkaW9GaWxlVGFibGUuZmlsdGVyKHJvdyA9PiByb3dbMF0gIT09IGxhYmVsKTtcblxuICAgICAgdGhpcy5jbGVhckV4YW1wbGVzKGxhYmVsKTsgLy8gdGhpcyByZXRyYWlucyB0aGUgbW9kZWxcbiAgICAgIHRoaXMuc3RhdGUuc2V0KHtcbiAgICAgICAgbGFiZWxzOiBmaWx0ZXJlZExhYmVscyxcbiAgICAgICAgbGFiZWxBdWRpb0ZpbGVUYWJsZTogZmlsdGVyZWRUYWJsZSxcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuXG4gIHRvZ2dsZUF1ZGlvRmlsZShmaWxlbmFtZSwgYWN0aXZlKSB7XG4gICAgY29uc3QgeyBhdWRpb0ZpbGVzLCBsYWJlbEF1ZGlvRmlsZVRhYmxlIH0gPSB0aGlzLnN0YXRlLmdldFZhbHVlcygpO1xuXG4gICAgY29uc3QgYXVkaW9GaWxlID0gYXVkaW9GaWxlcy5maW5kKGYgPT4gZi5uYW1lID09PSBmaWxlbmFtZSk7XG4gICAgYXVkaW9GaWxlLmFjdGl2ZSA9IGFjdGl2ZTtcblxuICAgIGNvbnN0IHVwZGF0ZWRUYWJsZSA9IGxhYmVsQXVkaW9GaWxlVGFibGUuZmlsdGVyKHJvdyA9PiByb3dbMV0gIT09IGZpbGVuYW1lKTtcblxuICAgIHRoaXMuc3RhdGUuc2V0KHtcbiAgICAgIGF1ZGlvRmlsZXMsXG4gICAgICBsYWJlbEF1ZGlvRmlsZVRhYmxlOiB1cGRhdGVkVGFibGUsXG4gICAgfSk7XG4gIH1cblxuICBjcmVhdGVMYWJlbEF1ZGlvRmlsZVJvdyhyb3cpIHtcbiAgICBjb25zdCBsYWJlbEF1ZGlvRmlsZVRhYmxlID0gdGhpcy5zdGF0ZS5nZXQoJ2xhYmVsQXVkaW9GaWxlVGFibGUnKTtcbiAgICBjb25zdCBpbmRleCA9IGxhYmVsQXVkaW9GaWxlVGFibGUuZmluZEluZGV4KHIgPT4gclswXSA9PT0gcm93WzBdICYmIHJbMV0gPT09IHJvd1sxXSk7XG5cbiAgICBpZiAoaW5kZXggPT09IC0xKSB7XG4gICAgICBsYWJlbEF1ZGlvRmlsZVRhYmxlLnB1c2gocm93KTtcbiAgICAgIHRoaXMuc3RhdGUuc2V0KHsgbGFiZWxBdWRpb0ZpbGVUYWJsZSB9KTtcbiAgICB9XG4gIH1cblxuICBkZWxldGVMYWJlbEF1ZGlvRmlsZVJvdyhyb3cpIHtcbiAgICBjb25zdCBsYWJlbEF1ZGlvRmlsZVRhYmxlID0gdGhpcy5zdGF0ZS5nZXQoJ2xhYmVsQXVkaW9GaWxlVGFibGUnKTtcbiAgICBjb25zdCBmaWx0ZXJlZFRhYmxlID0gbGFiZWxBdWRpb0ZpbGVUYWJsZS5maWx0ZXIociA9PiB7XG4gICAgICByZXR1cm4gclswXSA9PT0gcm93WzBdICYmIHJbMV0gPT09IHJvd1sxXSA/IGZhbHNlIDogdHJ1ZTtcbiAgICB9KTtcblxuICAgIHRoaXMuc3RhdGUuc2V0KHsgbGFiZWxBdWRpb0ZpbGVUYWJsZTogZmlsdGVyZWRUYWJsZSB9KTtcbiAgfVxuXG4gIGFzeW5jIHVwZGF0ZU1vZGVsKGV4YW1wbGVzID0gbnVsbCkge1xuICAgIGlmIChleGFtcGxlcyA9PT0gbnVsbCkge1xuICAgICAgZXhhbXBsZXMgPSB0aGlzLnN0YXRlLmdldCgnZXhhbXBsZXMnKTtcbiAgICB9XG5cbiAgICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgICBjb25zdCBsb2dQcmVmaXggPSBgW3Nlc3Npb24gXCIke3RoaXMuc3RhdGUuZ2V0KCdpZCcpfVwiXWA7XG4gICAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gICAgY29uc3QgbGFiZWxzID0gT2JqZWN0LnZhbHVlcyhleGFtcGxlcykubWFwKGQgPT4gZC5sYWJlbCkuZmlsdGVyKChkLCBpLCBhcnIpID0+IGFyci5pbmRleE9mKGQpID09PSBpKTtcbiAgICBjb25zb2xlLmxvZyhgXFxuJHtsb2dQcmVmaXh9ID4gVVBEQVRFIE1PREVMIC0gbGFiZWxzOmAsIGxhYmVscyk7XG4gICAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gICAgY29uc3QgcHJvY2Vzc2luZ1N0YXJ0VGltZSA9IG5ldyBEYXRlKCkuZ2V0VGltZSgpO1xuICAgIGNvbnNvbGUubG9nKGAke2xvZ1ByZWZpeH0gcHJvY2Vzc2luZyBzdGFydFxcdCgjIGV4YW1wbGVzOiAke09iamVjdC5rZXlzKGV4YW1wbGVzKS5sZW5ndGh9KWApO1xuICAgIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4gICAgLy8gcmVwbGFjZSBNTERlY29kZXIgdy8gRGVzdEJ1ZmZlciBpbiBncmFwaCBmb3IgcmVjb3JkaW5nIHRyYW5zZm9ybWVkIHN0cmVhbVxuICAgIC8vIEBub3RlIC0gdGhpcyBjYW4gb25seSB3b3JrIHcvIDEgb3IgMCBkZWNvZGVyLFxuICAgIC8vIEB0b2RvIC0gaGFuZGxlIGNhc2VzIHcvIDIgb3IgbW9yZSBkZWNvZGVycyBsYXRlci5cbiAgICBsZXQgaGFzRGVjb2RlciA9IGZhbHNlO1xuICAgIGxldCBidWZmZXIgPSBudWxsO1xuXG4gICAgZm9yIChsZXQgaWQgaW4gdGhpcy5ncmFwaC5tb2R1bGVzKSB7XG4gICAgICBjb25zdCBtb2R1bGUgPSB0aGlzLmdyYXBoLm1vZHVsZXNbaWRdO1xuXG4gICAgICBpZiAobW9kdWxlLnR5cGUgPT09ICdCdWZmZXInKSB7XG4gICAgICAgIGhhc0RlY29kZXIgPSB0cnVlO1xuICAgICAgICBidWZmZXIgPSBtb2R1bGU7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKGJ1ZmZlciA9PT0gbnVsbCkge1xuICAgICAgY29uc29sZS5sb2coYFxcbiR7bG9nUHJlZml4fSA+IGdyYXBoIGRvZXMgbm90IGNvbnRhaW4gYW55IE1MRGVjb2RlciwgYWJvcnQgdHJhbmluZy4uLmApO1xuICAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSgpO1xuICAgIH1cblxuICAgIC8vIGNvbnN0IGJ1ZmZlciA9IGdyYXBoLmdldE1vZHVsZShidWZmZXJJZCk7XG4gICAgbGV0IG9mZmxpbmVTb3VyY2U7XG5cbiAgICAvLyBAbm90ZSAtIG1pbWljIHJhcGlkLW1peCBBUEksIHJlbW92ZSAvIHVwZGF0ZSBsYXRlclxuICAgIGNvbnN0IHJhcGlkTWl4RXhhbXBsZXMgPSB7XG4gICAgICBkb2NUeXBlOiAncmFwaWQtbWl4Om1sLXRyYWluaW5nLXNldCcsXG4gICAgICBkb2NWZXJzaW9uOiAnMS4wLjAnLFxuICAgICAgcGF5bG9hZDoge1xuICAgICAgICBpbnB1dERpbWVuc2lvbjogMCxcbiAgICAgICAgb3V0cHV0RGltZW5zaW9uOiAwLFxuICAgICAgICBkYXRhOiBbXSxcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBmb3IgcGVyc2lzdGVuY3ksIGRpc3BsYXlcbiAgICBjb25zdCBwcm9jZXNzZWRFeGFtcGxlcyA9IHt9XG5cbiAgICAvLyBwcm9jZXNzIGV4YW1wbGVzIHJhdyBkYXRhIGluIHByZS1wcm9jZXNzaW5nIGdyYXBoXG4gICAgZm9yIChsZXQgdXVpZCBpbiBleGFtcGxlcykge1xuICAgICAgY29uc3QgZXhhbXBsZSA9IGV4YW1wbGVzW3V1aWRdO1xuXG4gICAgICBvZmZsaW5lU291cmNlID0gbmV3IE9mZmxpbmVTb3VyY2UoZXhhbXBsZS5pbnB1dCk7XG4gICAgICB0aGlzLmdyYXBoLnNldFNvdXJjZShvZmZsaW5lU291cmNlKTtcblxuICAgICAgLy8gcnVuIHRoZSBncmFwaCBvZmZsaW5lLCB0aGlzIE1VU1QgYmUgc3luY2hyb25vdXNcbiAgICAgIG9mZmxpbmVTb3VyY2UucnVuKCk7XG4gICAgICBjb25zdCB0cmFuc2Zvcm1lZFN0cmVhbSA9IGJ1ZmZlci5nZXREYXRhKCk7XG5cbiAgICAgIGlmIChleGFtcGxlLmlucHV0Lmxlbmd0aCAhPT0gdHJhbnNmb3JtZWRTdHJlYW0ubGVuZ3RoKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgJHtsb2dQcmVmaXh9IEVycm9yOiBpbmNvaGVyZW50IGV4YW1wbGUgcHJvY2Vzc2luZyBmb3IgZXhhbXBsZSAke3V1aWR9YCk7XG4gICAgICB9XG5cbiAgICAgIHRoaXMuZ3JhcGgucmVtb3ZlU291cmNlKG9mZmxpbmVTb3VyY2UpO1xuICAgICAgYnVmZmVyLnJlc2V0KCk7XG5cbiAgICAgIGNvbnN0IHByb2Nlc3NlZEV4YW1wbGUgPSB7XG4gICAgICAgIGxhYmVsOiBleGFtcGxlLmxhYmVsLFxuICAgICAgICBvdXRwdXQ6IGV4YW1wbGUub3V0cHV0LFxuICAgICAgICBpbnB1dDogdHJhbnNmb3JtZWRTdHJlYW0sXG4gICAgICB9O1xuICAgICAgLy8gYWRkIHRvIHByb2Nlc3NlZCBleGFtcGxlc1xuICAgICAgcmFwaWRNaXhFeGFtcGxlcy5wYXlsb2FkLmRhdGEucHVzaChwcm9jZXNzZWRFeGFtcGxlKTtcbiAgICAgIHByb2Nlc3NlZEV4YW1wbGVzW3V1aWRdID0gcHJvY2Vzc2VkRXhhbXBsZTtcbiAgICB9XG5cbiAgICBpZiAocmFwaWRNaXhFeGFtcGxlcy5wYXlsb2FkLmRhdGFbMF0pIHtcbiAgICAgIHJhcGlkTWl4RXhhbXBsZXMucGF5bG9hZC5pbnB1dERpbWVuc2lvbiA9IHJhcGlkTWl4RXhhbXBsZXMucGF5bG9hZC5kYXRhWzBdLmlucHV0WzBdLmxlbmd0aDtcbiAgICB9XG5cbiAgICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgICBjb25zdCBwcm9jZXNzaW5nVGltZSA9IG5ldyBEYXRlKCkuZ2V0VGltZSgpIC0gcHJvY2Vzc2luZ1N0YXJ0VGltZTtcbiAgICBjb25zb2xlLmxvZyhgJHtsb2dQcmVmaXh9IHByb2Nlc3NpbmcgZW5kXFx0XFx0KCR7cHJvY2Vzc2luZ1RpbWV9bXMpYCk7XG4gICAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gICAgY29uc3QgdHJhaW5pbmdTdGFydFRpbWUgPSBuZXcgRGF0ZSgpLmdldFRpbWUoKTtcbiAgICBjb25zdCBudW1JbnB1dERpbWVuc2lvbnMgPSByYXBpZE1peEV4YW1wbGVzLnBheWxvYWQuaW5wdXREaW1lbnNpb247XG4gICAgY29uc29sZS5sb2coYCR7bG9nUHJlZml4fSB0cmFpbmluZyBzdGFydFxcdFxcdCgjIGlucHV0IGRpbWVuc2lvbnM6ICR7bnVtSW5wdXREaW1lbnNpb25zfSlgKTtcbiAgICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuICAgIC8vIHRyYWluIG1vZGVsXG4gICAgLy8gQHRvZG8gLSBjbGVhbiB0aGlzIGYqKioqKiogbWVzc3kgTWFubyAvIFJhcGlkTWl4IC8gWG1tIGNvbnZlcnRpb25cbiAgICBjb25zdCB4bW1UcmFpbmluZ1NldCA9IHJhcGlkTWl4QWRhcHRlcnMucmFwaWRNaXhUb1htbVRyYWluaW5nU2V0KHJhcGlkTWl4RXhhbXBsZXMpO1xuXG4gICAgY29uc3QgbGVhcm5pbmdDb25maWcgPSB0aGlzLnN0YXRlLmdldCgnbGVhcm5pbmdDb25maWcnKTsgLy8gbWFub1xuICAgIGNvbnN0IHhtbUNvbmZpZyA9IHJhcGlkTWl4QWRhcHRlcnMucmFwaWRNaXhUb1htbUNvbmZpZyhsZWFybmluZ0NvbmZpZyk7IC8vIHhtbVxuICAgIGNvbnNvbGUubG9nKGxvZ1ByZWZpeCwgJ3htbSBjb25maWcnLCB4bW1Db25maWcpO1xuICAgIC8vIGdldCAoZ21tfGhobW0pIHhtbSBpbnN0YW5jZVxuICAgIGNvbnN0IHhtbSA9IHRoaXMueG1tSW5zdGFuY2VzW2xlYXJuaW5nQ29uZmlnLnBheWxvYWQubW9kZWxUeXBlXTtcblxuICAgIHhtbS5zZXRDb25maWcoeG1tQ29uZmlnKTtcbiAgICB4bW0uc2V0VHJhaW5pbmdTZXQoeG1tVHJhaW5pbmdTZXQpO1xuICAgIC8vIGNvbnNvbGUubG9nKHhtbS5nZXRDb25maWcoKSk7XG5cbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgeG1tLnRyYWluKChlcnIsIG1vZGVsKSA9PiB7XG4gICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICByZWplY3QoZXJyKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHJhcGlkTWl4TW9kZWwgPSByYXBpZE1peEFkYXB0ZXJzLnhtbVRvUmFwaWRNaXhNb2RlbChtb2RlbCk7XG4gICAgICAgIHRoaXMuc3RhdGUuc2V0KHtcbiAgICAgICAgICBleGFtcGxlcyxcbiAgICAgICAgICBwcm9jZXNzZWRFeGFtcGxlcyxcbiAgICAgICAgICBtb2RlbDogcmFwaWRNaXhNb2RlbCxcbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gICAgICAgIGNvbnN0IHRyYWluaW5nVGltZSA9IG5ldyBEYXRlKCkuZ2V0VGltZSgpIC0gdHJhaW5pbmdTdGFydFRpbWU7XG4gICAgICAgIGNvbnNvbGUubG9nKGAke2xvZ1ByZWZpeH0gdHJhaW5pbmcgZW5kXFx0XFx0KCR7dHJhaW5pbmdUaW1lfW1zKWApO1xuICAgICAgICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuICAgICAgICByZXNvbHZlKCk7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBTZXNzaW9uO1xuIl19