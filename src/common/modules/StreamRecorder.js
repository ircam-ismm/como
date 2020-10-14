import BaseModule from './BaseModule';
import { copyFrameData } from './helpers';

class StreamRecorder extends BaseModule {
  constructor(graph, type, id, options) {
    options = Object.assign({
      name: `player-${graph.player.get('id')}`,
      bufferSize: 50,
    }, options);

    super(graph, type, id, options);

    this.writer = null;

    this.unsubscribe = this.graph.player.subscribe(async updates => {
      if ('streamRecord' in updates) {
        if (updates['streamRecord'] === true) {
          const recordingName = this.options.name;
          const logger = graph.como.experience.plugins['logger'];

          this.writer = await logger.create(recordingName, {
            bufferSize: this.options.bufferSize,
          });
        } else {
          if (this.writer) {
            this.writer.close();
          }

          this.writer = null;
        }
      }
    });
  }

  destroy() {
    this.unsubscribe();
  }

  // @note - deadend
  process(inputFrame) {
    if (this.writer !== null) {
      const copy = {}
      copyFrameData(inputFrame.data, copy);
      this.writer.write(copy);
    }
  }
}

export default StreamRecorder;
