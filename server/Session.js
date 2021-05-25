"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _path = _interopRequireDefault(require("path"));

var _fs = _interopRequireDefault(require("fs"));

var _uuidv = require("uuidv4");

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
    const uuid = (0, _uuidv.uuid)();
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9zZXJ2ZXIvU2Vzc2lvbi5qcyJdLCJuYW1lcyI6WyJTZXNzaW9uIiwiY3JlYXRlIiwiY29tbyIsImlkIiwibmFtZSIsImdyYXBoIiwiZnNBdWRpb0ZpbGVzIiwic2Vzc2lvbiIsImluaXQiLCJ1cGRhdGVBdWRpb0ZpbGVzRnJvbUZpbGVTeXN0ZW0iLCJyZWdpc3RlcmVkQXVkaW9GaWxlcyIsImdldCIsImxhYmVscyIsImxhYmVsQXVkaW9GaWxlVGFibGUiLCJmb3JFYWNoIiwiYXVkaW9GaWxlIiwibGFiZWwiLCJyb3ciLCJwdXNoIiwic2V0IiwicGVyc2lzdCIsImZyb21GaWxlU3lzdGVtIiwiZGlybmFtZSIsIm1ldGFzIiwiZGIiLCJyZWFkIiwicGF0aCIsImpvaW4iLCJkYXRhR3JhcGgiLCJhdWRpb0dyYXBoIiwibGVhcm5pbmdDb25maWciLCJleGFtcGxlcyIsIm1vZGVsIiwiYXVkaW9GaWxlcyIsImNvbmZpZyIsImRhdGEiLCJhdWRpbyIsImNvbnN0cnVjdG9yIiwiZGlyZWN0b3J5IiwicHJvamVjdERpcmVjdG9yeSIsInhtbUluc3RhbmNlcyIsInhtbSIsImtleSIsInZhbHVlcyIsInN0YXRlIiwiZ2V0VmFsdWVzIiwid3JpdGUiLCJ2ZXJzaW9uIiwiZ3JhcGhPcHRpb25zIiwidHlwZXMiLCJpIiwibGVuZ3RoIiwidHlwZSIsInN1YkdyYXBoIiwibW9kdWxlcyIsImRlc2MiLCJPYmplY3QiLCJrZXlzIiwib3B0aW9ucyIsInByb2Nlc3NlZEV4YW1wbGVzIiwidXBkYXRlcyIsInN1YnNjcmliZSIsImZ1bmMiLCJkZWxldGUiLCJkZXRhY2giLCJpbml0VmFsdWVzIiwicmVkdWNlIiwiYWNjIiwic2VydmVyIiwic3RhdGVNYW5hZ2VyIiwiZW50cmllcyIsIm1vZHVsZUlkIiwic2NyaXB0UGFyYW1zIiwiYXNzaWduIiwiQXJyYXkiLCJmcm9tIiwicHJvamVjdCIsInBsYXllcnMiLCJmaWx0ZXIiLCJwbGF5ZXIiLCJncmFwaE9wdGlvbnNFdmVudCIsInVwZGF0ZU1vZGVsIiwiZ3JhcGhEZXNjcmlwdGlvbiIsIm1vZHVsZSIsIkdyYXBoIiwiYXVkaW9GaWxlVHJlZSIsImRlbGV0ZWQiLCJjcmVhdGVkIiwiZiIsInVybCIsImNyZWF0ZWRGaWxlIiwiY29weSIsImFjdGl2ZSIsImRlbGV0ZWRGaWxlIiwiaW5kZXgiLCJmaW5kSW5kZXgiLCJzcGxpY2UiLCJhZGRFeGFtcGxlIiwiZXhhbXBsZSIsInV1aWQiLCJkZWxldGVFeGFtcGxlIiwiY2xlYXJFeGFtcGxlcyIsImNsZWFyZWRFeGFtcGxlcyIsImNyZWF0ZUxhYmVsIiwiaW5kZXhPZiIsInVwZGF0ZUxhYmVsIiwib2xkTGFiZWwiLCJuZXdMYWJlbCIsInVwZGF0ZWRMYWJlbHMiLCJtYXAiLCJ1cGRhdGVkVGFibGUiLCJkZWxldGVMYWJlbCIsImZpbHRlcmVkTGFiZWxzIiwibCIsImZpbHRlcmVkVGFibGUiLCJ0b2dnbGVBdWRpb0ZpbGUiLCJmaWxlbmFtZSIsImZpbmQiLCJjcmVhdGVMYWJlbEF1ZGlvRmlsZVJvdyIsInIiLCJkZWxldGVMYWJlbEF1ZGlvRmlsZVJvdyIsImxvZ1ByZWZpeCIsImQiLCJhcnIiLCJjb25zb2xlIiwibG9nIiwicHJvY2Vzc2luZ1N0YXJ0VGltZSIsIkRhdGUiLCJnZXRUaW1lIiwiaGFzRGVjb2RlciIsImJ1ZmZlciIsIlByb21pc2UiLCJyZXNvbHZlIiwib2ZmbGluZVNvdXJjZSIsInJhcGlkTWl4RXhhbXBsZXMiLCJkb2NUeXBlIiwiZG9jVmVyc2lvbiIsInBheWxvYWQiLCJpbnB1dERpbWVuc2lvbiIsIm91dHB1dERpbWVuc2lvbiIsIk9mZmxpbmVTb3VyY2UiLCJpbnB1dCIsInNldFNvdXJjZSIsInJ1biIsInRyYW5zZm9ybWVkU3RyZWFtIiwiZ2V0RGF0YSIsIkVycm9yIiwicmVtb3ZlU291cmNlIiwicmVzZXQiLCJwcm9jZXNzZWRFeGFtcGxlIiwib3V0cHV0IiwicHJvY2Vzc2luZ1RpbWUiLCJ0cmFpbmluZ1N0YXJ0VGltZSIsIm51bUlucHV0RGltZW5zaW9ucyIsInhtbVRyYWluaW5nU2V0IiwicmFwaWRNaXhBZGFwdGVycyIsInJhcGlkTWl4VG9YbW1UcmFpbmluZ1NldCIsInhtbUNvbmZpZyIsInJhcGlkTWl4VG9YbW1Db25maWciLCJtb2RlbFR5cGUiLCJzZXRDb25maWciLCJzZXRUcmFpbmluZ1NldCIsInJlamVjdCIsInRyYWluIiwiZXJyIiwicmFwaWRNaXhNb2RlbCIsInhtbVRvUmFwaWRNaXhNb2RlbCIsInRyYWluaW5nVGltZSJdLCJtYXBwaW5ncyI6Ijs7Ozs7OztBQUFBOztBQUNBOztBQUNBOztBQUVBOztBQUVBOztBQUVBOztBQUNBOztBQUNBOztBQUNBOztBQUNBOzs7O0FBUEE7QUFTQSxNQUFNQSxPQUFOLENBQWM7QUFFWjtBQUNtQixlQUFOQyxNQUFNLENBQUNDLElBQUQsRUFBT0MsRUFBUCxFQUFXQyxJQUFYLEVBQWlCQyxLQUFqQixFQUF3QkMsWUFBeEIsRUFBc0M7QUFDdkQsVUFBTUMsT0FBTyxHQUFHLElBQUlQLE9BQUosQ0FBWUUsSUFBWixFQUFrQkMsRUFBbEIsQ0FBaEI7QUFDQSxVQUFNSSxPQUFPLENBQUNDLElBQVIsQ0FBYTtBQUFFSixNQUFBQSxJQUFGO0FBQVFDLE1BQUFBO0FBQVIsS0FBYixDQUFOO0FBQ0EsVUFBTUUsT0FBTyxDQUFDRSw4QkFBUixDQUF1Q0gsWUFBdkMsQ0FBTixDQUh1RCxDQUt2RDtBQUNBO0FBQ0E7O0FBQ0EsVUFBTUksb0JBQW9CLEdBQUdILE9BQU8sQ0FBQ0ksR0FBUixDQUFZLFlBQVosQ0FBN0I7QUFDQSxVQUFNQyxNQUFNLEdBQUcsRUFBZjtBQUNBLFVBQU1DLG1CQUFtQixHQUFHLEVBQTVCO0FBRUFILElBQUFBLG9CQUFvQixDQUFDSSxPQUFyQixDQUE2QkMsU0FBUyxJQUFJO0FBQ3hDLFlBQU1DLEtBQUssR0FBR0QsU0FBUyxDQUFDWCxJQUF4QjtBQUNBLFlBQU1hLEdBQUcsR0FBRyxDQUFDRCxLQUFELEVBQVFELFNBQVMsQ0FBQ1gsSUFBbEIsQ0FBWjtBQUNBUSxNQUFBQSxNQUFNLENBQUNN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aW1wb3J0IHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgZnMgZnJvbSAnZnMnO1xuaW1wb3J0IHsgdXVpZCBhcyB1dWlkdjQgfSBmcm9tICd1dWlkdjQnO1xuXG5pbXBvcnQgeG1tIGZyb20gJ3htbS1ub2RlJztcbi8vIGltcG9ydCBYbW1Qcm9jZXNzb3IgZnJvbSAnLi4vY29tbW9uL2xpYnMvbWFuby9YbW1Qcm9jZXNzb3IuanMnO1xuaW1wb3J0IHJhcGlkTWl4QWRhcHRlcnMgZnJvbSAncmFwaWQtbWl4LWFkYXB0ZXJzJztcblxuaW1wb3J0IGRiIGZyb20gJy4vdXRpbHMvZGInO1xuaW1wb3J0IGRpZmZBcnJheXMgZnJvbSAnLi4vY29tbW9uL3V0aWxzL2RpZmZBcnJheXMuanMnO1xuaW1wb3J0IEdyYXBoIGZyb20gJy4uL2NvbW1vbi9HcmFwaC5qcyc7XG5pbXBvcnQgT2ZmbGluZVNvdXJjZSBmcm9tICcuLi9jb21tb24vc291cmNlcy9PZmZsaW5lU291cmNlLmpzJztcbmltcG9ydCBjbG9uZWRlZXAgZnJvbSAnbG9kYXNoLmNsb25lZGVlcCc7XG5cbmNsYXNzIFNlc3Npb24ge1xuXG4gIC8qKiBmYWN0b3J5IG1ldGhvZHMgKi9cbiAgc3RhdGljIGFzeW5jIGNyZWF0ZShjb21vLCBpZCwgbmFtZSwgZ3JhcGgsIGZzQXVkaW9GaWxlcykge1xuICAgIGNvbnN0IHNlc3Npb24gPSBuZXcgU2Vzc2lvbihjb21vLCBpZCk7XG4gICAgYXdhaXQgc2Vzc2lvbi5pbml0KHsgbmFtZSwgZ3JhcGggfSk7XG4gICAgYXdhaXQgc2Vzc2lvbi51cGRhdGVBdWRpb0ZpbGVzRnJvbUZpbGVTeXN0ZW0oZnNBdWRpb0ZpbGVzKTtcblxuICAgIC8vIGJ5IGRlZmF1bHQgKHRvIGJlIGJhY2t3YXJkIHVzYWdlIGNvbXBhdGlibGUpOlxuICAgIC8vIC0gbGFiZWxzIGFyZSB0aGUgYXVkaW8gZmlsZXMgbmFtZXMgd2l0aG91dCBleHRlbnNpb25cbiAgICAvLyAtIGEgcm93IDxsYWJlbCwgYXVkaW9GaWxlPiBpcyBpbnNlcnRlZCBpbiB0aGUgYGxhYmVsQXVkaW9GaWxlVGFibGVgXG4gICAgY29uc3QgcmVnaXN0ZXJlZEF1ZGlvRmlsZXMgPSBzZXNzaW9uLmdldCgnYXVkaW9GaWxlcycpO1xuICAgIGNvbnN0IGxhYmVscyA9IFtdO1xuICAgIGNvbnN0IGxhYmVsQXVkaW9GaWxlVGFibGUgPSBbXTtcblxuICAgIHJlZ2lzdGVyZWRBdWRpb0ZpbGVzLmZvckVhY2goYXVkaW9GaWxlID0+IHtcbiAgICAgIGNvbnN0IGxhYmVsID0gYXVkaW9GaWxlLm5hbWU7XG4gICAgICBjb25zdCByb3cgPSBbbGFiZWwsIGF1ZGlvRmlsZS5uYW1lXTtcbiAgICAgIGxhYmVscy5wdXNoKGxhYmVsKTtcbiAgICAgIGxhYmVsQXVkaW9GaWxlVGFibGUucHVzaChyb3cpO1xuICAgIH0pO1xuXG4gICAgYXdhaXQgc2Vzc2lvbi5zZXQoeyBsYWJlbHMsIGxhYmVsQXVkaW9GaWxlVGFibGUgfSk7XG4gICAgYXdhaXQgc2Vzc2lvbi5wZXJzaXN0KCk7XG5cbiAgICByZXR1cm4gc2Vzc2lvbjtcbiAgfVxuXG4gIHN0YXRpYyBhc3luYyBmcm9tRmlsZVN5c3RlbShjb21vLCBkaXJuYW1lLCBmc0F1ZGlvRmlsZXMpIHtcbiAgICAvLyBAbm90ZSAtIHZlcnNpb24gMC4wLjAgKGNmLm1ldGFzKVxuICAgIGNvbnN0IG1ldGFzID0gYXdhaXQgZGIucmVhZChwYXRoLmpvaW4oZGlybmFtZSwgJ21ldGFzLmpzb24nKSk7XG4gICAgY29uc3QgZGF0YUdyYXBoID0gYXdhaXQgZGIucmVhZChwYXRoLmpvaW4oZGlybmFtZSwgYGdyYXBoLWRhdGEuanNvbmApKTtcbiAgICBjb25zdCBhdWRpb0dyYXBoID0gYXdhaXQgZGIucmVhZChwYXRoLmpvaW4oZGlybmFtZSwgYGdyYXBoLWF1ZGlvLmpzb25gKSk7XG4gICAgY29uc3QgbGFiZWxzID0gYXdhaXQgZGIucmVhZChwYXRoLmpvaW4oZGlybmFtZSwgJ2xhYmVscy5qc29uJykpO1xuICAgIGNvbnN0IGxhYmVsQXVkaW9GaWxlVGFibGUgPSBhd2FpdCBkYi5yZWFkKHBhdGguam9pbihkaXJuYW1lLCAnbGFiZWwtYXVkaW8tZmlsZXMtdGFibGUuanNvbicpKTtcbiAgICBjb25zdCBsZWFybmluZ0NvbmZpZyA9IGF3YWl0IGRiLnJlYWQocGF0aC5qb2luKGRpcm5hbWUsICdtbC1jb25maWcuanNvbicpKTtcbiAgICBjb25zdCBleGFtcGxlcyA9IGF3YWl0IGRiLnJlYWQocGF0aC5qb2luKGRpcm5hbWUsICcubWwtZXhhbXBsZXMuanNvbicpKTtcbiAgICBjb25zdCBtb2RlbCA9IGF3YWl0IGRiLnJlYWQocGF0aC5qb2luKGRpcm5hbWUsICcubWwtbW9kZWwuanNvbicpKTtcbiAgICBjb25zdCBhdWRpb0ZpbGVzID0gYXdhaXQgZGIucmVhZChwYXRoLmpvaW4oZGlybmFtZSwgJy5hdWRpby1maWxlcy5qc29uJykpO1xuXG4gICAgY29uc3QgaWQgPSBtZXRhcy5pZDtcbiAgICBjb25zdCBjb25maWcgPSB7XG4gICAgICBuYW1lOiBtZXRhcy5uYW1lLFxuICAgICAgZ3JhcGg6IHsgZGF0YTogZGF0YUdyYXBoLCBhdWRpbzogYXVkaW9HcmFwaCB9LFxuICAgICAgbGFiZWxzLFxuICAgICAgbGFiZWxBdWRpb0ZpbGVUYWJsZSxcbiAgICAgIGxlYXJuaW5nQ29uZmlnLFxuICAgICAgZXhhbXBsZXMsXG4gICAgICBtb2RlbCxcbiAgICAgIGF1ZGlvRmlsZXMsXG4gICAgfTtcblxuICAgIGNvbnN0IHNlc3Npb24gPSBuZXcgU2Vzc2lvbihjb21vLCBpZCk7XG4gICAgYXdhaXQgc2Vzc2lvbi5pbml0KGNvbmZpZyk7XG4gICAgYXdhaXQgc2Vzc2lvbi51cGRhdGVBdWRpb0ZpbGVzRnJvbUZpbGVTeXN0ZW0oZnNBdWRpb0ZpbGVzKTtcblxuICAgIHJldHVybiBzZXNzaW9uO1xuICB9XG5cbiAgY29uc3RydWN0b3IoY29tbywgaWQpIHtcbiAgICB0aGlzLmNvbW8gPSBjb21vO1xuICAgIHRoaXMuaWQgPSBpZDtcblxuICAgIHRoaXMuZGlyZWN0b3J5ID0gcGF0aC5qb2luKHRoaXMuY29tby5wcm9qZWN0RGlyZWN0b3J5LCAnc2Vzc2lvbnMnLCBpZCk7XG5cbiAgICB0aGlzLnhtbUluc3RhbmNlcyA9IHtcbiAgICAgICdnbW0nOiBuZXcgeG1tKCdnbW0nKSxcbiAgICAgICdoaG1tJzogbmV3IHhtbSgnaGhtbScpLFxuICAgIH07XG4gIH1cblxuICBhc3luYyBwZXJzaXN0KGtleSA9IG51bGwpIHtcbiAgICBjb25zdCB2YWx1ZXMgPSB0aGlzLnN0YXRlLmdldFZhbHVlcygpO1xuXG4gICAgaWYgKGtleSA9PT0gbnVsbCB8fMKga2V5ID09PSAnbmFtZScpIHtcbiAgICAgIGNvbnN0IHsgaWQsIG5hbWUgfSA9IHZhbHVlcztcbiAgICAgIGF3YWl0IGRiLndyaXRlKHBhdGguam9pbih0aGlzLmRpcmVjdG9yeSwgJ21ldGFzLmpzb24nKSwgeyBpZCwgbmFtZSwgdmVyc2lvbjogJzAuMC4wJyB9KTtcbiAgICB9XG5cbiAgICBpZiAoa2V5ID09PSBudWxsIHx8wqBrZXkgPT09ICdsYWJlbHMnKSB7XG4gICAgICBjb25zdCB7IGxhYmVscyB9ID0gdmFsdWVzO1xuICAgICAgYXdhaXQgZGIud3JpdGUocGF0aC5qb2luKHRoaXMuZGlyZWN0b3J5LCAnbGFiZWxzLmpzb24nKSwgbGFiZWxzKTtcbiAgICB9XG5cbiAgICBpZiAoa2V5ID09PSBudWxsIHx8wqBrZXkgPT09ICdsYWJlbEF1ZGlvRmlsZVRhYmxlJykge1xuICAgICAgY29uc3QgeyBsYWJlbEF1ZGlvRmlsZVRhYmxlIH0gPSB2YWx1ZXM7XG4gICAgICBhd2FpdCBkYi53cml0ZShwYXRoLmpvaW4odGhpcy5kaXJlY3RvcnksICdsYWJlbC1hdWRpby1maWxlcy10YWJsZS5qc29uJyksIGxhYmVsQXVkaW9GaWxlVGFibGUpO1xuICAgIH1cblxuICAgIGlmIChrZXkgPT09IG51bGwgfHzCoGtleSA9PT0gJ2dyYXBoJyB8fMKga2V5ID09PSAnZ3JhcGhPcHRpb25zJykge1xuICAgICAgLy8gcmVhcHBseSBjdXJyZW50IGdyYXBoIG9wdGlvbnMgaW50byBncmFwaCBkZWZpbml0aW9uc1xuICAgICAgY29uc3QgeyBncmFwaCwgZ3JhcGhPcHRpb25zIH0gPSB2YWx1ZXM7XG4gICAgICBjb25zdCB0eXBlcyA9IFsnZGF0YScsICdhdWRpbyddO1xuXG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHR5cGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGNvbnN0IHR5cGUgPSB0eXBlc1tpXTtcbiAgICAgICAgY29uc3Qgc3ViR3JhcGggPSBncmFwaFt0eXBlXTtcblxuICAgICAgICBzdWJHcmFwaC5tb2R1bGVzLmZvckVhY2goZGVzYyA9PiB7XG4gICAgICAgICAgaWYgKE9iamVjdC5rZXlzKGdyYXBoT3B0aW9uc1tkZXNjLmlkXSkubGVuZ3RoKSB7XG4gICAgICAgICAgICBkZXNjLm9wdGlvbnMgPSBncmFwaE9wdGlvbnNbZGVzYy5pZF07XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcblxuICAgICAgICBhd2FpdCBkYi53cml0ZShwYXRoLmpvaW4odGhpcy5kaXJlY3RvcnksIGBncmFwaC0ke3R5cGV9Lmpzb25gKSwgc3ViR3JhcGgpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChrZXkgPT09IG51bGwgfHzCoGtleSA9PT0gJ2xlYXJuaW5nQ29uZmlnJykge1xuICAgICAgY29uc3QgeyBsZWFybmluZ0NvbmZpZyB9ID0gdmFsdWVzO1xuICAgICAgYXdhaXQgZGIud3JpdGUocGF0aC5qb2luKHRoaXMuZGlyZWN0b3J5LCAnbWwtY29uZmlnLmpzb24nKSwgbGVhcm5pbmdDb25maWcpO1xuICAgIH1cblxuICAgIC8vIGdlbmVyYXRlZCBmaWxlcywga2VlcCB0aGVtIGhpZGRlblxuICAgIGlmIChrZXkgPT09IG51bGwgfHzCoGtleSA9PT0gJ2V4YW1wbGVzJykge1xuICAgICAgY29uc3QgeyBleGFtcGxlcyB9ID0gdmFsdWVzO1xuICAgICAgYXdhaXQgZGIud3JpdGUocGF0aC5qb2luKHRoaXMuZGlyZWN0b3J5LCAnLm1sLWV4YW1wbGVzLmpzb24nKSwgZXhhbXBsZXMsIGZhbHNlKTtcbiAgICB9XG5cbiAgIGlmIChrZXkgPT09IG51bGwgfHzCoGtleSA9PT0gJ3Byb2Nlc3NlZEV4YW1wbGVzJykge1xuICAgICAgY29uc3QgeyBwcm9jZXNzZWRFeGFtcGxlcyB9ID0gdmFsdWVzO1xuICAgICAgYXdhaXQgZGIud3JpdGUocGF0aC5qb2luKHRoaXMuZGlyZWN0b3J5LCAnLm1sLXByb2Nlc3NlZC1leGFtcGxlcy5kZWJ1Zy5qc29uJyksIHByb2Nlc3NlZEV4YW1wbGVzLCBmYWxzZSk7XG4gICAgfVxuXG4gICAgaWYgKGtleSA9PT0gbnVsbCB8fMKga2V5ID09PSAnbW9kZWwnKSB7XG4gICAgICBjb25zdCB7IG1vZGVsIH0gPSB2YWx1ZXM7XG4gICAgICBhd2FpdCBkYi53cml0ZShwYXRoLmpvaW4odGhpcy5kaXJlY3RvcnksICcubWwtbW9kZWwuanNvbicpLCBtb2RlbCwgZmFsc2UpO1xuICAgIH1cblxuICAgIGlmIChrZXkgPT09IG51bGwgfHzCoGtleSA9PT0gJ2F1ZGlvRmlsZXMnKSB7XG4gICAgICBjb25zdCB7IGF1ZGlvRmlsZXMgfSA9IHZhbHVlcztcbiAgICAgIGF3YWl0IGRiLndyaXRlKHBhdGguam9pbih0aGlzLmRpcmVjdG9yeSwgJy5hdWRpby1maWxlcy5qc29uJyksIGF1ZGlvRmlsZXMsIGZhbHNlKTtcbiAgICB9XG4gIH1cblxuICBnZXQobmFtZSkge1xuICAgIHJldHVybiB0aGlzLnN0YXRlLmdldChuYW1lKTtcbiAgfVxuXG4gIGdldFZhbHVlcygpIHtcbiAgICByZXR1cm4gdGhpcy5zdGF0ZS5nZXRWYWx1ZXMoKTtcbiAgfVxuXG4gIGFzeW5jIHNldCh1cGRhdGVzKSB7XG4gICAgYXdhaXQgdGhpcy5zdGF0ZS5zZXQodXBkYXRlcyk7XG4gIH1cblxuICBzdWJzY3JpYmUoZnVuYykge1xuICAgIHJldHVybiB0aGlzLnN0YXRlLnN1YnNjcmliZShmdW5jKTtcbiAgfVxuXG4gIGFzeW5jIGRlbGV0ZSgpIHtcbiAgICBhd2FpdCB0aGlzLnN0YXRlLmRldGFjaCgpO1xuICB9XG5cbiAgLyoqXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBpbml0VmFsdWVzXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBpbml0VmFsdWVzLmlkXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBpbml0VmFsdWVzLm5hbWVcbiAgICogQHBhcmFtIHtPYmplY3R9IGluaXRWYWx1ZXMuZ3JhcGhcbiAgICogQHBhcmFtIHtPYmplY3R9IFtpbml0VmFsdWVzLm1vZGVsXVxuICAgKiBAcGFyYW0ge09iamVjdH0gW2luaXRWYWx1ZXMuZXhhbXBsZXNdXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBbaW5pdFZhbHVlcy5sZWFybmluZ0NvbmZpZ11cbiAgICogQHBhcmFtIHtPYmplY3R9IFtpbml0VmFsdWVzLmF1ZGlvRmlsZXNdXG4gICAqL1xuICBhc3luYyBpbml0KGluaXRWYWx1ZXMpIHtcbiAgICBpbml0VmFsdWVzLmlkID0gdGhpcy5pZDtcbiAgICAvLyBleHRyYWN0IGdyYXBoIG9wdGlvbnMgZnJvbSBncmFwaCBkZWZpbml0aW9uXG4gICAgY29uc3QgbW9kdWxlcyA9IFsuLi5pbml0VmFsdWVzLmdyYXBoLmRhdGEubW9kdWxlcywgLi4uaW5pdFZhbHVlcy5ncmFwaC5hdWRpby5tb2R1bGVzXTtcblxuICAgIGluaXRWYWx1ZXMuZ3JhcGhPcHRpb25zID0gbW9kdWxlcy5yZWR1Y2UoKGFjYywgZGVzYykgPT4ge1xuICAgICAgYWNjW2Rlc2MuaWRdID0gZGVzYy5vcHRpb25zIHx8wqB7fTtcbiAgICAgIHJldHVybiBhY2M7XG4gICAgfSwge30pO1xuXG4gICAgdGhpcy5zdGF0ZSA9IGF3YWl0IHRoaXMuY29tby5zZXJ2ZXIuc3RhdGVNYW5hZ2VyLmNyZWF0ZShgc2Vzc2lvbmAsIGluaXRWYWx1ZXMpO1xuXG4gICAgdGhpcy5zdGF0ZS5zdWJzY3JpYmUoYXN5bmMgdXBkYXRlcyA9PiB7XG4gICAgICBmb3IgKGxldCBbbmFtZSwgdmFsdWVzXSBvZiBPYmplY3QuZW50cmllcyh1cGRhdGVzKSkge1xuICAgICAgICBzd2l0Y2ggKG5hbWUpIHtcbiAgICAgICAgICBjYXNlICdncmFwaE9wdGlvbnNFdmVudCc6IHtcbiAgICAgICAgICAgIGNvbnN0IGdyYXBoT3B0aW9ucyA9IHRoaXMuc3RhdGUuZ2V0KCdncmFwaE9wdGlvbnMnKTtcblxuICAgICAgICAgICAgZm9yIChsZXQgbW9kdWxlSWQgaW4gdmFsdWVzKSB7XG4gICAgICAgICAgICAgIC8vIGRlbGV0ZSBzY3JpcHRQYXJhbXMgb24gc2NyaXB0TmFtZSBjaGFuZ2VcbiAgICAgICAgICAgICAgaWYgKCdzY3JpcHROYW1lJyBpbiB2YWx1ZXNbbW9kdWxlSWRdKSB7XG4gICAgICAgICAgICAgICAgZGVsZXRlIGdyYXBoT3B0aW9uc1ttb2R1bGVJZF0uc2NyaXB0UGFyYW1zO1xuICAgICAgICAgICAgICAgIC8vIEB0b2RvIC0gdXBkYXRlIHRoZSBtb2RlbCB3aGVuIGEgZGF0YVNjcmlwdCBpcyB1cGRhdGVkLi4uXG4gICAgICAgICAgICAgICAgLy8gdGhpcy51cGRhdGVNb2RlbCh0aGlzLnN0YXRlLmdldCgnZXhhbXBsZXMnKSk7XG4gICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICBPYmplY3QuYXNzaWduKGdyYXBoT3B0aW9uc1ttb2R1bGVJZF0sIHZhbHVlc1ttb2R1bGVJZF0pO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0aGlzLnN0YXRlLnNldCh7IGdyYXBoT3B0aW9ucyB9KTtcblxuICAgICAgICAgICAgLy8gZm9yd2FyZCBldmVudCB0byBwbGF5ZXJzIGF0dGFjaGVkIHRvIHRoZSBzZXNzaW9uXG4gICAgICAgICAgICBBcnJheS5mcm9tKHRoaXMuY29tby5wcm9qZWN0LnBsYXllcnMudmFsdWVzKCkpXG4gICAgICAgICAgICAgIC5maWx0ZXIocGxheWVyID0+IHBsYXllci5nZXQoJ3Nlc3Npb25JZCcpID09PSB0aGlzLmlkKVxuICAgICAgICAgICAgICAuZm9yRWFjaChwbGF5ZXIgPT4gcGxheWVyLnNldCh7IGdyYXBoT3B0aW9uc0V2ZW50OiB2YWx1ZXMgfSkpO1xuXG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBjYXNlICdsZWFybmluZ0NvbmZpZyc6IHtcbiAgICAgICAgICAgIHRoaXMudXBkYXRlTW9kZWwoKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGF3YWl0IHRoaXMucGVyc2lzdChuYW1lKTtcbiAgICAgIH1cbiAgICB9KTtcblxuXG4gICAgLy8gaW5pdCBncmFwaFxuICAgIGNvbnN0IGdyYXBoRGVzY3JpcHRpb24gPSB0aGlzLnN0YXRlLmdldCgnZ3JhcGgnKTtcbiAgICBjb25zdCBkYXRhR3JhcGggPSBjbG9uZWRlZXAoZ3JhcGhEZXNjcmlwdGlvbi5kYXRhKTtcblxuICAgIGRhdGFHcmFwaC5tb2R1bGVzLmZvckVhY2gobW9kdWxlID0+IHtcbiAgICAgIGlmIChtb2R1bGUudHlwZSA9PT0gJ01MRGVjb2RlcicpIHtcbiAgICAgICAgbW9kdWxlLnR5cGUgPSAnQnVmZmVyJztcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIHRoaXMuZ3JhcGggPSBuZXcgR3JhcGgodGhpcy5jb21vLCB7IGRhdGE6IGRhdGFHcmFwaCB9LCB0aGlzLCBudWxsLCB0cnVlKTtcbiAgICBhd2FpdCB0aGlzLmdyYXBoLmluaXQoKTtcblxuICAgIC8vIGluaXQgbW9kZWxcbiAgICBhd2FpdCB0aGlzLnVwZGF0ZU1vZGVsKCk7XG4gIH1cblxuICBhc3luYyB1cGRhdGVBdWRpb0ZpbGVzRnJvbUZpbGVTeXN0ZW0oYXVkaW9GaWxlVHJlZSkge1xuICAgIGNvbnN0IGF1ZGlvRmlsZXMgPSB0aGlzLnN0YXRlLmdldCgnYXVkaW9GaWxlcycpO1xuICAgIGNvbnN0IHsgZGVsZXRlZCwgY3JlYXRlZCB9ID0gZGlmZkFycmF5cyhhdWRpb0ZpbGVzLCBhdWRpb0ZpbGVUcmVlLCBmID0+IGYudXJsKTtcblxuICAgIGNyZWF0ZWQuZm9yRWFjaChjcmVhdGVkRmlsZSA9PiB7XG4gICAgICBjb25zdCBjb3B5ID0gT2JqZWN0LmFzc2lnbih7fSwgY3JlYXRlZEZpbGUpO1xuICAgICAgY29weS5hY3RpdmUgPSB0cnVlO1xuXG4gICAgICBhdWRpb0ZpbGVzLnB1c2goY29weSk7XG4gICAgfSk7XG5cbiAgICBkZWxldGVkLmZvckVhY2goZGVsZXRlZEZpbGUgPT4ge1xuICAgICAgY29uc3QgaW5kZXggPSBhdWRpb0ZpbGVzLmZpbmRJbmRleChmID0+IGYudXJsID09PSBkZWxldGVkRmlsZS51cmwpO1xuICAgICAgYXVkaW9GaWxlcy5zcGxpY2UoaW5kZXgsIDEpO1xuICAgIH0pO1xuXG4gICAgYXdhaXQgdGhpcy5zdGF0ZS5zZXQoeyBhdWRpb0ZpbGVzIH0pO1xuICB9XG5cbiAgYWRkRXhhbXBsZShleGFtcGxlKSB7XG4gICAgY29uc3QgdXVpZCA9IHV1aWR2NCgpO1xuICAgIGNvbnN0IGV4YW1wbGVzID0gdGhpcy5zdGF0ZS5nZXQoJ2V4YW1wbGVzJyk7XG4gICAgZXhhbXBsZXNbdXVpZF0gPSBleGFtcGxlO1xuXG4gICAgdGhpcy51cGRhdGVNb2RlbChleGFtcGxlcyk7XG4gIH1cblxuICBkZWxldGVFeGFtcGxlKHV1aWQpIHtcbiAgICBjb25zdCBleGFtcGxlcyA9IHRoaXMuc3RhdGUuZ2V0KCdleGFtcGxlcycpO1xuXG4gICAgaWYgKHV1aWQgaW4gZXhhbXBsZXMpIHtcbiAgICAgIGRlbGV0ZSBleGFtcGxlc1t1dWlkXTtcbiAgICAgIHRoaXMudXBkYXRlTW9kZWwoZXhhbXBsZXMpO1xuICAgIH1cbiAgfVxuXG4gIGNsZWFyRXhhbXBsZXMobGFiZWwgPSBudWxsKSB7XG4gICAgY29uc3QgY2xlYXJlZEV4YW1wbGVzID0ge307XG5cbiAgICBpZiAobGFiZWwgIT09IG51bGwpIHtcbiAgICAgIGNvbnN0IGV4YW1wbGVzID0gdGhpcy5zdGF0ZS5nZXQoJ2V4YW1wbGVzJyk7XG5cbiAgICAgIGZvciAobGV0IHV1aWQgaW4gZXhhbXBsZXMpIHtcbiAgICAgICAgaWYgKGV4YW1wbGVzW3V1aWRdLmxhYmVsICE9PSBsYWJlbCkge1xuICAgICAgICAgIGNsZWFyZWRFeGFtcGxlc1t1dWlkXSA9IGV4YW1wbGVzW3V1aWRdO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgdGhpcy51cGRhdGVNb2RlbChjbGVhcmVkRXhhbXBsZXMpO1xuICB9XG5cbiAgY3JlYXRlTGFiZWwobGFiZWwpIHtcbiAgICBjb25zdCBsYWJlbHMgPSB0aGlzLnN0YXRlLmdldCgnbGFiZWxzJyk7XG5cbiAgICBpZiAobGFiZWxzLmluZGV4T2YobGFiZWwpID09PSAtMSkge1xuICAgICAgbGFiZWxzLnB1c2gobGFiZWwpO1xuXG4gICAgICB0aGlzLnN0YXRlLnNldCh7IGxhYmVscyB9KTtcbiAgICB9XG4gIH1cblxuICB1cGRhdGVMYWJlbChvbGRMYWJlbCwgbmV3TGFiZWwpIHtcbiAgICBjb25zdCB7IGxhYmVscywgbGFiZWxBdWRpb0ZpbGVUYWJsZSwgZXhhbXBsZXMgfSA9IHRoaXMuc3RhdGUuZ2V0VmFsdWVzKCk7XG5cbiAgICBpZiAobGFiZWxzLmluZGV4T2Yob2xkTGFiZWwpICE9PSAtMSAmJiBsYWJlbHMuaW5kZXhPZihuZXdMYWJlbCkgPT09IC0xKSB7XG4gICAgICBjb25zdCB1cGRhdGVkTGFiZWxzID0gbGFiZWxzLm1hcChsYWJlbCA9PiBsYWJlbCA9PT0gb2xkTGFiZWwgPyBuZXdMYWJlbCA6IGxhYmVsKTtcbiAgICAgIGNvbnN0IHVwZGF0ZWRUYWJsZSA9IGxhYmVsQXVkaW9GaWxlVGFibGUubWFwKHJvdyA9PiB7XG4gICAgICAgIGlmIChyb3dbMF0gPT09IG9sZExhYmVsKSB7XG4gICAgICAgICAgcm93WzBdID0gbmV3TGFiZWw7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gcm93O1xuICAgICAgfSk7XG5cbiAgICAgIC8vIHVwZGF0ZXMgbGFiZWxzIG9mIGV4aXN0aW5nIGV4YW1wbGVzXG4gICAgICBmb3IgKGxldCB1dWlkIGluIGV4YW1wbGVzKSB7XG4gICAgICAgIGNvbnN0IGV4YW1wbGUgPSBleGFtcGxlc1t1dWlkXTtcblxuICAgICAgICBpZiAoZXhhbXBsZS5sYWJlbCA9PT0gb2xkTGFiZWwpIHtcbiAgICAgICAgICBleGFtcGxlLmxhYmVsID0gbmV3TGFiZWw7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgdGhpcy51cGRhdGVNb2RlbChleGFtcGxlcyk7XG4gICAgICB0aGlzLnN0YXRlLnNldCh7XG4gICAgICAgIGxhYmVsczogdXBkYXRlZExhYmVscyxcbiAgICAgICAgbGFiZWxBdWRpb0ZpbGVUYWJsZTogdXBkYXRlZFRhYmxlLFxuICAgICAgfSk7XG4gICAgfVxuICB9XG5cbiAgZGVsZXRlTGFiZWwobGFiZWwpIHtcbiAgICBjb25zdCB7IGxhYmVscywgbGFiZWxBdWRpb0ZpbGVUYWJsZSwgZXhhbXBsZXMgfSA9IHRoaXMuc3RhdGUuZ2V0VmFsdWVzKCk7XG5cbiAgICBpZiAobGFiZWxzLmluZGV4T2YobGFiZWwpICE9PSAtMSkge1xuICAgICAgLy8gY2xlYW4gbGFiZWwgLyBhdWRpbyBmaWxlIHRhYmxlXG4gICAgICBjb25zdCBmaWx0ZXJlZExhYmVscyA9IGxhYmVscy5maWx0ZXIobCA9PiBsICE9PSBsYWJlbCk7XG4gICAgICBjb25zdCBmaWx0ZXJlZFRhYmxlID0gbGFiZWxBdWRpb0ZpbGVUYWJsZS5maWx0ZXIocm93ID0+IHJvd1swXSAhPT0gbGFiZWwpO1xuXG4gICAgICB0aGlzLmNsZWFyRXhhbXBsZXMobGFiZWwpOyAvLyB0aGlzIHJldHJhaW5zIHRoZSBtb2RlbFxuICAgICAgdGhpcy5zdGF0ZS5zZXQoe1xuICAgICAgICBsYWJlbHM6IGZpbHRlcmVkTGFiZWxzLFxuICAgICAgICBsYWJlbEF1ZGlvRmlsZVRhYmxlOiBmaWx0ZXJlZFRhYmxlLFxuICAgICAgfSk7XG4gICAgfVxuICB9XG5cbiAgdG9nZ2xlQXVkaW9GaWxlKGZpbGVuYW1lLCBhY3RpdmUpIHtcbiAgICBjb25zdCB7IGF1ZGlvRmlsZXMsIGxhYmVsQXVkaW9GaWxlVGFibGUgfSA9IHRoaXMuc3RhdGUuZ2V0VmFsdWVzKCk7XG5cbiAgICBjb25zdCBhdWRpb0ZpbGUgPSBhdWRpb0ZpbGVzLmZpbmQoZiA9PiBmLm5hbWUgPT09IGZpbGVuYW1lKTtcbiAgICBhdWRpb0ZpbGUuYWN0aXZlID0gYWN0aXZlO1xuXG4gICAgY29uc3QgdXBkYXRlZFRhYmxlID0gbGFiZWxBdWRpb0ZpbGVUYWJsZS5maWx0ZXIocm93ID0+IHJvd1sxXSAhPT0gZmlsZW5hbWUpO1xuXG4gICAgdGhpcy5zdGF0ZS5zZXQoe1xuICAgICAgYXVkaW9GaWxlcyxcbiAgICAgIGxhYmVsQXVkaW9GaWxlVGFibGU6IHVwZGF0ZWRUYWJsZSxcbiAgICB9KTtcbiAgfVxuXG4gIGNyZWF0ZUxhYmVsQXVkaW9GaWxlUm93KHJvdykge1xuICAgIGNvbnN0IGxhYmVsQXVkaW9GaWxlVGFibGUgPSB0aGlzLnN0YXRlLmdldCgnbGFiZWxBdWRpb0ZpbGVUYWJsZScpO1xuICAgIGNvbnN0IGluZGV4ID0gbGFiZWxBdWRpb0ZpbGVUYWJsZS5maW5kSW5kZXgociA9PiByWzBdID09PSByb3dbMF0gJiYgclsxXSA9PT0gcm93WzFdKTtcblxuICAgIGlmIChpbmRleCA9PT0gLTEpIHtcbiAgICAgIGxhYmVsQXVkaW9GaWxlVGFibGUucHVzaChyb3cpO1xuICAgICAgdGhpcy5zdGF0ZS5zZXQoeyBsYWJlbEF1ZGlvRmlsZVRhYmxlIH0pO1xuICAgIH1cbiAgfVxuXG4gIGRlbGV0ZUxhYmVsQXVkaW9GaWxlUm93KHJvdykge1xuICAgIGNvbnN0IGxhYmVsQXVkaW9GaWxlVGFibGUgPSB0aGlzLnN0YXRlLmdldCgnbGFiZWxBdWRpb0ZpbGVUYWJsZScpO1xuICAgIGNvbnN0IGZpbHRlcmVkVGFibGUgPSBsYWJlbEF1ZGlvRmlsZVRhYmxlLmZpbHRlcihyID0+IHtcbiAgICAgIHJldHVybiByWzBdID09PSByb3dbMF0gJiYgclsxXSA9PT0gcm93WzFdID8gZmFsc2UgOiB0cnVlO1xuICAgIH0pO1xuXG4gICAgdGhpcy5zdGF0ZS5zZXQoeyBsYWJlbEF1ZGlvRmlsZVRhYmxlOiBmaWx0ZXJlZFRhYmxlIH0pO1xuICB9XG5cbiAgYXN5bmMgdXBkYXRlTW9kZWwoZXhhbXBsZXMgPSBudWxsKSB7XG4gICAgaWYgKGV4YW1wbGVzID09PSBudWxsKSB7XG4gICAgICBleGFtcGxlcyA9IHRoaXMuc3RhdGUuZ2V0KCdleGFtcGxlcycpO1xuICAgIH1cblxuICAgIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgIGNvbnN0IGxvZ1ByZWZpeCA9IGBbc2Vzc2lvbiBcIiR7dGhpcy5zdGF0ZS5nZXQoJ2lkJyl9XCJdYDtcbiAgICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgICBjb25zdCBsYWJlbHMgPSBPYmplY3QudmFsdWVzKGV4YW1wbGVzKS5tYXAoZCA9PiBkLmxhYmVsKS5maWx0ZXIoKGQsIGksIGFycikgPT4gYXJyLmluZGV4T2YoZCkgPT09IGkpO1xuICAgIGNvbnNvbGUubG9nKGBcXG4ke2xvZ1ByZWZpeH0gPiBVUERBVEUgTU9ERUwgLSBsYWJlbHM6YCwgbGFiZWxzKTtcbiAgICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgICBjb25zdCBwcm9jZXNzaW5nU3RhcnRUaW1lID0gbmV3IERhdGUoKS5nZXRUaW1lKCk7XG4gICAgY29uc29sZS5sb2coYCR7bG9nUHJlZml4fSBwcm9jZXNzaW5nIHN0YXJ0XFx0KCMgZXhhbXBsZXM6ICR7T2JqZWN0LmtleXMoZXhhbXBsZXMpLmxlbmd0aH0pYCk7XG4gICAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbiAgICAvLyByZXBsYWNlIE1MRGVjb2RlciB3LyBEZXN0QnVmZmVyIGluIGdyYXBoIGZvciByZWNvcmRpbmcgdHJhbnNmb3JtZWQgc3RyZWFtXG4gICAgLy8gQG5vdGUgLSB0aGlzIGNhbiBvbmx5IHdvcmsgdy8gMSBvciAwIGRlY29kZXIsXG4gICAgLy8gQHRvZG8gLSBoYW5kbGUgY2FzZXMgdy8gMiBvciBtb3JlIGRlY29kZXJzIGxhdGVyLlxuICAgIGxldCBoYXNEZWNvZGVyID0gZmFsc2U7XG4gICAgbGV0IGJ1ZmZlciA9IG51bGw7XG5cbiAgICBmb3IgKGxldCBpZCBpbiB0aGlzLmdyYXBoLm1vZHVsZXMpIHtcbiAgICAgIGNvbnN0IG1vZHVsZSA9IHRoaXMuZ3JhcGgubW9kdWxlc1tpZF07XG5cbiAgICAgIGlmIChtb2R1bGUudHlwZSA9PT0gJ0J1ZmZlcicpIHtcbiAgICAgICAgaGFzRGVjb2RlciA9IHRydWU7XG4gICAgICAgIGJ1ZmZlciA9IG1vZHVsZTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoYnVmZmVyID09PSBudWxsKSB7XG4gICAgICBjb25zb2xlLmxvZyhgXFxuJHtsb2dQcmVmaXh9ID4gZ3JhcGggZG9lcyBub3QgY29udGFpbiBhbnkgTUxEZWNvZGVyLCBhYm9ydCB0cmFuaW5nLi4uYCk7XG4gICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCk7XG4gICAgfVxuXG4gICAgLy8gY29uc3QgYnVmZmVyID0gZ3JhcGguZ2V0TW9kdWxlKGJ1ZmZlcklkKTtcbiAgICBsZXQgb2ZmbGluZVNvdXJjZTtcblxuICAgIC8vIEBub3RlIC0gbWltaWMgcmFwaWQtbWl4IEFQSSwgcmVtb3ZlIC8gdXBkYXRlIGxhdGVyXG4gICAgY29uc3QgcmFwaWRNaXhFeGFtcGxlcyA9IHtcbiAgICAgIGRvY1R5cGU6ICdyYXBpZC1taXg6bWwtdHJhaW5pbmctc2V0JyxcbiAgICAgIGRvY1ZlcnNpb246ICcxLjAuMCcsXG4gICAgICBwYXlsb2FkOiB7XG4gICAgICAgIGlucHV0RGltZW5zaW9uOiAwLFxuICAgICAgICBvdXRwdXREaW1lbnNpb246IDAsXG4gICAgICAgIGRhdGE6IFtdLFxuICAgICAgfVxuICAgIH1cblxuICAgIC8vIGZvciBwZXJzaXN0ZW5jeSwgZGlzcGxheVxuICAgIGNvbnN0IHByb2Nlc3NlZEV4YW1wbGVzID0ge31cblxuICAgIC8vIHByb2Nlc3MgZXhhbXBsZXMgcmF3IGRhdGEgaW4gcHJlLXByb2Nlc3NpbmcgZ3JhcGhcbiAgICBmb3IgKGxldCB1dWlkIGluIGV4YW1wbGVzKSB7XG4gICAgICBjb25zdCBleGFtcGxlID0gZXhhbXBsZXNbdXVpZF07XG5cbiAgICAgIG9mZmxpbmVTb3VyY2UgPSBuZXcgT2ZmbGluZVNvdXJjZShleGFtcGxlLmlucHV0KTtcbiAgICAgIHRoaXMuZ3JhcGguc2V0U291cmNlKG9mZmxpbmVTb3VyY2UpO1xuXG4gICAgICAvLyBydW4gdGhlIGdyYXBoIG9mZmxpbmUsIHRoaXMgTVVTVCBiZSBzeW5jaHJvbm91c1xuICAgICAgb2ZmbGluZVNvdXJjZS5ydW4oKTtcbiAgICAgIGNvbnN0IHRyYW5zZm9ybWVkU3RyZWFtID0gYnVmZmVyLmdldERhdGEoKTtcblxuICAgICAgaWYgKGV4YW1wbGUuaW5wdXQubGVuZ3RoICE9PSB0cmFuc2Zvcm1lZFN0cmVhbS5sZW5ndGgpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGAke2xvZ1ByZWZpeH0gRXJyb3I6IGluY29oZXJlbnQgZXhhbXBsZSBwcm9jZXNzaW5nIGZvciBleGFtcGxlICR7dXVpZH1gKTtcbiAgICAgIH1cblxuICAgICAgdGhpcy5ncmFwaC5yZW1vdmVTb3VyY2Uob2ZmbGluZVNvdXJjZSk7XG4gICAgICBidWZmZXIucmVzZXQoKTtcblxuICAgICAgY29uc3QgcHJvY2Vzc2VkRXhhbXBsZSA9IHtcbiAgICAgICAgbGFiZWw6IGV4YW1wbGUubGFiZWwsXG4gICAgICAgIG91dHB1dDogZXhhbXBsZS5vdXRwdXQsXG4gICAgICAgIGlucHV0OiB0cmFuc2Zvcm1lZFN0cmVhbSxcbiAgICAgIH07XG4gICAgICAvLyBhZGQgdG8gcHJvY2Vzc2VkIGV4YW1wbGVzXG4gICAgICByYXBpZE1peEV4YW1wbGVzLnBheWxvYWQuZGF0YS5wdXNoKHByb2Nlc3NlZEV4YW1wbGUpO1xuICAgICAgcHJvY2Vzc2VkRXhhbXBsZXNbdXVpZF0gPSBwcm9jZXNzZWRFeGFtcGxlO1xuICAgIH1cblxuICAgIGlmIChyYXBpZE1peEV4YW1wbGVzLnBheWxvYWQuZGF0YVswXSkge1xuICAgICAgcmFwaWRNaXhFeGFtcGxlcy5wYXlsb2FkLmlucHV0RGltZW5zaW9uID0gcmFwaWRNaXhFeGFtcGxlcy5wYXlsb2FkLmRhdGFbMF0uaW5wdXRbMF0ubGVuZ3RoO1xuICAgIH1cblxuICAgIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgIGNvbnN0IHByb2Nlc3NpbmdUaW1lID0gbmV3IERhdGUoKS5nZXRUaW1lKCkgLSBwcm9jZXNzaW5nU3RhcnRUaW1lO1xuICAgIGNvbnNvbGUubG9nKGAke2xvZ1ByZWZpeH0gcHJvY2Vzc2luZyBlbmRcXHRcXHQoJHtwcm9jZXNzaW5nVGltZX1tcylgKTtcbiAgICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgICBjb25zdCB0cmFpbmluZ1N0YXJ0VGltZSA9IG5ldyBEYXRlKCkuZ2V0VGltZSgpO1xuICAgIGNvbnN0IG51bUlucHV0RGltZW5zaW9ucyA9IHJhcGlkTWl4RXhhbXBsZXMucGF5bG9hZC5pbnB1dERpbWVuc2lvbjtcbiAgICBjb25zb2xlLmxvZyhgJHtsb2dQcmVmaXh9IHRyYWluaW5nIHN0YXJ0XFx0XFx0KCMgaW5wdXQgZGltZW5zaW9uczogJHtudW1JbnB1dERpbWVuc2lvbnN9KWApO1xuICAgIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4gICAgLy8gdHJhaW4gbW9kZWxcbiAgICAvLyBAdG9kbyAtIGNsZWFuIHRoaXMgZioqKioqKiBtZXNzeSBNYW5vIC8gUmFwaWRNaXggLyBYbW0gY29udmVydGlvblxuICAgIGNvbnN0IHhtbVRyYWluaW5nU2V0ID0gcmFwaWRNaXhBZGFwdGVycy5yYXBpZE1peFRvWG1tVHJhaW5pbmdTZXQocmFwaWRNaXhFeGFtcGxlcyk7XG5cbiAgICBjb25zdCBsZWFybmluZ0NvbmZpZyA9IHRoaXMuc3RhdGUuZ2V0KCdsZWFybmluZ0NvbmZpZycpOyAvLyBtYW5vXG4gICAgY29uc3QgeG1tQ29uZmlnID0gcmFwaWRNaXhBZGFwdGVycy5yYXBpZE1peFRvWG1tQ29uZmlnKGxlYXJuaW5nQ29uZmlnKTsgLy8geG1tXG4gICAgY29uc29sZS5sb2cobG9nUHJlZml4LCAneG1tIGNvbmZpZycsIHhtbUNvbmZpZyk7XG4gICAgLy8gZ2V0IChnbW18aGhtbSkgeG1tIGluc3RhbmNlXG4gICAgY29uc3QgeG1tID0gdGhpcy54bW1JbnN0YW5jZXNbbGVhcm5pbmdDb25maWcucGF5bG9hZC5tb2RlbFR5cGVdO1xuXG4gICAgeG1tLnNldENvbmZpZyh4bW1Db25maWcpO1xuICAgIHhtbS5zZXRUcmFpbmluZ1NldCh4bW1UcmFpbmluZ1NldCk7XG4gICAgLy8gY29uc29sZS5sb2coeG1tLmdldENvbmZpZygpKTtcblxuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICB4bW0udHJhaW4oKGVyciwgbW9kZWwpID0+IHtcbiAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgIHJlamVjdChlcnIpO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgcmFwaWRNaXhNb2RlbCA9IHJhcGlkTWl4QWRhcHRlcnMueG1tVG9SYXBpZE1peE1vZGVsKG1vZGVsKTtcbiAgICAgICAgdGhpcy5zdGF0ZS5zZXQoe1xuICAgICAgICAgIGV4YW1wbGVzLFxuICAgICAgICAgIHByb2Nlc3NlZEV4YW1wbGVzLFxuICAgICAgICAgIG1vZGVsOiByYXBpZE1peE1vZGVsLFxuICAgICAgICB9KTtcblxuICAgICAgICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgICAgICAgY29uc3QgdHJhaW5pbmdUaW1lID0gbmV3IERhdGUoKS5nZXRUaW1lKCkgLSB0cmFpbmluZ1N0YXJ0VGltZTtcbiAgICAgICAgY29uc29sZS5sb2coYCR7bG9nUHJlZml4fSB0cmFpbmluZyBlbmRcXHRcXHQoJHt0cmFpbmluZ1RpbWV9bXMpYCk7XG4gICAgICAgIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4gICAgICAgIHJlc29sdmUoKTtcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IFNlc3Npb247XG4iXX0=