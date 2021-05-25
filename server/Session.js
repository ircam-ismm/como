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

    const processedExamples = {
      docType: 'rapid-mix:ml-training-set',
      docVersion: '1.0.0',
      payload: {
        inputDimension: 0,
        outputDimension: 0,
        data: []
      }
    }; // process examples raw data in pre-processing graph

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
      buffer.reset(); // add to processed examples

      processedExamples.payload.data.push({
        label: example.label,
        output: example.output,
        input: transformedStream
      });
    }

    if (processedExamples.payload.data[0]) {
      processedExamples.payload.inputDimension = processedExamples.payload.data[0].input[0].length;
    } // ---------------------------------------


    const processingTime = new Date().getTime() - processingStartTime;
    console.log(`${logPrefix} processing end\t\t(${processingTime}ms)`); // ---------------------------------------

    const trainingStartTime = new Date().getTime();
    const numInputDimensions = processedExamples.payload.inputDimension;
    console.log(`${logPrefix} training start\t\t(# input dimensions: ${numInputDimensions})`); // ---------------------------------------
    // train model
    // @todo - clean this f****** messy Mano / RapidMix / Xmm convertion

    const xmmTrainingSet = _rapidMixAdapters.default.rapidMixToXmmTrainingSet(processedExamples);

    const learningConfig = this.state.get('learningConfig'); // mano

    const xmmConfig = _rapidMixAdapters.default.rapidMixToXmmConfig(learningConfig); // xmm
    // get (gmm|hhmm) xmm instance


    const xmm = this.xmmInstances[learningConfig.payload.modelType];
    xmm.setConfig(xmmConfig);
    xmm.setTrainingSet(xmmTrainingSet);
    return new Promise((resolve, reject) => {
      xmm.train((err, model) => {
        if (err) {
          reject(err);
        }

        const rapidMixModel = _rapidMixAdapters.default.xmmToRapidMixModel(model);

        this.state.set({
          examples: examples,
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9zZXJ2ZXIvU2Vzc2lvbi5qcyJdLCJuYW1lcyI6WyJTZXNzaW9uIiwiY3JlYXRlIiwiY29tbyIsImlkIiwibmFtZSIsImdyYXBoIiwiZnNBdWRpb0ZpbGVzIiwic2Vzc2lvbiIsImluaXQiLCJ1cGRhdGVBdWRpb0ZpbGVzRnJvbUZpbGVTeXN0ZW0iLCJyZWdpc3RlcmVkQXVkaW9GaWxlcyIsImdldCIsImxhYmVscyIsImxhYmVsQXVkaW9GaWxlVGFibGUiLCJmb3JFYWNoIiwiYXVkaW9GaWxlIiwibGFiZWwiLCJyb3ciLCJwdXNoIiwic2V0IiwicGVyc2lzdCIsImZyb21GaWxlU3lzdGVtIiwiZGlybmFtZSIsIm1ldGFzIiwiZGIiLCJyZWFkIiwicGF0aCIsImpvaW4iLCJkYXRhR3JhcGgiLCJhdWRpb0dyYXBoIiwibGVhcm5pbmdDb25maWciLCJleGFtcGxlcyIsIm1vZGVsIiwiYXVkaW9GaWxlcyIsImNvbmZpZyIsImRhdGEiLCJhdWRpbyIsImNvbnN0cnVjdG9yIiwiZGlyZWN0b3J5IiwicHJvamVjdERpcmVjdG9yeSIsInhtbUluc3RhbmNlcyIsInhtbSIsImtleSIsInZhbHVlcyIsInN0YXRlIiwiZ2V0VmFsdWVzIiwid3JpdGUiLCJ2ZXJzaW9uIiwiZ3JhcGhPcHRpb25zIiwidHlwZXMiLCJpIiwibGVuZ3RoIiwidHlwZSIsInN1YkdyYXBoIiwibW9kdWxlcyIsImRlc2MiLCJPYmplY3QiLCJrZXlzIiwib3B0aW9ucyIsInVwZGF0ZXMiLCJzdWJzY3JpYmUiLCJmdW5jIiwiZGVsZXRlIiwiZGV0YWNoIiwiaW5pdFZhbHVlcyIsInJlZHVjZSIsImFjYyIsInNlcnZlciIsInN0YXRlTWFuYWdlciIsImVudHJpZXMiLCJtb2R1bGVJZCIsInNjcmlwdFBhcmFtcyIsImFzc2lnbiIsIkFycmF5IiwiZnJvbSIsInByb2plY3QiLCJwbGF5ZXJzIiwiZmlsdGVyIiwicGxheWVyIiwiZ3JhcGhPcHRpb25zRXZlbnQiLCJ1cGRhdGVNb2RlbCIsImdyYXBoRGVzY3JpcHRpb24iLCJtb2R1bGUiLCJHcmFwaCIsImF1ZGlvRmlsZVRyZWUiLCJkZWxldGVkIiwiY3JlYXRlZCIsImYiLCJ1cmwiLCJjcmVhdGVkRmlsZSIsImNvcHkiLCJhY3RpdmUiLCJkZWxldGVkRmlsZSIsImluZGV4IiwiZmluZEluZGV4Iiwic3BsaWNlIiwiYWRkRXhhbXBsZSIsImV4YW1wbGUiLCJ1dWlkIiwiZGVsZXRlRXhhbXBsZSIsImNsZWFyRXhhbXBsZXMiLCJjbGVhcmVkRXhhbXBsZXMiLCJjcmVhdGVMYWJlbCIsImluZGV4T2YiLCJ1cGRhdGVMYWJlbCIsIm9sZExhYmVsIiwibmV3TGFiZWwiLCJ1cGRhdGVkTGFiZWxzIiwibWFwIiwidXBkYXRlZFRhYmxlIiwiZGVsZXRlTGFiZWwiLCJmaWx0ZXJlZExhYmVscyIsImwiLCJmaWx0ZXJlZFRhYmxlIiwidG9nZ2xlQXVkaW9GaWxlIiwiZmlsZW5hbWUiLCJmaW5kIiwiY3JlYXRlTGFiZWxBdWRpb0ZpbGVSb3ciLCJyIiwiZGVsZXRlTGFiZWxBdWRpb0ZpbGVSb3ciLCJsb2dQcmVmaXgiLCJkIiwiYXJyIiwiY29uc29sZSIsImxvZyIsInByb2Nlc3NpbmdTdGFydFRpbWUiLCJEYXRlIiwiZ2V0VGltZSIsImhhc0RlY29kZXIiLCJidWZmZXIiLCJQcm9taXNlIiwicmVzb2x2ZSIsIm9mZmxpbmVTb3VyY2UiLCJwcm9jZXNzZWRFeGFtcGxlcyIsImRvY1R5cGUiLCJkb2NWZXJzaW9uIiwicGF5bG9hZCIsImlucHV0RGltZW5zaW9uIiwib3V0cHV0RGltZW5zaW9uIiwiT2ZmbGluZVNvdXJjZSIsImlucHV0Iiwic2V0U291cmNlIiwicnVuIiwidHJhbnNmb3JtZWRTdHJlYW0iLCJnZXREYXRhIiwiRXJyb3IiLCJyZW1vdmVTb3VyY2UiLCJyZXNldCIsIm91dHB1dCIsInByb2Nlc3NpbmdUaW1lIiwidHJhaW5pbmdTdGFydFRpbWUiLCJudW1JbnB1dERpbWVuc2lvbnMiLCJ4bW1UcmFpbmluZ1NldCIsInJhcGlkTWl4QWRhcHRlcnMiLCJyYXBpZE1peFRvWG1tVHJhaW5pbmdTZXQiLCJ4bW1Db25maWciLCJyYXBpZE1peFRvWG1tQ29uZmlnIiwibW9kZWxUeXBlIiwic2V0Q29uZmlnIiwic2V0VHJhaW5pbmdTZXQiLCJyZWplY3QiLCJ0cmFpbiIsImVyciIsInJhcGlkTWl4TW9kZWwiLCJ4bW1Ub1JhcGlkTWl4TW9kZWwiLCJ0cmFpbmluZ1RpbWUiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7QUFBQTs7QUFDQTs7QUFDQTs7QUFFQTs7QUFFQTs7QUFFQTs7QUFDQTs7QUFDQTs7QUFDQTs7QUFDQTs7OztBQVBBO0FBU0EsTUFBTUEsT0FBTixDQUFjO0FBRVo7QUFDbUIsZUFBTkMsTUFBTSxDQUFDQyxJQUFELEVBQU9DLEVBQVAsRUFBV0MsSUFBWCxFQUFpQkMsS0FBakIsRUFBd0JDLFlBQXhCLEVBQXNDO0FBQ3ZELFVBQU1DLE9BQU8sR0FBRyxJQUFJUCxPQUFKLENBQVlFLElBQVosRUFBa0JDLEVBQWxCLENBQWhCO0FBQ0EsVUFBTUksT0FBTyxDQUFDQyxJQUFSLENBQWE7QUFBRUosTUFBQUEsSUFBRjtBQUFRQyxNQUFBQTtBQUFSLEtBQWIsQ0FBTjtBQUNBLFVBQU1FLE9BQU8sQ0FBQ0UsOEJBQVIsQ0FBdUNILFlBQXZDLENBQU4sQ0FIdUQsQ0FLdkQ7QUFDQTtBQUNBOztBQUNBLFVBQU1JLG9CQUFvQixHQUFHSCxPQUFPLENBQUNJLEdBQVIsQ0FBWSxZQUFaLENBQTdCO0FBQ0EsVUFBTUMsTUFBTSxHQUFHLEVBQWY7QUFDQSxVQUFNQyxtQkFBbUIsR0FBRyxFQUE1QjtBQUVBSCxJQUFBQSxvQkFBb0IsQ0FBQ0ksT0FBckIsQ0FBNkJDLFNBQVMsSUFBSTtBQUN4QyxZQUFNQyxLQUFLLEdBQUdELFNBQVMsQ0FBQ1gsSUFBeEI7QUFDQSxZQUFNYSxHQUFHLEdBQUcsQ0FBQ0QsS0FBRCxFQUFRRCxTQUFTLENBQUNYLElBQWxCLENBQVo7QUFDQVEsTUFBQUEsTUFBTSxDQUFDTSxJQUFQLENBQVlGLEtBQVo7QUFDQUgsTUFBQUEsbUJBQW1CLENB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Q0FBQ0UsR0FBRCxDQUFOO0FBQ0Q7O0FBRUQsY0FBTUMsYUFBYSxHQUFHViwwQkFBaUJXLGtCQUFqQixDQUFvQ3BJLEtBQXBDLENBQXRCOztBQUNBLGFBQUtZLEtBQUwsQ0FBV3pCLEdBQVgsQ0FBZTtBQUFFWSxVQUFBQSxRQUFRLEVBQUVBLFFBQVo7QUFBc0JDLFVBQUFBLEtBQUssRUFBRW1JO0FBQTdCLFNBQWYsRUFOd0IsQ0FReEI7O0FBQ0EsY0FBTUUsWUFBWSxHQUFHLElBQUl2QyxJQUFKLEdBQVdDLE9BQVgsS0FBdUJ1QixpQkFBNUM7QUFDQTNCLFFBQUFBLE9BQU8sQ0FBQ0MsR0FBUixDQUFhLEdBQUVKLFNBQVUscUJBQW9CNkMsWUFBYSxLQUExRCxFQVZ3QixDQVd4Qjs7QUFFQWxDLFFBQUFBLE9BQU87QUFDUixPQWREO0FBZUQsS0FoQk0sQ0FBUDtBQWlCRDs7QUF0ZVc7O2VBeWVDbkksTyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0IGZzIGZyb20gJ2ZzJztcbmltcG9ydCB7IHV1aWQgYXMgdXVpZHY0IH0gZnJvbSAndXVpZHY0JztcblxuaW1wb3J0IHhtbSBmcm9tICd4bW0tbm9kZSc7XG4vLyBpbXBvcnQgWG1tUHJvY2Vzc29yIGZyb20gJy4uL2NvbW1vbi9saWJzL21hbm8vWG1tUHJvY2Vzc29yLmpzJztcbmltcG9ydCByYXBpZE1peEFkYXB0ZXJzIGZyb20gJ3JhcGlkLW1peC1hZGFwdGVycyc7XG5cbmltcG9ydCBkYiBmcm9tICcuL3V0aWxzL2RiJztcbmltcG9ydCBkaWZmQXJyYXlzIGZyb20gJy4uL2NvbW1vbi91dGlscy9kaWZmQXJyYXlzLmpzJztcbmltcG9ydCBHcmFwaCBmcm9tICcuLi9jb21tb24vR3JhcGguanMnO1xuaW1wb3J0IE9mZmxpbmVTb3VyY2UgZnJvbSAnLi4vY29tbW9uL3NvdXJjZXMvT2ZmbGluZVNvdXJjZS5qcyc7XG5pbXBvcnQgY2xvbmVkZWVwIGZyb20gJ2xvZGFzaC5jbG9uZWRlZXAnO1xuXG5jbGFzcyBTZXNzaW9uIHtcblxuICAvKiogZmFjdG9yeSBtZXRob2RzICovXG4gIHN0YXRpYyBhc3luYyBjcmVhdGUoY29tbywgaWQsIG5hbWUsIGdyYXBoLCBmc0F1ZGlvRmlsZXMpIHtcbiAgICBjb25zdCBzZXNzaW9uID0gbmV3IFNlc3Npb24oY29tbywgaWQpO1xuICAgIGF3YWl0IHNlc3Npb24uaW5pdCh7IG5hbWUsIGdyYXBoIH0pO1xuICAgIGF3YWl0IHNlc3Npb24udXBkYXRlQXVkaW9GaWxlc0Zyb21GaWxlU3lzdGVtKGZzQXVkaW9GaWxlcyk7XG5cbiAgICAvLyBieSBkZWZhdWx0ICh0byBiZSBiYWNrd2FyZCB1c2FnZSBjb21wYXRpYmxlKTpcbiAgICAvLyAtIGxhYmVscyBhcmUgdGhlIGF1ZGlvIGZpbGVzIG5hbWVzIHdpdGhvdXQgZXh0ZW5zaW9uXG4gICAgLy8gLSBhIHJvdyA8bGFiZWwsIGF1ZGlvRmlsZT4gaXMgaW5zZXJ0ZWQgaW4gdGhlIGBsYWJlbEF1ZGlvRmlsZVRhYmxlYFxuICAgIGNvbnN0IHJlZ2lzdGVyZWRBdWRpb0ZpbGVzID0gc2Vzc2lvbi5nZXQoJ2F1ZGlvRmlsZXMnKTtcbiAgICBjb25zdCBsYWJlbHMgPSBbXTtcbiAgICBjb25zdCBsYWJlbEF1ZGlvRmlsZVRhYmxlID0gW107XG5cbiAgICByZWdpc3RlcmVkQXVkaW9GaWxlcy5mb3JFYWNoKGF1ZGlvRmlsZSA9PiB7XG4gICAgICBjb25zdCBsYWJlbCA9IGF1ZGlvRmlsZS5uYW1lO1xuICAgICAgY29uc3Qgcm93ID0gW2xhYmVsLCBhdWRpb0ZpbGUubmFtZV07XG4gICAgICBsYWJlbHMucHVzaChsYWJlbCk7XG4gICAgICBsYWJlbEF1ZGlvRmlsZVRhYmxlLnB1c2gocm93KTtcbiAgICB9KTtcblxuICAgIGF3YWl0IHNlc3Npb24uc2V0KHsgbGFiZWxzLCBsYWJlbEF1ZGlvRmlsZVRhYmxlIH0pO1xuICAgIGF3YWl0IHNlc3Npb24ucGVyc2lzdCgpO1xuXG4gICAgcmV0dXJuIHNlc3Npb247XG4gIH1cblxuICBzdGF0aWMgYXN5bmMgZnJvbUZpbGVTeXN0ZW0oY29tbywgZGlybmFtZSwgZnNBdWRpb0ZpbGVzKSB7XG4gICAgLy8gQG5vdGUgLSB2ZXJzaW9uIDAuMC4wIChjZi5tZXRhcylcbiAgICBjb25zdCBtZXRhcyA9IGF3YWl0IGRiLnJlYWQocGF0aC5qb2luKGRpcm5hbWUsICdtZXRhcy5qc29uJykpO1xuICAgIGNvbnN0IGRhdGFHcmFwaCA9IGF3YWl0IGRiLnJlYWQocGF0aC5qb2luKGRpcm5hbWUsIGBncmFwaC1kYXRhLmpzb25gKSk7XG4gICAgY29uc3QgYXVkaW9HcmFwaCA9IGF3YWl0IGRiLnJlYWQocGF0aC5qb2luKGRpcm5hbWUsIGBncmFwaC1hdWRpby5qc29uYCkpO1xuICAgIGNvbnN0IGxhYmVscyA9IGF3YWl0IGRiLnJlYWQocGF0aC5qb2luKGRpcm5hbWUsICdsYWJlbHMuanNvbicpKTtcbiAgICBjb25zdCBsYWJlbEF1ZGlvRmlsZVRhYmxlID0gYXdhaXQgZGIucmVhZChwYXRoLmpvaW4oZGlybmFtZSwgJ2xhYmVsLWF1ZGlvLWZpbGVzLXRhYmxlLmpzb24nKSk7XG4gICAgY29uc3QgbGVhcm5pbmdDb25maWcgPSBhd2FpdCBkYi5yZWFkKHBhdGguam9pbihkaXJuYW1lLCAnbWwtY29uZmlnLmpzb24nKSk7XG4gICAgY29uc3QgZXhhbXBsZXMgPSBhd2FpdCBkYi5yZWFkKHBhdGguam9pbihkaXJuYW1lLCAnLm1sLWV4YW1wbGVzLmpzb24nKSk7XG4gICAgY29uc3QgbW9kZWwgPSBhd2FpdCBkYi5yZWFkKHBhdGguam9pbihkaXJuYW1lLCAnLm1sLW1vZGVsLmpzb24nKSk7XG4gICAgY29uc3QgYXVkaW9GaWxlcyA9IGF3YWl0IGRiLnJlYWQocGF0aC5qb2luKGRpcm5hbWUsICcuYXVkaW8tZmlsZXMuanNvbicpKTtcblxuICAgIGNvbnN0IGlkID0gbWV0YXMuaWQ7XG4gICAgY29uc3QgY29uZmlnID0ge1xuICAgICAgbmFtZTogbWV0YXMubmFtZSxcbiAgICAgIGdyYXBoOiB7IGRhdGE6IGRhdGFHcmFwaCwgYXVkaW86IGF1ZGlvR3JhcGggfSxcbiAgICAgIGxhYmVscyxcbiAgICAgIGxhYmVsQXVkaW9GaWxlVGFibGUsXG4gICAgICBsZWFybmluZ0NvbmZpZyxcbiAgICAgIGV4YW1wbGVzLFxuICAgICAgbW9kZWwsXG4gICAgICBhdWRpb0ZpbGVzLFxuICAgIH07XG5cbiAgICBjb25zdCBzZXNzaW9uID0gbmV3IFNlc3Npb24oY29tbywgaWQpO1xuICAgIGF3YWl0IHNlc3Npb24uaW5pdChjb25maWcpO1xuICAgIGF3YWl0IHNlc3Npb24udXBkYXRlQXVkaW9GaWxlc0Zyb21GaWxlU3lzdGVtKGZzQXVkaW9GaWxlcyk7XG5cbiAgICByZXR1cm4gc2Vzc2lvbjtcbiAgfVxuXG4gIGNvbnN0cnVjdG9yKGNvbW8sIGlkKSB7XG4gICAgdGhpcy5jb21vID0gY29tbztcbiAgICB0aGlzLmlkID0gaWQ7XG5cbiAgICB0aGlzLmRpcmVjdG9yeSA9IHBhdGguam9pbih0aGlzLmNvbW8ucHJvamVjdERpcmVjdG9yeSwgJ3Nlc3Npb25zJywgaWQpO1xuXG4gICAgdGhpcy54bW1JbnN0YW5jZXMgPSB7XG4gICAgICAnZ21tJzogbmV3IHhtbSgnZ21tJyksXG4gICAgICAnaGhtbSc6IG5ldyB4bW0oJ2hobW0nKSxcbiAgICB9O1xuICB9XG5cbiAgYXN5bmMgcGVyc2lzdChrZXkgPSBudWxsKSB7XG4gICAgY29uc3QgdmFsdWVzID0gdGhpcy5zdGF0ZS5nZXRWYWx1ZXMoKTtcblxuICAgIGlmIChrZXkgPT09IG51bGwgfHzCoGtleSA9PT0gJ25hbWUnKSB7XG4gICAgICBjb25zdCB7IGlkLCBuYW1lIH0gPSB2YWx1ZXM7XG4gICAgICBhd2FpdCBkYi53cml0ZShwYXRoLmpvaW4odGhpcy5kaXJlY3RvcnksICdtZXRhcy5qc29uJyksIHsgaWQsIG5hbWUsIHZlcnNpb246ICcwLjAuMCcgfSk7XG4gICAgfVxuXG4gICAgaWYgKGtleSA9PT0gbnVsbCB8fMKga2V5ID09PSAnbGFiZWxzJykge1xuICAgICAgY29uc3QgeyBsYWJlbHMgfSA9IHZhbHVlcztcbiAgICAgIGF3YWl0IGRiLndyaXRlKHBhdGguam9pbih0aGlzLmRpcmVjdG9yeSwgJ2xhYmVscy5qc29uJyksIGxhYmVscyk7XG4gICAgfVxuXG4gICAgaWYgKGtleSA9PT0gbnVsbCB8fMKga2V5ID09PSAnbGFiZWxBdWRpb0ZpbGVUYWJsZScpIHtcbiAgICAgIGNvbnN0IHsgbGFiZWxBdWRpb0ZpbGVUYWJsZSB9ID0gdmFsdWVzO1xuICAgICAgYXdhaXQgZGIud3JpdGUocGF0aC5qb2luKHRoaXMuZGlyZWN0b3J5LCAnbGFiZWwtYXVkaW8tZmlsZXMtdGFibGUuanNvbicpLCBsYWJlbEF1ZGlvRmlsZVRhYmxlKTtcbiAgICB9XG5cbiAgICBpZiAoa2V5ID09PSBudWxsIHx8wqBrZXkgPT09ICdncmFwaCcgfHzCoGtleSA9PT0gJ2dyYXBoT3B0aW9ucycpIHtcbiAgICAgIC8vIHJlYXBwbHkgY3VycmVudCBncmFwaCBvcHRpb25zIGludG8gZ3JhcGggZGVmaW5pdGlvbnNcbiAgICAgIGNvbnN0IHsgZ3JhcGgsIGdyYXBoT3B0aW9ucyB9ID0gdmFsdWVzO1xuICAgICAgY29uc3QgdHlwZXMgPSBbJ2RhdGEnLCAnYXVkaW8nXTtcblxuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0eXBlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICBjb25zdCB0eXBlID0gdHlwZXNbaV07XG4gICAgICAgIGNvbnN0IHN1YkdyYXBoID0gZ3JhcGhbdHlwZV07XG5cbiAgICAgICAgc3ViR3JhcGgubW9kdWxlcy5mb3JFYWNoKGRlc2MgPT4ge1xuICAgICAgICAgIGlmIChPYmplY3Qua2V5cyhncmFwaE9wdGlvbnNbZGVzYy5pZF0pLmxlbmd0aCkge1xuICAgICAgICAgICAgZGVzYy5vcHRpb25zID0gZ3JhcGhPcHRpb25zW2Rlc2MuaWRdO1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cbiAgICAgICAgYXdhaXQgZGIud3JpdGUocGF0aC5qb2luKHRoaXMuZGlyZWN0b3J5LCBgZ3JhcGgtJHt0eXBlfS5qc29uYCksIHN1YkdyYXBoKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoa2V5ID09PSBudWxsIHx8wqBrZXkgPT09ICdsZWFybmluZ0NvbmZpZycpIHtcbiAgICAgIGNvbnN0IHsgbGVhcm5pbmdDb25maWcgfSA9IHZhbHVlcztcbiAgICAgIGF3YWl0IGRiLndyaXRlKHBhdGguam9pbih0aGlzLmRpcmVjdG9yeSwgJ21sLWNvbmZpZy5qc29uJyksIGxlYXJuaW5nQ29uZmlnKTtcbiAgICB9XG5cbiAgICAvLyBnZW5lcmF0ZWQgZmlsZXMsIGtlZXAgdGhlbSBoaWRkZW5cbiAgICBpZiAoa2V5ID09PSBudWxsIHx8wqBrZXkgPT09ICdleGFtcGxlcycpIHtcbiAgICAgIGNvbnN0IHsgZXhhbXBsZXMgfSA9IHZhbHVlcztcbiAgICAgIGF3YWl0IGRiLndyaXRlKHBhdGguam9pbih0aGlzLmRpcmVjdG9yeSwgJy5tbC1leGFtcGxlcy5qc29uJyksIGV4YW1wbGVzLCBmYWxzZSk7XG4gICAgfVxuXG4gICAgaWYgKGtleSA9PT0gbnVsbCB8fMKga2V5ID09PSAnbW9kZWwnKSB7XG4gICAgICBjb25zdCB7IG1vZGVsIH0gPSB2YWx1ZXM7XG4gICAgICBhd2FpdCBkYi53cml0ZShwYXRoLmpvaW4odGhpcy5kaXJlY3RvcnksICcubWwtbW9kZWwuanNvbicpLCBtb2RlbCwgZmFsc2UpO1xuICAgIH1cblxuICAgIGlmIChrZXkgPT09IG51bGwgfHzCoGtleSA9PT0gJ2F1ZGlvRmlsZXMnKSB7XG4gICAgICBjb25zdCB7IGF1ZGlvRmlsZXMgfSA9IHZhbHVlcztcbiAgICAgIGF3YWl0IGRiLndyaXRlKHBhdGguam9pbih0aGlzLmRpcmVjdG9yeSwgJy5hdWRpby1maWxlcy5qc29uJyksIGF1ZGlvRmlsZXMsIGZhbHNlKTtcbiAgICB9XG4gIH1cblxuICBnZXQobmFtZSkge1xuICAgIHJldHVybiB0aGlzLnN0YXRlLmdldChuYW1lKTtcbiAgfVxuXG4gIGdldFZhbHVlcygpIHtcbiAgICByZXR1cm4gdGhpcy5zdGF0ZS5nZXRWYWx1ZXMoKTtcbiAgfVxuXG4gIGFzeW5jIHNldCh1cGRhdGVzKSB7XG4gICAgYXdhaXQgdGhpcy5zdGF0ZS5zZXQodXBkYXRlcyk7XG4gIH1cblxuICBzdWJzY3JpYmUoZnVuYykge1xuICAgIHJldHVybiB0aGlzLnN0YXRlLnN1YnNjcmliZShmdW5jKTtcbiAgfVxuXG4gIGFzeW5jIGRlbGV0ZSgpIHtcbiAgICBhd2FpdCB0aGlzLnN0YXRlLmRldGFjaCgpO1xuICB9XG5cbiAgLyoqXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBpbml0VmFsdWVzXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBpbml0VmFsdWVzLmlkXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBpbml0VmFsdWVzLm5hbWVcbiAgICogQHBhcmFtIHtPYmplY3R9IGluaXRWYWx1ZXMuZ3JhcGhcbiAgICogQHBhcmFtIHtPYmplY3R9IFtpbml0VmFsdWVzLm1vZGVsXVxuICAgKiBAcGFyYW0ge09iamVjdH0gW2luaXRWYWx1ZXMuZXhhbXBsZXNdXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBbaW5pdFZhbHVlcy5sZWFybmluZ0NvbmZpZ11cbiAgICogQHBhcmFtIHtPYmplY3R9IFtpbml0VmFsdWVzLmF1ZGlvRmlsZXNdXG4gICAqL1xuICBhc3luYyBpbml0KGluaXRWYWx1ZXMpIHtcbiAgICBpbml0VmFsdWVzLmlkID0gdGhpcy5pZDtcbiAgICAvLyBleHRyYWN0IGdyYXBoIG9wdGlvbnMgZnJvbSBncmFwaCBkZWZpbml0aW9uXG4gICAgY29uc3QgbW9kdWxlcyA9IFsuLi5pbml0VmFsdWVzLmdyYXBoLmRhdGEubW9kdWxlcywgLi4uaW5pdFZhbHVlcy5ncmFwaC5hdWRpby5tb2R1bGVzXTtcblxuICAgIGluaXRWYWx1ZXMuZ3JhcGhPcHRpb25zID0gbW9kdWxlcy5yZWR1Y2UoKGFjYywgZGVzYykgPT4ge1xuICAgICAgYWNjW2Rlc2MuaWRdID0gZGVzYy5vcHRpb25zIHx8wqB7fTtcbiAgICAgIHJldHVybiBhY2M7XG4gICAgfSwge30pO1xuXG4gICAgdGhpcy5zdGF0ZSA9IGF3YWl0IHRoaXMuY29tby5zZXJ2ZXIuc3RhdGVNYW5hZ2VyLmNyZWF0ZShgc2Vzc2lvbmAsIGluaXRWYWx1ZXMpO1xuXG4gICAgdGhpcy5zdGF0ZS5zdWJzY3JpYmUoYXN5bmMgdXBkYXRlcyA9PiB7XG4gICAgICBmb3IgKGxldCBbbmFtZSwgdmFsdWVzXSBvZiBPYmplY3QuZW50cmllcyh1cGRhdGVzKSkge1xuICAgICAgICBzd2l0Y2ggKG5hbWUpIHtcbiAgICAgICAgICBjYXNlICdncmFwaE9wdGlvbnNFdmVudCc6IHtcbiAgICAgICAgICAgIGNvbnN0IGdyYXBoT3B0aW9ucyA9IHRoaXMuc3RhdGUuZ2V0KCdncmFwaE9wdGlvbnMnKTtcblxuICAgICAgICAgICAgZm9yIChsZXQgbW9kdWxlSWQgaW4gdmFsdWVzKSB7XG4gICAgICAgICAgICAgIC8vIGRlbGV0ZSBzY3JpcHRQYXJhbXMgb24gc2NyaXB0TmFtZSBjaGFuZ2VcbiAgICAgICAgICAgICAgaWYgKCdzY3JpcHROYW1lJyBpbiB2YWx1ZXNbbW9kdWxlSWRdKSB7XG4gICAgICAgICAgICAgICAgZGVsZXRlIGdyYXBoT3B0aW9uc1ttb2R1bGVJZF0uc2NyaXB0UGFyYW1zO1xuICAgICAgICAgICAgICAgIC8vIEB0b2RvIC0gdXBkYXRlIHRoZSBtb2RlbCB3aGVuIGEgZGF0YVNjcmlwdCBpcyB1cGRhdGVkLi4uXG4gICAgICAgICAgICAgICAgLy8gdGhpcy51cGRhdGVNb2RlbCh0aGlzLnN0YXRlLmdldCgnZXhhbXBsZXMnKSk7XG4gICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICBPYmplY3QuYXNzaWduKGdyYXBoT3B0aW9uc1ttb2R1bGVJZF0sIHZhbHVlc1ttb2R1bGVJZF0pO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0aGlzLnN0YXRlLnNldCh7IGdyYXBoT3B0aW9ucyB9KTtcblxuICAgICAgICAgICAgLy8gZm9yd2FyZCBldmVudCB0byBwbGF5ZXJzIGF0dGFjaGVkIHRvIHRoZSBzZXNzaW9uXG4gICAgICAgICAgICBBcnJheS5mcm9tKHRoaXMuY29tby5wcm9qZWN0LnBsYXllcnMudmFsdWVzKCkpXG4gICAgICAgICAgICAgIC5maWx0ZXIocGxheWVyID0+IHBsYXllci5nZXQoJ3Nlc3Npb25JZCcpID09PSB0aGlzLmlkKVxuICAgICAgICAgICAgICAuZm9yRWFjaChwbGF5ZXIgPT4gcGxheWVyLnNldCh7IGdyYXBoT3B0aW9uc0V2ZW50OiB2YWx1ZXMgfSkpO1xuXG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBjYXNlICdsZWFybmluZ0NvbmZpZyc6IHtcbiAgICAgICAgICAgIHRoaXMudXBkYXRlTW9kZWwoKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGF3YWl0IHRoaXMucGVyc2lzdChuYW1lKTtcbiAgICAgIH1cbiAgICB9KTtcblxuXG4gICAgLy8gaW5pdCBncmFwaFxuICAgIGNvbnN0IGdyYXBoRGVzY3JpcHRpb24gPSB0aGlzLnN0YXRlLmdldCgnZ3JhcGgnKTtcbiAgICBjb25zdCBkYXRhR3JhcGggPSBjbG9uZWRlZXAoZ3JhcGhEZXNjcmlwdGlvbi5kYXRhKTtcblxuICAgIGRhdGFHcmFwaC5tb2R1bGVzLmZvckVhY2gobW9kdWxlID0+IHtcbiAgICAgIGlmIChtb2R1bGUudHlwZSA9PT0gJ01MRGVjb2RlcicpIHtcbiAgICAgICAgbW9kdWxlLnR5cGUgPSAnQnVmZmVyJztcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIHRoaXMuZ3JhcGggPSBuZXcgR3JhcGgodGhpcy5jb21vLCB7IGRhdGE6IGRhdGFHcmFwaCB9LCB0aGlzLCBudWxsLCB0cnVlKTtcbiAgICBhd2FpdCB0aGlzLmdyYXBoLmluaXQoKTtcblxuICAgIC8vIGluaXQgbW9kZWxcbiAgICBhd2FpdCB0aGlzLnVwZGF0ZU1vZGVsKCk7XG4gIH1cblxuICBhc3luYyB1cGRhdGVBdWRpb0ZpbGVzRnJvbUZpbGVTeXN0ZW0oYXVkaW9GaWxlVHJlZSkge1xuICAgIGNvbnN0IGF1ZGlvRmlsZXMgPSB0aGlzLnN0YXRlLmdldCgnYXVkaW9GaWxlcycpO1xuICAgIGNvbnN0IHsgZGVsZXRlZCwgY3JlYXRlZCB9ID0gZGlmZkFycmF5cyhhdWRpb0ZpbGVzLCBhdWRpb0ZpbGVUcmVlLCBmID0+IGYudXJsKTtcblxuICAgIGNyZWF0ZWQuZm9yRWFjaChjcmVhdGVkRmlsZSA9PiB7XG4gICAgICBjb25zdCBjb3B5ID0gT2JqZWN0LmFzc2lnbih7fSwgY3JlYXRlZEZpbGUpO1xuICAgICAgY29weS5hY3RpdmUgPSB0cnVlO1xuXG4gICAgICBhdWRpb0ZpbGVzLnB1c2goY29weSk7XG4gICAgfSk7XG5cbiAgICBkZWxldGVkLmZvckVhY2goZGVsZXRlZEZpbGUgPT4ge1xuICAgICAgY29uc3QgaW5kZXggPSBhdWRpb0ZpbGVzLmZpbmRJbmRleChmID0+IGYudXJsID09PSBkZWxldGVkRmlsZS51cmwpO1xuICAgICAgYXVkaW9GaWxlcy5zcGxpY2UoaW5kZXgsIDEpO1xuICAgIH0pO1xuXG4gICAgYXdhaXQgdGhpcy5zdGF0ZS5zZXQoeyBhdWRpb0ZpbGVzIH0pO1xuICB9XG5cbiAgYWRkRXhhbXBsZShleGFtcGxlKSB7XG4gICAgY29uc3QgdXVpZCA9IHV1aWR2NCgpO1xuICAgIGNvbnN0IGV4YW1wbGVzID0gdGhpcy5zdGF0ZS5nZXQoJ2V4YW1wbGVzJyk7XG4gICAgZXhhbXBsZXNbdXVpZF0gPSBleGFtcGxlO1xuXG4gICAgdGhpcy51cGRhdGVNb2RlbChleGFtcGxlcyk7XG4gIH1cblxuICBkZWxldGVFeGFtcGxlKHV1aWQpIHtcbiAgICBjb25zdCBleGFtcGxlcyA9IHRoaXMuc3RhdGUuZ2V0KCdleGFtcGxlcycpO1xuXG4gICAgaWYgKHV1aWQgaW4gZXhhbXBsZXMpIHtcbiAgICAgIGRlbGV0ZSBleGFtcGxlc1t1dWlkXTtcbiAgICAgIHRoaXMudXBkYXRlTW9kZWwoZXhhbXBsZXMpO1xuICAgIH1cbiAgfVxuXG4gIGNsZWFyRXhhbXBsZXMobGFiZWwgPSBudWxsKSB7XG4gICAgY29uc3QgY2xlYXJlZEV4YW1wbGVzID0ge307XG5cbiAgICBpZiAobGFiZWwgIT09IG51bGwpIHtcbiAgICAgIGNvbnN0IGV4YW1wbGVzID0gdGhpcy5zdGF0ZS5nZXQoJ2V4YW1wbGVzJyk7XG5cbiAgICAgIGZvciAobGV0IHV1aWQgaW4gZXhhbXBsZXMpIHtcbiAgICAgICAgaWYgKGV4YW1wbGVzW3V1aWRdLmxhYmVsICE9PSBsYWJlbCkge1xuICAgICAgICAgIGNsZWFyZWRFeGFtcGxlc1t1dWlkXSA9IGV4YW1wbGVzW3V1aWRdO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgdGhpcy51cGRhdGVNb2RlbChjbGVhcmVkRXhhbXBsZXMpO1xuICB9XG5cbiAgY3JlYXRlTGFiZWwobGFiZWwpIHtcbiAgICBjb25zdCBsYWJlbHMgPSB0aGlzLnN0YXRlLmdldCgnbGFiZWxzJyk7XG5cbiAgICBpZiAobGFiZWxzLmluZGV4T2YobGFiZWwpID09PSAtMSkge1xuICAgICAgbGFiZWxzLnB1c2gobGFiZWwpO1xuXG4gICAgICB0aGlzLnN0YXRlLnNldCh7IGxhYmVscyB9KTtcbiAgICB9XG4gIH1cblxuICB1cGRhdGVMYWJlbChvbGRMYWJlbCwgbmV3TGFiZWwpIHtcbiAgICBjb25zdCB7IGxhYmVscywgbGFiZWxBdWRpb0ZpbGVUYWJsZSwgZXhhbXBsZXMgfSA9IHRoaXMuc3RhdGUuZ2V0VmFsdWVzKCk7XG5cbiAgICBpZiAobGFiZWxzLmluZGV4T2Yob2xkTGFiZWwpICE9PSAtMSAmJiBsYWJlbHMuaW5kZXhPZihuZXdMYWJlbCkgPT09IC0xKSB7XG4gICAgICBjb25zdCB1cGRhdGVkTGFiZWxzID0gbGFiZWxzLm1hcChsYWJlbCA9PiBsYWJlbCA9PT0gb2xkTGFiZWwgPyBuZXdMYWJlbCA6IGxhYmVsKTtcbiAgICAgIGNvbnN0IHVwZGF0ZWRUYWJsZSA9IGxhYmVsQXVkaW9GaWxlVGFibGUubWFwKHJvdyA9PiB7XG4gICAgICAgIGlmIChyb3dbMF0gPT09IG9sZExhYmVsKSB7XG4gICAgICAgICAgcm93WzBdID0gbmV3TGFiZWw7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gcm93O1xuICAgICAgfSk7XG5cbiAgICAgIC8vIHVwZGF0ZXMgbGFiZWxzIG9mIGV4aXN0aW5nIGV4YW1wbGVzXG4gICAgICBmb3IgKGxldCB1dWlkIGluIGV4YW1wbGVzKSB7XG4gICAgICAgIGNvbnN0IGV4YW1wbGUgPSBleGFtcGxlc1t1dWlkXTtcblxuICAgICAgICBpZiAoZXhhbXBsZS5sYWJlbCA9PT0gb2xkTGFiZWwpIHtcbiAgICAgICAgICBleGFtcGxlLmxhYmVsID0gbmV3TGFiZWw7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgdGhpcy51cGRhdGVNb2RlbChleGFtcGxlcyk7XG4gICAgICB0aGlzLnN0YXRlLnNldCh7XG4gICAgICAgIGxhYmVsczogdXBkYXRlZExhYmVscyxcbiAgICAgICAgbGFiZWxBdWRpb0ZpbGVUYWJsZTogdXBkYXRlZFRhYmxlLFxuICAgICAgfSk7XG4gICAgfVxuICB9XG5cbiAgZGVsZXRlTGFiZWwobGFiZWwpIHtcbiAgICBjb25zdCB7IGxhYmVscywgbGFiZWxBdWRpb0ZpbGVUYWJsZSwgZXhhbXBsZXMgfSA9IHRoaXMuc3RhdGUuZ2V0VmFsdWVzKCk7XG5cbiAgICBpZiAobGFiZWxzLmluZGV4T2YobGFiZWwpICE9PSAtMSkge1xuICAgICAgLy8gY2xlYW4gbGFiZWwgLyBhdWRpbyBmaWxlIHRhYmxlXG4gICAgICBjb25zdCBmaWx0ZXJlZExhYmVscyA9IGxhYmVscy5maWx0ZXIobCA9PiBsICE9PSBsYWJlbCk7XG4gICAgICBjb25zdCBmaWx0ZXJlZFRhYmxlID0gbGFiZWxBdWRpb0ZpbGVUYWJsZS5maWx0ZXIocm93ID0+IHJvd1swXSAhPT0gbGFiZWwpO1xuXG4gICAgICB0aGlzLmNsZWFyRXhhbXBsZXMobGFiZWwpOyAvLyB0aGlzIHJldHJhaW5zIHRoZSBtb2RlbFxuICAgICAgdGhpcy5zdGF0ZS5zZXQoe1xuICAgICAgICBsYWJlbHM6IGZpbHRlcmVkTGFiZWxzLFxuICAgICAgICBsYWJlbEF1ZGlvRmlsZVRhYmxlOiBmaWx0ZXJlZFRhYmxlLFxuICAgICAgfSk7XG4gICAgfVxuICB9XG5cbiAgdG9nZ2xlQXVkaW9GaWxlKGZpbGVuYW1lLCBhY3RpdmUpIHtcbiAgICBjb25zdCB7IGF1ZGlvRmlsZXMsIGxhYmVsQXVkaW9GaWxlVGFibGUgfSA9IHRoaXMuc3RhdGUuZ2V0VmFsdWVzKCk7XG5cbiAgICBjb25zdCBhdWRpb0ZpbGUgPSBhdWRpb0ZpbGVzLmZpbmQoZiA9PiBmLm5hbWUgPT09IGZpbGVuYW1lKTtcbiAgICBhdWRpb0ZpbGUuYWN0aXZlID0gYWN0aXZlO1xuXG4gICAgY29uc3QgdXBkYXRlZFRhYmxlID0gbGFiZWxBdWRpb0ZpbGVUYWJsZS5maWx0ZXIocm93ID0+IHJvd1sxXSAhPT0gZmlsZW5hbWUpO1xuXG4gICAgdGhpcy5zdGF0ZS5zZXQoe1xuICAgICAgYXVkaW9GaWxlcyxcbiAgICAgIGxhYmVsQXVkaW9GaWxlVGFibGU6IHVwZGF0ZWRUYWJsZSxcbiAgICB9KTtcbiAgfVxuXG4gIGNyZWF0ZUxhYmVsQXVkaW9GaWxlUm93KHJvdykge1xuICAgIGNvbnN0IGxhYmVsQXVkaW9GaWxlVGFibGUgPSB0aGlzLnN0YXRlLmdldCgnbGFiZWxBdWRpb0ZpbGVUYWJsZScpO1xuICAgIGNvbnN0IGluZGV4ID0gbGFiZWxBdWRpb0ZpbGVUYWJsZS5maW5kSW5kZXgociA9PiByWzBdID09PSByb3dbMF0gJiYgclsxXSA9PT0gcm93WzFdKTtcblxuICAgIGlmIChpbmRleCA9PT0gLTEpIHtcbiAgICAgIGxhYmVsQXVkaW9GaWxlVGFibGUucHVzaChyb3cpO1xuICAgICAgdGhpcy5zdGF0ZS5zZXQoeyBsYWJlbEF1ZGlvRmlsZVRhYmxlIH0pO1xuICAgIH1cbiAgfVxuXG4gIGRlbGV0ZUxhYmVsQXVkaW9GaWxlUm93KHJvdykge1xuICAgIGNvbnN0IGxhYmVsQXVkaW9GaWxlVGFibGUgPSB0aGlzLnN0YXRlLmdldCgnbGFiZWxBdWRpb0ZpbGVUYWJsZScpO1xuICAgIGNvbnN0IGZpbHRlcmVkVGFibGUgPSBsYWJlbEF1ZGlvRmlsZVRhYmxlLmZpbHRlcihyID0+IHtcbiAgICAgIHJldHVybiByWzBdID09PSByb3dbMF0gJiYgclsxXSA9PT0gcm93WzFdID8gZmFsc2UgOiB0cnVlO1xuICAgIH0pO1xuXG4gICAgdGhpcy5zdGF0ZS5zZXQoeyBsYWJlbEF1ZGlvRmlsZVRhYmxlOiBmaWx0ZXJlZFRhYmxlIH0pO1xuICB9XG5cbiAgYXN5bmMgdXBkYXRlTW9kZWwoZXhhbXBsZXMgPSBudWxsKSB7XG4gICAgaWYgKGV4YW1wbGVzID09PSBudWxsKSB7XG4gICAgICBleGFtcGxlcyA9IHRoaXMuc3RhdGUuZ2V0KCdleGFtcGxlcycpO1xuICAgIH1cblxuICAgIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgIGNvbnN0IGxvZ1ByZWZpeCA9IGBbc2Vzc2lvbiBcIiR7dGhpcy5zdGF0ZS5nZXQoJ2lkJyl9XCJdYDtcbiAgICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgICBjb25zdCBsYWJlbHMgPSBPYmplY3QudmFsdWVzKGV4YW1wbGVzKS5tYXAoZCA9PiBkLmxhYmVsKS5maWx0ZXIoKGQsIGksIGFycikgPT4gYXJyLmluZGV4T2YoZCkgPT09IGkpO1xuICAgIGNvbnNvbGUubG9nKGBcXG4ke2xvZ1ByZWZpeH0gPiBVUERBVEUgTU9ERUwgLSBsYWJlbHM6YCwgbGFiZWxzKTtcbiAgICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgICBjb25zdCBwcm9jZXNzaW5nU3RhcnRUaW1lID0gbmV3IERhdGUoKS5nZXRUaW1lKCk7XG4gICAgY29uc29sZS5sb2coYCR7bG9nUHJlZml4fSBwcm9jZXNzaW5nIHN0YXJ0XFx0KCMgZXhhbXBsZXM6ICR7T2JqZWN0LmtleXMoZXhhbXBsZXMpLmxlbmd0aH0pYCk7XG4gICAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbiAgICAvLyByZXBsYWNlIE1MRGVjb2RlciB3LyBEZXN0QnVmZmVyIGluIGdyYXBoIGZvciByZWNvcmRpbmcgdHJhbnNmb3JtZWQgc3RyZWFtXG4gICAgLy8gQG5vdGUgLSB0aGlzIGNhbiBvbmx5IHdvcmsgdy8gMSBvciAwIGRlY29kZXIsXG4gICAgLy8gQHRvZG8gLSBoYW5kbGUgY2FzZXMgdy8gMiBvciBtb3JlIGRlY29kZXJzIGxhdGVyLlxuICAgIGxldCBoYXNEZWNvZGVyID0gZmFsc2U7XG4gICAgbGV0IGJ1ZmZlciA9IG51bGw7XG5cbiAgICBmb3IgKGxldCBpZCBpbiB0aGlzLmdyYXBoLm1vZHVsZXMpIHtcbiAgICAgIGNvbnN0IG1vZHVsZSA9IHRoaXMuZ3JhcGgubW9kdWxlc1tpZF07XG5cbiAgICAgIGlmIChtb2R1bGUudHlwZSA9PT0gJ0J1ZmZlcicpIHtcbiAgICAgICAgaGFzRGVjb2RlciA9IHRydWU7XG4gICAgICAgIGJ1ZmZlciA9IG1vZHVsZTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoYnVmZmVyID09PSBudWxsKSB7XG4gICAgICBjb25zb2xlLmxvZyhgXFxuJHtsb2dQcmVmaXh9ID4gZ3JhcGggZG9lcyBub3QgY29udGFpbiBhbnkgTUxEZWNvZGVyLCBhYm9ydCB0cmFuaW5nLi4uYCk7XG4gICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCk7XG4gICAgfVxuXG4gICAgLy8gY29uc3QgYnVmZmVyID0gZ3JhcGguZ2V0TW9kdWxlKGJ1ZmZlcklkKTtcbiAgICBsZXQgb2ZmbGluZVNvdXJjZTtcblxuICAgIC8vIEBub3RlIC0gbWltaWMgcmFwaWQtbWl4IEFQSSwgcmVtb3ZlIC8gdXBkYXRlIGxhdGVyXG4gICAgY29uc3QgcHJvY2Vzc2VkRXhhbXBsZXMgPSB7XG4gICAgICBkb2NUeXBlOiAncmFwaWQtbWl4Om1sLXRyYWluaW5nLXNldCcsXG4gICAgICBkb2NWZXJzaW9uOiAnMS4wLjAnLFxuICAgICAgcGF5bG9hZDoge1xuICAgICAgICBpbnB1dERpbWVuc2lvbjogMCxcbiAgICAgICAgb3V0cHV0RGltZW5zaW9uOiAwLFxuICAgICAgICBkYXRhOiBbXSxcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBwcm9jZXNzIGV4YW1wbGVzIHJhdyBkYXRhIGluIHByZS1wcm9jZXNzaW5nIGdyYXBoXG4gICAgZm9yIChsZXQgdXVpZCBpbiBleGFtcGxlcykge1xuICAgICAgY29uc3QgZXhhbXBsZSA9IGV4YW1wbGVzW3V1aWRdO1xuXG4gICAgICBvZmZsaW5lU291cmNlID0gbmV3IE9mZmxpbmVTb3VyY2UoZXhhbXBsZS5pbnB1dCk7XG4gICAgICB0aGlzLmdyYXBoLnNldFNvdXJjZShvZmZsaW5lU291cmNlKTtcblxuICAgICAgLy8gcnVuIHRoZSBncmFwaCBvZmZsaW5lLCB0aGlzIE1VU1QgYmUgc3luY2hyb25vdXNcbiAgICAgIG9mZmxpbmVTb3VyY2UucnVuKCk7XG4gICAgICBjb25zdCB0cmFuc2Zvcm1lZFN0cmVhbSA9IGJ1ZmZlci5nZXREYXRhKCk7XG5cbiAgICAgIGlmIChleGFtcGxlLmlucHV0Lmxlbmd0aCAhPT0gdHJhbnNmb3JtZWRTdHJlYW0ubGVuZ3RoKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgJHtsb2dQcmVmaXh9IEVycm9yOiBpbmNvaGVyZW50IGV4YW1wbGUgcHJvY2Vzc2luZyBmb3IgZXhhbXBsZSAke3V1aWR9YCk7XG4gICAgICB9XG5cbiAgICAgIHRoaXMuZ3JhcGgucmVtb3ZlU291cmNlKG9mZmxpbmVTb3VyY2UpO1xuICAgICAgYnVmZmVyLnJlc2V0KCk7XG5cbiAgICAgIC8vIGFkZCB0byBwcm9jZXNzZWQgZXhhbXBsZXNcbiAgICAgIHByb2Nlc3NlZEV4YW1wbGVzLnBheWxvYWQuZGF0YS5wdXNoKHtcbiAgICAgICAgbGFiZWw6IGV4YW1wbGUubGFiZWwsXG4gICAgICAgIG91dHB1dDogZXhhbXBsZS5vdXRwdXQsXG4gICAgICAgIGlucHV0OiB0cmFuc2Zvcm1lZFN0cmVhbSxcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIGlmIChwcm9jZXNzZWRFeGFtcGxlcy5wYXlsb2FkLmRhdGFbMF0pIHtcbiAgICAgIHByb2Nlc3NlZEV4YW1wbGVzLnBheWxvYWQuaW5wdXREaW1lbnNpb24gPSBwcm9jZXNzZWRFeGFtcGxlcy5wYXlsb2FkLmRhdGFbMF0uaW5wdXRbMF0ubGVuZ3RoO1xuICAgIH1cblxuICAgIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgIGNvbnN0IHByb2Nlc3NpbmdUaW1lID0gbmV3IERhdGUoKS5nZXRUaW1lKCkgLSBwcm9jZXNzaW5nU3RhcnRUaW1lO1xuICAgIGNvbnNvbGUubG9nKGAke2xvZ1ByZWZpeH0gcHJvY2Vzc2luZyBlbmRcXHRcXHQoJHtwcm9jZXNzaW5nVGltZX1tcylgKTtcbiAgICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgICBjb25zdCB0cmFpbmluZ1N0YXJ0VGltZSA9IG5ldyBEYXRlKCkuZ2V0VGltZSgpO1xuICAgIGNvbnN0IG51bUlucHV0RGltZW5zaW9ucyA9IHByb2Nlc3NlZEV4YW1wbGVzLnBheWxvYWQuaW5wdXREaW1lbnNpb247XG4gICAgY29uc29sZS5sb2coYCR7bG9nUHJlZml4fSB0cmFpbmluZyBzdGFydFxcdFxcdCgjIGlucHV0IGRpbWVuc2lvbnM6ICR7bnVtSW5wdXREaW1lbnNpb25zfSlgKTtcbiAgICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuICAgIC8vIHRyYWluIG1vZGVsXG4gICAgLy8gQHRvZG8gLSBjbGVhbiB0aGlzIGYqKioqKiogbWVzc3kgTWFubyAvIFJhcGlkTWl4IC8gWG1tIGNvbnZlcnRpb25cbiAgICBjb25zdCB4bW1UcmFpbmluZ1NldCA9IHJhcGlkTWl4QWRhcHRlcnMucmFwaWRNaXhUb1htbVRyYWluaW5nU2V0KHByb2Nlc3NlZEV4YW1wbGVzKTtcblxuICAgIGNvbnN0IGxlYXJuaW5nQ29uZmlnID0gdGhpcy5zdGF0ZS5nZXQoJ2xlYXJuaW5nQ29uZmlnJyk7IC8vIG1hbm9cbiAgICBjb25zdCB4bW1Db25maWcgPSByYXBpZE1peEFkYXB0ZXJzLnJhcGlkTWl4VG9YbW1Db25maWcobGVhcm5pbmdDb25maWcpOyAvLyB4bW1cbiAgICAvLyBnZXQgKGdtbXxoaG1tKSB4bW0gaW5zdGFuY2VcbiAgICBjb25zdCB4bW0gPSB0aGlzLnhtbUluc3RhbmNlc1tsZWFybmluZ0NvbmZpZy5wYXlsb2FkLm1vZGVsVHlwZV07XG5cbiAgICB4bW0uc2V0Q29uZmlnKHhtbUNvbmZpZyk7XG4gICAgeG1tLnNldFRyYWluaW5nU2V0KHhtbVRyYWluaW5nU2V0KTtcblxuXG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgIHhtbS50cmFpbigoZXJyLCBtb2RlbCkgPT4ge1xuICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgcmVqZWN0KGVycik7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCByYXBpZE1peE1vZGVsID0gcmFwaWRNaXhBZGFwdGVycy54bW1Ub1JhcGlkTWl4TW9kZWwobW9kZWwpO1xuICAgICAgICB0aGlzLnN0YXRlLnNldCh7IGV4YW1wbGVzOiBleGFtcGxlcywgbW9kZWw6IHJhcGlkTWl4TW9kZWwgfSk7XG5cbiAgICAgICAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gICAgICAgIGNvbnN0IHRyYWluaW5nVGltZSA9IG5ldyBEYXRlKCkuZ2V0VGltZSgpIC0gdHJhaW5pbmdTdGFydFRpbWU7XG4gICAgICAgIGNvbnNvbGUubG9nKGAke2xvZ1ByZWZpeH0gdHJhaW5pbmcgZW5kXFx0XFx0KCR7dHJhaW5pbmdUaW1lfW1zKWApO1xuICAgICAgICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuICAgICAgICByZXNvbHZlKCk7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBTZXNzaW9uO1xuIl19