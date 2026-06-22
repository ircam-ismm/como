import { LitElement, html, css } from 'lit';

import '@ircam/sc-components/sc-text.js';
import '@ircam/sc-components/sc-toggle.js';
import '@ircam/sc-components/sc-number.js';

// This is the other file you can edit

export default class MemoryBuffer {
  #pointer = -1;
  #length = null;
  #stack = null;

  static properties = {
    sourceId: {
      type: String,
      attribute: 'source-id',
    },
  };

  constructor(size, _initData) {
    this.#length = size;
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
      virtualIndex += 1;
    }
  }

  toArray() {
    const copy = new Array(this.#length);
    this.forEach((value, index) => copy[index] = value);
  }
}

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
    sourceId: {
      type: String,
      attribute: 'source-id',
    },
    sensorType: {
      type: String,
      attribute: 'sensor-type',
    },
  };

  static styles = css`
    :host {
      display: inline-block;
      box-sizing: border-box;
      background-color: white;
      margin-bottom: 60px;
      display: flex;
      flex-direction: row;
      width: 700px;
      height: 270px;
    }

    .controls {
      width: 300px;
      display: flex;
      flex-direction: column;
      background-color: var(--sc-color-primary-1);
    }

    .controls > div {
      display: flex;
      flex-direction: row;
    }

    .controls > div.main {
      justify-content: space-between;
    }

    .controls > div.main div {
      display: flex;
    }

    .controls > div.sensor-controls sc-text {
      width: 35px;
      text-align: center;
    }
  `;

  constructor() {
    super();

    this.pause = false;
    this.duration = 10;
    this.sourceId = null;
    this.numChannel = 1;
    this.channelIndex = 0;

    this.sensorsInfos = {
      accelerometer: {
        unit: 'm/s^2',
        normalizeFactor: 2 * 9.81,  // 2G
        axis: ['x', 'y', 'z'],
        colors: ['#003a7d', '#ff73b6', '#c6b201'], // dark blue, pink, yellow
        show: true,
      },
      gyroscope: {
        unit: 'rad/s',
        normalizeFactor: 4.28, // ±245 dps ~ ±4.28 rad/s
        axis: ['x', 'y', 'z'],
        colors: ['#008dff', '#4ecd8b', '#ff9d3a'], // med blue, green, orange
        show: true,
      },
      magnetometer: {
        unit: 'uT',
        normalizeFactor: 400, // ±4 gauss = ±400 en uT
        axis: ['x', 'y', 'z'],
        colors: ['#c701ff', '#d83034', '#326b77'], // purple, red, green blue
        show: true,
      },
      gravity: {
        unit: 'm/s^2',
        normalizeFactor: 2 * 9.81, // ±4 gauss = ±400 en uT
        axis: ['x', 'y', 'z'],
        colors: ['#006b0c', '#44347f', '#714404'], // green, purple, brown
        show: true,
      },
    };

    this.update = this.update.bind(this);
  }

  render() {
    return html`
      <div class="controls">
        <div class="main">
          <div>
            <sc-text style="width: 85px;">channel</sc-text>
            <sc-number
              style="width: 50px;"
              integer
              value=0
              min=${0}
              max=${this.numChannel - 1}
              @change=${e => this.channelIndex = e.detail.value}
            ></sc-number>
          </div>
          <div>
            <sc-text style="width: 85px;">pause</sc-text>
            <sc-toggle @change=${e => this.pause = e.detail.value}></sc-toggle>
          </div>
        </div>
        ${Object.keys(this.sensorsInfos).map(sensorType => {
          return html`
            <div>
              <sc-toggle
                value=${this.sensorsInfos[sensorType].show}
                @change=${e => this.sensorsInfos[sensorType].show = e.detail.value}
              ></sc-toggle>
              <sc-text>${sensorType} (${this.sensorsInfos[sensorType].unit})</sc-text>
            </div>
            <div class="sensor-controls">
              <sc-number
                .value=${this.sensorsInfos[sensorType].normalizeFactor}
                @change=${e => this.sensorsInfos[sensorType].normalizeFactor = e.detail.value}
              ></sc-number>
              ${this.sensorsInfos[sensorType].axis.map((value, index) => {
                return html`
                  <sc-text>${value}</sc-text>
                  <sc-color-picker
                    value=${this.sensorsInfos[sensorType].colors[index]}
                    @change=${e => this.sensorsInfos[sensorType].colors[index] = e.detail.value}
                  ></sc-color-picker>
                `
              })}
            </div>
          `;
        })}
      </div>
      <canvas></canvas>
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

    if (this.como === null) {
      throw new Error('como-sensor: property como not set');
    }

    this.#resizeObserver = new ResizeObserver(entries => {
      // const entry = entries[0];
      let { width, height } = this.shadowRoot.querySelector('canvas');
      width = Math.max(width, 400); // min to 400px
      height = Math.max(height, 270); // min to 400px

      this.#logicalWidth = width * window.devicePixelRatio;
      this.#logicalHeight = height * window.devicePixelRatio;

      this.#canvas.style.width = `${width}px`;
      this.#canvas.style.height = `${height}px`;
      this.#canvas.width = this.#logicalWidth;
      this.#canvas.height = this.#logicalHeight;
    });

    this.#resizeObserver.observe(this);

    this.source = await this.como.sourceManager.getSource(this.sourceId);
    this.source.onUpdate(updates => this.#onUpdate(updates));

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

  #onUpdate = (updates) => {
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

      const xDelta = this.#logicalWidth / (this.#buffer.length - 1);

      for (let [sensorType, infos] of Object.entries(this.sensorsInfos)) {
        if (infos.show === false) {
          continue;
        }

        const normalizeFactor = infos.normalizeFactor;

        infos.axis.forEach((axis, index) => {
          this.#ctx.strokeStyle = infos.colors[index];
          this.#ctx.beginPath();

          this.#buffer.forEach((frame, index) => {
            if (frame === undefined) {
              return;
            }

            let value = null;

            try {
              value = frame[sensorType][axis];
            } catch (err) {
              console.log('Faulty entry', frame);
              throw err;
            }

            const norm = (value + normalizeFactor) / (2. * normalizeFactor);
            const x = xDelta * index;
            const y = this.#logicalHeight - (this.#logicalHeight * norm);

            if (index === 0) {
              this.#ctx.moveTo(x, y);
            } else {
              this.#ctx.lineTo(x, y);
            }
          });

          this.#ctx.stroke();
        });
      }
    });
  };
}

if (customElements.get('como-sensor') === undefined) {
  customElements.define('como-sensor', ComoSensor);
}
