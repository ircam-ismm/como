/**
 * output format MUST be
 * {
 *   metas: [id, timestamp, period]
 *   accelerationIncludingGravity: [x, y, z],
 *   rotationRate: [alpha (yaw), beta (pitch), gamma (roll)]
 * }
 */
class BaseSource {
  constructor() {
    this.listeners = new Set();
  }

  addListener(callback) {
    this.listeners.add(callback);
  }

  removeListener(callback) {
    this.listeners.delete(callback);
  }

  removeAllListeners() {
    this.listeners.clear();
  }

  emit(data) {
    this.listeners.forEach(callback => callback(data));
  }
}

export default BaseSource;
