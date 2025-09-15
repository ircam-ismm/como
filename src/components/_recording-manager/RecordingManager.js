import Manager from '../Manager.js';

export default class RecordingManager extends Manager {
  #filesystem;

  constructor(como) {
    super(como, 'recordingManager');
  }

  list() {
    return this.#filesystem.getTree();
  }

  onUpdate(func) {

  }

  async read(filename) {
    return await this.#filesystem.readFile(filename);
  }

  async delete(filename) {
    return await this.#filesystem.rm(filename);
  }
}
