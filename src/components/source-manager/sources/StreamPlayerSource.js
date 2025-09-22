import AbstractSource from './AbstractSource.js';
import {
  isString,
} from '@ircam/sc-utils';

import {
  parseTxtAsStream,
} from '../utils/parse-txt-as-stream.js';

export default class StreamPlayerSource extends AbstractSource {
  static type = 'stream-player';

  #config;
  #stream;
  #currentFrame;
  // @todo - define unit (frame or time) for seek and loop
  // #startTime; // scheduler time
  // #firstFrameTime; // stream time
  #processorBinded;
  #timeoutId;
  #forcePeriod = null; // useful for testing

  constructor(como, config) {
    super(como);

    this.#config = config;

    if (Array.isArray(this.#config.stream)) {
      this.#stream = this.#config.stream;
    } else if (isString(this.#config.stream)) {
      this.#stream = parseTxtAsStream(this.#config.stream);
    } else {
      if (!('stream' in this.#config)) {
        throw new Error(`Cannot construct StreamPlayerSource: option.stream should either an Array or a blob`);
      } else {
        throw new Error(`Cannot construct StreamPlayerSource: option.stream is mandatory`);
      }
    }

    if (Number.isFinite(this.#config.forcePeriod)) {
      this.#forcePeriod = Math.max(0.001, this.#config.forcePeriod / 1000);
    }

    if (this.#stream.length < 2) {
       throw new Error(`Cannot construct StreamPlayerSource: Invalid stream, should contain at least 2 frames`);
    }

    this.#processorBinded = this.#processor.bind(this);
  }

  async init() {
    const firstChannel = this.#stream[0];
    const firstFrameTime = firstChannel[0].timestamp / 1000; // sec
    const lastFrameTime = firstChannel[firstChannel.length - 1].timestamp / 1000; // sec
    const duration = lastFrameTime - firstFrameTime;

    const state = await this.como.stateManager.create(`${this.como.sourceManager.name}:source`, {
      id: this.#config.id,
      type: StreamPlayerSource.type,
      nodeId: this.como.nodeId,
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
              // this.#startTime = this.como.scheduler.currentTime;
              this.como.scheduler.add(this.#processorBinded);
              state.set({ active: true });
            }
          }
        }
      }
    });

    super.init(state);
  }

  async delete() {
    if (this.como.scheduler.has(this.#processorBinded)) {
      clearTimeout(this.#timeoutId);
      this.como.scheduler.remove(this.#processorBinded);
    }

    await this.state.delete();
  }

  #processor(currentTime, _, event) {
    const frame = this.#stream[this.#currentFrame];
    let frameTime = frame[0].timestamp / 1000;
    // const position = frameTime - this.#firstFrameTime;

    this.#timeoutId = setTimeout(() => {
      this.state.set({
        frame,
      });
    }, event.tickLookahead * 1000);

    this.#currentFrame = this.#currentFrame + 1;

    if (this.state.get('loop')) {
      if (this.#currentFrame >= this.#stream.length) {
        this.#currentFrame = 0;
        // take an arbitrary dt
        const dt = this.#forcePeriod === null
          ? this.#forcePeriod
          : (this.#stream[1][0].timestamp - this.#stream[0][0].timestamp) / 1000;
        return currentTime + dt;
      }
    }

    // if not looping and end of stream, stop the stream
    if (!this.state.get('loop') && this.#currentFrame >= this.#stream.length) {
      this.state.set({
        control: 'pause',
        active: false,
      });

      return null; // remove from scheduler
    }

    const nextFrameTime = this.#stream[this.#currentFrame][0].timestamp / 1000;
    const dt = this.#forcePeriod
      ? this.#forcePeriod
      : nextFrameTime - frameTime;

    return currentTime + dt;
  }
}
