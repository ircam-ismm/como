import diffArrays from '../common/utils/diffArrays';

class Graph {
  /**
   * [player=null] - `player` is optionnal, as we might instanciate a graph
   * not related to a particular player (e.g. duplicate audio), each node
   * should be responsible to do the proper checks if it needs a player
   * (e.g. ExampleRecorder)
   */

  // move to (como, graphDescription, optionsSource <Session|Player>)
  constructor(como, session, player = null) {
    this.como = como;
    this.session = session;
    this.player = player;

    this.registeredModules = {};
    this.modules = {}; // <id, module>
    this.sources = new Set();

    this.description = this.session.get('graph');
    this.options = this.player ?
      this.player.get('graphOptions') : this.session.get('graphOptions');

    this.unsubscribeSession = this.session.subscribe(updates => {
      for (let [name, values] of Object.entries(updates)) {
        switch (name) {
          case 'graphOptionsEvent': {
            for (let moduleId in values) {
              Object.assign(this.options[moduleId], values[moduleId]);
              this._updateModuleOptions(moduleId, values[moduleId]);
            }
            break;
          }
        }
      }
    });

    this.unsubscribePlayer = this.player.subscribe(updates => {
      for (let [name, values] of Object.entries(updates)) {
        switch (name) {
          case 'graphOptionsEvent': {
            console.log()
            for (let moduleId in values) {
              Object.assign(this.options[moduleId], values[moduleId]);
              this._updateModuleOptions(moduleId, values[moduleId]);
            }
            break;
          }
        }
      }
    });

    // if (this.player) {
    //   this.player.subscribe(updates => {
    //     if ('graphOptionsOverrides' in updates) {
    //       const overrides = updates.graphOptionsOverrides;
    //       this._overrideGraphOptions(overrides);
    //     }
    //   });
    // }

    // register default modules
    // @note - this is not usable in real life because of the `Project.createGraph`
    // factory method, this should be fixed at some point
    this.como.modules.forEach(ctor => {
      this.registerModule(ctor);
    });
  }

  registerModule(ctor) {
    const name = ctor.prototype.constructor.name;;
    this.registeredModules[name] = ctor;
  }

  async init() {
    for (let i = 0; i < this.description.modules.length; i++) {
      const { type, id } = this.description.modules[i];
      const options = this.options[id];
      console.log(type, id, options);
      await this.createNode(type, id, options);
    }

    this.description.connections.forEach(conn => {
      const sourceId = conn[0];
      const destId = conn[1];
      this.createConnection(sourceId, destId);
    });
  }

  async delete() {
    this.unsubscribeSession();

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
  createConnection(sourceId, destId) {
    const source = this.modules[sourceId];

    if (!source) {
      throw new Error(`[Graph::createConnection] Undefined Node instance: "${sourceId}"`);
    }

    const dest = this.modules[destId];

    if (!dest) {
      throw new Error(`[Graph::createConnection] Undefined Node instance: "${destId}"`);
    }

    source.connect(dest);
  }

  /**
   * @todo - define how to change the source
   * @todo - allow multiple inputs
   */
  setSource(source, inputId = 'input') {
    const input = this.modules[inputId];
    // input.inputs.size = 1;
    source.addListener(rawData => {
      input.process(rawData);
    });

    this.sources.add(source);
  }

  removeSource(source) {
    source.removeAllListeners();
    this.sources.delete(source);
  }

  _updateModuleOptions(moduleId, options) {
    const module = this.modules[moduleId];
    // @note - we need this check because server-side graph may not have all
    // the modules instanciated (i.e. AudioModules). This should be removed
    // when the two graphs are seprated
    if (module) {
      module.updateOptions(options);
    }
  }
}

export default Graph;
