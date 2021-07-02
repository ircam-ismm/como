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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9zZXJ2ZXIvU2Vzc2lvbi5qcyJdLCJuYW1lcyI6WyJTZXNzaW9uIiwiY3JlYXRlIiwiY29tbyIsImlkIiwibmFtZSIsImdyYXBoIiwiZnNBdWRpb0ZpbGVzIiwic2Vzc2lvbiIsImluaXQiLCJ1cGRhdGVBdWRpb0ZpbGVzRnJvbUZpbGVTeXN0ZW0iLCJyZWdpc3RlcmVkQXVkaW9GaWxlcyIsImdldCIsImxhYmVscyIsImxhYmVsQXVkaW9GaWxlVGFibGUiLCJmb3JFYWNoIiwiYXVkaW9GaWxlIiwibGFiZWwiLCJyb3ciLCJwdXNoIiwic2V0IiwicGVyc2lzdCIsImZyb21GaWxlU3lzdGVtIiwiZGlybmFtZSIsIm1ldGFzIiwiZGIiLCJyZWFkIiwicGF0aCIsImpvaW4iLCJkYXRhR3JhcGgiLCJhdWRpb0dyYXBoIiwibGVhcm5pbmdDb25maWciLCJleGFtcGxlcyIsIm1vZGVsIiwiYXVkaW9GaWxlcyIsImNvbmZpZyIsImRhdGEiLCJhdWRpbyIsImNvbnN0cnVjdG9yIiwiZGlyZWN0b3J5IiwicHJvamVjdERpcmVjdG9yeSIsInhtbUluc3RhbmNlcyIsInhtbSIsImtleSIsInZhbHVlcyIsInN0YXRlIiwiZ2V0VmFsdWVzIiwid3JpdGUiLCJ2ZXJzaW9uIiwiZ3JhcGhPcHRpb25zIiwidHlwZXMiLCJpIiwibGVuZ3RoIiwidHlwZSIsInN1YkdyYXBoIiwibW9kdWxlcyIsImRlc2MiLCJPYmplY3QiLCJrZXlzIiwib3B0aW9ucyIsInByb2Nlc3NlZEV4YW1wbGVzIiwidXBkYXRlcyIsInN1YnNjcmliZSIsImZ1bmMiLCJkZWxldGUiLCJkZXRhY2giLCJpbml0VmFsdWVzIiwicmVkdWNlIiwiYWNjIiwic2VydmVyIiwic3RhdGVNYW5hZ2VyIiwiZW50cmllcyIsIm1vZHVsZUlkIiwic2NyaXB0UGFyYW1zIiwiYXNzaWduIiwiQXJyYXkiLCJmcm9tIiwicHJvamVjdCIsInBsYXllcnMiLCJmaWx0ZXIiLCJwbGF5ZXIiLCJncmFwaE9wdGlvbnNFdmVudCIsInVwZGF0ZU1vZGVsIiwiZ3JhcGhEZXNjcmlwdGlvbiIsIm1vZHVsZSIsIkdyYXBoIiwiYXVkaW9GaWxlVHJlZSIsImRlbGV0ZWQiLCJjcmVhdGVkIiwiZiIsInVybCIsImNyZWF0ZWRGaWxlIiwiY29weSIsImFjdGl2ZSIsImNyZWF0ZUxhYmVsIiwiY3JlYXRlTGFiZWxBdWRpb0ZpbGVSb3ciLCJkZWxldGVkRmlsZSIsImluZGV4IiwiZmluZEluZGV4Iiwic3BsaWNlIiwiZGVsZXRlTGFiZWwiLCJyb3dzIiwiciIsImRlbGV0ZUxhYmVsQXVkaW9GaWxlUm93IiwiYWRkRXhhbXBsZSIsImV4YW1wbGUiLCJ1dWlkIiwiZGVsZXRlRXhhbXBsZSIsImNsZWFyRXhhbXBsZXMiLCJjbGVhcmVkRXhhbXBsZXMiLCJpbmRleE9mIiwidXBkYXRlTGFiZWwiLCJvbGRMYWJlbCIsIm5ld0xhYmVsIiwidXBkYXRlZExhYmVscyIsIm1hcCIsInVwZGF0ZWRUYWJsZSIsImZpbHRlcmVkTGFiZWxzIiwibCIsImZpbHRlcmVkVGFibGUiLCJ0b2dnbGVBdWRpb0ZpbGUiLCJmaWxlbmFtZSIsImZpbmQiLCJsb2dQcmVmaXgiLCJkIiwiYXJyIiwiY29uc29sZSIsImxvZyIsInByb2Nlc3NpbmdTdGFydFRpbWUiLCJEYXRlIiwiZ2V0VGltZSIsImhhc0RlY29kZXIiLCJidWZmZXIiLCJQcm9taXNlIiwicmVzb2x2ZSIsIm9mZmxpbmVTb3VyY2UiLCJyYXBpZE1peEV4YW1wbGVzIiwiZG9jVHlwZSIsImRvY1ZlcnNpb24iLCJwYXlsb2FkIiwiaW5wdXREaW1lbnNpb24iLCJvdXRwdXREaW1lbnNpb24iLCJPZmZsaW5lU291cmNlIiwiaW5wdXQiLCJzZXRTb3VyY2UiLCJydW4iLCJ0cmFuc2Zvcm1lZFN0cmVhbSIsImdldERhdGEiLCJFcnJvciIsInJlbW92ZVNvdXJjZSIsInJlc2V0IiwicHJvY2Vzc2VkRXhhbXBsZSIsIm91dHB1dCIsInByb2Nlc3NpbmdUaW1lIiwidHJhaW5pbmdTdGFydFRpbWUiLCJudW1JbnB1dERpbWVuc2lvbnMiLCJ4bW1UcmFpbmluZ1NldCIsInJhcGlkTWl4QWRhcHRlcnMiLCJyYXBpZE1peFRvWG1tVHJhaW5pbmdTZXQiLCJ4bW1Db25maWciLCJyYXBpZE1peFRvWG1tQ29uZmlnIiwibW9kZWxUeXBlIiwic2V0Q29uZmlnIiwic2V0VHJhaW5pbmdTZXQiLCJyZWplY3QiLCJ0cmFpbiIsImVyciIsInJhcGlkTWl4TW9kZWwiLCJ4bW1Ub1JhcGlkTWl4TW9kZWwiLCJ0cmFpbmluZ1RpbWUiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7QUFBQTs7QUFDQTs7QUFDQTs7QUFFQTs7QUFFQTs7QUFFQTs7QUFDQTs7QUFDQTs7QUFDQTs7QUFDQTs7OztBQVBBO0FBU0EsTUFBTUEsT0FBTixDQUFjO0FBRVo7QUFDbUIsZUFBTkMsTUFBTSxDQUFDQyxJQUFELEVBQU9DLEVBQVAsRUFBV0MsSUFBWCxFQUFpQkMsS0FBakIsRUFBd0JDLFlBQXhCLEVBQXNDO0FBQ3ZELFVBQU1DLE9BQU8sR0FBRyxJQUFJUCxPQUFKLENBQVlFLElBQVosRUFBa0JDLEVBQWxCLENBQWhCO0FBQ0EsVUFBTUksT0FBTyxDQUFDQyxJQUFSLENBQWE7QUFBRUosTUFBQUEsSUFBRjtBQUFRQyxNQUFBQTtBQUFSLEtBQWIsQ0FBTjtBQUNBLFVBQU1FLE9BQU8sQ0FBQ0UsOEJBQVIsQ0FBdUNILFlBQXZDLENBQU4sQ0FIdUQsQ0FLdkQ7QUFDQTtBQUNBOztBQUNBLFVBQU1JLG9CQUFvQixHQUFHSCxPQUFPLENBQUNJLEdBQVIsQ0FBWSxZQUFaLENBQTdCO0FBQ0EsVUFBTUMsTUFBTSxHQUFHLEVBQWY7QUFDQSxVQUFNQyxtQkFBbUIsR0FBRyxFQUE1QjtBQUVBSCxJQUFBQSxvQkFBb0IsQ0FBQ0ksT0FBckIsQ0FBNkJDLFNBQVMsSUFBSTtBQUN4QyxZQUFNQyxLQUFLLEdBQUdELFNBQVMsQ0FBQ1gsSUFBeEI7QUFDQSxZQUFNYSxHQUFHLEdBQUcsQ0FBQ0QsS0FBRCxFQUFRRCxTQUFTLENBQUNYLElBQWxCLENBQVo7QUFDQVEsTUFBQUEsTUFB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QUFELENBQU47QUFDRDs7QUFFRCxjQUFNQyxhQUFhLEdBQUdWLDBCQUFpQlcsa0JBQWpCLENBQW9DdkksS0FBcEMsQ0FBdEI7O0FBQ0EsYUFBS1ksS0FBTCxDQUFXekIsR0FBWCxDQUFlO0FBQ2JZLFVBQUFBLFFBRGE7QUFFYjRCLFVBQUFBLGlCQUZhO0FBR2IzQixVQUFBQSxLQUFLLEVBQUVzSTtBQUhNLFNBQWYsRUFOd0IsQ0FZeEI7O0FBQ0EsY0FBTUUsWUFBWSxHQUFHLElBQUl4QyxJQUFKLEdBQVdDLE9BQVgsS0FBdUJ3QixpQkFBNUM7QUFDQTVCLFFBQUFBLE9BQU8sQ0FBQ0MsR0FBUixDQUFhLEdBQUVKLFNBQVUscUJBQW9COEMsWUFBYSxLQUExRCxFQWR3QixDQWV4Qjs7QUFFQW5DLFFBQUFBLE9BQU87QUFDUixPQWxCRDtBQW1CRCxLQXBCTSxDQUFQO0FBcUJEOztBQS9mVzs7ZUFrZ0JDckksTyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0IGZzIGZyb20gJ2ZzJztcbmltcG9ydCB7IHY0IGFzIHV1aWR2NCB9IGZyb20gJ3V1aWQnO1xuXG5pbXBvcnQgeG1tIGZyb20gJ3htbS1ub2RlJztcbi8vIGltcG9ydCBYbW1Qcm9jZXNzb3IgZnJvbSAnLi4vY29tbW9uL2xpYnMvbWFuby9YbW1Qcm9jZXNzb3IuanMnO1xuaW1wb3J0IHJhcGlkTWl4QWRhcHRlcnMgZnJvbSAncmFwaWQtbWl4LWFkYXB0ZXJzJztcblxuaW1wb3J0IGRiIGZyb20gJy4vdXRpbHMvZGInO1xuaW1wb3J0IGRpZmZBcnJheXMgZnJvbSAnLi4vY29tbW9uL3V0aWxzL2RpZmZBcnJheXMuanMnO1xuaW1wb3J0IEdyYXBoIGZyb20gJy4uL2NvbW1vbi9HcmFwaC5qcyc7XG5pbXBvcnQgT2ZmbGluZVNvdXJjZSBmcm9tICcuLi9jb21tb24vc291cmNlcy9PZmZsaW5lU291cmNlLmpzJztcbmltcG9ydCBjbG9uZWRlZXAgZnJvbSAnbG9kYXNoLmNsb25lZGVlcCc7XG5cbmNsYXNzIFNlc3Npb24ge1xuXG4gIC8qKiBmYWN0b3J5IG1ldGhvZHMgKi9cbiAgc3RhdGljIGFzeW5jIGNyZWF0ZShjb21vLCBpZCwgbmFtZSwgZ3JhcGgsIGZzQXVkaW9GaWxlcykge1xuICAgIGNvbnN0IHNlc3Npb24gPSBuZXcgU2Vzc2lvbihjb21vLCBpZCk7XG4gICAgYXdhaXQgc2Vzc2lvbi5pbml0KHsgbmFtZSwgZ3JhcGggfSk7XG4gICAgYXdhaXQgc2Vzc2lvbi51cGRhdGVBdWRpb0ZpbGVzRnJvbUZpbGVTeXN0ZW0oZnNBdWRpb0ZpbGVzKTtcblxuICAgIC8vIGJ5IGRlZmF1bHQgKHRvIGJlIGJhY2t3YXJkIHVzYWdlIGNvbXBhdGlibGUpOlxuICAgIC8vIC0gbGFiZWxzIGFyZSB0aGUgYXVkaW8gZmlsZXMgbmFtZXMgd2l0aG91dCBleHRlbnNpb25cbiAgICAvLyAtIGEgcm93IDxsYWJlbCwgYXVkaW9GaWxlPiBpcyBpbnNlcnRlZCBpbiB0aGUgYGxhYmVsQXVkaW9GaWxlVGFibGVgXG4gICAgY29uc3QgcmVnaXN0ZXJlZEF1ZGlvRmlsZXMgPSBzZXNzaW9uLmdldCgnYXVkaW9GaWxlcycpO1xuICAgIGNvbnN0IGxhYmVscyA9IFtdO1xuICAgIGNvbnN0IGxhYmVsQXVkaW9GaWxlVGFibGUgPSBbXTtcblxuICAgIHJlZ2lzdGVyZWRBdWRpb0ZpbGVzLmZvckVhY2goYXVkaW9GaWxlID0+IHtcbiAgICAgIGNvbnN0IGxhYmVsID0gYXVkaW9GaWxlLm5hbWU7XG4gICAgICBjb25zdCByb3cgPSBbbGFiZWwsIGF1ZGlvRmlsZS5uYW1lXTtcbiAgICAgIGxhYmVscy5wdXNoKGxhYmVsKTtcbiAgICAgIGxhYmVsQXVkaW9GaWxlVGFibGUucHVzaChyb3cpO1xuICAgIH0pO1xuXG4gICAgYXdhaXQgc2Vzc2lvbi5zZXQoeyBsYWJlbHMsIGxhYmVsQXVkaW9GaWxlVGFibGUgfSk7XG4gICAgYXdhaXQgc2Vzc2lvbi5wZXJzaXN0KCk7XG5cbiAgICByZXR1cm4gc2Vzc2lvbjtcbiAgfVxuXG4gIHN0YXRpYyBhc3luYyBmcm9tRmlsZVN5c3RlbShjb21vLCBkaXJuYW1lLCBmc0F1ZGlvRmlsZXMpIHtcbiAgICAvLyBAbm90ZSAtIHZlcnNpb24gMC4wLjAgKGNmLm1ldGFzKVxuICAgIGNvbnN0IG1ldGFzID0gYXdhaXQgZGIucmVhZChwYXRoLmpvaW4oZGlybmFtZSwgJ21ldGFzLmpzb24nKSk7XG4gICAgY29uc3QgZGF0YUdyYXBoID0gYXdhaXQgZGIucmVhZChwYXRoLmpvaW4oZGlybmFtZSwgYGdyYXBoLWRhdGEuanNvbmApKTtcbiAgICBjb25zdCBhdWRpb0dyYXBoID0gYXdhaXQgZGIucmVhZChwYXRoLmpvaW4oZGlybmFtZSwgYGdyYXBoLWF1ZGlvLmpzb25gKSk7XG4gICAgY29uc3QgbGFiZWxzID0gYXdhaXQgZGIucmVhZChwYXRoLmpvaW4oZGlybmFtZSwgJ2xhYmVscy5qc29uJykpO1xuICAgIGNvbnN0IGxhYmVsQXVkaW9GaWxlVGFibGUgPSBhd2FpdCBkYi5yZWFkKHBhdGguam9pbihkaXJuYW1lLCAnbGFiZWwtYXVkaW8tZmlsZXMtdGFibGUuanNvbicpKTtcbiAgICBjb25zdCBsZWFybmluZ0NvbmZpZyA9IGF3YWl0IGRiLnJlYWQocGF0aC5qb2luKGRpcm5hbWUsICdtbC1jb25maWcuanNvbicpKTtcbiAgICBjb25zdCBleGFtcGxlcyA9IGF3YWl0IGRiLnJlYWQocGF0aC5qb2luKGRpcm5hbWUsICcubWwtZXhhbXBsZXMuanNvbicpKTtcbiAgICBjb25zdCBtb2RlbCA9IGF3YWl0IGRiLnJlYWQocGF0aC5qb2luKGRpcm5hbWUsICcubWwtbW9kZWwuanNvbicpKTtcbiAgICBjb25zdCBhdWRpb0ZpbGVzID0gYXdhaXQgZGIucmVhZChwYXRoLmpvaW4oZGlybmFtZSwgJy5hdWRpby1maWxlcy5qc29uJykpO1xuXG4gICAgY29uc3QgaWQgPSBtZXRhcy5pZDtcbiAgICBjb25zdCBjb25maWcgPSB7XG4gICAgICBuYW1lOiBtZXRhcy5uYW1lLFxuICAgICAgZ3JhcGg6IHsgZGF0YTogZGF0YUdyYXBoLCBhdWRpbzogYXVkaW9HcmFwaCB9LFxuICAgICAgbGFiZWxzLFxuICAgICAgbGFiZWxBdWRpb0ZpbGVUYWJsZSxcbiAgICAgIGxlYXJuaW5nQ29uZmlnLFxuICAgICAgZXhhbXBsZXMsXG4gICAgICBtb2RlbCxcbiAgICAgIGF1ZGlvRmlsZXMsXG4gICAgfTtcblxuICAgIGNvbnN0IHNlc3Npb24gPSBuZXcgU2Vzc2lvbihjb21vLCBpZCk7XG4gICAgYXdhaXQgc2Vzc2lvbi5pbml0KGNvbmZpZyk7XG4gICAgYXdhaXQgc2Vzc2lvbi51cGRhdGVBdWRpb0ZpbGVzRnJvbUZpbGVTeXN0ZW0oZnNBdWRpb0ZpbGVzKTtcblxuICAgIHJldHVybiBzZXNzaW9uO1xuICB9XG5cbiAgY29uc3RydWN0b3IoY29tbywgaWQpIHtcbiAgICB0aGlzLmNvbW8gPSBjb21vO1xuICAgIHRoaXMuaWQgPSBpZDtcblxuICAgIHRoaXMuZGlyZWN0b3J5ID0gcGF0aC5qb2luKHRoaXMuY29tby5wcm9qZWN0RGlyZWN0b3J5LCAnc2Vzc2lvbnMnLCBpZCk7XG5cbiAgICB0aGlzLnhtbUluc3RhbmNlcyA9IHtcbiAgICAgICdnbW0nOiBuZXcgeG1tKCdnbW0nKSxcbiAgICAgICdoaG1tJzogbmV3IHhtbSgnaGhtbScpLFxuICAgIH07XG4gIH1cblxuICBhc3luYyBwZXJzaXN0KGtleSA9IG51bGwpIHtcbiAgICBjb25zdCB2YWx1ZXMgPSB0aGlzLnN0YXRlLmdldFZhbHVlcygpO1xuXG4gICAgaWYgKGtleSA9PT0gbnVsbCB8fMKga2V5ID09PSAnbmFtZScpIHtcbiAgICAgIGNvbnN0IHsgaWQsIG5hbWUgfSA9IHZhbHVlcztcbiAgICAgIGF3YWl0IGRiLndyaXRlKHBhdGguam9pbih0aGlzLmRpcmVjdG9yeSwgJ21ldGFzLmpzb24nKSwgeyBpZCwgbmFtZSwgdmVyc2lvbjogJzAuMC4wJyB9KTtcbiAgICB9XG5cbiAgICBpZiAoa2V5ID09PSBudWxsIHx8wqBrZXkgPT09ICdsYWJlbHMnKSB7XG4gICAgICBjb25zdCB7IGxhYmVscyB9ID0gdmFsdWVzO1xuICAgICAgYXdhaXQgZGIud3JpdGUocGF0aC5qb2luKHRoaXMuZGlyZWN0b3J5LCAnbGFiZWxzLmpzb24nKSwgbGFiZWxzKTtcbiAgICB9XG5cbiAgICBpZiAoa2V5ID09PSBudWxsIHx8wqBrZXkgPT09ICdsYWJlbEF1ZGlvRmlsZVRhYmxlJykge1xuICAgICAgY29uc3QgeyBsYWJlbEF1ZGlvRmlsZVRhYmxlIH0gPSB2YWx1ZXM7XG4gICAgICBhd2FpdCBkYi53cml0ZShwYXRoLmpvaW4odGhpcy5kaXJlY3RvcnksICdsYWJlbC1hdWRpby1maWxlcy10YWJsZS5qc29uJyksIGxhYmVsQXVkaW9GaWxlVGFibGUpO1xuICAgIH1cblxuICAgIGlmIChrZXkgPT09IG51bGwgfHzCoGtleSA9PT0gJ2dyYXBoJyB8fMKga2V5ID09PSAnZ3JhcGhPcHRpb25zJykge1xuICAgICAgLy8gcmVhcHBseSBjdXJyZW50IGdyYXBoIG9wdGlvbnMgaW50byBncmFwaCBkZWZpbml0aW9uc1xuICAgICAgY29uc3QgeyBncmFwaCwgZ3JhcGhPcHRpb25zIH0gPSB2YWx1ZXM7XG4gICAgICBjb25zdCB0eXBlcyA9IFsnZGF0YScsICdhdWRpbyddO1xuXG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHR5cGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGNvbnN0IHR5cGUgPSB0eXBlc1tpXTtcbiAgICAgICAgY29uc3Qgc3ViR3JhcGggPSBncmFwaFt0eXBlXTtcblxuICAgICAgICBzdWJHcmFwaC5tb2R1bGVzLmZvckVhY2goZGVzYyA9PiB7XG4gICAgICAgICAgaWYgKE9iamVjdC5rZXlzKGdyYXBoT3B0aW9uc1tkZXNjLmlkXSkubGVuZ3RoKSB7XG4gICAgICAgICAgICBkZXNjLm9wdGlvbnMgPSBncmFwaE9wdGlvbnNbZGVzYy5pZF07XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcblxuICAgICAgICBhd2FpdCBkYi53cml0ZShwYXRoLmpvaW4odGhpcy5kaXJlY3RvcnksIGBncmFwaC0ke3R5cGV9Lmpzb25gKSwgc3ViR3JhcGgpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChrZXkgPT09IG51bGwgfHzCoGtleSA9PT0gJ2xlYXJuaW5nQ29uZmlnJykge1xuICAgICAgY29uc3QgeyBsZWFybmluZ0NvbmZpZyB9ID0gdmFsdWVzO1xuICAgICAgYXdhaXQgZGIud3JpdGUocGF0aC5qb2luKHRoaXMuZGlyZWN0b3J5LCAnbWwtY29uZmlnLmpzb24nKSwgbGVhcm5pbmdDb25maWcpO1xuICAgIH1cblxuICAgIC8vIGdlbmVyYXRlZCBmaWxlcywga2VlcCB0aGVtIGhpZGRlblxuICAgIGlmIChrZXkgPT09IG51bGwgfHzCoGtleSA9PT0gJ2V4YW1wbGVzJykge1xuICAgICAgY29uc3QgeyBleGFtcGxlcyB9ID0gdmFsdWVzO1xuICAgICAgYXdhaXQgZGIud3JpdGUocGF0aC5qb2luKHRoaXMuZGlyZWN0b3J5LCAnLm1sLWV4YW1wbGVzLmpzb24nKSwgZXhhbXBsZXMsIGZhbHNlKTtcbiAgICB9XG5cbiAgIGlmIChrZXkgPT09IG51bGwgfHzCoGtleSA9PT0gJ3Byb2Nlc3NlZEV4YW1wbGVzJykge1xuICAgICAgY29uc3QgeyBwcm9jZXNzZWRFeGFtcGxlcyB9ID0gdmFsdWVzO1xuICAgICAgYXdhaXQgZGIud3JpdGUocGF0aC5qb2luKHRoaXMuZGlyZWN0b3J5LCAnLm1sLXByb2Nlc3NlZC1leGFtcGxlcy5kZWJ1Zy5qc29uJyksIHByb2Nlc3NlZEV4YW1wbGVzLCBmYWxzZSk7XG4gICAgfVxuXG4gICAgaWYgKGtleSA9PT0gbnVsbCB8fMKga2V5ID09PSAnbW9kZWwnKSB7XG4gICAgICBjb25zdCB7IG1vZGVsIH0gPSB2YWx1ZXM7XG4gICAgICBhd2FpdCBkYi53cml0ZShwYXRoLmpvaW4odGhpcy5kaXJlY3RvcnksICcubWwtbW9kZWwuanNvbicpLCBtb2RlbCwgZmFsc2UpO1xuICAgIH1cblxuICAgIGlmIChrZXkgPT09IG51bGwgfHzCoGtleSA9PT0gJ2F1ZGlvRmlsZXMnKSB7XG4gICAgICBjb25zdCB7IGF1ZGlvRmlsZXMgfSA9IHZhbHVlcztcbiAgICAgIGF3YWl0IGRiLndyaXRlKHBhdGguam9pbih0aGlzLmRpcmVjdG9yeSwgJy5hdWRpby1maWxlcy5qc29uJyksIGF1ZGlvRmlsZXMsIGZhbHNlKTtcbiAgICB9XG4gIH1cblxuICBnZXQobmFtZSkge1xuICAgIHJldHVybiB0aGlzLnN0YXRlLmdldChuYW1lKTtcbiAgfVxuXG4gIGdldFZhbHVlcygpIHtcbiAgICByZXR1cm4gdGhpcy5zdGF0ZS5nZXRWYWx1ZXMoKTtcbiAgfVxuXG4gIGFzeW5jIHNldCh1cGRhdGVzKSB7XG4gICAgYXdhaXQgdGhpcy5zdGF0ZS5zZXQodXBkYXRlcyk7XG4gIH1cblxuICBzdWJzY3JpYmUoZnVuYykge1xuICAgIHJldHVybiB0aGlzLnN0YXRlLnN1YnNjcmliZShmdW5jKTtcbiAgfVxuXG4gIGFzeW5jIGRlbGV0ZSgpIHtcbiAgICBhd2FpdCB0aGlzLnN0YXRlLmRldGFjaCgpO1xuICB9XG5cbiAgLyoqXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBpbml0VmFsdWVzXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBpbml0VmFsdWVzLmlkXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBpbml0VmFsdWVzLm5hbWVcbiAgICogQHBhcmFtIHtPYmplY3R9IGluaXRWYWx1ZXMuZ3JhcGhcbiAgICogQHBhcmFtIHtPYmplY3R9IFtpbml0VmFsdWVzLm1vZGVsXVxuICAgKiBAcGFyYW0ge09iamVjdH0gW2luaXRWYWx1ZXMuZXhhbXBsZXNdXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBbaW5pdFZhbHVlcy5sZWFybmluZ0NvbmZpZ11cbiAgICogQHBhcmFtIHtPYmplY3R9IFtpbml0VmFsdWVzLmF1ZGlvRmlsZXNdXG4gICAqL1xuICBhc3luYyBpbml0KGluaXRWYWx1ZXMpIHtcbiAgICBpbml0VmFsdWVzLmlkID0gdGhpcy5pZDtcbiAgICAvLyBleHRyYWN0IGdyYXBoIG9wdGlvbnMgZnJvbSBncmFwaCBkZWZpbml0aW9uXG4gICAgY29uc3QgbW9kdWxlcyA9IFsuLi5pbml0VmFsdWVzLmdyYXBoLmRhdGEubW9kdWxlcywgLi4uaW5pdFZhbHVlcy5ncmFwaC5hdWRpby5tb2R1bGVzXTtcblxuICAgIGluaXRWYWx1ZXMuZ3JhcGhPcHRpb25zID0gbW9kdWxlcy5yZWR1Y2UoKGFjYywgZGVzYykgPT4ge1xuICAgICAgYWNjW2Rlc2MuaWRdID0gZGVzYy5vcHRpb25zIHx8wqB7fTtcbiAgICAgIHJldHVybiBhY2M7XG4gICAgfSwge30pO1xuXG4gICAgdGhpcy5zdGF0ZSA9IGF3YWl0IHRoaXMuY29tby5zZXJ2ZXIuc3RhdGVNYW5hZ2VyLmNyZWF0ZShgc2Vzc2lvbmAsIGluaXRWYWx1ZXMpO1xuXG4gICAgdGhpcy5zdGF0ZS5zdWJzY3JpYmUoYXN5bmMgdXBkYXRlcyA9PiB7XG4gICAgICBmb3IgKGxldCBbbmFtZSwgdmFsdWVzXSBvZiBPYmplY3QuZW50cmllcyh1cGRhdGVzKSkge1xuICAgICAgICBzd2l0Y2ggKG5hbWUpIHtcbiAgICAgICAgICBjYXNlICdncmFwaE9wdGlvbnNFdmVudCc6IHtcbiAgICAgICAgICAgIGNvbnN0IGdyYXBoT3B0aW9ucyA9IHRoaXMuc3RhdGUuZ2V0KCdncmFwaE9wdGlvbnMnKTtcblxuICAgICAgICAgICAgZm9yIChsZXQgbW9kdWxlSWQgaW4gdmFsdWVzKSB7XG4gICAgICAgICAgICAgIC8vIGRlbGV0ZSBzY3JpcHRQYXJhbXMgb24gc2NyaXB0TmFtZSBjaGFuZ2VcbiAgICAgICAgICAgICAgaWYgKCdzY3JpcHROYW1lJyBpbiB2YWx1ZXNbbW9kdWxlSWRdKSB7XG4gICAgICAgICAgICAgICAgZGVsZXRlIGdyYXBoT3B0aW9uc1ttb2R1bGVJZF0uc2NyaXB0UGFyYW1zO1xuICAgICAgICAgICAgICAgIC8vIEB0b2RvIC0gdXBkYXRlIHRoZSBtb2RlbCB3aGVuIGEgZGF0YVNjcmlwdCBpcyB1cGRhdGVkLi4uXG4gICAgICAgICAgICAgICAgLy8gdGhpcy51cGRhdGVNb2RlbCh0aGlzLnN0YXRlLmdldCgnZXhhbXBsZXMnKSk7XG4gICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICBPYmplY3QuYXNzaWduKGdyYXBoT3B0aW9uc1ttb2R1bGVJZF0sIHZhbHVlc1ttb2R1bGVJZF0pO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0aGlzLnN0YXRlLnNldCh7IGdyYXBoT3B0aW9ucyB9KTtcblxuICAgICAgICAgICAgLy8gZm9yd2FyZCBldmVudCB0byBwbGF5ZXJzIGF0dGFjaGVkIHRvIHRoZSBzZXNzaW9uXG4gICAgICAgICAgICBBcnJheS5mcm9tKHRoaXMuY29tby5wcm9qZWN0LnBsYXllcnMudmFsdWVzKCkpXG4gICAgICAgICAgICAgIC5maWx0ZXIocGxheWVyID0+IHBsYXllci5nZXQoJ3Nlc3Npb25JZCcpID09PSB0aGlzLmlkKVxuICAgICAgICAgICAgICAuZm9yRWFjaChwbGF5ZXIgPT4gcGxheWVyLnNldCh7IGdyYXBoT3B0aW9uc0V2ZW50OiB2YWx1ZXMgfSkpO1xuXG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBjYXNlICdsZWFybmluZ0NvbmZpZyc6IHtcbiAgICAgICAgICAgIHRoaXMudXBkYXRlTW9kZWwoKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGF3YWl0IHRoaXMucGVyc2lzdChuYW1lKTtcbiAgICAgIH1cbiAgICB9KTtcblxuXG4gICAgLy8gaW5pdCBncmFwaFxuICAgIGNvbnN0IGdyYXBoRGVzY3JpcHRpb24gPSB0aGlzLnN0YXRlLmdldCgnZ3JhcGgnKTtcbiAgICBjb25zdCBkYXRhR3JhcGggPSBjbG9uZWRlZXAoZ3JhcGhEZXNjcmlwdGlvbi5kYXRhKTtcblxuICAgIGRhdGFHcmFwaC5tb2R1bGVzLmZvckVhY2gobW9kdWxlID0+IHtcbiAgICAgIGlmIChtb2R1bGUudHlwZSA9PT0gJ01MRGVjb2RlcicpIHtcbiAgICAgICAgbW9kdWxlLnR5cGUgPSAnQnVmZmVyJztcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIHRoaXMuZ3JhcGggPSBuZXcgR3JhcGgodGhpcy5jb21vLCB7IGRhdGE6IGRhdGFHcmFwaCB9LCB0aGlzLCBudWxsLCB0cnVlKTtcbiAgICBhd2FpdCB0aGlzLmdyYXBoLmluaXQoKTtcblxuICAgIC8vIGluaXQgbW9kZWxcbiAgICBhd2FpdCB0aGlzLnVwZGF0ZU1vZGVsKCk7XG4gIH1cblxuICBhc3luYyB1cGRhdGVBdWRpb0ZpbGVzRnJvbUZpbGVTeXN0ZW0oYXVkaW9GaWxlVHJlZSkge1xuICAgIGNvbnN0IHsgYXVkaW9GaWxlcywgbGFiZWxBdWRpb0ZpbGVUYWJsZSB9ID0gdGhpcy5zdGF0ZS5nZXRWYWx1ZXMoKTtcbiAgICBjb25zdCB7IGRlbGV0ZWQsIGNyZWF0ZWQgfSA9IGRpZmZBcnJheXMoYXVkaW9GaWxlcywgYXVkaW9GaWxlVHJlZSwgZiA9PiBmLnVybCk7XG5cbiAgICBjcmVhdGVkLmZvckVhY2goY3JlYXRlZEZpbGUgPT4ge1xuICAgICAgY29uc3QgY29weSA9IE9iamVjdC5hc3NpZ24oe30sIGNyZWF0ZWRGaWxlKTtcbiAgICAgIGNvcHkuYWN0aXZlID0gdHJ1ZTtcblxuICAgICAgYXVkaW9GaWxlcy5wdXNoKGNvcHkpO1xuXG4gICAgICAvLyBjcmVhdGUgbGFiZWwgYW5kIGRlZmF1bHQgW2xhYmVsLCBmaWxlXSByb3cgZW50cnlcbiAgICAgIHRoaXMuY3JlYXRlTGFiZWwoY3JlYXRlZEZpbGUubmFtZSk7XG4gICAgICB0aGlzLmNyZWF0ZUxhYmVsQXVkaW9GaWxlUm93KFtjcmVhdGVkRmlsZS5uYW1lLCBjcmVhdGVkRmlsZS5uYW1lXSk7XG4gICAgfSk7XG5cbiAgICBkZWxldGVkLmZvckVhY2goZGVsZXRlZEZpbGUgPT4ge1xuICAgICAgY29uc3QgaW5kZXggPSBhdWRpb0ZpbGVzLmZpbmRJbmRleChmID0+IGYudXJsID09PSBkZWxldGVkRmlsZS51cmwpO1xuICAgICAgYXVkaW9GaWxlcy5zcGxpY2UoaW5kZXgsIDEpO1xuXG4gICAgICAvLyBkZWxldGUgbGFiZWxcbiAgICAgIHRoaXMuZGVsZXRlTGFiZWwoZGVsZXRlZEZpbGUubmFtZSk7XG4gICAgICAvLyBkZWxldGUgcm93cyB3aGVyZSBhdWRpbyBmaWxlIGFwcGVhcnNcbiAgICAgIGNvbnN0IHJvd3MgPSBsYWJlbEF1ZGlvRmlsZVRhYmxlLmZpbHRlcihyID0+IHJbMV0gPT09IGRlbGV0ZWRGaWxlLm5hbWUpO1xuICAgICAgcm93cy5mb3JFYWNoKHJvdyA9PiB0aGlzLmRlbGV0ZUxhYmVsQXVkaW9GaWxlUm93KHJvdykpO1xuICAgIH0pO1xuXG4gICAgYXdhaXQgdGhpcy5zdGF0ZS5zZXQoeyBhdWRpb0ZpbGVzIH0pO1xuICB9XG5cbiAgYWRkRXhhbXBsZShleGFtcGxlKSB7XG4gICAgY29uc3QgdXVpZCA9IHV1aWR2NCgpO1xuICAgIGNvbnN0IGV4YW1wbGVzID0gdGhpcy5zdGF0ZS5nZXQoJ2V4YW1wbGVzJyk7XG4gICAgZXhhbXBsZXNbdXVpZF0gPSBleGFtcGxlO1xuXG4gICAgdGhpcy51cGRhdGVNb2RlbChleGFtcGxlcyk7XG4gIH1cblxuICBkZWxldGVFeGFtcGxlKHV1aWQpIHtcbiAgICBjb25zdCBleGFtcGxlcyA9IHRoaXMuc3RhdGUuZ2V0KCdleGFtcGxlcycpO1xuXG4gICAgaWYgKHV1aWQgaW4gZXhhbXBsZXMpIHtcbiAgICAgIGRlbGV0ZSBleGFtcGxlc1t1dWlkXTtcbiAgICAgIHRoaXMudXBkYXRlTW9kZWwoZXhhbXBsZXMpO1xuICAgIH1cbiAgfVxuXG4gIGNsZWFyRXhhbXBsZXMobGFiZWwgPSBudWxsKSB7XG4gICAgY29uc3QgY2xlYXJlZEV4YW1wbGVzID0ge307XG5cbiAgICBpZiAobGFiZWwgIT09IG51bGwpIHtcbiAgICAgIGNvbnN0IGV4YW1wbGVzID0gdGhpcy5zdGF0ZS5nZXQoJ2V4YW1wbGVzJyk7XG5cbiAgICAgIGZvciAobGV0IHV1aWQgaW4gZXhhbXBsZXMpIHtcbiAgICAgICAgaWYgKGV4YW1wbGVzW3V1aWRdLmxhYmVsICE9PSBsYWJlbCkge1xuICAgICAgICAgIGNsZWFyZWRFeGFtcGxlc1t1dWlkXSA9IGV4YW1wbGVzW3V1aWRdO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgdGhpcy51cGRhdGVNb2RlbChjbGVhcmVkRXhhbXBsZXMpO1xuICB9XG5cbiAgY3JlYXRlTGFiZWwobGFiZWwpIHtcbiAgICBjb25zdCBsYWJlbHMgPSB0aGlzLnN0YXRlLmdldCgnbGFiZWxzJyk7XG5cbiAgICBpZiAobGFiZWxzLmluZGV4T2YobGFiZWwpID09PSAtMSkge1xuICAgICAgbGFiZWxzLnB1c2gobGFiZWwpO1xuXG4gICAgICB0aGlzLnN0YXRlLnNldCh7IGxhYmVscyB9KTtcbiAgICB9XG4gIH1cblxuICB1cGRhdGVMYWJlbChvbGRMYWJlbCwgbmV3TGFiZWwpIHtcbiAgICBjb25zdCB7IGxhYmVscywgbGFiZWxBdWRpb0ZpbGVUYWJsZSwgZXhhbXBsZXMgfSA9IHRoaXMuc3RhdGUuZ2V0VmFsdWVzKCk7XG5cbiAgICBpZiAobGFiZWxzLmluZGV4T2Yob2xkTGFiZWwpICE9PSAtMSAmJiBsYWJlbHMuaW5kZXhPZihuZXdMYWJlbCkgPT09IC0xKSB7XG4gICAgICBjb25zdCB1cGRhdGVkTGFiZWxzID0gbGFiZWxzLm1hcChsYWJlbCA9PiBsYWJlbCA9PT0gb2xkTGFiZWwgPyBuZXdMYWJlbCA6IGxhYmVsKTtcbiAgICAgIGNvbnN0IHVwZGF0ZWRUYWJsZSA9IGxhYmVsQXVkaW9GaWxlVGFibGUubWFwKHJvdyA9PiB7XG4gICAgICAgIGlmIChyb3dbMF0gPT09IG9sZExhYmVsKSB7XG4gICAgICAgICAgcm93WzBdID0gbmV3TGFiZWw7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gcm93O1xuICAgICAgfSk7XG5cbiAgICAgIC8vIHVwZGF0ZXMgbGFiZWxzIG9mIGV4aXN0aW5nIGV4YW1wbGVzXG4gICAgICBmb3IgKGxldCB1dWlkIGluIGV4YW1wbGVzKSB7XG4gICAgICAgIGNvbnN0IGV4YW1wbGUgPSBleGFtcGxlc1t1dWlkXTtcblxuICAgICAgICBpZiAoZXhhbXBsZS5sYWJlbCA9PT0gb2xkTGFiZWwpIHtcbiAgICAgICAgICBleGFtcGxlLmxhYmVsID0gbmV3TGFiZWw7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgdGhpcy51cGRhdGVNb2RlbChleGFtcGxlcyk7XG4gICAgICB0aGlzLnN0YXRlLnNldCh7XG4gICAgICAgIGxhYmVsczogdXBkYXRlZExhYmVscyxcbiAgICAgICAgbGFiZWxBdWRpb0ZpbGVUYWJsZTogdXBkYXRlZFRhYmxlLFxuICAgICAgfSk7XG4gICAgfVxuICB9XG5cbiAgZGVsZXRlTGFiZWwobGFiZWwpIHtcbiAgICBjb25zdCB7IGxhYmVscywgbGFiZWxBdWRpb0ZpbGVUYWJsZSwgZXhhbXBsZXMgfSA9IHRoaXMuc3RhdGUuZ2V0VmFsdWVzKCk7XG5cbiAgICBpZiAobGFiZWxzLmluZGV4T2YobGFiZWwpICE9PSAtMSkge1xuICAgICAgLy8gY2xlYW4gbGFiZWwgLyBhdWRpbyBmaWxlIHRhYmxlXG4gICAgICBjb25zdCBmaWx0ZXJlZExhYmVscyA9IGxhYmVscy5maWx0ZXIobCA9PiBsICE9PSBsYWJlbCk7XG4gICAgICBjb25zdCBmaWx0ZXJlZFRhYmxlID0gbGFiZWxBdWRpb0ZpbGVUYWJsZS5maWx0ZXIocm93ID0+IHJvd1swXSAhPT0gbGFiZWwpO1xuXG4gICAgICB0aGlzLmNsZWFyRXhhbXBsZXMobGFiZWwpOyAvLyB0aGlzIHJldHJhaW5zIHRoZSBtb2RlbFxuICAgICAgdGhpcy5zdGF0ZS5zZXQoe1xuICAgICAgICBsYWJlbHM6IGZpbHRlcmVkTGFiZWxzLFxuICAgICAgICBsYWJlbEF1ZGlvRmlsZVRhYmxlOiBmaWx0ZXJlZFRhYmxlLFxuICAgICAgfSk7XG4gICAgfVxuICB9XG5cbiAgdG9nZ2xlQXVkaW9GaWxlKGZpbGVuYW1lLCBhY3RpdmUpIHtcbiAgICBjb25zdCB7IGF1ZGlvRmlsZXMsIGxhYmVsQXVkaW9GaWxlVGFibGUgfSA9IHRoaXMuc3RhdGUuZ2V0VmFsdWVzKCk7XG5cbiAgICBjb25zdCBhdWRpb0ZpbGUgPSBhdWRpb0ZpbGVzLmZpbmQoZiA9PiBmLm5hbWUgPT09IGZpbGVuYW1lKTtcbiAgICBhdWRpb0ZpbGUuYWN0aXZlID0gYWN0aXZlO1xuXG4gICAgY29uc3QgdXBkYXRlZFRhYmxlID0gbGFiZWxBdWRpb0ZpbGVUYWJsZS5maWx0ZXIocm93ID0+IHJvd1sxXSAhPT0gZmlsZW5hbWUpO1xuXG4gICAgdGhpcy5zdGF0ZS5zZXQoe1xuICAgICAgYXVkaW9GaWxlcyxcbiAgICAgIGxhYmVsQXVkaW9GaWxlVGFibGU6IHVwZGF0ZWRUYWJsZSxcbiAgICB9KTtcbiAgfVxuXG4gIGNyZWF0ZUxhYmVsQXVkaW9GaWxlUm93KHJvdykge1xuICAgIGNvbnN0IGxhYmVsQXVkaW9GaWxlVGFibGUgPSB0aGlzLnN0YXRlLmdldCgnbGFiZWxBdWRpb0ZpbGVUYWJsZScpO1xuICAgIGNvbnN0IGluZGV4ID0gbGFiZWxBdWRpb0ZpbGVUYWJsZS5maW5kSW5kZXgociA9PiByWzBdID09PSByb3dbMF0gJiYgclsxXSA9PT0gcm93WzFdKTtcblxuICAgIGlmIChpbmRleCA9PT0gLTEpIHtcbiAgICAgIGxhYmVsQXVkaW9GaWxlVGFibGUucHVzaChyb3cpO1xuICAgICAgdGhpcy5zdGF0ZS5zZXQoeyBsYWJlbEF1ZGlvRmlsZVRhYmxlIH0pO1xuICAgIH1cbiAgfVxuXG4gIGRlbGV0ZUxhYmVsQXVkaW9GaWxlUm93KHJvdykge1xuICAgIGNvbnN0IGxhYmVsQXVkaW9GaWxlVGFibGUgPSB0aGlzLnN0YXRlLmdldCgnbGFiZWxBdWRpb0ZpbGVUYWJsZScpO1xuICAgIGNvbnN0IGZpbHRlcmVkVGFibGUgPSBsYWJlbEF1ZGlvRmlsZVRhYmxlLmZpbHRlcihyID0+IHtcbiAgICAgIHJldHVybiByWzBdID09PSByb3dbMF0gJiYgclsxXSA9PT0gcm93WzFdID8gZmFsc2UgOiB0cnVlO1xuICAgIH0pO1xuXG4gICAgdGhpcy5zdGF0ZS5zZXQoeyBsYWJlbEF1ZGlvRmlsZVRhYmxlOiBmaWx0ZXJlZFRhYmxlIH0pO1xuICB9XG5cbiAgYXN5bmMgdXBkYXRlTW9kZWwoZXhhbXBsZXMgPSBudWxsKSB7XG4gICAgaWYgKGV4YW1wbGVzID09PSBudWxsKSB7XG4gICAgICBleGFtcGxlcyA9IHRoaXMuc3RhdGUuZ2V0KCdleGFtcGxlcycpO1xuICAgIH1cblxuICAgIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgIGNvbnN0IGxvZ1ByZWZpeCA9IGBbc2Vzc2lvbiBcIiR7dGhpcy5zdGF0ZS5nZXQoJ2lkJyl9XCJdYDtcbiAgICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgICBjb25zdCBsYWJlbHMgPSBPYmplY3QudmFsdWVzKGV4YW1wbGVzKS5tYXAoZCA9PiBkLmxhYmVsKS5maWx0ZXIoKGQsIGksIGFycikgPT4gYXJyLmluZGV4T2YoZCkgPT09IGkpO1xuICAgIGNvbnNvbGUubG9nKGBcXG4ke2xvZ1ByZWZpeH0gPiBVUERBVEUgTU9ERUwgLSBsYWJlbHM6YCwgbGFiZWxzKTtcbiAgICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgICBjb25zdCBwcm9jZXNzaW5nU3RhcnRUaW1lID0gbmV3IERhdGUoKS5nZXRUaW1lKCk7XG4gICAgY29uc29sZS5sb2coYCR7bG9nUHJlZml4fSBwcm9jZXNzaW5nIHN0YXJ0XFx0KCMgZXhhbXBsZXM6ICR7T2JqZWN0LmtleXMoZXhhbXBsZXMpLmxlbmd0aH0pYCk7XG4gICAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbiAgICAvLyByZXBsYWNlIE1MRGVjb2RlciB3LyBEZXN0QnVmZmVyIGluIGdyYXBoIGZvciByZWNvcmRpbmcgdHJhbnNmb3JtZWQgc3RyZWFtXG4gICAgLy8gQG5vdGUgLSB0aGlzIGNhbiBvbmx5IHdvcmsgdy8gMSBvciAwIGRlY29kZXIsXG4gICAgLy8gQHRvZG8gLSBoYW5kbGUgY2FzZXMgdy8gMiBvciBtb3JlIGRlY29kZXJzIGxhdGVyLlxuICAgIGxldCBoYXNEZWNvZGVyID0gZmFsc2U7XG4gICAgbGV0IGJ1ZmZlciA9IG51bGw7XG5cbiAgICBmb3IgKGxldCBpZCBpbiB0aGlzLmdyYXBoLm1vZHVsZXMpIHtcbiAgICAgIGNvbnN0IG1vZHVsZSA9IHRoaXMuZ3JhcGgubW9kdWxlc1tpZF07XG5cbiAgICAgIGlmIChtb2R1bGUudHlwZSA9PT0gJ0J1ZmZlcicpIHtcbiAgICAgICAgaGFzRGVjb2RlciA9IHRydWU7XG4gICAgICAgIGJ1ZmZlciA9IG1vZHVsZTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoYnVmZmVyID09PSBudWxsKSB7XG4gICAgICBjb25zb2xlLmxvZyhgXFxuJHtsb2dQcmVmaXh9ID4gZ3JhcGggZG9lcyBub3QgY29udGFpbiBhbnkgTUxEZWNvZGVyLCBhYm9ydCB0cmFuaW5nLi4uYCk7XG4gICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCk7XG4gICAgfVxuXG4gICAgLy8gY29uc3QgYnVmZmVyID0gZ3JhcGguZ2V0TW9kdWxlKGJ1ZmZlcklkKTtcbiAgICBsZXQgb2ZmbGluZVNvdXJjZTtcblxuICAgIC8vIEBub3RlIC0gbWltaWMgcmFwaWQtbWl4IEFQSSwgcmVtb3ZlIC8gdXBkYXRlIGxhdGVyXG4gICAgY29uc3QgcmFwaWRNaXhFeGFtcGxlcyA9IHtcbiAgICAgIGRvY1R5cGU6ICdyYXBpZC1taXg6bWwtdHJhaW5pbmctc2V0JyxcbiAgICAgIGRvY1ZlcnNpb246ICcxLjAuMCcsXG4gICAgICBwYXlsb2FkOiB7XG4gICAgICAgIGlucHV0RGltZW5zaW9uOiAwLFxuICAgICAgICBvdXRwdXREaW1lbnNpb246IDAsXG4gICAgICAgIGRhdGE6IFtdLFxuICAgICAgfVxuICAgIH1cblxuICAgIC8vIGZvciBwZXJzaXN0ZW5jeSwgZGlzcGxheVxuICAgIGNvbnN0IHByb2Nlc3NlZEV4YW1wbGVzID0ge31cblxuICAgIC8vIHByb2Nlc3MgZXhhbXBsZXMgcmF3IGRhdGEgaW4gcHJlLXByb2Nlc3NpbmcgZ3JhcGhcbiAgICBmb3IgKGxldCB1dWlkIGluIGV4YW1wbGVzKSB7XG4gICAgICBjb25zdCBleGFtcGxlID0gZXhhbXBsZXNbdXVpZF07XG5cbiAgICAgIG9mZmxpbmVTb3VyY2UgPSBuZXcgT2ZmbGluZVNvdXJjZShleGFtcGxlLmlucHV0KTtcbiAgICAgIHRoaXMuZ3JhcGguc2V0U291cmNlKG9mZmxpbmVTb3VyY2UpO1xuXG4gICAgICAvLyBydW4gdGhlIGdyYXBoIG9mZmxpbmUsIHRoaXMgTVVTVCBiZSBzeW5jaHJvbm91c1xuICAgICAgb2ZmbGluZVNvdXJjZS5ydW4oKTtcbiAgICAgIGNvbnN0IHRyYW5zZm9ybWVkU3RyZWFtID0gYnVmZmVyLmdldERhdGEoKTtcblxuICAgICAgaWYgKGV4YW1wbGUuaW5wdXQubGVuZ3RoICE9PSB0cmFuc2Zvcm1lZFN0cmVhbS5sZW5ndGgpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGAke2xvZ1ByZWZpeH0gRXJyb3I6IGluY29oZXJlbnQgZXhhbXBsZSBwcm9jZXNzaW5nIGZvciBleGFtcGxlICR7dXVpZH1gKTtcbiAgICAgIH1cblxuICAgICAgdGhpcy5ncmFwaC5yZW1vdmVTb3VyY2Uob2ZmbGluZVNvdXJjZSk7XG4gICAgICBidWZmZXIucmVzZXQoKTtcblxuICAgICAgY29uc3QgcHJvY2Vzc2VkRXhhbXBsZSA9IHtcbiAgICAgICAgbGFiZWw6IGV4YW1wbGUubGFiZWwsXG4gICAgICAgIG91dHB1dDogZXhhbXBsZS5vdXRwdXQsXG4gICAgICAgIGlucHV0OiB0cmFuc2Zvcm1lZFN0cmVhbSxcbiAgICAgIH07XG4gICAgICAvLyBhZGQgdG8gcHJvY2Vzc2VkIGV4YW1wbGVzXG4gICAgICByYXBpZE1peEV4YW1wbGVzLnBheWxvYWQuZGF0YS5wdXNoKHByb2Nlc3NlZEV4YW1wbGUpO1xuICAgICAgcHJvY2Vzc2VkRXhhbXBsZXNbdXVpZF0gPSBwcm9jZXNzZWRFeGFtcGxlO1xuICAgIH1cblxuICAgIGlmIChyYXBpZE1peEV4YW1wbGVzLnBheWxvYWQuZGF0YVswXSkge1xuICAgICAgcmFwaWRNaXhFeGFtcGxlcy5wYXlsb2FkLmlucHV0RGltZW5zaW9uID0gcmFwaWRNaXhFeGFtcGxlcy5wYXlsb2FkLmRhdGFbMF0uaW5wdXRbMF0ubGVuZ3RoO1xuICAgIH1cblxuICAgIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgIGNvbnN0IHByb2Nlc3NpbmdUaW1lID0gbmV3IERhdGUoKS5nZXRUaW1lKCkgLSBwcm9jZXNzaW5nU3RhcnRUaW1lO1xuICAgIGNvbnNvbGUubG9nKGAke2xvZ1ByZWZpeH0gcHJvY2Vzc2luZyBlbmRcXHRcXHQoJHtwcm9jZXNzaW5nVGltZX1tcylgKTtcbiAgICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgICBjb25zdCB0cmFpbmluZ1N0YXJ0VGltZSA9IG5ldyBEYXRlKCkuZ2V0VGltZSgpO1xuICAgIGNvbnN0IG51bUlucHV0RGltZW5zaW9ucyA9IHJhcGlkTWl4RXhhbXBsZXMucGF5bG9hZC5pbnB1dERpbWVuc2lvbjtcbiAgICBjb25zb2xlLmxvZyhgJHtsb2dQcmVmaXh9IHRyYWluaW5nIHN0YXJ0XFx0XFx0KCMgaW5wdXQgZGltZW5zaW9uczogJHtudW1JbnB1dERpbWVuc2lvbnN9KWApO1xuICAgIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4gICAgLy8gdHJhaW4gbW9kZWxcbiAgICAvLyBAdG9kbyAtIGNsZWFuIHRoaXMgZioqKioqKiBtZXNzeSBNYW5vIC8gUmFwaWRNaXggLyBYbW0gY29udmVydGlvblxuICAgIGNvbnN0IHhtbVRyYWluaW5nU2V0ID0gcmFwaWRNaXhBZGFwdGVycy5yYXBpZE1peFRvWG1tVHJhaW5pbmdTZXQocmFwaWRNaXhFeGFtcGxlcyk7XG5cbiAgICBjb25zdCBsZWFybmluZ0NvbmZpZyA9IHRoaXMuc3RhdGUuZ2V0KCdsZWFybmluZ0NvbmZpZycpOyAvLyBtYW5vXG4gICAgY29uc3QgeG1tQ29uZmlnID0gcmFwaWRNaXhBZGFwdGVycy5yYXBpZE1peFRvWG1tQ29uZmlnKGxlYXJuaW5nQ29uZmlnKTsgLy8geG1tXG4gICAgY29uc29sZS5sb2cobG9nUHJlZml4LCAneG1tIGNvbmZpZycsIHhtbUNvbmZpZyk7XG4gICAgLy8gZ2V0IChnbW18aGhtbSkgeG1tIGluc3RhbmNlXG4gICAgY29uc3QgeG1tID0gdGhpcy54bW1JbnN0YW5jZXNbbGVhcm5pbmdDb25maWcucGF5bG9hZC5tb2RlbFR5cGVdO1xuXG4gICAgeG1tLnNldENvbmZpZyh4bW1Db25maWcpO1xuICAgIHhtbS5zZXRUcmFpbmluZ1NldCh4bW1UcmFpbmluZ1NldCk7XG4gICAgLy8gY29uc29sZS5sb2coeG1tLmdldENvbmZpZygpKTtcblxuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICB4bW0udHJhaW4oKGVyciwgbW9kZWwpID0+IHtcbiAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgIHJlamVjdChlcnIpO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgcmFwaWRNaXhNb2RlbCA9IHJhcGlkTWl4QWRhcHRlcnMueG1tVG9SYXBpZE1peE1vZGVsKG1vZGVsKTtcbiAgICAgICAgdGhpcy5zdGF0ZS5zZXQoe1xuICAgICAgICAgIGV4YW1wbGVzLFxuICAgICAgICAgIHByb2Nlc3NlZEV4YW1wbGVzLFxuICAgICAgICAgIG1vZGVsOiByYXBpZE1peE1vZGVsLFxuICAgICAgICB9KTtcblxuICAgICAgICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgICAgICAgY29uc3QgdHJhaW5pbmdUaW1lID0gbmV3IERhdGUoKS5nZXRUaW1lKCkgLSB0cmFpbmluZ1N0YXJ0VGltZTtcbiAgICAgICAgY29uc29sZS5sb2coYCR7bG9nUHJlZml4fSB0cmFpbmluZyBlbmRcXHRcXHQoJHt0cmFpbmluZ1RpbWV9bXMpYCk7XG4gICAgICAgIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4gICAgICAgIHJlc29sdmUoKTtcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IFNlc3Npb247XG4iXX0=