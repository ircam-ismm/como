import BaseSource from './BaseSource.js';

class OfflineSource extends BaseSource {
  constructor(data) {
    super();
    this.data = data;
  }

  run() {
    this.data.forEach(frame => this.emit(frame));
  }
}

export default OfflineSource;
