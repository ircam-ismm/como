import BaseModule from './BaseModule';
import cloneDeep from 'lodash.clonedeep';

class Bridge extends BaseModule {
  constructor(graph, type, id, options) {
    super(graph, type, id, options);

    this._listeners = new Set();
  }

  addListener(callback) {
    this._listeners.add(callback);
  }

  removeListener(callback = null) {
    if (callback === null) {
      this._listeners.clear();
    } else {
      this._listeners.delete(callback);
    }
  }

  execute(inputFrame) {
    const copy = cloneDeep(inputFrame.data);
    this._listeners.forEach(callback => callback(copy));
  }
}

export default Bridge;
