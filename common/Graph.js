"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _lodash = _interopRequireDefault(require("lodash.clonedeep"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

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

    this.sources = new Set(); // > handle slave and master graph
    // we define as "master" graph, a graph that is related to a "real" player
    // and as such should take care of handling the sampling rate of it's source
    // and be able to record examples, stream it's resampled source, and record
    // it (i.e. not a duplicated player, not the session's graph used for
    // training the model).

    graphDescription = (0, _lodash.default)(graphDescription);
    this.inputId = graphDescription.data.modules.find(m => m.type === 'Input').id;

    if (!slave) {
      const dataDescription = graphDescription.data;
      const nodePrefix = parseInt(Math.random() * 1e6) + '';
      const originalInputId = this.inputId;
      this.inputId = `${nodePrefix}-input`; // add input and resampler before input

      dataDescription.modules.push({
        id: this.inputId,
        type: 'Input'
      }, {
        id: `${nodePrefix}-resampler`,
        type: 'InputResampler',
        options: {
          resamplingPeriod: 0.02 // damn... @fixme - hard-coded value

        }
      });
      dataDescription.connections.push([this.inputId, `${nodePrefix}-resampler`], [`${nodePrefix}-resampler`, originalInputId]); // add ExampleRecorder, NetworkSend

      dataDescription.modules.push({
        id: `${nodePrefix}-example-recorder`,
        type: 'ExampleRecorder'
      }, {
        id: `${nodePrefix}-network-send`,
        type: 'NetworkSend'
      }, {
        id: `${nodePrefix}-stream-recorder`,
        type: 'StreamRecorder'
      });
      dataDescription.connections.push([`${nodePrefix}-resampler`, `${nodePrefix}-example-recorder`], [`${nodePrefix}-resampler`, `${nodePrefix}-network-send`], [`${nodePrefix}-resampler`, `${nodePrefix}-stream-recorder`]);
    }

    this.description = graphDescription;
    const optionsSource = this.player ? this.player : this.session;
    this.options = optionsSource.get('graphOptions'); // @todo - replace w/ optionsSource

    this.unsubscribeOptions = optionsSource.subscribe(updates => {
      for (let [name, values] of Object.entries(updates)) {
        switch (name) {
          case 'graphOptionsEvent':
            {
              for (let moduleId in values) {
                Object.assign(this.options[moduleId], values[moduleId]);
                const module = this.modules[moduleId]; // @note - we need this check because some graphs may not have all
                // the modules instanciated (e.g. server-side audio graph nodes).

                if (module) {
                  module.updateOptions(values[moduleId]);
                }
              }

              break;
            }
        }
      }
    }); // register default modules
    // @note - this is not usable in real life because of the `Project.createGraph`
    // factory method, this should be fixed at some point...

    this.como.modules.forEach(ctor => this.registerModule(ctor));
  }

  registerModule(ctor) {
    const name = ctor.prototype.constructor.name;
    ;
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
      const {
        modules,
        connections
      } = this.description[graph];

      for (let j = 0; j < modules.length; j++) {
        const {
          type,
          id
        } = modules[j];
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
    this.sources.clear(); // delete all nodes and connections

    for (let id in this.modules) {
      const module = this.modules[id];
      module.disconnect();
      module.destroy();
    }

    this.modules = {};
  } // @todo - implement deleteNode()


  async createNode(type, id, options) {
    const ctor = this.registeredModules[type];

    if (!ctor) {
      throw new Error(`[Graph::createNode] Undefined Node constructor: "${type}"`);
    }

    const module = new ctor(this, type, id, options);
    await module.init();
    this.modules[id] = module;
  } // @todo - allow id or node
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
    const input = this.modules[inputId]; // input.inputs.size = 1;

    source.addListener(rawData => input.process(rawData));
    this.sources.add(source);
  }

  removeSource(source) {
    source.removeAllListeners();
    this.sources.delete(source);
  }

}

var _default = Graph;
exports.default = _default;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9jb21tb24vR3JhcGguanMiXSwibmFtZXMiOlsiR3JhcGgiLCJjb25zdHJ1Y3RvciIsImNvbW8iLCJncmFwaERlc2NyaXB0aW9uIiwic2Vzc2lvbiIsInBsYXllciIsInNsYXZlIiwicmVnaXN0ZXJlZE1vZHVsZXMiLCJtb2R1bGVzIiwic291cmNlcyIsIlNldCIsImlucHV0SWQiLCJkYXRhIiwiZmluZCIsIm0iLCJ0eXBlIiwiaWQiLCJkYXRhRGVzY3JpcHRpb24iLCJub2RlUHJlZml4IiwicGFyc2VJbnQiLCJNYXRoIiwicmFuZG9tIiwib3JpZ2luYWxJbnB1dElkIiwicHVzaCIsIm9wdGlvbnMiLCJyZXNhbXBsaW5nUGVyaW9kIiwiY29ubmVjdGlvbnMiLCJkZXNjcmlwdGlvbiIsIm9wdGlvbnNTb3VyY2UiLCJnZXQiLCJ1bnN1YnNjcmliZU9wdGlvbnMiLCJzdWJzY3JpYmUiLCJ1cGRhdGVzIiwibmFtZSIsInZhbHVlcyIsIk9iamVjdCIsImVudHJpZXMiLCJtb2R1bGVJZCIsImFzc2lnbiIsIm1vZHVsZSIsInVwZGF0ZU9wdGlvbnMiLCJmb3JFYWNoIiwiY3RvciIsInJlZ2lzdGVyTW9kdWxlIiwicHJvdG90eXBlIiwiZ2V0TW9kdWxlIiwiaW5pdCIsImdyYXBocyIsImtleXMiLCJpIiwibGVuZ3RoIiwiZ3JhcGgiLCJqIiwiY3JlYXRlTm9kZSIsImNvbm4iLCJzb3VyY2VJZCIsImRlc3RJZCIsImNyZWF0ZUNvbm5lY3Rpb24iLCJhdWRpbyIsImRhdGFPdXRwdXRJZCIsImRlbGV0ZSIsInNvdXJjZSIsInJlbW92ZUFsbExpc3RlbmVycyIsImNsZWFyIiwiZGlzY29ubmVjdCIsImRlc3Ryb3kiLCJFcnJvciIsInRhcmdldElkIiwidGFyZ2V0IiwiY29ubmVjdCIsInNldFNvdXJjZSIsImlucHV0IiwiYWRkTGlzdGVuZXIiLCJyYXdEYXRhIiwicHJvY2VzcyIsImFkZCIsInJlbW92ZVNvdXJjZSJdLCJtYXBwaW5ncyI6Ijs7Ozs7OztBQUFB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QWpCO0FBQ0Q7O0FBRURlLEVBQUFBLFlBQVksQ0FBQ2YsTUFBRCxFQUFTO0FBQ25CQSxJQUFBQSxNQUFNLENBQUNDLGtCQUFQO0FBQ0EsU0FBS3JELE9BQUwsQ0FBYW1ELE1BQWIsQ0FBb0JDLE1BQXBCO0FBQ0Q7O0FBek5TOztlQTRORzdELEsiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgY2xvbmVkZWVwIGZyb20gJ2xvZGFzaC5jbG9uZWRlZXAnO1xuXG5jbGFzcyBHcmFwaCB7XG4gIC8qKlxuICAgKiBbcGxheWVyPW51bGxdIC0gYHBsYXllcmAgaXMgb3B0aW9ubmFsLCBhcyB3ZSBtaWdodCBpbnN0YW5jaWF0ZSBhIGdyYXBoXG4gICAqIG5vdCByZWxhdGVkIHRvIGEgcGFydGljdWxhciBwbGF5ZXIgKGUuZy4gZHVwbGljYXRlIGF1ZGlvKSwgZWFjaCBub2RlXG4gICAqIHNob3VsZCBiZSByZXNwb25zaWJsZSB0byBkbyB0aGUgcHJvcGVyIGNoZWNrcyBpZiBpdCBuZWVkcyBhIHBsYXllclxuICAgKiAoZS5nLiBFeGFtcGxlUmVjb3JkZXIpXG4gICAqXG4gICAqIFdhcm5pbmc6IHdlIG5lZWQgdG8ga2VlcCBcInNlc3Npb25cIiBhbmQgXCJwbGF5ZXJcIiBiZWNhdXNlIG1vZHVsZXMgbWF5IHVzZSB0aGVtXG4gICAqXG4gICAqXG4gICAqXG4gICAqIEBwYXJhbSB7Qm9vbGVhbn0gc2xhdmUgLSBkZWZpbmVzIGlmIHRoZSBncmFwaCBpcyBzbGF2ZWQgdG9cbiAgICovXG4gIGNvbnN0cnVjdG9yKGNvbW8sIGdyYXBoRGVzY3JpcHRpb24sIHNlc3Npb24sIHBsYXllciA9IG51bGwsIHNsYXZlID0gZmFsc2UpIHtcbiAgICB0aGlzLmNvbW8gPSBjb21vO1xuICAgIHRoaXMuc2Vzc2lvbiA9IHNlc3Npb247XG4gICAgdGhpcy5wbGF5ZXIgPSBwbGF5ZXI7XG4gICAgdGhpcy5zbGF2ZSA9IHNsYXZlO1xuXG4gICAgdGhpcy5yZWdpc3RlcmVkTW9kdWxlcyA9IHt9O1xuICAgIHRoaXMubW9kdWxlcyA9IHt9OyAvLyA8aWQsIG1vZHVsZT5cbiAgICB0aGlzLnNvdXJjZXMgPSBuZXcgU2V0KCk7XG5cbiAgICAvLyA+IGhhbmRsZSBzbGF2ZSBhbmQgbWFzdGVyIGdyYXBoXG4gICAgLy8gd2UgZGVmaW5lIGFzIFwibWFzdGVyXCIgZ3JhcGgsIGEgZ3JhcGggdGhhdCBpcyByZWxhdGVkIHRvIGEgXCJyZWFsXCIgcGxheWVyXG4gICAgLy8gYW5kIGFzIHN1Y2ggc2hvdWxkIHRha2UgY2FyZSBvZiBoYW5kbGluZyB0aGUgc2FtcGxpbmcgcmF0ZSBvZiBpdCdzIHNvdXJjZVxuICAgIC8vIGFuZCBiZSBhYmxlIHRvIHJlY29yZCBleGFtcGxlcywgc3RyZWFtIGl0J3MgcmVzYW1wbGVkIHNvdXJjZSwgYW5kIHJlY29yZFxuICAgIC8vIGl0IChpLmUuIG5vdCBhIGR1cGxpY2F0ZWQgcGxheWVyLCBub3QgdGhlIHNlc3Npb24ncyBncmFwaCB1c2VkIGZvclxuICAgIC8vIHRyYWluaW5nIHRoZSBtb2RlbCkuXG4gICAgZ3JhcGhEZXNjcmlwdGlvbiA9IGNsb25lZGVlcChncmFwaERlc2NyaXB0aW9uKTtcbiAgICB0aGlzLmlucHV0SWQgPSBncmFwaERlc2NyaXB0aW9uLmRhdGEubW9kdWxlcy5maW5kKG0gPT4gbS50eXBlID09PSAnSW5wdXQnKS5pZDtcblxuICAgIGlmICghc2xhdmUpIHtcbiAgICAgIGNvbnN0IGRhdGFEZXNjcmlwdGlvbiA9IGdyYXBoRGVzY3JpcHRpb24uZGF0YTtcbiAgICAgIGNvbnN0IG5vZGVQcmVmaXggPSBwYXJzZUludChNYXRoLnJhbmRvbSgpICogMWU2KSArICcnO1xuICAgICAgY29uc3Qgb3JpZ2luYWxJbnB1dElkID0gdGhpcy5pbnB1dElkO1xuICAgICAgdGhpcy5pbnB1dElkID0gYCR7bm9kZVByZWZpeH0taW5wdXRgO1xuXG4gICAgICAvLyBhZGQgaW5wdXQgYW5kIHJlc2FtcGxlciBiZWZvcmUgaW5wdXRcbiAgICAgIGRhdGFEZXNjcmlwdGlvbi5tb2R1bGVzLnB1c2goXG4gICAgICAgIHtcbiAgICAgICAgICBpZDogdGhpcy5pbnB1dElkLFxuICAgICAgICAgIHR5cGU6ICdJbnB1dCcsXG4gICAgICAgIH0sIHtcbiAgICAgICAgICBpZDogYCR7bm9kZVByZWZpeH0tcmVzYW1wbGVyYCxcbiAgICAgICAgICB0eXBlOiAnSW5wdXRSZXNhbXBsZXInLFxuICAgICAgICAgIG9wdGlvbnM6IHtcbiAgICAgICAgICAgIHJlc2FtcGxpbmdQZXJpb2Q6IDAuMDIsIC8vIGRhbW4uLi4gQGZpeG1lIC0gaGFyZC1jb2RlZCB2YWx1ZVxuICAgICAgICAgIH0sXG4gICAgICAgIH1cbiAgICAgICk7XG5cbiAgICAgIGRhdGFEZXNjcmlwdGlvbi5jb25uZWN0aW9ucy5wdXNoKFxuICAgICAgICBbdGhpcy5pbnB1dElkLCBgJHtub2RlUHJlZml4fS1yZXNhbXBsZXJgXSxcbiAgICAgICAgW2Ake25vZGVQcmVmaXh9LXJlc2FtcGxlcmAsIG9yaWdpbmFsSW5wdXRJZF1cbiAgICAgICk7XG5cbiAgICAgIC8vIGFkZCBFeGFtcGxlUmVjb3JkZXIsIE5ldHdvcmtTZW5kXG4gICAgICBkYXRhRGVzY3JpcHRpb24ubW9kdWxlcy5wdXNoKFxuICAgICAgICB7XG4gICAgICAgICAgaWQ6IGAke25vZGVQcmVmaXh9LWV4YW1wbGUtcmVjb3JkZXJgLFxuICAgICAgICAgIHR5cGU6ICdFeGFtcGxlUmVjb3JkZXInLFxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgaWQ6IGAke25vZGVQcmVmaXh9LW5ldHdvcmstc2VuZGAsXG4gICAgICAgICAgdHlwZTogJ05ldHdvcmtTZW5kJyxcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgIGlkOiBgJHtub2RlUHJlZml4fS1zdHJlYW0tcmVjb3JkZXJgLFxuICAgICAgICAgIHR5cGU6ICdTdHJlYW1SZWNvcmRlcicsXG4gICAgICAgIH0sXG4gICAgICApO1xuXG4gICAgICBkYXRhRGVzY3JpcHRpb24uY29ubmVjdGlvbnMucHVzaChcbiAgICAgICAgW2Ake25vZGVQcmVmaXh9LXJlc2FtcGxlcmAsIGAke25vZGVQcmVmaXh9LWV4YW1wbGUtcmVjb3JkZXJgXSxcbiAgICAgICAgW2Ake25vZGVQcmVmaXh9LXJlc2FtcGxlcmAsIGAke25vZGVQcmVmaXh9LW5ldHdvcmstc2VuZGBdLFxuICAgICAgICBbYCR7bm9kZVByZWZpeH0tcmVzYW1wbGVyYCwgYCR7bm9kZVByZWZpeH0tc3RyZWFtLXJlY29yZGVyYF1cbiAgICAgICk7XG4gICAgfVxuXG4gICAgdGhpcy5kZXNjcmlwdGlvbiA9IGdyYXBoRGVzY3JpcHRpb247XG5cbiAgICBjb25zdCBvcHRpb25zU291cmNlID0gdGhpcy5wbGF5ZXIgPyB0aGlzLnBsYXllciA6IHRoaXMuc2Vzc2lvbjtcbiAgICB0aGlzLm9wdGlvbnMgPSBvcHRpb25zU291cmNlLmdldCgnZ3JhcGhPcHRpb25zJyk7XG5cbiAgICAvLyBAdG9kbyAtIHJlcGxhY2Ugdy8gb3B0aW9uc1NvdXJjZVxuICAgIHRoaXMudW5zdWJzY3JpYmVPcHRpb25zID0gb3B0aW9uc1NvdXJjZS5zdWJzY3JpYmUodXBkYXRlcyA9PiB7XG4gICAgICBmb3IgKGxldCBbbmFtZSwgdmFsdWVzXSBvZiBPYmplY3QuZW50cmllcyh1cGRhdGVzKSkge1xuICAgICAgICBzd2l0Y2ggKG5hbWUpIHtcbiAgICAgICAgICBjYXNlICdncmFwaE9wdGlvbnNFdmVudCc6IHtcbiAgICAgICAgICAgIGZvciAobGV0IG1vZHVsZUlkIGluIHZhbHVlcykge1xuICAgICAgICAgICAgICBPYmplY3QuYXNzaWduKHRoaXMub3B0aW9uc1ttb2R1bGVJZF0sIHZhbHVlc1ttb2R1bGVJZF0pO1xuICAgICAgICAgICAgICBjb25zdCBtb2R1bGUgPSB0aGlzLm1vZHVsZXNbbW9kdWxlSWRdO1xuXG4gICAgICAgICAgICAgIC8vIEBub3RlIC0gd2UgbmVlZCB0aGlzIGNoZWNrIGJlY2F1c2Ugc29tZSBncmFwaHMgbWF5IG5vdCBoYXZlIGFsbFxuICAgICAgICAgICAgICAvLyB0aGUgbW9kdWxlcyBpbnN0YW5jaWF0ZWQgKGUuZy4gc2VydmVyLXNpZGUgYXVkaW8gZ3JhcGggbm9kZXMpLlxuICAgICAgICAgICAgICBpZiAobW9kdWxlKSB7XG4gICAgICAgICAgICAgICAgbW9kdWxlLnVwZGF0ZU9wdGlvbnModmFsdWVzW21vZHVsZUlkXSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0pO1xuXG4gICAgLy8gcmVnaXN0ZXIgZGVmYXVsdCBtb2R1bGVzXG4gICAgLy8gQG5vdGUgLSB0aGlzIGlzIG5vdCB1c2FibGUgaW4gcmVhbCBsaWZlIGJlY2F1c2Ugb2YgdGhlIGBQcm9qZWN0LmNyZWF0ZUdyYXBoYFxuICAgIC8vIGZhY3RvcnkgbWV0aG9kLCB0aGlzIHNob3VsZCBiZSBmaXhlZCBhdCBzb21lIHBvaW50Li4uXG4gICAgdGhpcy5jb21vLm1vZHVsZXMuZm9yRWFjaChjdG9yID0+IHRoaXMucmVnaXN0ZXJNb2R1bGUoY3RvcikpO1xuICB9XG5cbiAgcmVnaXN0ZXJNb2R1bGUoY3Rvcikge1xuICAgIGNvbnN0IG5hbWUgPSBjdG9yLnByb3RvdHlwZS5jb25zdHJ1Y3Rvci5uYW1lOztcbiAgICB0aGlzLnJlZ2lzdGVyZWRNb2R1bGVzW25hbWVdID0gY3RvcjtcbiAgfVxuXG4gIC8qKiBAcHJpdmF0ZSAqL1xuICBnZXRNb2R1bGUobW9kdWxlSWQpIHtcbiAgICByZXR1cm4gdGhpcy5tb2R1bGVzW21vZHVsZUlkXTtcbiAgfVxuXG4gIGFzeW5jIGluaXQoKSB7XG4gICAgY29uc3QgZ3JhcGhzID0gT2JqZWN0LmtleXModGhpcy5kZXNjcmlwdGlvbik7XG5cbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGdyYXBocy5sZW5ndGg7IGkrKykge1xuICAgICAgY29uc3QgZ3JhcGggPSBncmFwaHNbaV07XG4gICAgICBjb25zdCB7IG1vZHVsZXMsIGNvbm5lY3Rpb25zIH0gPSB0aGlzLmRlc2NyaXB0aW9uW2dyYXBoXTtcblxuICAgICAgZm9yIChsZXQgaiA9IDA7IGogPCBtb2R1bGVzLmxlbmd0aDsgaisrKSB7XG4gICAgICAgIGNvbnN0IHsgdHlwZSwgaWQgfSA9IG1vZHVsZXNbal07XG4gICAgICAgIGNvbnN0IG9wdGlvbnMgPSB0aGlzLm9wdGlvbnNbaWRdO1xuICAgICAgICBhd2FpdCB0aGlzLmNyZWF0ZU5vZGUodHlwZSwgaWQsIG9wdGlvbnMpO1xuICAgICAgfVxuXG4gICAgICBjb25uZWN0aW9ucy5mb3JFYWNoKGNvbm4gPT4ge1xuICAgICAgICBjb25zdCBzb3VyY2VJZCA9IGNvbm5bMF07XG4gICAgICAgIGNvbnN0IGRlc3RJZCA9IGNvbm5bMV07XG4gICAgICAgIHRoaXMuY3JlYXRlQ29ubmVjdGlvbihzb3VyY2VJZCwgZGVzdElkKTtcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIGlmICh0aGlzLmRlc2NyaXB0aW9uLmRhdGEgJiYgdGhpcy5kZXNjcmlwdGlvbi5hdWRpbykge1xuICAgICAgY29uc3QgZGF0YU91dHB1dElkID0gdGhpcy5kZXNjcmlwdGlvbi5kYXRhLm1vZHVsZXMuZmluZChtID0+IG0udHlwZSA9PT0gJ091dHB1dCcpLmlkO1xuXG4gICAgICB0aGlzLmRlc2NyaXB0aW9uLmF1ZGlvLm1vZHVsZXMuZm9yRWFjaChtb2R1bGUgPT4ge1xuICAgICAgICBpZiAobW9kdWxlLnR5cGUgIT09ICdBdWRpb0Rlc3RpbmF0aW9uJykge1xuICAgICAgICAgIHRoaXMuY3JlYXRlQ29ubmVjdGlvbihkYXRhT3V0cHV0SWQsIG1vZHVsZS5pZCk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuXG4gIGFzeW5jIGRlbGV0ZSgpIHtcbiAgICB0aGlzLnVuc3Vic2NyaWJlT3B0aW9ucygpO1xuXG4gICAgdGhpcy5zb3VyY2VzLmZvckVhY2goc291cmNlID0+IHNvdXJjZS5yZW1vdmVBbGxMaXN0ZW5lcnMoKSk7XG4gICAgdGhpcy5zb3VyY2VzLmNsZWFyKCk7XG4gICAgLy8gZGVsZXRlIGFsbCBub2RlcyBhbmQgY29ubmVjdGlvbnNcbiAgICBmb3IgKGxldCBpZCBpbiB0aGlzLm1vZHVsZXMpIHtcbiAgICAgIGNvbnN0IG1vZHVsZSA9IHRoaXMubW9kdWxlc1tpZF07XG4gICAgICBtb2R1bGUuZGlzY29ubmVjdCgpO1xuICAgICAgbW9kdWxlLmRlc3Ryb3koKTtcbiAgICB9XG5cbiAgICB0aGlzLm1vZHVsZXMgPSB7fTtcbiAgfVxuXG4gIC8vIEB0b2RvIC0gaW1wbGVtZW50IGRlbGV0ZU5vZGUoKVxuICBhc3luYyBjcmVhdGVOb2RlKHR5cGUsIGlkLCBvcHRpb25zKSB7XG4gICAgY29uc3QgY3RvciA9IHRoaXMucmVnaXN0ZXJlZE1vZHVsZXNbdHlwZV07XG5cbiAgICBpZiAoIWN0b3IpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgW0dyYXBoOjpjcmVhdGVOb2RlXSBVbmRlZmluZWQgTm9kZSBjb25zdHJ1Y3RvcjogXCIke3R5cGV9XCJgKTtcbiAgICB9XG5cbiAgICBjb25zdCBtb2R1bGUgPSBuZXcgY3Rvcih0aGlzLCB0eXBlLCBpZCwgb3B0aW9ucyk7XG4gICAgYXdhaXQgbW9kdWxlLmluaXQoKTtcblxuICAgIHRoaXMubW9kdWxlc1tpZF0gPSBtb2R1bGU7XG4gIH1cblxuICAvLyBAdG9kbyAtIGFsbG93IGlkIG9yIG5vZGVcbiAgLy8gQHRvZG8gLSBpbXBsZW1lbnQgZGVsZXRlQ29ubmVjdGlvbigpXG4gIGNyZWF0ZUNvbm5lY3Rpb24oc291cmNlSWQsIHRhcmdldElkKSB7XG4gICAgY29uc3Qgc291cmNlID0gdGhpcy5tb2R1bGVzW3NvdXJjZUlkXTtcblxuICAgIGlmICghc291cmNlKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYFtHcmFwaDo6Y3JlYXRlQ29ubmVjdGlvbl0gVW5kZWZpbmVkIHNvdXJjZSBOb2RlIGluc3RhbmNlOiBcIiR7c291cmNlSWR9XCJcbihjb25uZWN0aW9uOiBbJHtzb3VyY2VJZH0sICR7dGFyZ2V0SWR9XSlgKTtcbiAgICB9XG5cbiAgICBjb25zdCB0YXJnZXQgPSB0aGlzLm1vZHVsZXNbdGFyZ2V0SWRdO1xuXG4gICAgaWYgKCF0YXJnZXQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgW0dyYXBoOjpjcmVhdGVDb25uZWN0aW9uXSBVbmRlZmluZWQgdGFyZ2V0IE5vZGUgaW5zdGFuY2U6IFwiJHt0YXJnZXRJZH1cIlxuKGNvbm5lY3Rpb246IFske3NvdXJjZUlkfSwgJHt0YXJnZXRJZH1dKWApO1xuICAgIH1cblxuICAgIHNvdXJjZS5jb25uZWN0KHRhcmdldCk7XG4gIH1cblxuICAvKipcbiAgICogQHRvZG8gLSBkZWZpbmUgaG93IHRvIGNoYW5nZSB0aGUgc291cmNlXG4gICAqIEB0b2RvIC0gYWxsb3cgbXVsdGlwbGUgaW5wdXRzXG4gICAqL1xuICBzZXRTb3VyY2Uoc291cmNlLCBpbnB1dElkID0gdGhpcy5pbnB1dElkKSB7XG4gICAgY29uc3QgaW5wdXQgPSB0aGlzLm1vZHVsZXNbaW5wdXRJZF07XG4gICAgLy8gaW5wdXQuaW5wdXRzLnNpemUgPSAxO1xuICAgIHNvdXJjZS5hZGRMaXN0ZW5lcihyYXdEYXRhID0+IGlucHV0LnByb2Nlc3MocmF3RGF0YSkpO1xuXG4gICAgdGhpcy5zb3VyY2VzLmFkZChzb3VyY2UpO1xuICB9XG5cbiAgcmVtb3ZlU291cmNlKHNvdXJjZSkge1xuICAgIHNvdXJjZS5yZW1vdmVBbGxMaXN0ZW5lcnMoKTtcbiAgICB0aGlzLnNvdXJjZXMuZGVsZXRlKHNvdXJjZSk7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgR3JhcGg7XG4iXX0=