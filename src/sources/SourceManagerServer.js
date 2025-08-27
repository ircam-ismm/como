import SourceManager from './SourceManager.js';
import sourceDescription from '../entities/source.js';

export default class SourceManagerServer extends SourceManager {
  constructor(como, entityName) {
    super(como, entityName);

    this.como.stateManager.defineClass('source', sourceDescription);
  }
}
