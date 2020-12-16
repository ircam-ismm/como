"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

/**
 * Interface added to `LfoCore to implement source
 *
 * Source have some responsability on graph as they mostly control its whole
 * lifecycle. They must implement the start and stop method in order to
 * make sure the graph is initialized and set `started` to true.
 * A source should never accept and propagate incomming frames until `started`
 * is set to `true`.
 *
 * @name SourceMixin
 * @memberof module:core
 * @mixin
 *
 * @example
 * class MySource extends SourceMixin(BaseLfo) {}
 */
const SourceMixin = superclass => class extends superclass {
  constructor(...args) {
    super(...args);
    this.initialized = false;
    this.initPromise = null;
    this.started = false;
    this.start = this.start.bind(this);
    this.stop = this.stop.bind(this);
  }
  /**
   * Initialize the graph by calling `initModule`. When the returned `Promise`
   * fulfills, the graph can be considered as initialized and `start` can be
   * called safely. If `start` is called whithout explicit `init`, `init` is
   * made internally, actual start of the graph is then not garanteed to be
   * synchronous.
   *
   * @memberof module:core.SourceMixin
   * @instance
   * @name init
   *
   * @return Promise
   *
   * @example
   * // safe initialization and start
   * source.init().then(() => source.start())
   * // safe initialization and start
   * source.start();
   */


  init() {
    this.initPromise = this.initModule().then(() => {
      this.initStream(); // this is synchronous

      this.initialized = true;
      return Promise.resolve(true);
    });
    return this.initPromise;
  }
  /**
   * Interface method to implement that starts the graph.
   *
   * The method main purpose is to make sure take verify initialization step and
   * set `started` to `true` when done.
   * Should behave synchronously when called inside `init().then()` and async
   * if called without init step.
   *
   * @memberof module:core.SourceMixin
   * @instance
   * @name start
   *
   * @example
   * // basic `start` implementation
   * start() {
   *   if (this.initialized === false) {
   *     if (this.initPromise === null) // init has not yet been called
   *       this.initPromise = this.init();
   *
   *     this.initPromise.then(this.start);
   *     return;
   *   }
   *
   *   this.started = true;
   * }
   */


  start() {}
  /**
   * Interface method to implement that stops the graph.
   *
   * @memberof module:core.SourceMixin
   * @instance
   * @name stop
   *
   * @example
   * // basic `stop` implementation
   * stop() {
   *   this.started = false;
   * }
   */


  stop() {}
  /**
   * The implementation should never allow incomming frames
   * if `this.started` is not `true`.
   *
   * @memberof module:core.SourceMixin
   * @instance
   * @name processFrame
   *
   * @param {Object} frame
   *
   * @example
   * // basic `processFrame` implementation
   * processFrame(frame) {
   *   if (this.started === true) {
   *     this.prepareFrame();
   *     this.processFunction(frame);
   *     this.propagateFrame();
   *   }
   * }
   */


  processFrame(frame) {}

};

var _default = SourceMixin;
exports.default = _default;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9jb21tb24vbGlicy9sZm8vU291cmNlTWl4aW4uanMiXSwibmFtZXMiOlsiU291cmNlTWl4aW4iLCJzdXBlcmNsYXNzIiwiY29uc3RydWN0b3IiLCJhcmdzIiwiaW5pdGlhbGl6ZWQiLCJpbml0UHJvbWlzZSIsInN0YXJ0ZWQiLCJzdGFydCIsImJpbmQiLCJzdG9wIiwiaW5pdCIsImluaXRNb2R1bGUiLCJ0aGVuIiwiaW5pdFN0cmVhbSIsIlByb21pc2UiLCJyZXNvbHZlIiwicHJvY2Vzc0ZyYW1lIiwiZnJhbWUiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNDLE1BQU1BLFdBQVcsR0FBSUMsVUFBRCxJQUFnQixjQUFjQSxVQUFkLENBQXlCO0FBQzVEQyxFQUFBQSxXQUFXLENBQUMsR0FBR0MsSUFBSixFQUFVO0FBQ25CLFVBQU0sR0FBR0EsSUFBVDtBQUVBLFNBQUtDLFdBQUwsR0FBbUIsS0FBbkI7QUFDQSxTQUFLQyxXQUFMLEdBQW1CLElBQW5CO0FBQ0EsU0FBS0MsT0FBTCxHQUFlLEtBQWY7QUFFQSxTQUFLQyxLQUFMLEdBQWEsS0FBS0EsS0FBTCxDQUFXQyxJQUFYLENBQWdCLElBQWhCLENBQWI7QUFDQSxTQUFLQyxJQUFMLEdBQVksS0FBS0EsSUFBTCxDQUFVRCxJQUFWLENBQWUsSUFBZixDQUFaO0FBQ0Q7QUFFRDtBQUNGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7O0FBQ0VFLEVBQUFBLElBQUksR0FBRztBQUNMLFNBQUtMLFdBQUwsR0FBbUIsS0FBS00sVUFBTCxHQUFrQkMsSUFBbEIsQ0FBdUIsTUFBTTtBQUM5QyxXQUFLQyxVQUFMLEdBRDhDLENBQzNCOztBQUNuQixXQUFLVCxXQUFMLEdBQW1CLElBQW5CO0FBQ0EsYUFBT1UsT0FBTyxDQUFDQyxPQUFSLENBQWdCLElBQWhCLENBQVA7QUFDRCxLQUprQixDQUFuQjtBQU1BLFdBQU8sS0FBS1YsV0FBWjtBQUNEO0FBRUQ7QUFDRjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7O0FBQ0VFLEVBQUFBLEtBQUssR0FBRyxDQUFFO0FBRVY7QUFDRjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQUNFRSxFQUFBQSxJQUFJLEdBQUcsQ0FBRTtBQUVUO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQUNFTyxFQUFBQSxZQUFZLENBQUNDLEtBQUQsRUFBUSxDQUFFOztBQXhHc0MsQ0FBN0Q7O2VBMkdjakIsVyIsInNvdXJjZXNDb250ZW50IjpbIlxuLyoqXG4gKiBJbnRlcmZhY2UgYWRkZWQgdG8gYExmb0NvcmUgdG8gaW1wbGVtZW50IHNvdXJjZVxuICpcbiAqIFNvdXJjZSBoYXZlIHNvbWUgcmVzcG9uc2FiaWxpdHkgb24gZ3JhcGggYXMgdGhleSBtb3N0bHkgY29udHJvbCBpdHMgd2hvbGVcbiAqIGxpZmVjeWNsZS4gVGhleSBtdXN0IGltcGxlbWVudCB0aGUgc3RhcnQgYW5kIHN0b3AgbWV0aG9kIGluIG9yZGVyIHRvXG4gKiBtYWtlIHN1cmUgdGhlIGdyYXBoIGlzIGluaXRpYWxpemVkIGFuZCBzZXQgYHN0YXJ0ZWRgIHRvIHRydWUuXG4gKiBBIHNvdXJjZSBzaG91bGQgbmV2ZXIgYWNjZXB0IGFuZCBwcm9wYWdhdGUgaW5jb21taW5nIGZyYW1lcyB1bnRpbCBgc3RhcnRlZGBcbiAqIGlzIHNldCB0byBgdHJ1ZWAuXG4gKlxuICogQG5hbWUgU291cmNlTWl4aW5cbiAqIEBtZW1iZXJvZiBtb2R1bGU6Y29yZVxuICogQG1peGluXG4gKlxuICogQGV4YW1wbGVcbiAqIGNsYXNzIE15U291cmNlIGV4dGVuZHMgU291cmNlTWl4aW4oQmFzZUxmbykge31cbiAqL1xuIGNvbnN0IFNvdXJjZU1peGluID0gKHN1cGVyY2xhc3MpID0+IGNsYXNzIGV4dGVuZHMgc3VwZXJjbGFzcyB7XG4gIGNvbnN0cnVjdG9yKC4uLmFyZ3MpIHtcbiAgICBzdXBlciguLi5hcmdzKTtcblxuICAgIHRoaXMuaW5pdGlhbGl6ZWQgPSBmYWxzZTtcbiAgICB0aGlzLmluaXRQcm9taXNlID0gbnVsbDtcbiAgICB0aGlzLnN0YXJ0ZWQgPSBmYWxzZTtcblxuICAgIHRoaXMuc3RhcnQgPSB0aGlzLnN0YXJ0LmJpbmQodGhpcyk7XG4gICAgdGhpcy5zdG9wID0gdGhpcy5zdG9wLmJpbmQodGhpcyk7XG4gIH1cblxuICAvKipcbiAgICogSW5pdGlhbGl6ZSB0aGUgZ3JhcGggYnkgY2FsbGluZyBgaW5pdE1vZHVsZWAuIFdoZW4gdGhlIHJldHVybmVkIGBQcm9taXNlYFxuICAgKiBmdWxmaWxscywgdGhlIGdyYXBoIGNhbiBiZSBjb25zaWRlcmVkIGFzIGluaXRpYWxpemVkIGFuZCBgc3RhcnRgIGNhbiBiZVxuICAgKiBjYWxsZWQgc2FmZWx5LiBJZiBgc3RhcnRgIGlzIGNhbGxlZCB3aGl0aG91dCBleHBsaWNpdCBgaW5pdGAsIGBpbml0YCBpc1xuICAgKiBtYWRlIGludGVybmFsbHksIGFjdHVhbCBzdGFydCBvZiB0aGUgZ3JhcGggaXMgdGhlbiBub3QgZ2FyYW50ZWVkIHRvIGJlXG4gICAqIHN5bmNocm9ub3VzLlxuICAgKlxuICAgKiBAbWVtYmVyb2YgbW9kdWxlOmNvcmUuU291cmNlTWl4aW5cbiAgICogQGluc3RhbmNlXG4gICAqIEBuYW1lIGluaXRcbiAgICpcbiAgICogQHJldHVybiBQcm9taXNlXG4gICAqXG4gICAqIEBleGFtcGxlXG4gICAqIC8vIHNhZmUgaW5pdGlhbGl6YXRpb24gYW5kIHN0YXJ0XG4gICAqIHNvdXJjZS5pbml0KCkudGhlbigoKSA9PiBzb3VyY2Uuc3RhcnQoKSlcbiAgICogLy8gc2FmZSBpbml0aWFsaXphdGlvbiBhbmQgc3RhcnRcbiAgICogc291cmNlLnN0YXJ0KCk7XG4gICAqL1xuICBpbml0KCkge1xuICAgIHRoaXMuaW5pdFByb21pc2UgPSB0aGlzLmluaXRNb2R1bGUoKS50aGVuKCgpID0+IHtcbiAgICAgIHRoaXMuaW5pdFN0cmVhbSgpOyAvLyB0aGlzIGlzIHN5bmNocm9ub3VzXG4gICAgICB0aGlzLmluaXRpYWxpemVkID0gdHJ1ZTtcbiAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUodHJ1ZSk7XG4gICAgfSk7XG5cbiAgICByZXR1cm4gdGhpcy5pbml0UHJvbWlzZTtcbiAgfVxuXG4gIC8qKlxuICAgKiBJbnRlcmZhY2UgbWV0aG9kIHRvIGltcGxlbWVudCB0aGF0IHN0YXJ0cyB0aGUgZ3JhcGguXG4gICAqXG4gICAqIFRoZSBtZXRob2QgbWFpbiBwdXJwb3NlIGlzIHRvIG1ha2Ugc3VyZSB0YWtlIHZlcmlmeSBpbml0aWFsaXphdGlvbiBzdGVwIGFuZFxuICAgKiBzZXQgYHN0YXJ0ZWRgIHRvIGB0cnVlYCB3aGVuIGRvbmUuXG4gICAqIFNob3VsZCBiZWhhdmUgc3luY2hyb25vdXNseSB3aGVuIGNhbGxlZCBpbnNpZGUgYGluaXQoKS50aGVuKClgIGFuZCBhc3luY1xuICAgKiBpZiBjYWxsZWQgd2l0aG91dCBpbml0IHN0ZXAuXG4gICAqXG4gICAqIEBtZW1iZXJvZiBtb2R1bGU6Y29yZS5Tb3VyY2VNaXhpblxuICAgKiBAaW5zdGFuY2VcbiAgICogQG5hbWUgc3RhcnRcbiAgICpcbiAgICogQGV4YW1wbGVcbiAgICogLy8gYmFzaWMgYHN0YXJ0YCBpbXBsZW1lbnRhdGlvblxuICAgKiBzdGFydCgpIHtcbiAgICogICBpZiAodGhpcy5pbml0aWFsaXplZCA9PT0gZmFsc2UpIHtcbiAgICogICAgIGlmICh0aGlzLmluaXRQcm9taXNlID09PSBudWxsKSAvLyBpbml0IGhhcyBub3QgeWV0IGJlZW4gY2FsbGVkXG4gICAqICAgICAgIHRoaXMuaW5pdFByb21pc2UgPSB0aGlzLmluaXQoKTtcbiAgICpcbiAgICogICAgIHRoaXMuaW5pdFByb21pc2UudGhlbih0aGlzLnN0YXJ0KTtcbiAgICogICAgIHJldHVybjtcbiAgICogICB9XG4gICAqXG4gICAqICAgdGhpcy5zdGFydGVkID0gdHJ1ZTtcbiAgICogfVxuICAgKi9cbiAgc3RhcnQoKSB7fVxuXG4gIC8qKlxuICAgKiBJbnRlcmZhY2UgbWV0aG9kIHRvIGltcGxlbWVudCB0aGF0IHN0b3BzIHRoZSBncmFwaC5cbiAgICpcbiAgICogQG1lbWJlcm9mIG1vZHVsZTpjb3JlLlNvdXJjZU1peGluXG4gICAqIEBpbnN0YW5jZVxuICAgKiBAbmFtZSBzdG9wXG4gICAqXG4gICAqIEBleGFtcGxlXG4gICAqIC8vIGJhc2ljIGBzdG9wYCBpbXBsZW1lbnRhdGlvblxuICAgKiBzdG9wKCkge1xuICAgKiAgIHRoaXMuc3RhcnRlZCA9IGZhbHNlO1xuICAgKiB9XG4gICAqL1xuICBzdG9wKCkge31cblxuICAvKipcbiAgICogVGhlIGltcGxlbWVudGF0aW9uIHNob3VsZCBuZXZlciBhbGxvdyBpbmNvbW1pbmcgZnJhbWVzXG4gICAqIGlmIGB0aGlzLnN0YXJ0ZWRgIGlzIG5vdCBgdHJ1ZWAuXG4gICAqXG4gICAqIEBtZW1iZXJvZiBtb2R1bGU6Y29yZS5Tb3VyY2VNaXhpblxuICAgKiBAaW5zdGFuY2VcbiAgICogQG5hbWUgcHJvY2Vzc0ZyYW1lXG4gICAqXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBmcmFtZVxuICAgKlxuICAgKiBAZXhhbXBsZVxuICAgKiAvLyBiYXNpYyBgcHJvY2Vzc0ZyYW1lYCBpbXBsZW1lbnRhdGlvblxuICAgKiBwcm9jZXNzRnJhbWUoZnJhbWUpIHtcbiAgICogICBpZiAodGhpcy5zdGFydGVkID09PSB0cnVlKSB7XG4gICAqICAgICB0aGlzLnByZXBhcmVGcmFtZSgpO1xuICAgKiAgICAgdGhpcy5wcm9jZXNzRnVuY3Rpb24oZnJhbWUpO1xuICAgKiAgICAgdGhpcy5wcm9wYWdhdGVGcmFtZSgpO1xuICAgKiAgIH1cbiAgICogfVxuICAgKi9cbiAgcHJvY2Vzc0ZyYW1lKGZyYW1lKSB7fVxufVxuXG5leHBvcnQgZGVmYXVsdCBTb3VyY2VNaXhpbjtcbiJdfQ==