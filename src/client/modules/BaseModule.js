class BaseModule {
  // @todo - update signature to (como, graph, type, id, options)
  constructor(graph, type, id, options = {}) {
    this.graph = graph;
    this.type = type;
    this.id = id;
    this.options = Object.assign({}, options);

    // we allow multiple inputs on a module even if most of them
    // wont differenciate any of these inputs
    this.inputs = new Set(); // actually only use by Merge
    this.outputs = new Set();

    // data format
    // {
    //   {String} type
    //   {String} id
    //   {Object} data
    // }
    this.outputFrame = {
      type: this.type,
      id: this.id,
      data: {},
    };
  }

  async init() {
    // if something async have to be done on instanciation
  }

  /**
   * @todo - rename
   */
  updateOptions(options = {}) {
    this.options = Object.assign(this.options, options);
  }

  destroy() {
    // console.log('@todo - implement what must be done when the module is destroyed', this.id);
  }

  connect(dest) {
    this.outputs.add(dest);
    dest.inputs.add(this);
  }

  disconnect(dest = null) {
    if (dest === null) {
      this.outputs.clear();
      this.inputs.clear();
    } else {
      this.outputs.delete(dest);
      dest.inputs.delete(this);
    }
  }

  /**
   * interface method to be implemented by child nodes
   */
  execute(inputFrame) {}

  // @note - probably a problem with the resampler as its async
  // or we can consider the resampler is itself a source
  process(inputFrame) {
    this.outputFrame = this.execute(inputFrame);
    this.propagate(this.outputFrame);
  }

  propagate(outputFrame) {
    this.outputs.forEach(output => output.process(outputFrame));
  }
}

export default BaseModule;
