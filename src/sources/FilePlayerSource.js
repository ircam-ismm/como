import AbstractSource from './AbstractSource.js';
import {
  parseTxtAsStream
} from '../utils/parse-txt-as-stream.js';

export default class FilePlayerSource extends AbstractSource {
  static type = 'file-player';

  #config;
  #stream;
  #startTime; // scheduler time
  #currentFrame;
  #firstFrameTime; // stream time
  #processorBinded;
  #timeoutId;

  constructor(como, config) {
    super(como);

    this.#config = config;
    this.#stream = parseTxtAsStream(this.#config.data);

    this.#processorBinded = this.#processor.bind(this);
  }

  get id() {
    return this.#config.id;
  }

  async init() {
    const firstChannel = this.#stream[0];
    const firstFrameTime = firstChannel[0].timestamp / 1000; // sec
    const lastFrameTime = firstChannel[firstChannel.length - 1].timestamp / 1000; // sec
    const duration = lastFrameTime - firstFrameTime;

    this.#firstFrameTime = firstFrameTime;

    const state = await this.como.stateManager.create('source', {
      id: this.#config.id,
      type: FilePlayerSource.type,
      infos: {
        // this
      },
      control: 'pause',
      duration,
    });

    state.onUpdate(updates => {
      for (let [key, value] of Object.entries(updates)) {
        switch (key) {
          case 'control': {
            if (value === 'pause') {
              if (this.como.scheduler.has(this.#processorBinded)) {
                clearTimeout(this.#timeoutId);
                this.como.scheduler.remove(this.#processorBinded);
                state.set({ active: false });
              }
            } else {
              this.#currentFrame = 0; // @todo
              this.#startTime = this.como.scheduler.currentTime;
              this.como.scheduler.add(this.#processorBinded);
              state.set({ active: true });
            }
          }
        }
      }
    });

    state.onDelete(() => {
      if (this.como.scheduler.has(this.#processorBinded)) {
        clearTimeout(this.#timeoutId);
        this.como.scheduler.remove(this.#processorBinded);
      }
    });

    super.init(state);
  }

  async delete() {
    await this.state.delete();
  }

  #processor(currentTime, _, event) {
    const frame = this.#stream[this.#currentFrame];
    const frameTime = frame[0].timestamp / 1000;
    const position = frameTime - this.#firstFrameTime;

    this.#timeoutId = setTimeout(() => {
      this.state.set({ frame, position });
    }, event.tickLookahead * 1000);

    this.#currentFrame = this.#currentFrame + 1;

    if (this.#currentFrame < this.#stream.length) {
      const nextFrameTime = this.#stream[this.#currentFrame][0].timestamp / 1000;
      const dt = nextFrameTime - frameTime;

      return currentTime + dt;
    } else {
      this.state.set({
        control: 'pause',
        active: false,
      });

      return null; // remove from scheduler
    }
  }
}
