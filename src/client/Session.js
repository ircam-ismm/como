import diffArrays from '../common/diffArrays.js';

// we should maybe have a parent StateDecorator class
class Session {
  constructor(como, sessionState) {
    this.como = como;
    this.state = sessionState;
  }

  getValues() {
    return this.state.getValues();
  }

  get(name) {
    return this.state.get(name);
  }

  async set(values) {
    return await this.state.set(values);
  }

  subscribe(func) {
    return this.state.subscribe(func);
  }

  async detach() {
    await this.state.detach();
  }

  onDetach(func) {
    // @note - just a decorator for log
    const callback = () => {
      console.log('@todo - clean session buffer cache');
      func();
    }
    this.state.onDetach(callback);
  }

  onDelete(func) {
    this.state.onDelete(func);
  }

  addExample(example) {
    const sessionId = this.state.get('id');
    this.como.client.socket.send(`como:session:addExample`, sessionId, example);
  }

  deleteExample(exampleUuid) {
    const sessionId = this.state.get('id');
    this.como.client.socket.send(`como:session:deleteExample`, sessionId, exampleUuid);
  }

  clearExamples() {
    const sessionId = this.state.get('id');
    this.como.client.socket.send(`como:session:clearExamples`, sessionId);
  }

  clearLabel(label) {
    const sessionId = this.state.get('id');
    this.como.client.socket.send(`como:session:clearLabel`, sessionId, label);
  }

  async updateAudioFiles() {
    const audioFiles = this.state.get('audioFiles');
    const audioBufferLoader = this.como.experience.plugins['audio-buffer-loader'];

    const activeAudioFiles = audioFiles.filter(audioFile => audioFile.active);
    const activeUrls = activeAudioFiles.map(audioFile => audioFile.url);
    const current = Object.keys(audioBufferLoader.data);

    const { created, deleted } = diffArrays(current, activeUrls);
    // release deactivated buffer
    deleted.forEach(url => delete audioBufferLoader.data[url]);
    // load new files
    const toLoad = {};
    created.forEach(url => toLoad[url] = url);

    await audioBufferLoader.load(toLoad);

    // recreate <label, Buffers[]> pairs
    this.audioFilesByLabel = {};

    activeAudioFiles.forEach(audioFile => {
      const { label, url } = audioFile;
      const buffer = audioBufferLoader.data[url];

      if (!this.audioFilesByLabel[label]) {
        this.audioFilesByLabel[label] = [buffer];
      } else {
        this.audioFilesByLabel[label].push(buffer)
      }
    });

    // clear audio buffer loader cache
    // audioBufferLoader.data = {};
  }

}

export default Session;
