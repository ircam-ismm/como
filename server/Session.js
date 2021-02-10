"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _path = _interopRequireDefault(require("path"));

var _fs = _interopRequireDefault(require("fs"));

var _uuidv = require("uuidv4");

var _xmmNode = _interopRequireDefault(require("xmm-node"));

var _XmmProcessor = _interopRequireDefault(require("../common/libs/mano/XmmProcessor.js"));

var _rapidMixAdapters = _interopRequireDefault(require("rapid-mix-adapters"));

var _db = _interopRequireDefault(require("./utils/db"));

var _diffArrays = _interopRequireDefault(require("../common/utils/diffArrays.js"));

var _Graph = _interopRequireDefault(require("../common/Graph.js"));

var _OfflineSource = _interopRequireDefault(require("../common/sources/OfflineSource.js"));

var _lodash = _interopRequireDefault(require("lodash.clonedeep"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

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
    }; // @note - only used for config formatting
    // this should be simplified, the translation between xmm / mano / rapidmix
    // config format is really messy

    this.processor = new _XmmProcessor.default();
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

    this.processor.setConfig(learningConfig);
    const rapidMixConfig = this.processor.getConfig(); // rapidMix

    const xmmConfig = _rapidMixAdapters.default.rapidMixToXmmConfig(rapidMixConfig); // xmm
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9zZXJ2ZXIvU2Vzc2lvbi5qcyJdLCJuYW1lcyI6WyJTZXNzaW9uIiwiY3JlYXRlIiwiY29tbyIsImlkIiwibmFtZSIsImdyYXBoIiwiZnNBdWRpb0ZpbGVzIiwic2Vzc2lvbiIsImluaXQiLCJ1cGRhdGVBdWRpb0ZpbGVzRnJvbUZpbGVTeXN0ZW0iLCJyZWdpc3RlcmVkQXVkaW9GaWxlcyIsImdldCIsImxhYmVscyIsImxhYmVsQXVkaW9GaWxlVGFibGUiLCJmb3JFYWNoIiwiYXVkaW9GaWxlIiwibGFiZWwiLCJyb3ciLCJwdXNoIiwic2V0IiwicGVyc2lzdCIsImZyb21GaWxlU3lzdGVtIiwiZGlybmFtZSIsIm1ldGFzIiwiZGIiLCJyZWFkIiwicGF0aCIsImpvaW4iLCJkYXRhR3JhcGgiLCJhdWRpb0dyYXBoIiwibGVhcm5pbmdDb25maWciLCJleGFtcGxlcyIsIm1vZGVsIiwiYXVkaW9GaWxlcyIsImNvbmZpZyIsImRhdGEiLCJhdWRpbyIsImNvbnN0cnVjdG9yIiwiZGlyZWN0b3J5IiwicHJvamVjdERpcmVjdG9yeSIsInhtbUluc3RhbmNlcyIsInhtbSIsInByb2Nlc3NvciIsIlhtbVByb2Nlc3NvciIsImtleSIsInZhbHVlcyIsInN0YXRlIiwiZ2V0VmFsdWVzIiwid3JpdGUiLCJ2ZXJzaW9uIiwiZ3JhcGhPcHRpb25zIiwidHlwZXMiLCJpIiwibGVuZ3RoIiwidHlwZSIsInN1YkdyYXBoIiwibW9kdWxlcyIsImRlc2MiLCJPYmplY3QiLCJrZXlzIiwib3B0aW9ucyIsInVwZGF0ZXMiLCJzdWJzY3JpYmUiLCJmdW5jIiwiZGVsZXRlIiwiZGV0YWNoIiwiaW5pdFZhbHVlcyIsInJlZHVjZSIsImFjYyIsInNlcnZlciIsInN0YXRlTWFuYWdlciIsImVudHJpZXMiLCJtb2R1bGVJZCIsInNjcmlwdFBhcmFtcyIsImFzc2lnbiIsIkFycmF5IiwiZnJvbSIsInByb2plY3QiLCJwbGF5ZXJzIiwiZmlsdGVyIiwicGxheWVyIiwiZ3JhcGhPcHRpb25zRXZlbnQiLCJ1cGRhdGVNb2RlbCIsImdyYXBoRGVzY3JpcHRpb24iLCJtb2R1bGUiLCJHcmFwaCIsImF1ZGlvRmlsZVRyZWUiLCJkZWxldGVkIiwiY3JlYXRlZCIsImYiLCJ1cmwiLCJjcmVhdGVkRmlsZSIsImNvcHkiLCJhY3RpdmUiLCJkZWxldGVkRmlsZSIsImluZGV4IiwiZmluZEluZGV4Iiwic3BsaWNlIiwiYWRkRXhhbXBsZSIsImV4YW1wbGUiLCJ1dWlkIiwiZGVsZXRlRXhhbXBsZSIsImNsZWFyRXhhbXBsZXMiLCJjbGVhcmVkRXhhbXBsZXMiLCJjcmVhdGVMYWJlbCIsImluZGV4T2YiLCJ1cGRhdGVMYWJlbCIsIm9sZExhYmVsIiwibmV3TGFiZWwiLCJ1cGRhdGVkTGFiZWxzIiwibWFwIiwidXBkYXRlZFRhYmxlIiwiZGVsZXRlTGFiZWwiLCJmaWx0ZXJlZExhYmVscyIsImwiLCJmaWx0ZXJlZFRhYmxlIiwidG9nZ2xlQXVkaW9GaWxlIiwiZmlsZW5hbWUiLCJmaW5kIiwiY3JlYXRlTGFiZWxBdWRpb0ZpbGVSb3ciLCJyIiwiZGVsZXRlTGFiZWxBdWRpb0ZpbGVSb3ciLCJsb2dQcmVmaXgiLCJkIiwiYXJyIiwiY29uc29sZSIsImxvZyIsInByb2Nlc3NpbmdTdGFydFRpbWUiLCJEYXRlIiwiZ2V0VGltZSIsImhhc0RlY29kZXIiLCJidWZmZXIiLCJQcm9taXNlIiwicmVzb2x2ZSIsIm9mZmxpbmVTb3VyY2UiLCJwcm9jZXNzZWRFeGFtcGxlcyIsImRvY1R5cGUiLCJkb2NWZXJzaW9uIiwicGF5bG9hZCIsImlucHV0RGltZW5zaW9uIiwib3V0cHV0RGltZW5zaW9uIiwiT2ZmbGluZVNvdXJjZSIsImlucHV0Iiwic2V0U291cmNlIiwicnVuIiwidHJhbnNmb3JtZWRTdHJlYW0iLCJnZXREYXRhIiwiRXJyb3IiLCJyZW1vdmVTb3VyY2UiLCJyZXNldCIsIm91dHB1dCIsInByb2Nlc3NpbmdUaW1lIiwidHJhaW5pbmdTdGFydFRpbWUiLCJudW1JbnB1dERpbWVuc2lvbnMiLCJ4bW1UcmFpbmluZ1NldCIsInJhcGlkTWl4QWRhcHRlcnMiLCJyYXBpZE1peFRvWG1tVHJhaW5pbmdTZXQiLCJzZXRDb25maWciLCJyYXBpZE1peENvbmZpZyIsImdldENvbmZpZyIsInhtbUNvbmZpZyIsInJhcGlkTWl4VG9YbW1Db25maWciLCJtb2RlbFR5cGUiLCJzZXRUcmFpbmluZ1NldCIsInJlamVjdCIsInRyYWluIiwiZXJyIiwicmFwaWRNaXhNb2RlbCIsInhtbVRvUmFwaWRNaXhNb2RlbCIsInRyYWluaW5nVGltZSJdLCJtYXBwaW5ncyI6Ijs7Ozs7OztBQUFBOztBQUNBOztBQUNBOztBQUVBOztBQUNBOztBQUNBOztBQUVBOztBQUNBOztBQUNBOztBQUNBOztBQUNBOzs7O0FBRUEsTUFBTUEsT0FBTixDQUFjO0FBRVo7QUFDbUIsZUFBTkMsTUFBTSxDQUFDQyxJQUFELEVBQU9DLEVBQVAsRUFBV0MsSUFBWCxFQUFpQkMsS0FBakIsRUFBd0JDLFlBQXhCLEVBQXNDO0FBQ3ZELFVBQU1DLE9BQU8sR0FBRyxJQUFJUCxPQUFKLENBQVlFLElBQVosRUFBa0JDLEVBQWxCLENBQWhCO0FBQ0EsVUFBTUksT0FBTyxDQUFDQyxJQUFSLENBQWE7QUFBRUosTUFBQUEsSUFBRjtBQUFRQyxNQUFBQTtBQUFSLEtBQWIsQ0FBTjtBQUNBLFVBQU1FLE9BQU8sQ0FBQ0UsOEJBQVIsQ0FBdUNILFlBQXZDLENBQU4sQ0FIdUQsQ0FLdkQ7QUFDQTtBQUNBOztBQUNBLFVBQU1JLG9CQUFvQixHQUFHSCxPQUFPLENBQUNJLEdBQVIsQ0FBWSxZQUFaLENBQTdCO0FBQ0EsVUFBTUMsTUFBTSxHQUFHLEVBQWY7QUFDQSxVQUFNQyxtQkFBbUIsR0FBRyxFQUE1QjtBQUVBSCxJQUFBQSxvQkFBb0IsQ0FBQ0ksT0FBckIsQ0FBNkJDLFNBQVMsSUFBSTtBQUN4QyxZQUFNQyxLQUFLLEdBQUdELFNBQVMsQ0FBQ1gsSUFBeEI7QUFDQSxZQUFNYSxHQUFHLEdBQUcsQ0FBQ0QsS0FBRCxFQUFRRCxTQUFTLENBQUNYLElBQWxCLENBQVo7QUFD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R0FBRyxDQUFDb0gsU0FBSixDQUFjRyxTQUFkO0FBQ0F2SCxJQUFBQSxHQUFHLENBQUMwSCxjQUFKLENBQW1CVCxjQUFuQjtBQUdBLFdBQU8sSUFBSXRCLE9BQUosQ0FBWSxDQUFDQyxPQUFELEVBQVUrQixNQUFWLEtBQXFCO0FBQ3RDM0gsTUFBQUEsR0FBRyxDQUFDNEgsS0FBSixDQUFVLENBQUNDLEdBQUQsRUFBTXRJLEtBQU4sS0FBZ0I7QUFDeEIsWUFBSXNJLEdBQUosRUFBUztBQUNQRixVQUFBQSxNQUFNLENBQUNFLEdBQUQsQ0FBTjtBQUNEOztBQUVELGNBQU1DLGFBQWEsR0FBR1osMEJBQWlCYSxrQkFBakIsQ0FBb0N4SSxLQUFwQyxDQUF0Qjs7QUFDQSxhQUFLYyxLQUFMLENBQVczQixHQUFYLENBQWU7QUFBRVksVUFBQUEsUUFBUSxFQUFFQSxRQUFaO0FBQXNCQyxVQUFBQSxLQUFLLEVBQUV1STtBQUE3QixTQUFmLEVBTndCLENBUXhCOztBQUNBLGNBQU1FLFlBQVksR0FBRyxJQUFJekMsSUFBSixHQUFXQyxPQUFYLEtBQXVCdUIsaUJBQTVDO0FBQ0EzQixRQUFBQSxPQUFPLENBQUNDLEdBQVIsQ0FBYSxHQUFFSixTQUFVLHFCQUFvQitDLFlBQWEsS0FBMUQsRUFWd0IsQ0FXeEI7O0FBRUFwQyxRQUFBQSxPQUFPO0FBQ1IsT0FkRDtBQWVELEtBaEJNLENBQVA7QUFpQkQ7O0FBN2VXOztlQWdmQ3JJLE8iLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCBmcyBmcm9tICdmcyc7XG5pbXBvcnQgeyB1dWlkIGFzIHV1aWR2NCB9IGZyb20gJ3V1aWR2NCc7XG5cbmltcG9ydCB4bW0gZnJvbSAneG1tLW5vZGUnO1xuaW1wb3J0IFhtbVByb2Nlc3NvciBmcm9tICcuLi9jb21tb24vbGlicy9tYW5vL1htbVByb2Nlc3Nvci5qcyc7XG5pbXBvcnQgcmFwaWRNaXhBZGFwdGVycyBmcm9tICdyYXBpZC1taXgtYWRhcHRlcnMnO1xuXG5pbXBvcnQgZGIgZnJvbSAnLi91dGlscy9kYic7XG5pbXBvcnQgZGlmZkFycmF5cyBmcm9tICcuLi9jb21tb24vdXRpbHMvZGlmZkFycmF5cy5qcyc7XG5pbXBvcnQgR3JhcGggZnJvbSAnLi4vY29tbW9uL0dyYXBoLmpzJztcbmltcG9ydCBPZmZsaW5lU291cmNlIGZyb20gJy4uL2NvbW1vbi9zb3VyY2VzL09mZmxpbmVTb3VyY2UuanMnO1xuaW1wb3J0IGNsb25lZGVlcCBmcm9tICdsb2Rhc2guY2xvbmVkZWVwJztcblxuY2xhc3MgU2Vzc2lvbiB7XG5cbiAgLyoqIGZhY3RvcnkgbWV0aG9kcyAqL1xuICBzdGF0aWMgYXN5bmMgY3JlYXRlKGNvbW8sIGlkLCBuYW1lLCBncmFwaCwgZnNBdWRpb0ZpbGVzKSB7XG4gICAgY29uc3Qgc2Vzc2lvbiA9IG5ldyBTZXNzaW9uKGNvbW8sIGlkKTtcbiAgICBhd2FpdCBzZXNzaW9uLmluaXQoeyBuYW1lLCBncmFwaCB9KTtcbiAgICBhd2FpdCBzZXNzaW9uLnVwZGF0ZUF1ZGlvRmlsZXNGcm9tRmlsZVN5c3RlbShmc0F1ZGlvRmlsZXMpO1xuXG4gICAgLy8gYnkgZGVmYXVsdCAodG8gYmUgYmFja3dhcmQgdXNhZ2UgY29tcGF0aWJsZSk6XG4gICAgLy8gLSBsYWJlbHMgYXJlIHRoZSBhdWRpbyBmaWxlcyBuYW1lcyB3aXRob3V0IGV4dGVuc2lvblxuICAgIC8vIC0gYSByb3cgPGxhYmVsLCBhdWRpb0ZpbGU+IGlzIGluc2VydGVkIGluIHRoZSBgbGFiZWxBdWRpb0ZpbGVUYWJsZWBcbiAgICBjb25zdCByZWdpc3RlcmVkQXVkaW9GaWxlcyA9IHNlc3Npb24uZ2V0KCdhdWRpb0ZpbGVzJyk7XG4gICAgY29uc3QgbGFiZWxzID0gW107XG4gICAgY29uc3QgbGFiZWxBdWRpb0ZpbGVUYWJsZSA9IFtdO1xuXG4gICAgcmVnaXN0ZXJlZEF1ZGlvRmlsZXMuZm9yRWFjaChhdWRpb0ZpbGUgPT4ge1xuICAgICAgY29uc3QgbGFiZWwgPSBhdWRpb0ZpbGUubmFtZTtcbiAgICAgIGNvbnN0IHJvdyA9IFtsYWJlbCwgYXVkaW9GaWxlLm5hbWVdO1xuICAgICAgbGFiZWxzLnB1c2gobGFiZWwpO1xuICAgICAgbGFiZWxBdWRpb0ZpbGVUYWJsZS5wdXNoKHJvdyk7XG4gICAgfSk7XG5cbiAgICBhd2FpdCBzZXNzaW9uLnNldCh7IGxhYmVscywgbGFiZWxBdWRpb0ZpbGVUYWJsZSB9KTtcbiAgICBhd2FpdCBzZXNzaW9uLnBlcnNpc3QoKTtcblxuICAgIHJldHVybiBzZXNzaW9uO1xuICB9XG5cbiAgc3RhdGljIGFzeW5jIGZyb21GaWxlU3lzdGVtKGNvbW8sIGRpcm5hbWUsIGZzQXVkaW9GaWxlcykge1xuICAgIC8vIEBub3RlIC0gdmVyc2lvbiAwLjAuMCAoY2YubWV0YXMpXG4gICAgY29uc3QgbWV0YXMgPSBhd2FpdCBkYi5yZWFkKHBhdGguam9pbihkaXJuYW1lLCAnbWV0YXMuanNvbicpKTtcbiAgICBjb25zdCBkYXRhR3JhcGggPSBhd2FpdCBkYi5yZWFkKHBhdGguam9pbihkaXJuYW1lLCBgZ3JhcGgtZGF0YS5qc29uYCkpO1xuICAgIGNvbnN0IGF1ZGlvR3JhcGggPSBhd2FpdCBkYi5yZWFkKHBhdGguam9pbihkaXJuYW1lLCBgZ3JhcGgtYXVkaW8uanNvbmApKTtcbiAgICBjb25zdCBsYWJlbHMgPSBhd2FpdCBkYi5yZWFkKHBhdGguam9pbihkaXJuYW1lLCAnbGFiZWxzLmpzb24nKSk7XG4gICAgY29uc3QgbGFiZWxBdWRpb0ZpbGVUYWJsZSA9IGF3YWl0IGRiLnJlYWQocGF0aC5qb2luKGRpcm5hbWUsICdsYWJlbC1hdWRpby1maWxlcy10YWJsZS5qc29uJykpO1xuICAgIGNvbnN0IGxlYXJuaW5nQ29uZmlnID0gYXdhaXQgZGIucmVhZChwYXRoLmpvaW4oZGlybmFtZSwgJ21sLWNvbmZpZy5qc29uJykpO1xuICAgIGNvbnN0IGV4YW1wbGVzID0gYXdhaXQgZGIucmVhZChwYXRoLmpvaW4oZGlybmFtZSwgJy5tbC1leGFtcGxlcy5qc29uJykpO1xuICAgIGNvbnN0IG1vZGVsID0gYXdhaXQgZGIucmVhZChwYXRoLmpvaW4oZGlybmFtZSwgJy5tbC1tb2RlbC5qc29uJykpO1xuICAgIGNvbnN0IGF1ZGlvRmlsZXMgPSBhd2FpdCBkYi5yZWFkKHBhdGguam9pbihkaXJuYW1lLCAnLmF1ZGlvLWZpbGVzLmpzb24nKSk7XG5cbiAgICBjb25zdCBpZCA9IG1ldGFzLmlkO1xuICAgIGNvbnN0IGNvbmZpZyA9IHtcbiAgICAgIG5hbWU6IG1ldGFzLm5hbWUsXG4gICAgICBncmFwaDogeyBkYXRhOiBkYXRhR3JhcGgsIGF1ZGlvOiBhdWRpb0dyYXBoIH0sXG4gICAgICBsYWJlbHMsXG4gICAgICBsYWJlbEF1ZGlvRmlsZVRhYmxlLFxuICAgICAgbGVhcm5pbmdDb25maWcsXG4gICAgICBleGFtcGxlcyxcbiAgICAgIG1vZGVsLFxuICAgICAgYXVkaW9GaWxlcyxcbiAgICB9O1xuXG4gICAgY29uc3Qgc2Vzc2lvbiA9IG5ldyBTZXNzaW9uKGNvbW8sIGlkKTtcbiAgICBhd2FpdCBzZXNzaW9uLmluaXQoY29uZmlnKTtcbiAgICBhd2FpdCBzZXNzaW9uLnVwZGF0ZUF1ZGlvRmlsZXNGcm9tRmlsZVN5c3RlbShmc0F1ZGlvRmlsZXMpO1xuXG4gICAgcmV0dXJuIHNlc3Npb247XG4gIH1cblxuICBjb25zdHJ1Y3Rvcihjb21vLCBpZCkge1xuICAgIHRoaXMuY29tbyA9IGNvbW87XG4gICAgdGhpcy5pZCA9IGlkO1xuXG4gICAgdGhpcy5kaXJlY3RvcnkgPSBwYXRoLmpvaW4odGhpcy5jb21vLnByb2plY3REaXJlY3RvcnksICdzZXNzaW9ucycsIGlkKTtcblxuICAgIHRoaXMueG1tSW5zdGFuY2VzID0ge1xuICAgICAgJ2dtbSc6IG5ldyB4bW0oJ2dtbScpLFxuICAgICAgJ2hobW0nOiBuZXcgeG1tKCdoaG1tJyksXG4gICAgfTtcbiAgICAvLyBAbm90ZSAtIG9ubHkgdXNlZCBmb3IgY29uZmlnIGZvcm1hdHRpbmdcbiAgICAvLyB0aGlzIHNob3VsZCBiZSBzaW1wbGlmaWVkLCB0aGUgdHJhbnNsYXRpb24gYmV0d2VlbiB4bW0gLyBtYW5vIC8gcmFwaWRtaXhcbiAgICAvLyBjb25maWcgZm9ybWF0IGlzIHJlYWxseSBtZXNzeVxuICAgIHRoaXMucHJvY2Vzc29yID0gbmV3IFhtbVByb2Nlc3NvcigpO1xuICB9XG5cbiAgYXN5bmMgcGVyc2lzdChrZXkgPSBudWxsKSB7XG4gICAgY29uc3QgdmFsdWVzID0gdGhpcy5zdGF0ZS5nZXRWYWx1ZXMoKTtcblxuICAgIGlmIChrZXkgPT09IG51bGwgfHzCoGtleSA9PT0gJ25hbWUnKSB7XG4gICAgICBjb25zdCB7IGlkLCBuYW1lIH0gPSB2YWx1ZXM7XG4gICAgICBhd2FpdCBkYi53cml0ZShwYXRoLmpvaW4odGhpcy5kaXJlY3RvcnksICdtZXRhcy5qc29uJyksIHsgaWQsIG5hbWUsIHZlcnNpb246ICcwLjAuMCcgfSk7XG4gICAgfVxuXG4gICAgaWYgKGtleSA9PT0gbnVsbCB8fMKga2V5ID09PSAnbGFiZWxzJykge1xuICAgICAgY29uc3QgeyBsYWJlbHMgfSA9IHZhbHVlcztcbiAgICAgIGF3YWl0IGRiLndyaXRlKHBhdGguam9pbih0aGlzLmRpcmVjdG9yeSwgJ2xhYmVscy5qc29uJyksIGxhYmVscyk7XG4gICAgfVxuXG4gICAgaWYgKGtleSA9PT0gbnVsbCB8fMKga2V5ID09PSAnbGFiZWxBdWRpb0ZpbGVUYWJsZScpIHtcbiAgICAgIGNvbnN0IHsgbGFiZWxBdWRpb0ZpbGVUYWJsZSB9ID0gdmFsdWVzO1xuICAgICAgYXdhaXQgZGIud3JpdGUocGF0aC5qb2luKHRoaXMuZGlyZWN0b3J5LCAnbGFiZWwtYXVkaW8tZmlsZXMtdGFibGUuanNvbicpLCBsYWJlbEF1ZGlvRmlsZVRhYmxlKTtcbiAgICB9XG5cbiAgICBpZiAoa2V5ID09PSBudWxsIHx8wqBrZXkgPT09ICdncmFwaCcgfHzCoGtleSA9PT0gJ2dyYXBoT3B0aW9ucycpIHtcbiAgICAgIC8vIHJlYXBwbHkgY3VycmVudCBncmFwaCBvcHRpb25zIGludG8gZ3JhcGggZGVmaW5pdGlvbnNcbiAgICAgIGNvbnN0IHsgZ3JhcGgsIGdyYXBoT3B0aW9ucyB9ID0gdmFsdWVzO1xuICAgICAgY29uc3QgdHlwZXMgPSBbJ2RhdGEnLCAnYXVkaW8nXTtcblxuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0eXBlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICBjb25zdCB0eXBlID0gdHlwZXNbaV07XG4gICAgICAgIGNvbnN0IHN1YkdyYXBoID0gZ3JhcGhbdHlwZV07XG5cbiAgICAgICAgc3ViR3JhcGgubW9kdWxlcy5mb3JFYWNoKGRlc2MgPT4ge1xuICAgICAgICAgIGlmIChPYmplY3Qua2V5cyhncmFwaE9wdGlvbnNbZGVzYy5pZF0pLmxlbmd0aCkge1xuICAgICAgICAgICAgZGVzYy5vcHRpb25zID0gZ3JhcGhPcHRpb25zW2Rlc2MuaWRdO1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cbiAgICAgICAgYXdhaXQgZGIud3JpdGUocGF0aC5qb2luKHRoaXMuZGlyZWN0b3J5LCBgZ3JhcGgtJHt0eXBlfS5qc29uYCksIHN1YkdyYXBoKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoa2V5ID09PSBudWxsIHx8wqBrZXkgPT09ICdsZWFybmluZ0NvbmZpZycpIHtcbiAgICAgIGNvbnN0IHsgbGVhcm5pbmdDb25maWcgfSA9IHZhbHVlcztcbiAgICAgIGF3YWl0IGRiLndyaXRlKHBhdGguam9pbih0aGlzLmRpcmVjdG9yeSwgJ21sLWNvbmZpZy5qc29uJyksIGxlYXJuaW5nQ29uZmlnKTtcbiAgICB9XG5cbiAgICAvLyBnZW5lcmF0ZWQgZmlsZXMsIGtlZXAgdGhlbSBoaWRkZW5cbiAgICBpZiAoa2V5ID09PSBudWxsIHx8wqBrZXkgPT09ICdleGFtcGxlcycpIHtcbiAgICAgIGNvbnN0IHsgZXhhbXBsZXMgfSA9IHZhbHVlcztcbiAgICAgIGF3YWl0IGRiLndyaXRlKHBhdGguam9pbih0aGlzLmRpcmVjdG9yeSwgJy5tbC1leGFtcGxlcy5qc29uJyksIGV4YW1wbGVzLCBmYWxzZSk7XG4gICAgfVxuXG4gICAgaWYgKGtleSA9PT0gbnVsbCB8fMKga2V5ID09PSAnbW9kZWwnKSB7XG4gICAgICBjb25zdCB7IG1vZGVsIH0gPSB2YWx1ZXM7XG4gICAgICBhd2FpdCBkYi53cml0ZShwYXRoLmpvaW4odGhpcy5kaXJlY3RvcnksICcubWwtbW9kZWwuanNvbicpLCBtb2RlbCwgZmFsc2UpO1xuICAgIH1cblxuICAgIGlmIChrZXkgPT09IG51bGwgfHzCoGtleSA9PT0gJ2F1ZGlvRmlsZXMnKSB7XG4gICAgICBjb25zdCB7IGF1ZGlvRmlsZXMgfSA9IHZhbHVlcztcbiAgICAgIGF3YWl0IGRiLndyaXRlKHBhdGguam9pbih0aGlzLmRpcmVjdG9yeSwgJy5hdWRpby1maWxlcy5qc29uJyksIGF1ZGlvRmlsZXMsIGZhbHNlKTtcbiAgICB9XG4gIH1cblxuICBnZXQobmFtZSkge1xuICAgIHJldHVybiB0aGlzLnN0YXRlLmdldChuYW1lKTtcbiAgfVxuXG4gIGdldFZhbHVlcygpIHtcbiAgICByZXR1cm4gdGhpcy5zdGF0ZS5nZXRWYWx1ZXMoKTtcbiAgfVxuXG4gIGFzeW5jIHNldCh1cGRhdGVzKSB7XG4gICAgYXdhaXQgdGhpcy5zdGF0ZS5zZXQodXBkYXRlcyk7XG4gIH1cblxuICBzdWJzY3JpYmUoZnVuYykge1xuICAgIHJldHVybiB0aGlzLnN0YXRlLnN1YnNjcmliZShmdW5jKTtcbiAgfVxuXG4gIGFzeW5jIGRlbGV0ZSgpIHtcbiAgICBhd2FpdCB0aGlzLnN0YXRlLmRldGFjaCgpO1xuICB9XG5cbiAgLyoqXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBpbml0VmFsdWVzXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBpbml0VmFsdWVzLmlkXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBpbml0VmFsdWVzLm5hbWVcbiAgICogQHBhcmFtIHtPYmplY3R9IGluaXRWYWx1ZXMuZ3JhcGhcbiAgICogQHBhcmFtIHtPYmplY3R9IFtpbml0VmFsdWVzLm1vZGVsXVxuICAgKiBAcGFyYW0ge09iamVjdH0gW2luaXRWYWx1ZXMuZXhhbXBsZXNdXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBbaW5pdFZhbHVlcy5sZWFybmluZ0NvbmZpZ11cbiAgICogQHBhcmFtIHtPYmplY3R9IFtpbml0VmFsdWVzLmF1ZGlvRmlsZXNdXG4gICAqL1xuICBhc3luYyBpbml0KGluaXRWYWx1ZXMpIHtcbiAgICBpbml0VmFsdWVzLmlkID0gdGhpcy5pZDtcbiAgICAvLyBleHRyYWN0IGdyYXBoIG9wdGlvbnMgZnJvbSBncmFwaCBkZWZpbml0aW9uXG4gICAgY29uc3QgbW9kdWxlcyA9IFsuLi5pbml0VmFsdWVzLmdyYXBoLmRhdGEubW9kdWxlcywgLi4uaW5pdFZhbHVlcy5ncmFwaC5hdWRpby5tb2R1bGVzXTtcblxuICAgIGluaXRWYWx1ZXMuZ3JhcGhPcHRpb25zID0gbW9kdWxlcy5yZWR1Y2UoKGFjYywgZGVzYykgPT4ge1xuICAgICAgYWNjW2Rlc2MuaWRdID0gZGVzYy5vcHRpb25zIHx8wqB7fTtcbiAgICAgIHJldHVybiBhY2M7XG4gICAgfSwge30pO1xuXG4gICAgdGhpcy5zdGF0ZSA9IGF3YWl0IHRoaXMuY29tby5zZXJ2ZXIuc3RhdGVNYW5hZ2VyLmNyZWF0ZShgc2Vzc2lvbmAsIGluaXRWYWx1ZXMpO1xuXG4gICAgdGhpcy5zdGF0ZS5zdWJzY3JpYmUoYXN5bmMgdXBkYXRlcyA9PiB7XG4gICAgICBmb3IgKGxldCBbbmFtZSwgdmFsdWVzXSBvZiBPYmplY3QuZW50cmllcyh1cGRhdGVzKSkge1xuICAgICAgICBzd2l0Y2ggKG5hbWUpIHtcbiAgICAgICAgICBjYXNlICdncmFwaE9wdGlvbnNFdmVudCc6IHtcbiAgICAgICAgICAgIGNvbnN0IGdyYXBoT3B0aW9ucyA9IHRoaXMuc3RhdGUuZ2V0KCdncmFwaE9wdGlvbnMnKTtcblxuICAgICAgICAgICAgZm9yIChsZXQgbW9kdWxlSWQgaW4gdmFsdWVzKSB7XG4gICAgICAgICAgICAgIC8vIGRlbGV0ZSBzY3JpcHRQYXJhbXMgb24gc2NyaXB0TmFtZSBjaGFuZ2VcbiAgICAgICAgICAgICAgaWYgKCdzY3JpcHROYW1lJyBpbiB2YWx1ZXNbbW9kdWxlSWRdKSB7XG4gICAgICAgICAgICAgICAgZGVsZXRlIGdyYXBoT3B0aW9uc1ttb2R1bGVJZF0uc2NyaXB0UGFyYW1zO1xuICAgICAgICAgICAgICAgIC8vIEB0b2RvIC0gdXBkYXRlIHRoZSBtb2RlbCB3aGVuIGEgZGF0YVNjcmlwdCBpcyB1cGRhdGVkLi4uXG4gICAgICAgICAgICAgICAgLy8gdGhpcy51cGRhdGVNb2RlbCh0aGlzLnN0YXRlLmdldCgnZXhhbXBsZXMnKSk7XG4gICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICBPYmplY3QuYXNzaWduKGdyYXBoT3B0aW9uc1ttb2R1bGVJZF0sIHZhbHVlc1ttb2R1bGVJZF0pO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0aGlzLnN0YXRlLnNldCh7IGdyYXBoT3B0aW9ucyB9KTtcblxuICAgICAgICAgICAgLy8gZm9yd2FyZCBldmVudCB0byBwbGF5ZXJzIGF0dGFjaGVkIHRvIHRoZSBzZXNzaW9uXG4gICAgICAgICAgICBBcnJheS5mcm9tKHRoaXMuY29tby5wcm9qZWN0LnBsYXllcnMudmFsdWVzKCkpXG4gICAgICAgICAgICAgIC5maWx0ZXIocGxheWVyID0+IHBsYXllci5nZXQoJ3Nlc3Npb25JZCcpID09PSB0aGlzLmlkKVxuICAgICAgICAgICAgICAuZm9yRWFjaChwbGF5ZXIgPT4gcGxheWVyLnNldCh7IGdyYXBoT3B0aW9uc0V2ZW50OiB2YWx1ZXMgfSkpO1xuXG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBjYXNlICdsZWFybmluZ0NvbmZpZyc6IHtcbiAgICAgICAgICAgIHRoaXMudXBkYXRlTW9kZWwoKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGF3YWl0IHRoaXMucGVyc2lzdChuYW1lKTtcbiAgICAgIH1cbiAgICB9KTtcblxuXG4gICAgLy8gaW5pdCBncmFwaFxuICAgIGNvbnN0IGdyYXBoRGVzY3JpcHRpb24gPSB0aGlzLnN0YXRlLmdldCgnZ3JhcGgnKTtcbiAgICBjb25zdCBkYXRhR3JhcGggPSBjbG9uZWRlZXAoZ3JhcGhEZXNjcmlwdGlvbi5kYXRhKTtcblxuICAgIGRhdGFHcmFwaC5tb2R1bGVzLmZvckVhY2gobW9kdWxlID0+IHtcbiAgICAgIGlmIChtb2R1bGUudHlwZSA9PT0gJ01MRGVjb2RlcicpIHtcbiAgICAgICAgbW9kdWxlLnR5cGUgPSAnQnVmZmVyJztcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIHRoaXMuZ3JhcGggPSBuZXcgR3JhcGgodGhpcy5jb21vLCB7IGRhdGE6IGRhdGFHcmFwaCB9LCB0aGlzLCBudWxsLCB0cnVlKTtcbiAgICBhd2FpdCB0aGlzLmdyYXBoLmluaXQoKTtcblxuICAgIC8vIGluaXQgbW9kZWxcbiAgICBhd2FpdCB0aGlzLnVwZGF0ZU1vZGVsKCk7XG4gIH1cblxuICBhc3luYyB1cGRhdGVBdWRpb0ZpbGVzRnJvbUZpbGVTeXN0ZW0oYXVkaW9GaWxlVHJlZSkge1xuICAgIGNvbnN0IGF1ZGlvRmlsZXMgPSB0aGlzLnN0YXRlLmdldCgnYXVkaW9GaWxlcycpO1xuICAgIGNvbnN0IHsgZGVsZXRlZCwgY3JlYXRlZCB9ID0gZGlmZkFycmF5cyhhdWRpb0ZpbGVzLCBhdWRpb0ZpbGVUcmVlLCBmID0+IGYudXJsKTtcblxuICAgIGNyZWF0ZWQuZm9yRWFjaChjcmVhdGVkRmlsZSA9PiB7XG4gICAgICBjb25zdCBjb3B5ID0gT2JqZWN0LmFzc2lnbih7fSwgY3JlYXRlZEZpbGUpO1xuICAgICAgY29weS5hY3RpdmUgPSB0cnVlO1xuXG4gICAgICBhdWRpb0ZpbGVzLnB1c2goY29weSk7XG4gICAgfSk7XG5cbiAgICBkZWxldGVkLmZvckVhY2goZGVsZXRlZEZpbGUgPT4ge1xuICAgICAgY29uc3QgaW5kZXggPSBhdWRpb0ZpbGVzLmZpbmRJbmRleChmID0+IGYudXJsID09PSBkZWxldGVkRmlsZS51cmwpO1xuICAgICAgYXVkaW9GaWxlcy5zcGxpY2UoaW5kZXgsIDEpO1xuICAgIH0pO1xuXG4gICAgYXdhaXQgdGhpcy5zdGF0ZS5zZXQoeyBhdWRpb0ZpbGVzIH0pO1xuICB9XG5cbiAgYWRkRXhhbXBsZShleGFtcGxlKSB7XG4gICAgY29uc3QgdXVpZCA9IHV1aWR2NCgpO1xuICAgIGNvbnN0IGV4YW1wbGVzID0gdGhpcy5zdGF0ZS5nZXQoJ2V4YW1wbGVzJyk7XG4gICAgZXhhbXBsZXNbdXVpZF0gPSBleGFtcGxlO1xuXG4gICAgdGhpcy51cGRhdGVNb2RlbChleGFtcGxlcyk7XG4gIH1cblxuICBkZWxldGVFeGFtcGxlKHV1aWQpIHtcbiAgICBjb25zdCBleGFtcGxlcyA9IHRoaXMuc3RhdGUuZ2V0KCdleGFtcGxlcycpO1xuXG4gICAgaWYgKHV1aWQgaW4gZXhhbXBsZXMpIHtcbiAgICAgIGRlbGV0ZSBleGFtcGxlc1t1dWlkXTtcbiAgICAgIHRoaXMudXBkYXRlTW9kZWwoZXhhbXBsZXMpO1xuICAgIH1cbiAgfVxuXG4gIGNsZWFyRXhhbXBsZXMobGFiZWwgPSBudWxsKSB7XG4gICAgY29uc3QgY2xlYXJlZEV4YW1wbGVzID0ge307XG5cbiAgICBpZiAobGFiZWwgIT09IG51bGwpIHtcbiAgICAgIGNvbnN0IGV4YW1wbGVzID0gdGhpcy5zdGF0ZS5nZXQoJ2V4YW1wbGVzJyk7XG5cbiAgICAgIGZvciAobGV0IHV1aWQgaW4gZXhhbXBsZXMpIHtcbiAgICAgICAgaWYgKGV4YW1wbGVzW3V1aWRdLmxhYmVsICE9PSBsYWJlbCkge1xuICAgICAgICAgIGNsZWFyZWRFeGFtcGxlc1t1dWlkXSA9IGV4YW1wbGVzW3V1aWRdO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgdGhpcy51cGRhdGVNb2RlbChjbGVhcmVkRXhhbXBsZXMpO1xuICB9XG5cbiAgY3JlYXRlTGFiZWwobGFiZWwpIHtcbiAgICBjb25zdCBsYWJlbHMgPSB0aGlzLnN0YXRlLmdldCgnbGFiZWxzJyk7XG5cbiAgICBpZiAobGFiZWxzLmluZGV4T2YobGFiZWwpID09PSAtMSkge1xuICAgICAgbGFiZWxzLnB1c2gobGFiZWwpO1xuXG4gICAgICB0aGlzLnN0YXRlLnNldCh7IGxhYmVscyB9KTtcbiAgICB9XG4gIH1cblxuICB1cGRhdGVMYWJlbChvbGRMYWJlbCwgbmV3TGFiZWwpIHtcbiAgICBjb25zdCB7IGxhYmVscywgbGFiZWxBdWRpb0ZpbGVUYWJsZSwgZXhhbXBsZXMgfSA9IHRoaXMuc3RhdGUuZ2V0VmFsdWVzKCk7XG5cbiAgICBpZiAobGFiZWxzLmluZGV4T2Yob2xkTGFiZWwpICE9PSAtMSAmJiBsYWJlbHMuaW5kZXhPZihuZXdMYWJlbCkgPT09IC0xKSB7XG4gICAgICBjb25zdCB1cGRhdGVkTGFiZWxzID0gbGFiZWxzLm1hcChsYWJlbCA9PiBsYWJlbCA9PT0gb2xkTGFiZWwgPyBuZXdMYWJlbCA6IGxhYmVsKTtcbiAgICAgIGNvbnN0IHVwZGF0ZWRUYWJsZSA9IGxhYmVsQXVkaW9GaWxlVGFibGUubWFwKHJvdyA9PiB7XG4gICAgICAgIGlmIChyb3dbMF0gPT09IG9sZExhYmVsKSB7XG4gICAgICAgICAgcm93WzBdID0gbmV3TGFiZWw7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gcm93O1xuICAgICAgfSk7XG5cbiAgICAgIC8vIHVwZGF0ZXMgbGFiZWxzIG9mIGV4aXN0aW5nIGV4YW1wbGVzXG4gICAgICBmb3IgKGxldCB1dWlkIGluIGV4YW1wbGVzKSB7XG4gICAgICAgIGNvbnN0IGV4YW1wbGUgPSBleGFtcGxlc1t1dWlkXTtcblxuICAgICAgICBpZiAoZXhhbXBsZS5sYWJlbCA9PT0gb2xkTGFiZWwpIHtcbiAgICAgICAgICBleGFtcGxlLmxhYmVsID0gbmV3TGFiZWw7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgdGhpcy51cGRhdGVNb2RlbChleGFtcGxlcyk7XG4gICAgICB0aGlzLnN0YXRlLnNldCh7XG4gICAgICAgIGxhYmVsczogdXBkYXRlZExhYmVscyxcbiAgICAgICAgbGFiZWxBdWRpb0ZpbGVUYWJsZTogdXBkYXRlZFRhYmxlLFxuICAgICAgfSk7XG4gICAgfVxuICB9XG5cbiAgZGVsZXRlTGFiZWwobGFiZWwpIHtcbiAgICBjb25zdCB7IGxhYmVscywgbGFiZWxBdWRpb0ZpbGVUYWJsZSwgZXhhbXBsZXMgfSA9IHRoaXMuc3RhdGUuZ2V0VmFsdWVzKCk7XG5cbiAgICBpZiAobGFiZWxzLmluZGV4T2YobGFiZWwpICE9PSAtMSkge1xuICAgICAgLy8gY2xlYW4gbGFiZWwgLyBhdWRpbyBmaWxlIHRhYmxlXG4gICAgICBjb25zdCBmaWx0ZXJlZExhYmVscyA9IGxhYmVscy5maWx0ZXIobCA9PiBsICE9PSBsYWJlbCk7XG4gICAgICBjb25zdCBmaWx0ZXJlZFRhYmxlID0gbGFiZWxBdWRpb0ZpbGVUYWJsZS5maWx0ZXIocm93ID0+IHJvd1swXSAhPT0gbGFiZWwpO1xuXG4gICAgICB0aGlzLmNsZWFyRXhhbXBsZXMobGFiZWwpOyAvLyB0aGlzIHJldHJhaW5zIHRoZSBtb2RlbFxuICAgICAgdGhpcy5zdGF0ZS5zZXQoe1xuICAgICAgICBsYWJlbHM6IGZpbHRlcmVkTGFiZWxzLFxuICAgICAgICBsYWJlbEF1ZGlvRmlsZVRhYmxlOiBmaWx0ZXJlZFRhYmxlLFxuICAgICAgfSk7XG4gICAgfVxuICB9XG5cbiAgdG9nZ2xlQXVkaW9GaWxlKGZpbGVuYW1lLCBhY3RpdmUpIHtcbiAgICBjb25zdCB7IGF1ZGlvRmlsZXMsIGxhYmVsQXVkaW9GaWxlVGFibGUgfSA9IHRoaXMuc3RhdGUuZ2V0VmFsdWVzKCk7XG5cbiAgICBjb25zdCBhdWRpb0ZpbGUgPSBhdWRpb0ZpbGVzLmZpbmQoZiA9PiBmLm5hbWUgPT09IGZpbGVuYW1lKTtcbiAgICBhdWRpb0ZpbGUuYWN0aXZlID0gYWN0aXZlO1xuXG4gICAgY29uc3QgdXBkYXRlZFRhYmxlID0gbGFiZWxBdWRpb0ZpbGVUYWJsZS5maWx0ZXIocm93ID0+IHJvd1sxXSAhPT0gZmlsZW5hbWUpO1xuXG4gICAgdGhpcy5zdGF0ZS5zZXQoe1xuICAgICAgYXVkaW9GaWxlcyxcbiAgICAgIGxhYmVsQXVkaW9GaWxlVGFibGU6IHVwZGF0ZWRUYWJsZSxcbiAgICB9KTtcbiAgfVxuXG4gIGNyZWF0ZUxhYmVsQXVkaW9GaWxlUm93KHJvdykge1xuICAgIGNvbnN0IGxhYmVsQXVkaW9GaWxlVGFibGUgPSB0aGlzLnN0YXRlLmdldCgnbGFiZWxBdWRpb0ZpbGVUYWJsZScpO1xuICAgIGNvbnN0IGluZGV4ID0gbGFiZWxBdWRpb0ZpbGVUYWJsZS5maW5kSW5kZXgociA9PiByWzBdID09PSByb3dbMF0gJiYgclsxXSA9PT0gcm93WzFdKTtcblxuICAgIGlmIChpbmRleCA9PT0gLTEpIHtcbiAgICAgIGxhYmVsQXVkaW9GaWxlVGFibGUucHVzaChyb3cpO1xuICAgICAgdGhpcy5zdGF0ZS5zZXQoeyBsYWJlbEF1ZGlvRmlsZVRhYmxlIH0pO1xuICAgIH1cbiAgfVxuXG4gIGRlbGV0ZUxhYmVsQXVkaW9GaWxlUm93KHJvdykge1xuICAgIGNvbnN0IGxhYmVsQXVkaW9GaWxlVGFibGUgPSB0aGlzLnN0YXRlLmdldCgnbGFiZWxBdWRpb0ZpbGVUYWJsZScpO1xuICAgIGNvbnN0IGZpbHRlcmVkVGFibGUgPSBsYWJlbEF1ZGlvRmlsZVRhYmxlLmZpbHRlcihyID0+IHtcbiAgICAgIHJldHVybiByWzBdID09PSByb3dbMF0gJiYgclsxXSA9PT0gcm93WzFdID8gZmFsc2UgOiB0cnVlO1xuICAgIH0pO1xuXG4gICAgdGhpcy5zdGF0ZS5zZXQoeyBsYWJlbEF1ZGlvRmlsZVRhYmxlOiBmaWx0ZXJlZFRhYmxlIH0pO1xuICB9XG5cbiAgYXN5bmMgdXBkYXRlTW9kZWwoZXhhbXBsZXMgPSBudWxsKSB7XG4gICAgaWYgKGV4YW1wbGVzID09PSBudWxsKSB7XG4gICAgICBleGFtcGxlcyA9IHRoaXMuc3RhdGUuZ2V0KCdleGFtcGxlcycpO1xuICAgIH1cblxuICAgIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgIGNvbnN0IGxvZ1ByZWZpeCA9IGBbc2Vzc2lvbiBcIiR7dGhpcy5zdGF0ZS5nZXQoJ2lkJyl9XCJdYDtcbiAgICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgICBjb25zdCBsYWJlbHMgPSBPYmplY3QudmFsdWVzKGV4YW1wbGVzKS5tYXAoZCA9PiBkLmxhYmVsKS5maWx0ZXIoKGQsIGksIGFycikgPT4gYXJyLmluZGV4T2YoZCkgPT09IGkpO1xuICAgIGNvbnNvbGUubG9nKGBcXG4ke2xvZ1ByZWZpeH0gPiBVUERBVEUgTU9ERUwgLSBsYWJlbHM6YCwgbGFiZWxzKTtcbiAgICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgICBjb25zdCBwcm9jZXNzaW5nU3RhcnRUaW1lID0gbmV3IERhdGUoKS5nZXRUaW1lKCk7XG4gICAgY29uc29sZS5sb2coYCR7bG9nUHJlZml4fSBwcm9jZXNzaW5nIHN0YXJ0XFx0KCMgZXhhbXBsZXM6ICR7T2JqZWN0LmtleXMoZXhhbXBsZXMpLmxlbmd0aH0pYCk7XG4gICAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbiAgICAvLyByZXBsYWNlIE1MRGVjb2RlciB3LyBEZXN0QnVmZmVyIGluIGdyYXBoIGZvciByZWNvcmRpbmcgdHJhbnNmb3JtZWQgc3RyZWFtXG4gICAgLy8gQG5vdGUgLSB0aGlzIGNhbiBvbmx5IHdvcmsgdy8gMSBvciAwIGRlY29kZXIsXG4gICAgLy8gQHRvZG8gLSBoYW5kbGUgY2FzZXMgdy8gMiBvciBtb3JlIGRlY29kZXJzIGxhdGVyLlxuICAgIGxldCBoYXNEZWNvZGVyID0gZmFsc2U7XG4gICAgbGV0IGJ1ZmZlciA9IG51bGw7XG5cbiAgICBmb3IgKGxldCBpZCBpbiB0aGlzLmdyYXBoLm1vZHVsZXMpIHtcbiAgICAgIGNvbnN0IG1vZHVsZSA9IHRoaXMuZ3JhcGgubW9kdWxlc1tpZF07XG5cbiAgICAgIGlmIChtb2R1bGUudHlwZSA9PT0gJ0J1ZmZlcicpIHtcbiAgICAgICAgaGFzRGVjb2RlciA9IHRydWU7XG4gICAgICAgIGJ1ZmZlciA9IG1vZHVsZTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoYnVmZmVyID09PSBudWxsKSB7XG4gICAgICBjb25zb2xlLmxvZyhgXFxuJHtsb2dQcmVmaXh9ID4gZ3JhcGggZG9lcyBub3QgY29udGFpbiBhbnkgTUxEZWNvZGVyLCBhYm9ydCB0cmFuaW5nLi4uYCk7XG4gICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCk7XG4gICAgfVxuXG4gICAgLy8gY29uc3QgYnVmZmVyID0gZ3JhcGguZ2V0TW9kdWxlKGJ1ZmZlcklkKTtcbiAgICBsZXQgb2ZmbGluZVNvdXJjZTtcblxuICAgIC8vIEBub3RlIC0gbWltaWMgcmFwaWQtbWl4IEFQSSwgcmVtb3ZlIC8gdXBkYXRlIGxhdGVyXG4gICAgY29uc3QgcHJvY2Vzc2VkRXhhbXBsZXMgPSB7XG4gICAgICBkb2NUeXBlOiAncmFwaWQtbWl4Om1sLXRyYWluaW5nLXNldCcsXG4gICAgICBkb2NWZXJzaW9uOiAnMS4wLjAnLFxuICAgICAgcGF5bG9hZDoge1xuICAgICAgICBpbnB1dERpbWVuc2lvbjogMCxcbiAgICAgICAgb3V0cHV0RGltZW5zaW9uOiAwLFxuICAgICAgICBkYXRhOiBbXSxcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBwcm9jZXNzIGV4YW1wbGVzIHJhdyBkYXRhIGluIHByZS1wcm9jZXNzaW5nIGdyYXBoXG4gICAgZm9yIChsZXQgdXVpZCBpbiBleGFtcGxlcykge1xuICAgICAgY29uc3QgZXhhbXBsZSA9IGV4YW1wbGVzW3V1aWRdO1xuXG4gICAgICBvZmZsaW5lU291cmNlID0gbmV3IE9mZmxpbmVTb3VyY2UoZXhhbXBsZS5pbnB1dCk7XG4gICAgICB0aGlzLmdyYXBoLnNldFNvdXJjZShvZmZsaW5lU291cmNlKTtcblxuICAgICAgLy8gcnVuIHRoZSBncmFwaCBvZmZsaW5lLCB0aGlzIE1VU1QgYmUgc3luY2hyb25vdXNcbiAgICAgIG9mZmxpbmVTb3VyY2UucnVuKCk7XG4gICAgICBjb25zdCB0cmFuc2Zvcm1lZFN0cmVhbSA9IGJ1ZmZlci5nZXREYXRhKCk7XG5cbiAgICAgIGlmIChleGFtcGxlLmlucHV0Lmxlbmd0aCAhPT0gdHJhbnNmb3JtZWRTdHJlYW0ubGVuZ3RoKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgJHtsb2dQcmVmaXh9IEVycm9yOiBpbmNvaGVyZW50IGV4YW1wbGUgcHJvY2Vzc2luZyBmb3IgZXhhbXBsZSAke3V1aWR9YCk7XG4gICAgICB9XG5cbiAgICAgIHRoaXMuZ3JhcGgucmVtb3ZlU291cmNlKG9mZmxpbmVTb3VyY2UpO1xuICAgICAgYnVmZmVyLnJlc2V0KCk7XG5cbiAgICAgIC8vIGFkZCB0byBwcm9jZXNzZWQgZXhhbXBsZXNcbiAgICAgIHByb2Nlc3NlZEV4YW1wbGVzLnBheWxvYWQuZGF0YS5wdXNoKHtcbiAgICAgICAgbGFiZWw6IGV4YW1wbGUubGFiZWwsXG4gICAgICAgIG91dHB1dDogZXhhbXBsZS5vdXRwdXQsXG4gICAgICAgIGlucHV0OiB0cmFuc2Zvcm1lZFN0cmVhbSxcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIGlmIChwcm9jZXNzZWRFeGFtcGxlcy5wYXlsb2FkLmRhdGFbMF0pIHtcbiAgICAgIHByb2Nlc3NlZEV4YW1wbGVzLnBheWxvYWQuaW5wdXREaW1lbnNpb24gPSBwcm9jZXNzZWRFeGFtcGxlcy5wYXlsb2FkLmRhdGFbMF0uaW5wdXRbMF0ubGVuZ3RoO1xuICAgIH1cblxuICAgIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgIGNvbnN0IHByb2Nlc3NpbmdUaW1lID0gbmV3IERhdGUoKS5nZXRUaW1lKCkgLSBwcm9jZXNzaW5nU3RhcnRUaW1lO1xuICAgIGNvbnNvbGUubG9nKGAke2xvZ1ByZWZpeH0gcHJvY2Vzc2luZyBlbmRcXHRcXHQoJHtwcm9jZXNzaW5nVGltZX1tcylgKTtcbiAgICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgICBjb25zdCB0cmFpbmluZ1N0YXJ0VGltZSA9IG5ldyBEYXRlKCkuZ2V0VGltZSgpO1xuICAgIGNvbnN0IG51bUlucHV0RGltZW5zaW9ucyA9IHByb2Nlc3NlZEV4YW1wbGVzLnBheWxvYWQuaW5wdXREaW1lbnNpb247XG4gICAgY29uc29sZS5sb2coYCR7bG9nUHJlZml4fSB0cmFpbmluZyBzdGFydFxcdFxcdCgjIGlucHV0IGRpbWVuc2lvbnM6ICR7bnVtSW5wdXREaW1lbnNpb25zfSlgKTtcbiAgICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuICAgIC8vIHRyYWluIG1vZGVsXG4gICAgLy8gQHRvZG8gLSBjbGVhbiB0aGlzIGYqKioqKiogbWVzc3kgTWFubyAvIFJhcGlkTWl4IC8gWG1tIGNvbnZlcnRpb25cbiAgICBjb25zdCB4bW1UcmFpbmluZ1NldCA9IHJhcGlkTWl4QWRhcHRlcnMucmFwaWRNaXhUb1htbVRyYWluaW5nU2V0KHByb2Nlc3NlZEV4YW1wbGVzKTtcblxuICAgIGNvbnN0IGxlYXJuaW5nQ29uZmlnID0gdGhpcy5zdGF0ZS5nZXQoJ2xlYXJuaW5nQ29uZmlnJyk7IC8vIG1hbm9cbiAgICB0aGlzLnByb2Nlc3Nvci5zZXRDb25maWcobGVhcm5pbmdDb25maWcpXG4gICAgY29uc3QgcmFwaWRNaXhDb25maWcgPSB0aGlzLnByb2Nlc3Nvci5nZXRDb25maWcoKTsgLy8gcmFwaWRNaXhcbiAgICBjb25zdCB4bW1Db25maWcgPSByYXBpZE1peEFkYXB0ZXJzLnJhcGlkTWl4VG9YbW1Db25maWcocmFwaWRNaXhDb25maWcpOyAvLyB4bW1cblxuICAgIC8vIGdldCAoZ21tfGhobW0pIHhtbSBpbnN0YW5jZVxuICAgIGNvbnN0IHhtbSA9IHRoaXMueG1tSW5zdGFuY2VzW2xlYXJuaW5nQ29uZmlnLnBheWxvYWQubW9kZWxUeXBlXTtcblxuICAgIHhtbS5zZXRDb25maWcoeG1tQ29uZmlnKTtcbiAgICB4bW0uc2V0VHJhaW5pbmdTZXQoeG1tVHJhaW5pbmdTZXQpO1xuXG5cbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgeG1tLnRyYWluKChlcnIsIG1vZGVsKSA9PiB7XG4gICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICByZWplY3QoZXJyKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHJhcGlkTWl4TW9kZWwgPSByYXBpZE1peEFkYXB0ZXJzLnhtbVRvUmFwaWRNaXhNb2RlbChtb2RlbCk7XG4gICAgICAgIHRoaXMuc3RhdGUuc2V0KHsgZXhhbXBsZXM6IGV4YW1wbGVzLCBtb2RlbDogcmFwaWRNaXhNb2RlbCB9KTtcblxuICAgICAgICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgICAgICAgY29uc3QgdHJhaW5pbmdUaW1lID0gbmV3IERhdGUoKS5nZXRUaW1lKCkgLSB0cmFpbmluZ1N0YXJ0VGltZTtcbiAgICAgICAgY29uc29sZS5sb2coYCR7bG9nUHJlZml4fSB0cmFpbmluZyBlbmRcXHRcXHQoJHt0cmFpbmluZ1RpbWV9bXMpYCk7XG4gICAgICAgIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4gICAgICAgIHJlc29sdmUoKTtcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IFNlc3Npb247XG4iXX0=