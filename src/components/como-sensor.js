import { LitElement, html, css } from 'lit';
import MemoryBuffer from '../../../../src/utils/MemoryBuffer.js';

import '@ircam/sc-components/sc-text.js';
import '@ircam/sc-components/sc-toggle.js';

export default class MemoryBuffer {
  #pointer = -1;
  #length = null;
  #stack = null;

  static properties = {
    sourceId: {
      type: String,
      attribute: 'source-id',
    },
  }

  constructor(size, _initData) {
    this.#length = size;
    console.log(this.#length);
    this.#stack = new Array(this.#length);

    // @todo - fill with last values of init data
  }

  get length() {
    return this.#length;
  }

  push(value) {
    this.#pointer = (this.#pointer + 1) % this.#length;
    this.#stack[this.#pointer] = value;
  }

  forEach(func) {
    const zeroIndex = this.#pointer + 1;
    let virtualIndex = 0;

    for (let i = zeroIndex; i < this.#length; i++) {
      func(this.#stack[i], virtualIndex);
      virtualIndex += 1;
    }

    for (let i = 0; i <= this.#pointer; i++) {
      func(this.#stack[i], virtualIndex);
      virtualIndex += 1
    }
  }

  toArray() {
    const copy = new Array(this.#length)
    this.forEach((value, index) => copy[index] = value);
  }
}

// const buffer = new MemoryBuffer(4);
// buffer.push(1); // this should be d
// buffer.push(2);
// buffer.push(3);
// buffer.push(4);
// buffer.push(5);

// let valueExpected = 2;
// let indexExpected = 0;

// buffer.forEach((value, index) => {
//   console.log(value, index);
//   assert.equal(value, valueExpected);
//   assert.equal(index, indexExpected);

//   valueExpected += 1;
//   indexExpected += 1;
// });

class ComoSensor extends LitElement {
  #canvas = null;
  #ctx = null;
  #logicalWidth = 300;
  #logicalHeight = 200;
  #resizeObserver = null;
  #buffer = null;
  #rafId = null;
  // #frameIndex = 0;

  static properties = {
    pause: { type: Boolean }, // pause rendering but not buffering
    duration: { type: Number },
    numChannel: { type: Number },
  };

  static styles = css`
    :host {
      display: inline-block;
      box-sizing: border-box;
      width: 300px;
      height: 200px;
      background-color: white;
      margin-bottom: 60px;
    }
  `;

  constructor() {
    super();

    this.pause = false;
    this.duration = 10;
    this.sourceId = null;
    this.numChannel = 1;
    this.channelIndex = 0;

    this.update = this.update.bind(this);
  }

  render() {
    return html`
      <canvas></canvas>
      <div class="controls">
        <div>
          <sc-text>pause</sc-text>
          <sc-toggle @change=${e => this.pause = e.detail.value}></sc-toggle>
          ${this.numChannel > 1
            ? html`
              <sc-number
                value=0
                min=${0}
                max=${this.numChannel - 1}
                @change=${e => this.channelIndex = e.detail.value}
              ></sc-number>`
            : ''
          }
        </div>
      </div>
    `;
  }

  firstUpdated() {
    super.firstUpdated();

    this.#canvas = this.shadowRoot.querySelector('canvas');
    this.#ctx = this.#canvas.getContext('2d');
  }

  async connectedCallback() {
    super.connectedCallback();

    if (this.sourceId === null) {
      throw new Error('como-sensor: attribute sourceId is mandatory');
    }

    if (!this.como === null) {
      throw new Error('como-sensor: property como not set');
    }

    this.#resizeObserver = new ResizeObserver(entries => {
      const entry = entries[0];
      const { width, height } = entry.contentRect;

      this.#logicalWidth = width * window.devicePixelRatio;
      this.#logicalHeight = height * window.devicePixelRatio;

      this.#canvas.style.width = `${width}px`;
      this.#canvas.style.height = `${height}px`;
      this.#canvas.width = this.#logicalWidth;
      this.#canvas.height = this.#logicalHeight;
    });

    this.#resizeObserver.observe(this);

    this.source = await this.como.sourceManager.getSource(this.sourceId);
    this.source.onUpdate(updates => this.onUpdate(updates));

    if (this.source.get('type') === 'aggregated') {
      const infos = this.source.get('infos');
      this.numChannel = infos.sources.length;
    }
  }

  async disconnectedCallback() {
    this.#resizeObserver.disconnect();

    await this.source.detach();
    this.#buffer = null;

    super.disconnectedCallback();
  }

  onUpdate(updates) {
    let { frame } = updates;

    if (!frame) {
      return;
    }

    frame = frame[this.channelIndex];

    if (!this.#buffer) {
      const numItemsInBuffer = Math.ceil(this.duration * frame.accelerometer.frequency);
      this.#buffer = new MemoryBuffer(numItemsInBuffer);
    }

    this.#buffer.push(frame);

    if (this.pause) {
      return;
    }

    window.cancelAnimationFrame(this.#rafId);

    this.#rafId = window.requestAnimationFrame(() => {
      this.#ctx.clearRect(0, 0, this.#logicalWidth, this.#logicalHeight);

      let x = 0;
      const xDelta = this.#logicalWidth / (this.#buffer.length - 1);
      const normalize = value => (value + 9.81) / (2 * 9.81);
      const colors = ['red', 'blue', 'green'];

      ['x', 'y', 'z'].forEach((field, index) => {
        this.#ctx.strokeStyle = colors[index];
        this.#ctx.beginPath();

        this.#buffer.forEach((value, index) => {
          // console.log(value);
          if (value === undefined) {
            return;
          }

          // como-sensor.js:208 Uncaught TypeError: Cannot read properties of undefined (reading 'x')
          // at como-sensor.js:208:36
          // at MemoryBuffer.forEach (como-sensor.js:46:7)
          // at como-sensor.js:202:22
          // at Array.forEach (<anonymous>)
          // at como-sensor.js:198:23

          let entryValue = null;
          try {
            entryValue = value.accelerometer[field];
          } catch (err) {
            console.log('Faulty entry', value);
            throw err;
          }
          const entryNorm = normalize(entryValue);
          const x = xDelta * index;
          const y = this.#logicalHeight - (this.#logicalHeight * entryNorm);

          if (index === 0) {
            this.#ctx.moveTo(x, y);
          } else {
            this.#ctx.lineTo(x, y);
          }
        });

        this.#ctx.stroke();
      });
    });
  }
}

if (customElements.get('como-sensor') === undefined) {
  customElements.define('como-sensor', ComoSensor);
}
