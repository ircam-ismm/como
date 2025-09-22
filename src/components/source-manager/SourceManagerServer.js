import SourceManager from './SourceManager.js';
import sourceDescription from './source-description.js';

export default class SourceManagerServer extends SourceManager {
  constructor(como, name) {
    super(como, name);

    this.como.stateManager.defineClass(`${this.name}:source`, sourceDescription);
  }
}
