
import { LitElement, html, css } from 'lit';
import Plotly from 'plotly.js-basic-dist'

class ComoSensorPlot extends LitElement {
  #value = null;

  static properties = {
    value: { type: String },
  }

  get value() {
    return this.#value;
  }

  set value(value) {
    console.log(value);
    this.#value = value;
    this.updateGraph();
  }

  static styles = css`
    :host {
      display: block;
      box-sizing: border-box;
      width: 800px;
      height: 200px;
      background-color: grey;
      /* margin-bottom: 60px; */
      outline: 1px solid grey;
    }
  `;

  constructor() {
    super();

    this.#value = null;
  }

  render() {
    return html`<div class="plot"></div>`;
  }

  updateGraph() {
    const $container = this.shadowRoot.querySelector('.plot');
    const data = this.#value
      .split('\n')
      .map(line => line.trim())
      .filter(line => line !== '')
      .map(line => JSON.parse(line));

    console.log(data);

    let startTime = null;
    const timeseries = [];
    const x = [];
    const y = [];
    const z = [];

    data.forEach(d => {
      const { gravity } = d;

      if (startTime === null) {
        startTime = gravity.timestamp;
      }

      timeseries.push((gravity.timestamp - startTime) / 1000);
      x.push(gravity.x);
      y.push(gravity.y);
      z.push(gravity.z);
    });
    // gravity { x, y, z }
    const traces = [
      {
        x: timeseries,
        y: x,
        type: 'scatter',
        name: 'gravity x',
      },
      {
        x: timeseries,
        y: y,
        type: 'scatter',
        name: 'gravity y',
      },
      {
        x: timeseries,
        y: z,
        type: 'scatter',
        name: 'gravity z',
      },
    ];

    Plotly.newPlot($container, traces);
  }
}

if (customElements.get('como-sensor-plot') === undefined) {
  customElements.define('como-sensor-plot', ComoSensorPlot);
}

