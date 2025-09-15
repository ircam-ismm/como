import SourceManager from './SourceManager.js';
import sourceDescription from './source-description.js';

export default class SourceManagerServer extends SourceManager {
  constructor(como, entityName) {
    super(como, entityName);

    this.como.stateManager.defineClass('SourceManager:source', sourceDescription);
  }
}
