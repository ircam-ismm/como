import Sessions from './Sessions.js';
import Players from './Players.js';
import Graph from '../common/Graph.js';

class Project {
  constructor(como) {
    this.como = como;
  }

  async init() {
    this.state = await this.como.client.stateManager.attach('project');
    this.players = new Players(this.como);
    this.sessions = new Sessions(this.como);

    /**
     * @note: if preloadAudioFiles is true, we load all the audio files, so
     * that we can still update active and inactive files per session without
     * having to restart the server each time.
     */
    if (this.state.get('preloadAudioFiles') && this.como.experience.plugins['audio-buffer-loader']) {
      const audioFiles = this.state.get('audioFiles').reduce((acc, file) => {
        acc[file.name] = file.url;
        return acc;
      }, {});

      await this.como.experience.plugins['audio-buffer-loader'].load(audioFiles);
    }
  }

  subscribe(func) {
    const unsubscribe = this.state.subscribe(func);
    return unsubscribe;
  }

  getValues() {
    return this.state.getValues();
  }

  get(name) {
    return this.state.get(name);
  }

  async createSession(sessionName, graphPreset) {
    return new Promise((resolve, reject) => {
      const ackChannel = `como:project:createSession:ack`;
      const errChannel = `como:project:createSession:err`;

      const resolvePromise = value => {
        this.como.client.socket.removeAllListeners(ackChannel);
        this.como.client.socket.removeAllListeners(errChannel);
        resolve(value);
      }

      this.como.client.socket.addListener(ackChannel, resolvePromise);
      this.como.client.socket.addListener(errChannel, err => {
        console.log('project:createSession error', err);
        resolvePromise(null);
      });

      this.como.client.socket.send(`como:project:createSession:req`, sessionName, graphPreset);
    });
  }

  async deleteSession(sessionId) {
    return new Promise((resolve, reject) => {
      const ackChannel = `como:project:deleteSession:ack`;
      const errChannel = `como:project:deleteSession:err`;

      const resolvePromise = value => {
        this.como.client.socket.removeAllListeners(ackChannel);
        this.como.client.socket.removeAllListeners(errChannel);
        resolve(value);
      }

      this.como.client.socket.addListener(ackChannel, resolvePromise);
      this.como.client.socket.addListener(errChannel, err => {
        console.log('project:deleteSession error', err);
        resolvePromise(null);
      });

      this.como.client.socket.send(`como:project:deleteSession:req`, sessionId);
    });
  }

  async createStreamRoute(fromSourceId, toNodeId) {
    return new Promise((resolve, reject) => {
      const ackChannel = `como:routing:createStreamRoute:ack`;
      const errChannel = `como:routing:createStreamRoute:err`;

      const resolvePromise = value => {
        this.como.client.socket.removeAllListeners(ackChannel);
        this.como.client.socket.removeAllListeners(errChannel);
        resolve(value);
      }

      this.como.client.socket.addListener(ackChannel, resolvePromise);
      this.como.client.socket.addListener(errChannel, err => {
        console.log('routing:createStreamRoute error', err);
        resolvePromise(null);
      });

      this.como.client.socket.send(`como:routing:createStreamRoute:req`, fromSourceId, toNodeId);
    });
  }

  async deleteStreamRoute(fromSourceId, toNodeId) {
    return new Promise((resolve, reject) => {
      const ackChannel = `como:routing:deleteStreamRoute:ack`;
      const errChannel = `como:routing:deleteStreamRoute:err`;

      const resolvePromise = value => {
        this.como.client.socket.removeAllListeners(ackChannel);
        this.como.client.socket.removeAllListeners(errChannel);
        resolve(value);
      }

      this.como.client.socket.addListener(ackChannel, resolvePromise);
      this.como.client.socket.addListener(errChannel, err => {
        console.log('routing:deleteStreamRoute error', err);
        resolvePromise(null);
      });

      this.como.client.socket.send(`como:routing:deleteStreamRoute:req`, fromSourceId, toNodeId);
    });
  }

  propagateStreamFrame(frame) {
    this.como.client.socket.sendBinary('stream', frame)
  }

  /**
   * @param {Int} playerId - Id of the player in the como application, the
   *  given `id` should be unique. In most case, the node id
   *  (e.g. soudnworks.client.id) will be a good choice.
   */
  async createPlayer(playerId = null) {
    return this.players.create(playerId);
  }

  /**
   * @note - this API is not a good thing, it prevents to add user / application
   * defined modules
   */
  async createGraph(session, player, slave) {
    const graphDescription = session.get('graph');
    const graph = new Graph(this.como, graphDescription, session, player, slave);
    await graph.init();

    return graph;
  }
}

export default Project;
