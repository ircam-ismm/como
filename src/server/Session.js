import path from 'path';
import { uuid as uuidv4 } from 'uuidv4';

import xmm from 'xmm-node';
import XmmProcessor from '../common/libs/mano/XmmProcessor.js';
import rapidMixAdapters from 'rapid-mix-adapters';

import db from './utils/db';
import diffArrays from '../common/utils/diffArrays.js';
import Graph from '../common/Graph.js';
import BaseSource from '../common/sources/BaseSource.js';

// hardcoded subgraph for pre-processing
const processingModules = [
  {
    id: 'input',
    type: 'Input',
  },
  {
    id: 'motion-descriptors',
    type: 'MotionDescriptors',
    options: {
      resamplingPeriod: 0.02,
    },
  },
  {
    id: 'merge-descriptors',
    type: 'Merge',
  },
  {
    id: 'script-select-descriptors',
    type: 'ScriptData',
    options: {
      scriptName: 'default-ml-descriptors',
    },
  },
];

const processingConnections = [
  [ 'input', 'merge-descriptors' ],
  [ 'input', 'motion-descriptors' ],
  [ 'motion-descriptors', 'merge-descriptors' ],
  [ 'merge-descriptors', 'script-select-descriptors' ],
];

// this will be usefull client-side to plot recorded examples
class OfflineSource extends BaseSource {
  constructor(data) {
    super();
    this.data = data;
  }

  run() {
    this.data.forEach(frame => this.emit(frame));
  }
}

class DestBuffer {
  constructor() {
    this.inputs = new Set();
    this.output = new Set();
    this.data = [];
  }

  process(inputFrame) {
    const frame = [];

    for (let i = 0; i < inputFrame.data.length; i++) {
      frame[i] = inputFrame.data[i];
    }

    this.data.push(frame);
  }
}

class Session {

  /** factory methods */
  static async create(como, id, name, graph, audioFiles) {
    const session = new Session(como, id, name);
    await session.init({ id, name, graph });
    await session.updateAudioFilesFromFileSystem(audioFiles);

    await db.write(session.configFullPath, session.serialize());

    return session;
  }

  static async fromData(como, json, audioFiles) {
    const { name, id } = json;
    const session = new Session(como, id, name);
    await session.init(json);
    await session.updateAudioFilesFromFileSystem(audioFiles);

    return session;
  }

  constructor(como, id, name) {
    this.como = como;
    this.id = id;

    this.directory = path.join(this.como.projectDirectory, 'sessions', id);
    this.configFullPath = path.join(this.directory, `config.json`);
  }

  serialize() {
    // reapply graphOptions in graph definition and clean
    const values = this.state.getValues();
    const { graph, graphOptions } = values;

    graph.modules.forEach(desc => {
      if (Object.keys(graphOptions[desc.id]).length) {
        desc.options = graphOptions[desc.id];
      }
    });

    delete values.graphOptions;
    delete values.graphOptionsEvent;

    return values;
  }

  get(name) {
    if (name === 'graph') {
      return {
        modules: processingModules,
        connections: processingConnections,
      };
    } else {
      return this.state.get(name);
    }
  }

  subscribe(func) {
    return this.state.subscribe(func);
  }

  async delete() {
    await this.state.detach();
  }

  /**
   * All this subgraph stuff is really dirty... there is an architectural
   * problem here that should be solved at some point...
   */
  async init(initValues) {
    // extract graph options from graph definition
    initValues.graphOptions = initValues.graph.modules.reduce((acc, desc) => {
      acc[desc.id] = desc.options || {};
      return acc;
    }, {});

    this.state = await this.como.server.stateManager.create(`session`, initValues);

    this.state.subscribe(async updates => {
      // if updates['audioFiles'] => handle labels (old / new) and retrain model if needed
      // @todo - we should also take into account the `active` label
      // @note - this should probably be cleaned up when updated from file system too, TBC
      for (let [name, values] of Object.entries(updates)) {
        switch (name) {
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
              this.trainModel(examples);
            }
            break;
          }
          case 'graphOptionsEvent': {
            const graphOptions = this.state.get('graphOptions');

            for (let moduleId in values) {
              Object.assign(graphOptions[moduleId], values[moduleId]);
            }

            const players = Array.from(this.como.project.players.values())
              .filter(player => player.get('sessionId') === this.id)
              .forEach(player => player.set({ graphOptionsEvent: updates }));

            // find player attached to the session and forward event
          }
        }
      }

      await db.write(this.configFullPath, this.serialize());
    });

    // @todo - check that the graph topology is valid

    // ----- start dirty
    // @todo - review this part...
    // for now we have no way to dyamically modify the graph,
    // then this is ok (for now...)
    const graph = this.state.get('graph');

    this.graph = new Graph(
      this.como,
      this,
    );

    await this.graph.init();
    // ----- end dirty



    this.xmmInstances = {
      'gmm': new xmm('gmm'),
      'hhmm': new xmm('hhmm'),
    };
    // used for config formatting
    this.processor = new XmmProcessor();
    // retrain model on instanciation
    const examples = this.state.get('examples');
    await this.trainModel(examples);
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

    this.trainModel(examples);
  }

  deleteExample(uuid) {
    const examples = this.state.get('examples');

    if (uuid in examples) {
      delete examples[uuid];
      this.trainModel(examples);
    }
  }

  clearExamples() {
    const examples = {};
    this.trainModel(examples);
  }

  clearLabel(label) {
    const examples = this.state.get('examples');

    for (let uuid in examples) {
      const example = examples[uuid];

      if (example.label === label) {
        delete examples[uuid];
      }
    }

    this.trainModel(examples);
  }

  async trainModel(examples) {
    const VERBOSE = true;

    if (VERBOSE) {
      console.log(`\n[session "${this.state.get('id')}"] > TRAIN MODEL \
(# examples: ${Object.keys(examples).length})`);
    }
    // process each example into subgraph
    const processedExamples = {
      docType: 'rapid-mix:ml-training-set',
      docVersion: '1.0.0',
      payload: {
        inputDimension: 0,
        outputDimension: 0,
        data: [],
      }
    }

    if (VERBOSE) {
      console.log(`[session "${this.state.get('id')}"] processing examples start`);
    }

    const startTime = new Date().getTime();

    // process examples raw data in pre-processing graph
    for (let uuid in examples) {
      const example = examples[uuid];

      const offlineSource = new OfflineSource(example.input);
      const bufferDest = new DestBuffer();

      this.graph.setSource(offlineSource);
      this.graph.modules['script-select-descriptors'].connect(bufferDest);

      offlineSource.run(); // @important - everything must be synchronous here...

      const processedExample = {
        label: example.label,
        output: example.output,
        input: bufferDest.data
      };

      if (example.input.length !== processedExample.input.length) {
        throw new Error(`Session:trainModel - incoherent example processing for ${uuid}`);
      }

      // add to processed examples
      processedExamples.payload.data.push(processedExample);

      this.graph.modules['script-select-descriptors'].disconnect();
      this.graph.removeSource(offlineSource);
    }

    if (VERBOSE) {
      console.log(`[session "${this.state.get('id')}"] processing examples \
finished (${new Date().getTime() - startTime}ms)`);
    }

    console.log(`[session "${this.state.get('id')}"] training labels:`,
      [...new Set(processedExamples.payload.data.map(d => d.label))]);

    // -----------------------------------------------------------
    // this Mano / RapidMix / Xmm stuff is a f****** mess too...
    // -----------------------------------------------------------

    const model = {};

    // @note - these 2 guys are not really different...,
    // removing `this.processor` should not be a impossible problem
    const learningConfig = this.state.get('learningConfig');
    this.processor.setConfig(learningConfig);
    const rapidMixConfig = this.processor.getConfig();
    // console.log(learningConfig);
    // console.log(rapidMixConfig);

    if (processedExamples.payload.data[0]) {
      processedExamples.payload.inputDimension = processedExamples.payload.data[0].input[0].length;
    } else {
      processedExamples.payload.inputDimension = 0;
    }

    const xmmTrainingSet = rapidMixAdapters.rapidMixToXmmTrainingSet(processedExamples);
    const xmmConfig = rapidMixAdapters.rapidMixToXmmConfig(rapidMixConfig);

    const target = learningConfig.payload.modelType;
    const xmm = this.xmmInstances[target];

    xmm.setConfig(xmmConfig);
    xmm.setTrainingSet(xmmTrainingSet);

    return new Promise((resolve, reject) => {
      if (VERBOSE) {
        console.log(`[session "${this.state.get('id')}"] training start \
(input dimension: ${processedExamples.payload.inputDimension})}`);
      }

      const startTime = new Date().getTime();

      xmm.train((err, model) => {
        if (err) {
          reject(err);
        }

        if (VERBOSE) {
          console.log(`[session "${this.state.get('id')}"] training \
finished (${new Date().getTime() - startTime}ms)`);
        }

        const rapidMixModel = rapidMixAdapters.xmmToRapidMixModel(model);
        this.state.set({ examples: examples, model: rapidMixModel });

        resolve();
      });
    });
  }
}

export default Session;
