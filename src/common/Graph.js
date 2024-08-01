import clonedeep from 'lodash.clonedeep';

class Graph {
  /**
   * [player=null] - `player` is optionnal, as we might instanciate a graph
   * not related to a particular player (e.g. duplicate audio), each node
   * should be responsible to do the proper checks if it needs a player
   * (e.g. ExampleRecorder)
   *
   * Warning: we need to keep "session" and "player" because modules may use them
   *
   *
   *
   * @param {Boolean} slave - defines if the graph is slaved to
   */
  constructor(como, graphDescription, session, player = null, slave = false) {
    this.como = como;
    this.session = session;
    this.player = player;
    this.slave = slave;

    this.registeredModules = {};
    this.modules = {}; // <id, module>
    this.sources = new Set();

    // > handle slave and master graph
    // we define as "master" graph, a graph that is related to a "real" player
    // and as such should take care of handling the sampling rate of it's source
    // and be able to record examples, stream it's resampled source, and record
    // it (i.e. not a duplicated player, not the session's graph used for
    // training the model).
    graphDescription = clonedeep(graphDescription);
    this.inputId = graphDescription.data.modules.find(m => m.type === 'Input').id;

    if (!slave) {
      const dataDescription = graphDescription.data;
      const nodePrefix = parseInt(Math.random() * 1e6) + '';
      const originalInputId = this.inputId;
      this.inputId = `${nodePrefix}-input`;

      // add input and resampler before input
      dataDescription.modules.push(
        {
          id: this.inputId,
          type: 'Input',
        }, {
          id: `${nodePrefix}-resampler`,
          type: 'InputResampler',
          options: {
            resamplingPeriod: 0.02, // damn... @fixme - hard-coded value
          },
        }
      );

      dataDescription.connections.push(
        [this.inputId, `${nodePrefix}-resampler`],
        [`${nodePrefix}-resampler`, originalInputId]
      );

      // add ExampleRecorder, NetworkSend
      dataDescription.modules.push(
        {
          id: `${nodePrefix}-example-recorder`,
          type: 'ExampleRecorder',
        },
        {
          id: `${nodePrefix}-network-send`,
          type: 'NetworkSend',
        },
        {
          id: `${nodePrefix}-stream-recorder`,
          type: 'StreamRecorder',
        },
      );

      dataDescription.connections.push(
        [`${nodePrefix}-resampler`, `${nodePrefix}-example-recorder`],
        [`${nodePrefix}-resampler`, `${nodePrefix}-network-send`],
        [`${nodePrefix}-resampler`, `${nodePrefix}-stream-recorder`]
      );
    }

    this.description = graphDescription;

    const optionsSource = this.player ? this.player : this.session;
    this.options = optionsSource.get('graphOptions') || {};

    this.unsubscribeOptions = optionsSource.subscribe(updates => {
      for (let [name, values] of Object.entries(updates)) {
        switch (name) {
          case 'graphOptionsEvent': {
            console.log('Graph subscribe called', Object.keys(values));
            for (let moduleId in values) {
              const module = this.modules[moduleId];
              // we need this check because some graphs may not have all
              // the modules instanciated (e.g. server-side audio graph nodes).
              if (module) {
                if (!(moduleId in this.options)) {
                  this.options[moduleId] = {};
                }

                Object.assign(this.options[moduleId], values[moduleId]);

                module.updateOptions(values[moduleId]);
              }
            }
            break;
          }
        }
      }
    });

    // register default modules
    // @note - this is not usable in real life because of the `Project.createGraph`
    // factory method, this should be fixed at some point...
    this.como.modules.forEach(ctor => this.registerModule(ctor));
  }

  registerModule(ctor) {
    const name = ctor.prototype.constructor.name;;
    this.registeredModules[name] = ctor;
  }

  /** @private */
  getModule(moduleId) {
    return this.modules[moduleId];
  }

  async init() {
    const graphs = Object.keys(this.description);

    for (let i = 0; i < graphs.length; i++) {
      const graph = graphs[i];
      const { modules, connections } = this.description[graph];

      for (let j = 0; j < modules.length; j++) {
        const { type, id } = modules[j];
        const options = this.options[id];
        await this.createNode(type, id, options);
      }

      connections.forEach(conn => {
        const sourceId = conn[0];
        const destId = conn[1];
        this.createConnection(sourceId, destId);
      });
    }

    if (this.description.data && this.description.audio) {
      const dataOutputId = this.description.data.modules.find(m => m.type === 'Output').id;

      this.description.audio.modules.forEach(module => {
        if (module.type !== 'AudioDestination') {
          this.createConnection(dataOutputId, module.id);
        }
      });
    }
  }

  async delete() {
    this.unsubscribeOptions();

    this.sources.forEach(source => source.removeAllListeners());
    this.sources.clear();
    // delete all nodes and connections
    for (let id in this.modules) {
      const module = this.modules[id];
      module.disconnect();
      module.destroy();
    }

    this.modules = {};
  }

  // @todo - implement deleteNode()
  async createNode(type, id, options) {
    const ctor = this.registeredModules[type];

    if (!ctor) {
      throw new Error(`[Graph::createNode] Undefined Node constructor: "${type}"`);
    }

    const module = new ctor(this, type, id, options);
    await module.init();

    this.modules[id] = module;
  }

  // @todo - allow id or node
  // @todo - implement deleteConnection()
  createConnection(sourceId, targetId) {
    const source = this.modules[sourceId];

    if (!source) {
      throw new Error(`[Graph::createConnection] Undefined source Node instance: "${sourceId}"
(connection: [${sourceId}, ${targetId}])`);
    }

    const target = this.modules[targetId];

    if (!target) {
      throw new Error(`[Graph::createConnection] Undefined target Node instance: "${targetId}"
(connection: [${sourceId}, ${targetId}])`);
    }

    source.connect(target);
  }

  /**
   * @todo - define how to change the source
   * @todo - allow multiple inputs
   */
  setSource(source, inputId = this.inputId) {
    const input = this.modules[inputId];
    // input.inputs.size = 1;
    source.addListener(rawData => input.process(rawData));

    this.sources.add(source);
  }

  removeSource(source) {
    source.removeAllListeners();
    this.sources.delete(source);
  }
}

export default Graph;
