import diffArrays from '../common/utils/diffArrays.js';

class LabelAudioFileTable {
  constructor(session) {
    this.session = session;
  }

  query(label) {
    const result = [];
    const labelAudioFileTable = this.session.get('labelAudioFileTable');

    for (let [_label, filename] of labelAudioFileTable) {
      if (label === _label) {
        result.push(filename);
      }
    }

    return result;
  }

  queryBuffers(label) {
    const result = this.query(label);
    return result.map(filename => this.session.audioBuffers[filename]);
  }

  delete(label = null, filename = null) {

  }

  insert(label, filename) {

  }
}

// we should maybe have a parent StateDecorator class
class Session {
  constructor(como, sessionState) {
    this.como = como;
    this.state = sessionState;

    this.audioBuffers = {};
    this.labelAudioFileTable = new LabelAudioFileTable(this);
  }

  async init() {
    await this.updateAudioFiles();

    this.state.subscribe(updates => {
      for (let name in updates) {
        switch (name) {
          case 'audioFiles': {
            this.updateAudioFiles();
            break;
          }
        }
      }
    });
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

  subscribe(func, executeListener = false) {
    return this.state.subscribe(func, executeListener);
  }

  async detach() {
    await this.state.detach();
  }

  onDetach(func) {
    // @note - just a decorator for log
    const callback = () => {
      console.log('@todo - clean session audio buffers');
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

  clearExamples(label = null) {
    const sessionId = this.state.get('id');
    this.como.client.socket.send(`como:session:clearExamples`, sessionId, label);
  }

  retrain() {
    const sessionId = this.state.get('id');
    this.como.client.socket.send(`como:session:retrain`, sessionId);
  }

  setGraphOptions(moduleId, updates) {
    this.state.set({ graphOptionsEvent: { [moduleId]: updates }});
  }

  getGraphOptions(moduleId) {
    const graphOptions = this.state.get('graphOptions');
    return graphOptions[moduleId];
  }

  createLabel(label) {
    const sessionId = this.state.get('id');
    this.como.client.socket.send(`como:session:createLabel`, sessionId, label);
  }

  updateLabel(oldLabel, newLabel) {
    const sessionId = this.state.get('id');
    this.como.client.socket.send(`como:session:updateLabel`, sessionId, oldLabel, newLabel);
  }

  deleteLabel(label) {
    const sessionId = this.state.get('id');
    this.como.client.socket.send(`como:session:deleteLabel`, sessionId, label);
  }

  toggleAudioFile(filename, active) {
    const sessionId = this.state.get('id');
    this.como.client.socket.send(`como:session:toggleAudioFile`, sessionId, filename, active);
  }

  createLabelAudioFileRow(row) {
    const sessionId = this.state.get('id');
    this.como.client.socket.send(`como:session:createLabelAudioFileRow`, sessionId, row);
  }

  deleteLabelAudioFileRow(row) {
    const sessionId = this.state.get('id');
    this.como.client.socket.send(`como:session:deleteLabelAudioFileRow`, sessionId, row);
  }

  async updateAudioFiles() {
    if (!this.como.experience.plugins['audio-buffer-loader']) {
      return
    }

    const audioFiles = this.state.get('audioFiles');
    const activeAudioFiles = audioFiles.filter(audioFile => audioFile.active);
    const audioBufferLoader = this.como.experience.plugins['audio-buffer-loader'];

    if (this.como.project.get('preloadAudioFiles')) {
      // pick audio files from audio-buffer-load cache
      this.audioBuffers = {};

      activeAudioFiles.forEach(file => {
        this.audioBuffers[file.name] = audioBufferLoader.data[file.name];
      });
    } else {
      // load active files from session
      const filesToLoad = {};
      activeAudioFiles.forEach(file => filesToLoad[file.name] = file.url);

      this.audioBuffers = await audioBufferLoader.load(filesToLoad);
      // clear audio buffer loader cache
      audioBufferLoader.data = {};
    }
  }
}

export default Session;
