"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _parameters = _interopRequireDefault(require("@ircam/parameters"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

let id = 0;
/**
 * Base `lfo` class to be extended in order to create new nodes.
 *
 * Nodes are divided in 3 categories:
 * - **`source`** are responsible for acquering a signal and its properties
 *   (frameRate, frameSize, etc.)
 * - **`sink`** are endpoints of the graph, such nodes can be recorders,
 *   visualizers, etc.
 * - **`operator`** are used to make computation on the input signal and
 *   forward the results below in the graph.
 *
 * In most cases the methods to override / extend are:
 * - the **`constructor`** to define the parameters of the new lfo node.
 * - the **`processStreamParams`** method to define how the node modify the
 *   stream attributes (e.g. by changing the frame size)
 * - the **`process{FrameType}`** method to define the operations that the
 *   node apply on the stream. The type of input a node can handle is defined
 *   by its implemented interface, if it implements `processSignal`, a stream
 *   of type `signal` can be processed, `processVector` to handle
 *   an input of type `vector`.
 *
 * <span class="warning">_This class should be considered abstract and only
 * be used as a base class to extend._</span>
 *
 * #### overview of the interface
 *
 * **initModule**
 *
 * Returns a Promise that resolves when the module is initialized. Is
 * especially important for modules that rely on asynchronous underlying APIs.
 *
 * **processStreamParams(prevStreamParams)**
 *
 * `base` class (default implementation)
 * - call `prepareStreamParams`
 * - call `propagateStreamParams`
 *
 * `child` class
 * - override some of the inherited `streamParams`
 * - creates the any related logic buffers
 * - call `propagateStreamParams`
 *
 * _should not call `super.processStreamParams`_
 *
 * **prepareStreamParams()**
 *
 * - assign prevStreamParams to this.streamParams
 * - check if the class implements the correct `processInput` method
 *
 * _shouldn't be extended, only consumed in `processStreamParams`_
 *
 * **propagateStreamParams()**
 *
 * - creates the `frameData` buffer
 * - propagate `streamParams` to children
 *
 * _shouldn't be extended, only consumed in `processStreamParams`_
 *
 * **processFrame()**
 *
 * `base` class (default implementation)
 * - call `prepareFrame`
 * - assign frameTime and frameMetadata to identity
 * - call the proper function according to inputType
 * - call `propagateFrame`
 *
 * `child` class
 * - call `prepareFrame`
 * - do whatever you want with incomming frame
 * - call `propagateFrame`
 *
 * _should not call `super.processFrame`_
 *
 * **prepareFrame()**
 *
 * - if `reinit` and trigger `processStreamParams` if needed
 *
 * _shouldn't be extended, only consumed in `processFrame`_
 *
 * **propagateFrame()**
 *
 * - propagate frame to children
 *
 * _shouldn't be extended, only consumed in `processFrame`_
 *
 * @memberof module:core
 */

class BaseLfo {
  constructor(definitions = {}, options = {}) {
    this.cid = id++;
    /**
     * Parameter bag containing parameter instances.
     *
     * @type {Object}
     * @name params
     * @instance
     * @memberof module:core.BaseLfo
     */

    this.params = (0, _parameters.default)(definitions, options); // listen for param updates

    this.params.addListener(this.onParamUpdate.bind(this));
    /**
     * Description of the stream output of the node.
     * Set to `null` when the node is destroyed.
     *
     * @type {Object}
     * @property {Number} frameSize - Frame size at the output of the node.
     * @property {Number} frameRate - Frame rate at the output of the node.
     * @property {String} frameType - Frame type at the output of the node,
     *  possible values are `signal`, `vector` or `scalar`.
     * @property {Array|String} description - If type is `vector`, describe
     *  the dimension(s) of output stream.
     * @property {Number} sourceSampleRate - Sample rate of the source of the
     *  graph. _The value should be defined by sources and never modified_.
     * @property {Number} sourceSampleCount - Number of consecutive discrete
     *  time values contained in the data frame output by the source.
     *  _The value should be defined by sources and never modified_.
     *
     * @name streamParams
     * @instance
     * @memberof module:core.BaseLfo
     */

    this.streamParams = {
      frameType: null,
      frameSize: 1,
      frameRate: 0,
      description: null,
      sourceSampleRate: 0,
      sourceSampleCount: null
    };
    /**
     * Current frame. This object and its data are updated at each incomming
     * frame without reallocating memory.
     *
     * @type {Object}
     * @name frame
     * @property {Number} time - Time of the current frame.
     * @property {Float32Array} data - Data of the current frame.
     * @property {Object} metadata - Metadata associted to the current frame.
     * @instance
     * @memberof module:core.BaseLfo
     */

    this.frame = {
      time: 0,
      data: null,
      metadata: {}
    };
    /**
     * List of nodes connected to the ouput of the node (lower in the graph).
     * At each frame, the node forward its `frame` to to all its `nextModules`.
     *
     * @type {Array<BaseLfo>}
     * @name nextModules
     * @instance
     * @memberof module:core.BaseLfo
     * @see {@link module:core.BaseLfo#connect}
     * @see {@link module:core.BaseLfo#disconnect}
     */

    this.nextModules = [];
    /**
     * The node from which the node receive the frames (upper in the graph).
     *
     * @type {BaseLfo}
     * @name prevModule
     * @instance
     * @memberof module:core.BaseLfo
     * @see {@link module:core.BaseLfo#connect}
     * @see {@link module:core.BaseLfo#disconnect}
     */

    this.prevModule = null;
    /**
     * Is set to true when a static parameter is updated. On the next input
     * frame all the subgraph streamParams starting from this node will be
     * updated.
     *
     * @type {Boolean}
     * @name _reinit
     * @instance
     * @memberof module:core.BaseLfo
     * @private
     */

    this._reinit = false;
  }
  /**
   * Returns an object describing each available parameter of the node.
   *
   * @return {Object}
   */


  getParamsDescription() {
    return this.params.getDefinitions();
  }
  /**
   * Reset all parameters to their initial value (as defined on instantication)
   *
   * @see {@link module:core.BaseLfo#streamParams}
   */


  resetParams() {
    this.params.reset();
  }
  /**
   * Function called when a param is updated. By default set the `_reinit`
   * flag to `true` if the param is `static` one. This method should be
   * extended to handle particular logic bound to a specific parameter.
   *
   * @param {String} name - Name of the parameter.
   * @param {Mixed} value - Value of the parameter.
   * @param {Object} metas - Metadata associated to the parameter.
   */


  onParamUpdate(name, value, metas = {}) {
    if (metas.kind === 'static') this._reinit = true;
  }
  /**
   * Connect the current node (`prevModule`) to another node (`nextOp`).
   * A given node can be connected to several operators and propagate frames
   * to each of them.
   *
   * @param {BaseLfo} next - Next operator in the graph.
   * @see {@link module:core.BaseLfo#processFrame}
   * @see {@link module:core.BaseLfo#disconnect}
   */


  connect(next) {
    if (this.streamParams === null || next.streamParams === null) throw new Error('Invalid connection: cannot connect a dead node');

    if (this.streamParams.frameType !== null) {
      // graph has already been started
      // next.processStreamParams(this.streamParams);
      next.initModule().then(() => {
        next.processStreamParams(this.streamParams); // we can forward frame from now

        this.nextModules.push(next);
        next.prevModule = this;
      });
    } else {
      this.nextModules.push(next);
      next.prevModule = this;
    }
  }
  /**
   * Remove the given operator from its previous operators' `nextModules`.
   *
   * @param {BaseLfo} [next=null] - The operator to disconnect from the current
   *  operator. If `null` disconnect all the next operators.
   */


  disconnect(next = null) {
    if (next === null) {
      this.nextModules.forEach(next => this.disconnect(next));
    } else {
      const index = this.nextModules.indexOf(this);
      this.nextModules.splice(index, 1);
      next.prevModule = null;
    }
  }
  /**
   * Destroy all the nodes in the sub-graph starting from the current node.
   * When detroyed, the `streamParams` of the node are set to `null`, the
   * operator is then considered as `dead` and cannot be reconnected.
   *
   * @see {@link module:core.BaseLfo#connect}
   */


  destroy() {
    // destroy all chidren
    let index = this.nextModules.length;

    while (index--) this.nextModules[index].destroy(); // disconnect itself from the previous operator


    if (this.prevModule) this.prevModule.disconnect(this); // mark the object as dead

    this.streamParams = null;
  }
  /**
   * Return a `Promise` that resolve when the module is ready to be consumed.
   * Some modules relies on asynchronous APIs at initialization and thus could
   * be not ready to be consumed when the graph starts.
   * A module should be consider as initialized when all next modules (children)
   * are themselves initialized. The event bubbles up from sinks to sources.
   * When all its next operators are ready, a source can consider the whole graph
   * as ready and then start to produce frames.
   * The default implementation resolves when all next operators are resolved
   * themselves.
   * An operator relying on external async API must override this method to
   * resolve only when its dependecy is ready.
   *
   * @return Promise
   * @todo - Handle dynamic connections
   */


  initModule() {
    const nextPromises = this.nextModules.map(module => {
      return module.initModule();
    });
    return Promise.all(nextPromises);
  }
  /**
   * Helper to initialize the stream in standalone mode.
   *
   * @param {Object} [streamParams={}] - Parameters of the stream.
   *
   * @see {@link module:core.BaseLfo#processStreamParams}
   * @see {@link module:core.BaseLfo#resetStream}
   */


  initStream(streamParams = {}) {
    this.processStreamParams(streamParams);
    this.resetStream();
  }
  /**
   * Reset the `frame.data` buffer by setting all its values to 0.
   * A source operator should call `processStreamParams` and `resetStream` when
   * started, each of these method propagate through the graph automaticaly.
   *
   * @see {@link module:core.BaseLfo#processStreamParams}
   */


  resetStream() {
    // buttom up
    for (let i = 0, l = this.nextModules.length; i < l; i++) this.nextModules[i].resetStream(); // no buffer for `scalar` type or sink node
    // @note - this should be reviewed


    if (this.streamParams.frameType !== 'scalar' && this.frame.data !== null) {
      const frameSize = this.streamParams.frameSize;
      const data = this.frame.data;

      for (let i = 0; i < frameSize; i++) data[i] = 0;
    }
  }
  /**
   * Finalize the stream. A source node should call this method when stopped,
   * `finalizeStream` is automatically propagated throught the graph.
   *
   * @param {Number} endTime - Logical time at which the graph is stopped.
   */


  finalizeStream(endTime) {
    for (let i = 0, l = this.nextModules.length; i < l; i++) this.nextModules[i].finalizeStream(endTime);
  }
  /**
   * Initialize or update the operator's `streamParams` according to the
   * previous operators `streamParams` values.
   *
   * When implementing a new operator this method should:
   * 1. call `this.prepareStreamParams` with the given `prevStreamParams`
   * 2. optionnally change values to `this.streamParams` according to the
   *    logic performed by the operator.
   * 3. optionnally allocate memory for ring buffers, etc.
   * 4. call `this.propagateStreamParams` to trigger the method on the next
   *    operators in the graph.
   *
   * @param {Object} prevStreamParams - `streamParams` of the previous operator.
   *
   * @see {@link module:core.BaseLfo#prepareStreamParams}
   * @see {@link module:core.BaseLfo#propagateStreamParams}
   */


  processStreamParams(prevStreamParams = {}) {
    this.prepareStreamParams(prevStreamParams);
    this.propagateStreamParams();
  }
  /**
   * Common logic to do at the beginning of the `processStreamParam`, must be
   * called at the beginning of any `processStreamParam` implementation.
   *
   * The method mainly check if the current node implement the interface to
   * handle the type of frame propagated by it's parent:
   * - to handle a `vector` frame type, the class must implement `processVector`
   * - to handle a `signal` frame type, the class must implement `processSignal`
   * - in case of a 'scalar' frame type, the class can implement any of the
   * following by order of preference: `processScalar`, `processVector`,
   * `processSignal`.
   *
   * @param {Object} prevStreamParams - `streamParams` of the previous operator.
   *
   * @see {@link module:core.BaseLfo#processStreamParams}
   * @see {@link module:core.BaseLfo#propagateStreamParams}
   */


  prepareStreamParams(prevStreamParams = {}) {
    Object.assign(this.streamParams, prevStreamParams);
    const prevFrameType = prevStreamParams.frameType;

    switch (prevFrameType) {
      case 'scalar':
        if (this.processScalar) this.processFunction = this.processScalar;else if (this.processVector) this.processFunction = this.processVector;else if (this.processSignal) this.processFunction = this.processSignal;else throw new Error(`${this.constructor.name} - no "process" function found`);
        break;

      case 'vector':
        if (!('processVector' in this)) throw new Error(`${this.constructor.name} - "processVector" is not defined`);
        this.processFunction = this.processVector;
        break;

      case 'signal':
        if (!('processSignal' in this)) throw new Error(`${this.constructor.name} - "processSignal" is not defined`);
        this.processFunction = this.processSignal;
        break;

      default:
        // defaults to processFunction
        break;
    }
  }
  /**
   * Create the `this.frame.data` buffer and forward the operator's `streamParam`
   * to all its next operators, must be called at the end of any
   * `processStreamParams` implementation.
   *
   * @see {@link module:core.BaseLfo#processStreamParams}
   * @see {@link module:core.BaseLfo#prepareStreamParams}
   */


  propagateStreamParams() {
    this.frame.data = new Float32Array(this.streamParams.frameSize);

    for (let i = 0, l = this.nextModules.length; i < l; i++) this.nextModules[i].processStreamParams(this.streamParams);
  }
  /**
   * Define the particular logic the operator applies to the stream.
   * According to the frame type of the previous node, the method calls one
   * of the following method `processVector`, `processSignal` or `processScalar`
   *
   * @param {Object} frame - Frame (time, data, and metadata) as given by the
   *  previous operator. The incomming frame should never be modified by
   *  the operator.
   *
   * @see {@link module:core.BaseLfo#prepareFrame}
   * @see {@link module:core.BaseLfo#propagateFrame}
   * @see {@link module:core.BaseLfo#processStreamParams}
   */


  processFrame(frame) {
    this.prepareFrame(); // frameTime and frameMetadata defaults to identity

    this.frame.time = frame.time;
    this.frame.metadata = frame.metadata;
    this.processFunction(frame);
    this.propagateFrame();
  }
  /**
   * Pointer to the method called in `processFrame` according to the
   * frame type of the previous operator. Is dynamically assigned in
   * `prepareStreamParams`.
   *
   * @see {@link module:core.BaseLfo#prepareStreamParams}
   * @see {@link module:core.BaseLfo#processFrame}
   */


  processFunction(frame) {
    this.frame = frame;
  }
  /**
   * Common logic to perform at the beginning of the `processFrame`.
   *
   * @see {@link module:core.BaseLfo#processFrame}
   */


  prepareFrame() {
    if (this._reinit === true) {
      const streamParams = this.prevModule !== null ? this.prevModule.streamParams : {};
      this.initStream(streamParams);
      this._reinit = false;
    }
  }
  /**
   * Forward the current `frame` to the next operators, is called at the end of
   * `processFrame`.
   *
   * @see {@link module:core.BaseLfo#processFrame}
   */


  propagateFrame() {
    for (let i = 0, l = this.nextModules.length; i < l; i++) this.nextModules[i].processFrame(this.frame);
  }

}

var _default = BaseLfo;
exports.default = _default;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9jb21tb24vbGlicy9sZm8vQmFzZUxmby5qcyJdLCJuYW1lcyI6WyJpZCIsIkJhc2VMZm8iLCJjb25zdHJ1Y3RvciIsImRlZmluaXRpb25zIiwib3B0aW9ucyIsImNpZCIsInBhcmFtcyIsImFkZExpc3RlbmVyIiwib25QYXJhbVVwZGF0ZSIsImJpbmQiLCJzdHJlYW1QYXJhbXMiLCJmcmFtZVR5cGUiLCJmcmFtZVNpemUiLCJmcmFtZVJhdGUiLCJkZXNjcmlwdGlvbiIsInNvdXJjZVNhbXBsZVJhdGUiLCJzb3VyY2VTYW1wbGVDb3VudCIsImZyYW1lIiwidGltZSIsImRhdGEiLCJtZXRhZGF0YSIsIm5leHRNb2R1bGVzIiwicHJldk1vZHVsZSIsIl9yZWluaXQiLCJnZXRQYXJhbXNEZXNjcmlwdGlvbiIsImdldERlZmluaXRpb25zIiwicmVzZXRQYXJhbXMiLCJyZXNldCIsIm5hbWUiLCJ2YWx1ZSIsIm1ldGFzIiwia2luZCIsImNvbm5lY3QiLCJuZXh0IiwiRXJyb3IiLCJpbml0TW9kdWxlIiwidGhlbiIsInByb2Nlc3NTdHJlYW1QYXJhbXMiLCJwdXNoIiwiZGlzY29ubmVjdCIsImZvckVhY2giLCJpbmRleCIsImluZGV4T2YiLCJzcGxpY2UiLCJkZXN0cm95IiwibGVuZ3RoIiwibmV4dFByb21pc2VzIiwibWFwIiwibW9kdWxlIiwiUHJvbWlzZSIsImFsbCIsImluaXRTdHJlYW0iLCJyZXNldFN0cmVhbSIsImkiLCJsIiwiZmluYWxpemVTdHJlYW0iLCJlbmRUaW1lIiwicHJldlN0cmVhbVBhcmFtcyIsInByZXBhcmVTdHJlYW1QYXJhbXMiLCJwcm9wYWdhdGVTdHJlYW1QYXJhbXMiLCJPYmplY3QiLCJhc3NpZ24iLCJwcmV2RnJhbWVUeXBlIiwicHJvY2Vzc1NjYWxhciIsInByb2Nlc3NGdW5jdGlvbiIsInByb2Nlc3NWZWN0b3IiLCJwcm9jZXNzU2lnbmFsIiwiRmxvYXQzMkFycmF5IiwicHJvY2Vzc0ZyYW1lIiwicHJlcGFy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Z0JaLFlBQTNDLEdBQTBELEVBQS9FO0FBQ0EsV0FBS3lDLFVBQUwsQ0FBZ0J6QyxZQUFoQjtBQUNBLFdBQUthLE9BQUwsR0FBZSxLQUFmO0FBQ0Q7QUFDRjtBQUVEO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7O0FBQ0UrQyxFQUFBQSxjQUFjLEdBQUc7QUFDZixTQUFLLElBQUlqQixDQUFDLEdBQUcsQ0FBUixFQUFXQyxDQUFDLEdBQUcsS0FBS2pDLFdBQUwsQ0FBaUJ3QixNQUFyQyxFQUE2Q1EsQ0FBQyxHQUFHQyxDQUFqRCxFQUFvREQsQ0FBQyxFQUFyRCxFQUNFLEtBQUtoQyxXQUFMLENBQWlCZ0MsQ0FBakIsRUFBb0JlLFlBQXBCLENBQWlDLEtBQUtuRCxLQUF0QztBQUNIOztBQWhhVzs7ZUFtYUNoQixPIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHBhcmFtZXRlcnMgZnJvbSAnQGlyY2FtL3BhcmFtZXRlcnMnO1xuXG5sZXQgaWQgPSAwO1xuXG4vKipcbiAqIEJhc2UgYGxmb2AgY2xhc3MgdG8gYmUgZXh0ZW5kZWQgaW4gb3JkZXIgdG8gY3JlYXRlIG5ldyBub2Rlcy5cbiAqXG4gKiBOb2RlcyBhcmUgZGl2aWRlZCBpbiAzIGNhdGVnb3JpZXM6XG4gKiAtICoqYHNvdXJjZWAqKiBhcmUgcmVzcG9uc2libGUgZm9yIGFjcXVlcmluZyBhIHNpZ25hbCBhbmQgaXRzIHByb3BlcnRpZXNcbiAqICAgKGZyYW1lUmF0ZSwgZnJhbWVTaXplLCBldGMuKVxuICogLSAqKmBzaW5rYCoqIGFyZSBlbmRwb2ludHMgb2YgdGhlIGdyYXBoLCBzdWNoIG5vZGVzIGNhbiBiZSByZWNvcmRlcnMsXG4gKiAgIHZpc3VhbGl6ZXJzLCBldGMuXG4gKiAtICoqYG9wZXJhdG9yYCoqIGFyZSB1c2VkIHRvIG1ha2UgY29tcHV0YXRpb24gb24gdGhlIGlucHV0IHNpZ25hbCBhbmRcbiAqICAgZm9yd2FyZCB0aGUgcmVzdWx0cyBiZWxvdyBpbiB0aGUgZ3JhcGguXG4gKlxuICogSW4gbW9zdCBjYXNlcyB0aGUgbWV0aG9kcyB0byBvdmVycmlkZSAvIGV4dGVuZCBhcmU6XG4gKiAtIHRoZSAqKmBjb25zdHJ1Y3RvcmAqKiB0byBkZWZpbmUgdGhlIHBhcmFtZXRlcnMgb2YgdGhlIG5ldyBsZm8gbm9kZS5cbiAqIC0gdGhlICoqYHByb2Nlc3NTdHJlYW1QYXJhbXNgKiogbWV0aG9kIHRvIGRlZmluZSBob3cgdGhlIG5vZGUgbW9kaWZ5IHRoZVxuICogICBzdHJlYW0gYXR0cmlidXRlcyAoZS5nLiBieSBjaGFuZ2luZyB0aGUgZnJhbWUgc2l6ZSlcbiAqIC0gdGhlICoqYHByb2Nlc3N7RnJhbWVUeXBlfWAqKiBtZXRob2QgdG8gZGVmaW5lIHRoZSBvcGVyYXRpb25zIHRoYXQgdGhlXG4gKiAgIG5vZGUgYXBwbHkgb24gdGhlIHN0cmVhbS4gVGhlIHR5cGUgb2YgaW5wdXQgYSBub2RlIGNhbiBoYW5kbGUgaXMgZGVmaW5lZFxuICogICBieSBpdHMgaW1wbGVtZW50ZWQgaW50ZXJmYWNlLCBpZiBpdCBpbXBsZW1lbnRzIGBwcm9jZXNzU2lnbmFsYCwgYSBzdHJlYW1cbiAqICAgb2YgdHlwZSBgc2lnbmFsYCBjYW4gYmUgcHJvY2Vzc2VkLCBgcHJvY2Vzc1ZlY3RvcmAgdG8gaGFuZGxlXG4gKiAgIGFuIGlucHV0IG9mIHR5cGUgYHZlY3RvcmAuXG4gKlxuICogPHNwYW4gY2xhc3M9XCJ3YXJuaW5nXCI+X1RoaXMgY2xhc3Mgc2hvdWxkIGJlIGNvbnNpZGVyZWQgYWJzdHJhY3QgYW5kIG9ubHlcbiAqIGJlIHVzZWQgYXMgYSBiYXNlIGNsYXNzIHRvIGV4dGVuZC5fPC9zcGFuPlxuICpcbiAqICMjIyMgb3ZlcnZpZXcgb2YgdGhlIGludGVyZmFjZVxuICpcbiAqICoqaW5pdE1vZHVsZSoqXG4gKlxuICogUmV0dXJucyBhIFByb21pc2UgdGhhdCByZXNvbHZlcyB3aGVuIHRoZSBtb2R1bGUgaXMgaW5pdGlhbGl6ZWQuIElzXG4gKiBlc3BlY2lhbGx5IGltcG9ydGFudCBmb3IgbW9kdWxlcyB0aGF0IHJlbHkgb24gYXN5bmNocm9ub3VzIHVuZGVybHlpbmcgQVBJcy5cbiAqXG4gKiAqKnByb2Nlc3NTdHJlYW1QYXJhbXMocHJldlN0cmVhbVBhcmFtcykqKlxuICpcbiAqIGBiYXNlYCBjbGFzcyAoZGVmYXVsdCBpbXBsZW1lbnRhdGlvbilcbiAqIC0gY2FsbCBgcHJlcGFyZVN0cmVhbVBhcmFtc2BcbiAqIC0gY2FsbCBgcHJvcGFnYXRlU3RyZWFtUGFyYW1zYFxuICpcbiAqIGBjaGlsZGAgY2xhc3NcbiAqIC0gb3ZlcnJpZGUgc29tZSBvZiB0aGUgaW5oZXJpdGVkIGBzdHJlYW1QYXJhbXNgXG4gKiAtIGNyZWF0ZXMgdGhlIGFueSByZWxhdGVkIGxvZ2ljIGJ1ZmZlcnNcbiAqIC0gY2FsbCBgcHJvcGFnYXRlU3RyZWFtUGFyYW1zYFxuICpcbiAqIF9zaG91bGQgbm90IGNhbGwgYHN1cGVyLnByb2Nlc3NTdHJlYW1QYXJhbXNgX1xuICpcbiAqICoqcHJlcGFyZVN0cmVhbVBhcmFtcygpKipcbiAqXG4gKiAtIGFzc2lnbiBwcmV2U3RyZWFtUGFyYW1zIHRvIHRoaXMuc3RyZWFtUGFyYW1zXG4gKiAtIGNoZWNrIGlmIHRoZSBjbGFzcyBpbXBsZW1lbnRzIHRoZSBjb3JyZWN0IGBwcm9jZXNzSW5wdXRgIG1ldGhvZFxuICpcbiAqIF9zaG91bGRuJ3QgYmUgZXh0ZW5kZWQsIG9ubHkgY29uc3VtZWQgaW4gYHByb2Nlc3NTdHJlYW1QYXJhbXNgX1xuICpcbiAqICoqcHJvcGFnYXRlU3RyZWFtUGFyYW1zKCkqKlxuICpcbiAqIC0gY3JlYXRlcyB0aGUgYGZyYW1lRGF0YWAgYnVmZmVyXG4gKiAtIHByb3BhZ2F0ZSBgc3RyZWFtUGFyYW1zYCB0byBjaGlsZHJlblxuICpcbiAqIF9zaG91bGRuJ3QgYmUgZXh0ZW5kZWQsIG9ubHkgY29uc3VtZWQgaW4gYHByb2Nlc3NTdHJlYW1QYXJhbXNgX1xuICpcbiAqICoqcHJvY2Vzc0ZyYW1lKCkqKlxuICpcbiAqIGBiYXNlYCBjbGFzcyAoZGVmYXVsdCBpbXBsZW1lbnRhdGlvbilcbiAqIC0gY2FsbCBgcHJlcGFyZUZyYW1lYFxuICogLSBhc3NpZ24gZnJhbWVUaW1lIGFuZCBmcmFtZU1ldGFkYXRhIHRvIGlkZW50aXR5XG4gKiAtIGNhbGwgdGhlIHByb3BlciBmdW5jdGlvbiBhY2NvcmRpbmcgdG8gaW5wdXRUeXBlXG4gKiAtIGNhbGwgYHByb3BhZ2F0ZUZyYW1lYFxuICpcbiAqIGBjaGlsZGAgY2xhc3NcbiAqIC0gY2FsbCBgcHJlcGFyZUZyYW1lYFxuICogLSBkbyB3aGF0ZXZlciB5b3Ugd2FudCB3aXRoIGluY29tbWluZyBmcmFtZVxuICogLSBjYWxsIGBwcm9wYWdhdGVGcmFtZWBcbiAqXG4gKiBfc2hvdWxkIG5vdCBjYWxsIGBzdXBlci5wcm9jZXNzRnJhbWVgX1xuICpcbiAqICoqcHJlcGFyZUZyYW1lKCkqKlxuICpcbiAqIC0gaWYgYHJlaW5pdGAgYW5kIHRyaWdnZXIgYHByb2Nlc3NTdHJlYW1QYXJhbXNgIGlmIG5lZWRlZFxuICpcbiAqIF9zaG91bGRuJ3QgYmUgZXh0ZW5kZWQsIG9ubHkgY29uc3VtZWQgaW4gYHByb2Nlc3NGcmFtZWBfXG4gKlxuICogKipwcm9wYWdhdGVGcmFtZSgpKipcbiAqXG4gKiAtIHByb3BhZ2F0ZSBmcmFtZSB0byBjaGlsZHJlblxuICpcbiAqIF9zaG91bGRuJ3QgYmUgZXh0ZW5kZWQsIG9ubHkgY29uc3VtZWQgaW4gYHByb2Nlc3NGcmFtZWBfXG4gKlxuICogQG1lbWJlcm9mIG1vZHVsZTpjb3JlXG4gKi9cbmNsYXNzIEJhc2VMZm8ge1xuICBjb25zdHJ1Y3RvcihkZWZpbml0aW9ucyA9IHt9LCBvcHRpb25zID0ge30pIHtcbiAgICB0aGlzLmNpZCA9IGlkKys7XG5cbiAgICAvKipcbiAgICAgKiBQYXJhbWV0ZXIgYmFnIGNvbnRhaW5pbmcgcGFyYW1ldGVyIGluc3RhbmNlcy5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtPYmplY3R9XG4gICAgICogQG5hbWUgcGFyYW1zXG4gICAgICogQGluc3RhbmNlXG4gICAgICogQG1lbWJlcm9mIG1vZHVsZTpjb3JlLkJhc2VMZm9cbiAgICAgKi9cbiAgICB0aGlzLnBhcmFtcyA9IHBhcmFtZXRlcnMoZGVmaW5pdGlvbnMsIG9wdGlvbnMpO1xuICAgIC8vIGxpc3RlbiBmb3IgcGFyYW0gdXBkYXRlc1xuICAgIHRoaXMucGFyYW1zLmFkZExpc3RlbmVyKHRoaXMub25QYXJhbVVwZGF0ZS5iaW5kKHRoaXMpKTtcblxuICAgIC8qKlxuICAgICAqIERlc2NyaXB0aW9uIG9mIHRoZSBzdHJlYW0gb3V0cHV0IG9mIHRoZSBub2RlLlxuICAgICAqIFNldCB0byBgbnVsbGAgd2hlbiB0aGUgbm9kZSBpcyBkZXN0cm95ZWQuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7T2JqZWN0fVxuICAgICAqIEBwcm9wZXJ0eSB7TnVtYmVyfSBmcmFtZVNpemUgLSBGcmFtZSBzaXplIGF0IHRoZSBvdXRwdXQgb2YgdGhlIG5vZGUuXG4gICAgICogQHByb3BlcnR5IHtOdW1iZXJ9IGZyYW1lUmF0ZSAtIEZyYW1lIHJhdGUgYXQgdGhlIG91dHB1dCBvZiB0aGUgbm9kZS5cbiAgICAgKiBAcHJvcGVydHkge1N0cmluZ30gZnJhbWVUeXBlIC0gRnJhbWUgdHlwZSBhdCB0aGUgb3V0cHV0IG9mIHRoZSBub2RlLFxuICAgICAqICBwb3NzaWJsZSB2YWx1ZXMgYXJlIGBzaWduYWxgLCBgdmVjdG9yYCBvciBgc2NhbGFyYC5cbiAgICAgKiBAcHJvcGVydHkge0FycmF5fFN0cmluZ30gZGVzY3JpcHRpb24gLSBJZiB0eXBlIGlzIGB2ZWN0b3JgLCBkZXNjcmliZVxuICAgICAqICB0aGUgZGltZW5zaW9uKHMpIG9mIG91dHB1dCBzdHJlYW0uXG4gICAgICogQHByb3BlcnR5IHtOdW1iZXJ9IHNvdXJjZVNhbXBsZVJhdGUgLSBTYW1wbGUgcmF0ZSBvZiB0aGUgc291cmNlIG9mIHRoZVxuICAgICAqICBncmFwaC4gX1RoZSB2YWx1ZSBzaG91bGQgYmUgZGVmaW5lZCBieSBzb3VyY2VzIGFuZCBuZXZlciBtb2RpZmllZF8uXG4gICAgICogQHByb3BlcnR5IHtOdW1iZXJ9IHNvdXJjZVNhbXBsZUNvdW50IC0gTnVtYmVyIG9mIGNvbnNlY3V0aXZlIGRpc2NyZXRlXG4gICAgICogIHRpbWUgdmFsdWVzIGNvbnRhaW5lZCBpbiB0aGUgZGF0YSBmcmFtZSBvdXRwdXQgYnkgdGhlIHNvdXJjZS5cbiAgICAgKiAgX1RoZSB2YWx1ZSBzaG91bGQgYmUgZGVmaW5lZCBieSBzb3VyY2VzIGFuZCBuZXZlciBtb2RpZmllZF8uXG4gICAgICpcbiAgICAgKiBAbmFtZSBzdHJlYW1QYXJhbXNcbiAgICAgKiBAaW5zdGFuY2VcbiAgICAgKiBAbWVtYmVyb2YgbW9kdWxlOmNvcmUuQmFzZUxmb1xuICAgICAqL1xuICAgIHRoaXMuc3RyZWFtUGFyYW1zID0ge1xuICAgICAgZnJhbWVUeXBlOiBudWxsLFxuICAgICAgZnJhbWVTaXplOiAxLFxuICAgICAgZnJhbWVSYXRlOiAwLFxuICAgICAgZGVzY3JpcHRpb246IG51bGwsXG4gICAgICBzb3VyY2VTYW1wbGVSYXRlOiAwLFxuICAgICAgc291cmNlU2FtcGxlQ291bnQ6IG51bGwsXG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIEN1cnJlbnQgZnJhbWUuIFRoaXMgb2JqZWN0IGFuZCBpdHMgZGF0YSBhcmUgdXBkYXRlZCBhdCBlYWNoIGluY29tbWluZ1xuICAgICAqIGZyYW1lIHdpdGhvdXQgcmVhbGxvY2F0aW5nIG1lbW9yeS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtPYmplY3R9XG4gICAgICogQG5hbWUgZnJhbWVcbiAgICAgKiBAcHJvcGVydHkge051bWJlcn0gdGltZSAtIFRpbWUgb2YgdGhlIGN1cnJlbnQgZnJhbWUuXG4gICAgICogQHByb3BlcnR5IHtGbG9hdDMyQXJyYXl9IGRhdGEgLSBEYXRhIG9mIHRoZSBjdXJyZW50IGZyYW1lLlxuICAgICAqIEBwcm9wZXJ0eSB7T2JqZWN0fSBtZXRhZGF0YSAtIE1ldGFkYXRhIGFzc29jaXRlZCB0byB0aGUgY3VycmVudCBmcmFtZS5cbiAgICAgKiBAaW5zdGFuY2VcbiAgICAgKiBAbWVtYmVyb2YgbW9kdWxlOmNvcmUuQmFzZUxmb1xuICAgICAqL1xuICAgIHRoaXMuZnJhbWUgPSB7XG4gICAgICB0aW1lOiAwLFxuICAgICAgZGF0YTogbnVsbCxcbiAgICAgIG1ldGFkYXRhOiB7fSxcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogTGlzdCBvZiBub2RlcyBjb25uZWN0ZWQgdG8gdGhlIG91cHV0IG9mIHRoZSBub2RlIChsb3dlciBpbiB0aGUgZ3JhcGgpLlxuICAgICAqIEF0IGVhY2ggZnJhbWUsIHRoZSBub2RlIGZvcndhcmQgaXRzIGBmcmFtZWAgdG8gdG8gYWxsIGl0cyBgbmV4dE1vZHVsZXNgLlxuICAgICAqXG4gICAgICogQHR5cGUge0FycmF5PEJhc2VMZm8+fVxuICAgICAqIEBuYW1lIG5leHRNb2R1bGVzXG4gICAgICogQGluc3RhbmNlXG4gICAgICogQG1lbWJlcm9mIG1vZHVsZTpjb3JlLkJhc2VMZm9cbiAgICAgKiBAc2VlIHtAbGluayBtb2R1bGU6Y29yZS5CYXNlTGZvI2Nvbm5lY3R9XG4gICAgICogQHNlZSB7QGxpbmsgbW9kdWxlOmNvcmUuQmFzZUxmbyNkaXNjb25uZWN0fVxuICAgICAqL1xuICAgIHRoaXMubmV4dE1vZHVsZXMgPSBbXTtcblxuICAgIC8qKlxuICAgICAqIFRoZSBub2RlIGZyb20gd2hpY2ggdGhlIG5vZGUgcmVjZWl2ZSB0aGUgZnJhbWVzICh1cHBlciBpbiB0aGUgZ3JhcGgpLlxuICAgICAqXG4gICAgICogQHR5cGUge0Jhc2VMZm99XG4gICAgICogQG5hbWUgcHJldk1vZHVsZVxuICAgICAqIEBpbnN0YW5jZVxuICAgICAqIEBtZW1iZXJvZiBtb2R1bGU6Y29yZS5CYXNlTGZvXG4gICAgICogQHNlZSB7QGxpbmsgbW9kdWxlOmNvcmUuQmFzZUxmbyNjb25uZWN0fVxuICAgICAqIEBzZWUge0BsaW5rIG1vZHVsZTpjb3JlLkJhc2VMZm8jZGlzY29ubmVjdH1cbiAgICAgKi9cbiAgICB0aGlzLnByZXZNb2R1bGUgPSBudWxsO1xuXG4gICAgLyoqXG4gICAgICogSXMgc2V0IHRvIHRydWUgd2hlbiBhIHN0YXRpYyBwYXJhbWV0ZXIgaXMgdXBkYXRlZC4gT24gdGhlIG5leHQgaW5wdXRcbiAgICAgKiBmcmFtZSBhbGwgdGhlIHN1YmdyYXBoIHN0cmVhbVBhcmFtcyBzdGFydGluZyBmcm9tIHRoaXMgbm9kZSB3aWxsIGJlXG4gICAgICogdXBkYXRlZC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtCb29sZWFufVxuICAgICAqIEBuYW1lIF9yZWluaXRcbiAgICAgKiBAaW5zdGFuY2VcbiAgICAgKiBAbWVtYmVyb2YgbW9kdWxlOmNvcmUuQmFzZUxmb1xuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgdGhpcy5fcmVpbml0ID0gZmFsc2U7XG4gIH1cblxuICAvKipcbiAgICogUmV0dXJucyBhbiBvYmplY3QgZGVzY3JpYmluZyBlYWNoIGF2YWlsYWJsZSBwYXJhbWV0ZXIgb2YgdGhlIG5vZGUuXG4gICAqXG4gICAqIEByZXR1cm4ge09iamVjdH1cbiAgICovXG4gIGdldFBhcmFtc0Rlc2NyaXB0aW9uKCkge1xuICAgIHJldHVybiB0aGlzLnBhcmFtcy5nZXREZWZpbml0aW9ucygpO1xuICB9XG5cbiAgLyoqXG4gICAqIFJlc2V0IGFsbCBwYXJhbWV0ZXJzIHRvIHRoZWlyIGluaXRpYWwgdmFsdWUgKGFzIGRlZmluZWQgb24gaW5zdGFudGljYXRpb24pXG4gICAqXG4gICAqIEBzZWUge0BsaW5rIG1vZHVsZTpjb3JlLkJhc2VMZm8jc3RyZWFtUGFyYW1zfVxuICAgKi9cbiAgcmVzZXRQYXJhbXMoKSB7XG4gICAgdGhpcy5wYXJhbXMucmVzZXQoKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBGdW5jdGlvbiBjYWxsZWQgd2hlbiBhIHBhcmFtIGlzIHVwZGF0ZWQuIEJ5IGRlZmF1bHQgc2V0IHRoZSBgX3JlaW5pdGBcbiAgICogZmxhZyB0byBgdHJ1ZWAgaWYgdGhlIHBhcmFtIGlzIGBzdGF0aWNgIG9uZS4gVGhpcyBtZXRob2Qgc2hvdWxkIGJlXG4gICAqIGV4dGVuZGVkIHRvIGhhbmRsZSBwYXJ0aWN1bGFyIGxvZ2ljIGJvdW5kIHRvIGEgc3BlY2lmaWMgcGFyYW1ldGVyLlxuICAgKlxuICAgKiBAcGFyYW0ge1N0cmluZ30gbmFtZSAtIE5hbWUgb2YgdGhlIHBhcmFtZXRlci5cbiAgICogQHBhcmFtIHtNaXhlZH0gdmFsdWUgLSBWYWx1ZSBvZiB0aGUgcGFyYW1ldGVyLlxuICAgKiBAcGFyYW0ge09iamVjdH0gbWV0YXMgLSBNZXRhZGF0YSBhc3NvY2lhdGVkIHRvIHRoZSBwYXJhbWV0ZXIuXG4gICAqL1xuICBvblBhcmFtVXBkYXRlKG5hbWUsIHZhbHVlLCBtZXRhcyA9IHt9KSB7XG4gICAgaWYgKG1ldGFzLmtpbmQgPT09ICdzdGF0aWMnKVxuICAgICAgdGhpcy5fcmVpbml0ID0gdHJ1ZTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDb25uZWN0IHRoZSBjdXJyZW50IG5vZGUgKGBwcmV2TW9kdWxlYCkgdG8gYW5vdGhlciBub2RlIChgbmV4dE9wYCkuXG4gICAqIEEgZ2l2ZW4gbm9kZSBjYW4gYmUgY29ubmVjdGVkIHRvIHNldmVyYWwgb3BlcmF0b3JzIGFuZCBwcm9wYWdhdGUgZnJhbWVzXG4gICAqIHRvIGVhY2ggb2YgdGhlbS5cbiAgICpcbiAgICogQHBhcmFtIHtCYXNlTGZvfSBuZXh0IC0gTmV4dCBvcGVyYXRvciBpbiB0aGUgZ3JhcGguXG4gICAqIEBzZWUge0BsaW5rIG1vZHVsZTpjb3JlLkJhc2VMZm8jcHJvY2Vzc0ZyYW1lfVxuICAgKiBAc2VlIHtAbGluayBtb2R1bGU6Y29yZS5CYXNlTGZvI2Rpc2Nvbm5lY3R9XG4gICAqL1xuICBjb25uZWN0KG5leHQpIHtcbiAgICBpZiAodGhpcy5zdHJlYW1QYXJhbXMgPT09IG51bGwgfHwgbmV4dC5zdHJlYW1QYXJhbXMgPT09IG51bGwpXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgY29ubmVjdGlvbjogY2Fubm90IGNvbm5lY3QgYSBkZWFkIG5vZGUnKTtcblxuICAgIGlmICh0aGlzLnN0cmVhbVBhcmFtcy5mcmFtZVR5cGUgIT09IG51bGwpIHsgLy8gZ3JhcGggaGFzIGFscmVhZHkgYmVlbiBzdGFydGVkXG4gICAgICAvLyBuZXh0LnByb2Nlc3NTdHJlYW1QYXJhbXModGhpcy5zdHJlYW1QYXJhbXMpO1xuICAgICAgbmV4dC5pbml0TW9kdWxlKCkudGhlbigoKSA9PiB7XG4gICAgICAgIG5leHQucHJvY2Vzc1N0cmVhbVBhcmFtcyh0aGlzLnN0cmVhbVBhcmFtcyk7XG4gICAgICAgIC8vIHdlIGNhbiBmb3J3YXJkIGZyYW1lIGZyb20gbm93XG4gICAgICAgIHRoaXMubmV4dE1vZHVsZXMucHVzaChuZXh0KTtcbiAgICAgICAgbmV4dC5wcmV2TW9kdWxlID0gdGhpcztcbiAgICAgIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLm5leHRNb2R1bGVzLnB1c2gobmV4dCk7XG4gICAgICBuZXh0LnByZXZNb2R1bGUgPSB0aGlzO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBSZW1vdmUgdGhlIGdpdmVuIG9wZXJhdG9yIGZyb20gaXRzIHByZXZpb3VzIG9wZXJhdG9ycycgYG5leHRNb2R1bGVzYC5cbiAgICpcbiAgICogQHBhcmFtIHtCYXNlTGZvfSBbbmV4dD1udWxsXSAtIFRoZSBvcGVyYXRvciB0byBkaXNjb25uZWN0IGZyb20gdGhlIGN1cnJlbnRcbiAgICogIG9wZXJhdG9yLiBJZiBgbnVsbGAgZGlzY29ubmVjdCBhbGwgdGhlIG5leHQgb3BlcmF0b3JzLlxuICAgKi9cbiAgZGlzY29ubmVjdChuZXh0ID0gbnVsbCkge1xuICAgIGlmIChuZXh0ID09PSBudWxsKSB7XG4gICAgICB0aGlzLm5leHRNb2R1bGVzLmZvckVhY2goKG5leHQpID0+IHRoaXMuZGlzY29ubmVjdChuZXh0KSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IGluZGV4ID0gdGhpcy5uZXh0TW9kdWxlcy5pbmRleE9mKHRoaXMpO1xuICAgICAgdGhpcy5uZXh0TW9kdWxlcy5zcGxpY2UoaW5kZXgsIDEpO1xuICAgICAgbmV4dC5wcmV2TW9kdWxlID0gbnVsbDtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogRGVzdHJveSBhbGwgdGhlIG5vZGVzIGluIHRoZSBzdWItZ3JhcGggc3RhcnRpbmcgZnJvbSB0aGUgY3VycmVudCBub2RlLlxuICAgKiBXaGVuIGRldHJveWVkLCB0aGUgYHN0cmVhbVBhcmFtc2Agb2YgdGhlIG5vZGUgYXJlIHNldCB0byBgbnVsbGAsIHRoZVxuICAgKiBvcGVyYXRvciBpcyB0aGVuIGNvbnNpZGVyZWQgYXMgYGRlYWRgIGFuZCBjYW5ub3QgYmUgcmVjb25uZWN0ZWQuXG4gICAqXG4gICAqIEBzZWUge0BsaW5rIG1vZHVsZTpjb3JlLkJhc2VMZm8jY29ubmVjdH1cbiAgICovXG4gIGRlc3Ryb3koKSB7XG4gICAgLy8gZGVzdHJveSBhbGwgY2hpZHJlblxuICAgIGxldCBpbmRleCA9IHRoaXMubmV4dE1vZHVsZXMubGVuZ3RoO1xuXG4gICAgd2hpbGUgKGluZGV4LS0pXG4gICAgICB0aGlzLm5leHRNb2R1bGVzW2luZGV4XS5kZXN0cm95KCk7XG5cbiAgICAvLyBkaXNjb25uZWN0IGl0c2VsZiBmcm9tIHRoZSBwcmV2aW91cyBvcGVyYXRvclxuICAgIGlmICh0aGlzLnByZXZNb2R1bGUpXG4gICAgICB0aGlzLnByZXZNb2R1bGUuZGlzY29ubmVjdCh0aGlzKTtcblxuICAgIC8vIG1hcmsgdGhlIG9iamVjdCBhcyBkZWFkXG4gICAgdGhpcy5zdHJlYW1QYXJhbXMgPSBudWxsO1xuICB9XG5cbiAgLyoqXG4gICAqIFJldHVybiBhIGBQcm9taXNlYCB0aGF0IHJlc29sdmUgd2hlbiB0aGUgbW9kdWxlIGlzIHJlYWR5IHRvIGJlIGNvbnN1bWVkLlxuICAgKiBTb21lIG1vZHVsZXMgcmVsaWVzIG9uIGFzeW5jaHJvbm91cyBBUElzIGF0IGluaXRpYWxpemF0aW9uIGFuZCB0aHVzIGNvdWxkXG4gICAqIGJlIG5vdCByZWFkeSB0byBiZSBjb25zdW1lZCB3aGVuIHRoZSBncmFwaCBzdGFydHMuXG4gICAqIEEgbW9kdWxlIHNob3VsZCBiZSBjb25zaWRlciBhcyBpbml0aWFsaXplZCB3aGVuIGFsbCBuZXh0IG1vZHVsZXMgKGNoaWxkcmVuKVxuICAgKiBhcmUgdGhlbXNlbHZlcyBpbml0aWFsaXplZC4gVGhlIGV2ZW50IGJ1YmJsZXMgdXAgZnJvbSBzaW5rcyB0byBzb3VyY2VzLlxuICAgKiBXaGVuIGFsbCBpdHMgbmV4dCBvcGVyYXRvcnMgYXJlIHJlYWR5LCBhIHNvdXJjZSBjYW4gY29uc2lkZXIgdGhlIHdob2xlIGdyYXBoXG4gICAqIGFzIHJlYWR5IGFuZCB0aGVuIHN0YXJ0IHRvIHByb2R1Y2UgZnJhbWVzLlxuICAgKiBUaGUgZGVmYXVsdCBpbXBsZW1lbnRhdGlvbiByZXNvbHZlcyB3aGVuIGFsbCBuZXh0IG9wZXJhdG9ycyBhcmUgcmVzb2x2ZWRcbiAgICogdGhlbXNlbHZlcy5cbiAgICogQW4gb3BlcmF0b3IgcmVseWluZyBvbiBleHRlcm5hbCBhc3luYyBBUEkgbXVzdCBvdmVycmlkZSB0aGlzIG1ldGhvZCB0b1xuICAgKiByZXNvbHZlIG9ubHkgd2hlbiBpdHMgZGVwZW5kZWN5IGlzIHJlYWR5LlxuICAgKlxuICAgKiBAcmV0dXJuIFByb21pc2VcbiAgICogQHRvZG8gLSBIYW5kbGUgZHluYW1pYyBjb25uZWN0aW9uc1xuICAgKi9cbiAgaW5pdE1vZHVsZSgpIHtcbiAgICBjb25zdCBuZXh0UHJvbWlzZXMgPSB0aGlzLm5leHRNb2R1bGVzLm1hcCgobW9kdWxlKSA9PiB7XG4gICAgICByZXR1cm4gbW9kdWxlLmluaXRNb2R1bGUoKTtcbiAgICB9KTtcblxuICAgIHJldHVybiBQcm9taXNlLmFsbChuZXh0UHJvbWlzZXMpO1xuICB9XG5cbiAgLyoqXG4gICAqIEhlbHBlciB0byBpbml0aWFsaXplIHRoZSBzdHJlYW0gaW4gc3RhbmRhbG9uZSBtb2RlLlxuICAgKlxuICAgKiBAcGFyYW0ge09iamVjdH0gW3N0cmVhbVBhcmFtcz17fV0gLSBQYXJhbWV0ZXJzIG9mIHRoZSBzdHJlYW0uXG4gICAqXG4gICAqIEBzZWUge0BsaW5rIG1vZHVsZTpjb3JlLkJhc2VMZm8jcHJvY2Vzc1N0cmVhbVBhcmFtc31cbiAgICogQHNlZSB7QGxpbmsgbW9kdWxlOmNvcmUuQmFzZUxmbyNyZXNldFN0cmVhbX1cbiAgICovXG4gIGluaXRTdHJlYW0oc3RyZWFtUGFyYW1zID0ge30pIHtcbiAgICB0aGlzLnByb2Nlc3NTdHJlYW1QYXJhbXMoc3RyZWFtUGFyYW1zKTtcbiAgICB0aGlzLnJlc2V0U3RyZWFtKCk7XG4gIH1cblxuICAvKipcbiAgICogUmVzZXQgdGhlIGBmcmFtZS5kYXRhYCBidWZmZXIgYnkgc2V0dGluZyBhbGwgaXRzIHZhbHVlcyB0byAwLlxuICAgKiBBIHNvdXJjZSBvcGVyYXRvciBzaG91bGQgY2FsbCBgcHJvY2Vzc1N0cmVhbVBhcmFtc2AgYW5kIGByZXNldFN0cmVhbWAgd2hlblxuICAgKiBzdGFydGVkLCBlYWNoIG9mIHRoZXNlIG1ldGhvZCBwcm9wYWdhdGUgdGhyb3VnaCB0aGUgZ3JhcGggYXV0b21hdGljYWx5LlxuICAgKlxuICAgKiBAc2VlIHtAbGluayBtb2R1bGU6Y29yZS5CYXNlTGZvI3Byb2Nlc3NTdHJlYW1QYXJhbXN9XG4gICAqL1xuICByZXNldFN0cmVhbSgpIHtcbiAgICAvLyBidXR0b20gdXBcbiAgICBmb3IgKGxldCBpID0gMCwgbCA9IHRoaXMubmV4dE1vZHVsZXMubGVuZ3RoOyBpIDwgbDsgaSsrKVxuICAgICAgdGhpcy5uZXh0TW9kdWxlc1tpXS5yZXNldFN0cmVhbSgpO1xuXG4gICAgLy8gbm8gYnVmZmVyIGZvciBgc2NhbGFyYCB0eXBlIG9yIHNpbmsgbm9kZVxuICAgIC8vIEBub3RlIC0gdGhpcyBzaG91bGQgYmUgcmV2aWV3ZWRcbiAgICBpZiAodGhpcy5zdHJlYW1QYXJhbXMuZnJhbWVUeXBlICE9PSAnc2NhbGFyJyAmJiB0aGlzLmZyYW1lLmRhdGEgIT09IG51bGwpIHtcbiAgICAgIGNvbnN0IGZyYW1lU2l6ZSA9IHRoaXMuc3RyZWFtUGFyYW1zLmZyYW1lU2l6ZTtcbiAgICAgIGNvbnN0IGRhdGEgPSB0aGlzLmZyYW1lLmRhdGE7XG5cbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZnJhbWVTaXplOyBpKyspXG4gICAgICAgIGRhdGFbaV0gPSAwO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBGaW5hbGl6ZSB0aGUgc3RyZWFtLiBBIHNvdXJjZSBub2RlIHNob3VsZCBjYWxsIHRoaXMgbWV0aG9kIHdoZW4gc3RvcHBlZCxcbiAgICogYGZpbmFsaXplU3RyZWFtYCBpcyBhdXRvbWF0aWNhbGx5IHByb3BhZ2F0ZWQgdGhyb3VnaHQgdGhlIGdyYXBoLlxuICAgKlxuICAgKiBAcGFyYW0ge051bWJlcn0gZW5kVGltZSAtIExvZ2ljYWwgdGltZSBhdCB3aGljaCB0aGUgZ3JhcGggaXMgc3RvcHBlZC5cbiAgICovXG4gIGZpbmFsaXplU3RyZWFtKGVuZFRpbWUpIHtcbiAgICBmb3IgKGxldCBpID0gMCwgbCA9IHRoaXMubmV4dE1vZHVsZXMubGVuZ3RoOyBpIDwgbDsgaSsrKVxuICAgICAgdGhpcy5uZXh0TW9kdWxlc1tpXS5maW5hbGl6ZVN0cmVhbShlbmRUaW1lKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBJbml0aWFsaXplIG9yIHVwZGF0ZSB0aGUgb3BlcmF0b3IncyBgc3RyZWFtUGFyYW1zYCBhY2NvcmRpbmcgdG8gdGhlXG4gICAqIHByZXZpb3VzIG9wZXJhdG9ycyBgc3RyZWFtUGFyYW1zYCB2YWx1ZXMuXG4gICAqXG4gICAqIFdoZW4gaW1wbGVtZW50aW5nIGEgbmV3IG9wZXJhdG9yIHRoaXMgbWV0aG9kIHNob3VsZDpcbiAgICogMS4gY2FsbCBgdGhpcy5wcmVwYXJlU3RyZWFtUGFyYW1zYCB3aXRoIHRoZSBnaXZlbiBgcHJldlN0cmVhbVBhcmFtc2BcbiAgICogMi4gb3B0aW9ubmFsbHkgY2hhbmdlIHZhbHVlcyB0byBgdGhpcy5zdHJlYW1QYXJhbXNgIGFjY29yZGluZyB0byB0aGVcbiAgICogICAgbG9naWMgcGVyZm9ybWVkIGJ5IHRoZSBvcGVyYXRvci5cbiAgICogMy4gb3B0aW9ubmFsbHkgYWxsb2NhdGUgbWVtb3J5IGZvciByaW5nIGJ1ZmZlcnMsIGV0Yy5cbiAgICogNC4gY2FsbCBgdGhpcy5wcm9wYWdhdGVTdHJlYW1QYXJhbXNgIHRvIHRyaWdnZXIgdGhlIG1ldGhvZCBvbiB0aGUgbmV4dFxuICAgKiAgICBvcGVyYXRvcnMgaW4gdGhlIGdyYXBoLlxuICAgKlxuICAgKiBAcGFyYW0ge09iamVjdH0gcHJldlN0cmVhbVBhcmFtcyAtIGBzdHJlYW1QYXJhbXNgIG9mIHRoZSBwcmV2aW91cyBvcGVyYXRvci5cbiAgICpcbiAgICogQHNlZSB7QGxpbmsgbW9kdWxlOmNvcmUuQmFzZUxmbyNwcmVwYXJlU3RyZWFtUGFyYW1zfVxuICAgKiBAc2VlIHtAbGluayBtb2R1bGU6Y29yZS5CYXNlTGZvI3Byb3BhZ2F0ZVN0cmVhbVBhcmFtc31cbiAgICovXG4gIHByb2Nlc3NTdHJlYW1QYXJhbXMocHJldlN0cmVhbVBhcmFtcyA9IHt9KSB7XG4gICAgdGhpcy5wcmVwYXJlU3RyZWFtUGFyYW1zKHByZXZTdHJlYW1QYXJhbXMpO1xuICAgIHRoaXMucHJvcGFnYXRlU3RyZWFtUGFyYW1zKCk7XG4gIH1cblxuICAvKipcbiAgICogQ29tbW9uIGxvZ2ljIHRvIGRvIGF0IHRoZSBiZWdpbm5pbmcgb2YgdGhlIGBwcm9jZXNzU3RyZWFtUGFyYW1gLCBtdXN0IGJlXG4gICAqIGNhbGxlZCBhdCB0aGUgYmVnaW5uaW5nIG9mIGFueSBgcHJvY2Vzc1N0cmVhbVBhcmFtYCBpbXBsZW1lbnRhdGlvbi5cbiAgICpcbiAgICogVGhlIG1ldGhvZCBtYWlubHkgY2hlY2sgaWYgdGhlIGN1cnJlbnQgbm9kZSBpbXBsZW1lbnQgdGhlIGludGVyZmFjZSB0b1xuICAgKiBoYW5kbGUgdGhlIHR5cGUgb2YgZnJhbWUgcHJvcGFnYXRlZCBieSBpdCdzIHBhcmVudDpcbiAgICogLSB0byBoYW5kbGUgYSBgdmVjdG9yYCBmcmFtZSB0eXBlLCB0aGUgY2xhc3MgbXVzdCBpbXBsZW1lbnQgYHByb2Nlc3NWZWN0b3JgXG4gICAqIC0gdG8gaGFuZGxlIGEgYHNpZ25hbGAgZnJhbWUgdHlwZSwgdGhlIGNsYXNzIG11c3QgaW1wbGVtZW50IGBwcm9jZXNzU2lnbmFsYFxuICAgKiAtIGluIGNhc2Ugb2YgYSAnc2NhbGFyJyBmcmFtZSB0eXBlLCB0aGUgY2xhc3MgY2FuIGltcGxlbWVudCBhbnkgb2YgdGhlXG4gICAqIGZvbGxvd2luZyBieSBvcmRlciBvZiBwcmVmZXJlbmNlOiBgcHJvY2Vzc1NjYWxhcmAsIGBwcm9jZXNzVmVjdG9yYCxcbiAgICogYHByb2Nlc3NTaWduYWxgLlxuICAgKlxuICAgKiBAcGFyYW0ge09iamVjdH0gcHJldlN0cmVhbVBhcmFtcyAtIGBzdHJlYW1QYXJhbXNgIG9mIHRoZSBwcmV2aW91cyBvcGVyYXRvci5cbiAgICpcbiAgICogQHNlZSB7QGxpbmsgbW9kdWxlOmNvcmUuQmFzZUxmbyNwcm9jZXNzU3RyZWFtUGFyYW1zfVxuICAgKiBAc2VlIHtAbGluayBtb2R1bGU6Y29yZS5CYXNlTGZvI3Byb3BhZ2F0ZVN0cmVhbVBhcmFtc31cbiAgICovXG4gIHByZXBhcmVTdHJlYW1QYXJhbXMocHJldlN0cmVhbVBhcmFtcyA9IHt9KSB7XG4gICAgT2JqZWN0LmFzc2lnbih0aGlzLnN0cmVhbVBhcmFtcywgcHJldlN0cmVhbVBhcmFtcyk7XG4gICAgY29uc3QgcHJldkZyYW1lVHlwZSA9IHByZXZTdHJlYW1QYXJhbXMuZnJhbWVUeXBlO1xuXG4gICAgc3dpdGNoIChwcmV2RnJhbWVUeXBlKSB7XG4gICAgICBjYXNlICdzY2FsYXInOlxuICAgICAgICBpZiAodGhpcy5wcm9jZXNzU2NhbGFyKVxuICAgICAgICAgIHRoaXMucHJvY2Vzc0Z1bmN0aW9uID0gdGhpcy5wcm9jZXNzU2NhbGFyO1xuICAgICAgICBlbHNlIGlmICh0aGlzLnByb2Nlc3NWZWN0b3IpXG4gICAgICAgICAgdGhpcy5wcm9jZXNzRnVuY3Rpb24gPSB0aGlzLnByb2Nlc3NWZWN0b3I7XG4gICAgICAgIGVsc2UgaWYgKHRoaXMucHJvY2Vzc1NpZ25hbClcbiAgICAgICAgICB0aGlzLnByb2Nlc3NGdW5jdGlvbiA9IHRoaXMucHJvY2Vzc1NpZ25hbDtcbiAgICAgICAgZWxzZVxuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgJHt0aGlzLmNvbnN0cnVjdG9yLm5hbWV9IC0gbm8gXCJwcm9jZXNzXCIgZnVuY3Rpb24gZm91bmRgKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlICd2ZWN0b3InOlxuICAgICAgICBpZiAoISgncHJvY2Vzc1ZlY3RvcicgaW4gdGhpcykpXG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGAke3RoaXMuY29uc3RydWN0b3IubmFtZX0gLSBcInByb2Nlc3NWZWN0b3JcIiBpcyBub3QgZGVmaW5lZGApO1xuXG4gICAgICAgIHRoaXMucHJvY2Vzc0Z1bmN0aW9uID0gdGhpcy5wcm9jZXNzVmVjdG9yO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgJ3NpZ25hbCc6XG4gICAgICAgIGlmICghKCdwcm9jZXNzU2lnbmFsJyBpbiB0aGlzKSlcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYCR7dGhpcy5jb25zdHJ1Y3Rvci5uYW1lfSAtIFwicHJvY2Vzc1NpZ25hbFwiIGlzIG5vdCBkZWZpbmVkYCk7XG5cbiAgICAgICAgdGhpcy5wcm9jZXNzRnVuY3Rpb24gPSB0aGlzLnByb2Nlc3NTaWduYWw7XG4gICAgICAgIGJyZWFrO1xuICAgICAgZGVmYXVsdDpcbiAgICAgICAgLy8gZGVmYXVsdHMgdG8gcHJvY2Vzc0Z1bmN0aW9uXG4gICAgICAgIGJyZWFrO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBDcmVhdGUgdGhlIGB0aGlzLmZyYW1lLmRhdGFgIGJ1ZmZlciBhbmQgZm9yd2FyZCB0aGUgb3BlcmF0b3IncyBgc3RyZWFtUGFyYW1gXG4gICAqIHRvIGFsbCBpdHMgbmV4dCBvcGVyYXRvcnMsIG11c3QgYmUgY2FsbGVkIGF0IHRoZSBlbmQgb2YgYW55XG4gICAqIGBwcm9jZXNzU3RyZWFtUGFyYW1zYCBpbXBsZW1lbnRhdGlvbi5cbiAgICpcbiAgICogQHNlZSB7QGxpbmsgbW9kdWxlOmNvcmUuQmFzZUxmbyNwcm9jZXNzU3RyZWFtUGFyYW1zfVxuICAgKiBAc2VlIHtAbGluayBtb2R1bGU6Y29yZS5CYXNlTGZvI3ByZXBhcmVTdHJlYW1QYXJhbXN9XG4gICAqL1xuICBwcm9wYWdhdGVTdHJlYW1QYXJhbXMoKSB7XG4gICAgdGhpcy5mcmFtZS5kYXRhID0gbmV3IEZsb2F0MzJBcnJheSh0aGlzLnN0cmVhbVBhcmFtcy5mcmFtZVNpemUpO1xuXG4gICAgZm9yIChsZXQgaSA9IDAsIGwgPSB0aGlzLm5leHRNb2R1bGVzLmxlbmd0aDsgaSA8IGw7IGkrKylcbiAgICAgIHRoaXMubmV4dE1vZHVsZXNbaV0ucHJvY2Vzc1N0cmVhbVBhcmFtcyh0aGlzLnN0cmVhbVBhcmFtcyk7XG4gIH1cblxuICAvKipcbiAgICogRGVmaW5lIHRoZSBwYXJ0aWN1bGFyIGxvZ2ljIHRoZSBvcGVyYXRvciBhcHBsaWVzIHRvIHRoZSBzdHJlYW0uXG4gICAqIEFjY29yZGluZyB0byB0aGUgZnJhbWUgdHlwZSBvZiB0aGUgcHJldmlvdXMgbm9kZSwgdGhlIG1ldGhvZCBjYWxscyBvbmVcbiAgICogb2YgdGhlIGZvbGxvd2luZyBtZXRob2QgYHByb2Nlc3NWZWN0b3JgLCBgcHJvY2Vzc1NpZ25hbGAgb3IgYHByb2Nlc3NTY2FsYXJgXG4gICAqXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBmcmFtZSAtIEZyYW1lICh0aW1lLCBkYXRhLCBhbmQgbWV0YWRhdGEpIGFzIGdpdmVuIGJ5IHRoZVxuICAgKiAgcHJldmlvdXMgb3BlcmF0b3IuIFRoZSBpbmNvbW1pbmcgZnJhbWUgc2hvdWxkIG5ldmVyIGJlIG1vZGlmaWVkIGJ5XG4gICAqICB0aGUgb3BlcmF0b3IuXG4gICAqXG4gICAqIEBzZWUge0BsaW5rIG1vZHVsZTpjb3JlLkJhc2VMZm8jcHJlcGFyZUZyYW1lfVxuICAgKiBAc2VlIHtAbGluayBtb2R1bGU6Y29yZS5CYXNlTGZvI3Byb3BhZ2F0ZUZyYW1lfVxuICAgKiBAc2VlIHtAbGluayBtb2R1bGU6Y29yZS5CYXNlTGZvI3Byb2Nlc3NTdHJlYW1QYXJhbXN9XG4gICAqL1xuICBwcm9jZXNzRnJhbWUoZnJhbWUpIHtcbiAgICB0aGlzLnByZXBhcmVGcmFtZSgpO1xuXG4gICAgLy8gZnJhbWVUaW1lIGFuZCBmcmFtZU1ldGFkYXRhIGRlZmF1bHRzIHRvIGlkZW50aXR5XG4gICAgdGhpcy5mcmFtZS50aW1lID0gZnJhbWUudGltZTtcbiAgICB0aGlzLmZyYW1lLm1ldGFkYXRhID0gZnJhbWUubWV0YWRhdGE7XG5cbiAgICB0aGlzLnByb2Nlc3NGdW5jdGlvbihmcmFtZSk7XG4gICAgdGhpcy5wcm9wYWdhdGVGcmFtZSgpO1xuICB9XG5cbiAgLyoqXG4gICAqIFBvaW50ZXIgdG8gdGhlIG1ldGhvZCBjYWxsZWQgaW4gYHByb2Nlc3NGcmFtZWAgYWNjb3JkaW5nIHRvIHRoZVxuICAgKiBmcmFtZSB0eXBlIG9mIHRoZSBwcmV2aW91cyBvcGVyYXRvci4gSXMgZHluYW1pY2FsbHkgYXNzaWduZWQgaW5cbiAgICogYHByZXBhcmVTdHJlYW1QYXJhbXNgLlxuICAgKlxuICAgKiBAc2VlIHtAbGluayBtb2R1bGU6Y29yZS5CYXNlTGZvI3ByZXBhcmVTdHJlYW1QYXJhbXN9XG4gICAqIEBzZWUge0BsaW5rIG1vZHVsZTpjb3JlLkJhc2VMZm8jcHJvY2Vzc0ZyYW1lfVxuICAgKi9cbiAgcHJvY2Vzc0Z1bmN0aW9uKGZyYW1lKSB7XG4gICAgdGhpcy5mcmFtZSA9IGZyYW1lO1xuICB9XG5cbiAgLyoqXG4gICAqIENvbW1vbiBsb2dpYyB0byBwZXJmb3JtIGF0IHRoZSBiZWdpbm5pbmcgb2YgdGhlIGBwcm9jZXNzRnJhbWVgLlxuICAgKlxuICAgKiBAc2VlIHtAbGluayBtb2R1bGU6Y29yZS5CYXNlTGZvI3Byb2Nlc3NGcmFtZX1cbiAgICovXG4gIHByZXBhcmVGcmFtZSgpIHtcbiAgICBpZiAodGhpcy5fcmVpbml0ID09PSB0cnVlKSB7XG4gICAgICBjb25zdCBzdHJlYW1QYXJhbXMgPSB0aGlzLnByZXZNb2R1bGUgIT09IG51bGwgPyB0aGlzLnByZXZNb2R1bGUuc3RyZWFtUGFyYW1zIDoge307XG4gICAgICB0aGlzLmluaXRTdHJlYW0oc3RyZWFtUGFyYW1zKTtcbiAgICAgIHRoaXMuX3JlaW5pdCA9IGZhbHNlO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBGb3J3YXJkIHRoZSBjdXJyZW50IGBmcmFtZWAgdG8gdGhlIG5leHQgb3BlcmF0b3JzLCBpcyBjYWxsZWQgYXQgdGhlIGVuZCBvZlxuICAgKiBgcHJvY2Vzc0ZyYW1lYC5cbiAgICpcbiAgICogQHNlZSB7QGxpbmsgbW9kdWxlOmNvcmUuQmFzZUxmbyNwcm9jZXNzRnJhbWV9XG4gICAqL1xuICBwcm9wYWdhdGVGcmFtZSgpIHtcbiAgICBmb3IgKGxldCBpID0gMCwgbCA9IHRoaXMubmV4dE1vZHVsZXMubGVuZ3RoOyBpIDwgbDsgaSsrKVxuICAgICAgdGhpcy5uZXh0TW9kdWxlc1tpXS5wcm9jZXNzRnJhbWUodGhpcy5mcmFtZSk7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgQmFzZUxmbztcbiJdfQ==