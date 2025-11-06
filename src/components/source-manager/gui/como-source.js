import { LitElement, html, css, nothing } from 'lit';

import '@ircam/sc-components/sc-text.js';
import '@ircam/sc-components/sc-status.js';
import '@ircam/sc-components/sc-record.js';

class ComoSource extends LitElement {
  #unsubscribeSource;

  static properties = {
    plotSensor: {
      type: Boolean,
      reflect: true,
      attribute: 'plot-sensor',
    },
  };

  static styles = css`

  `;

  constructor() {
    super();

    this.como = null;
    this.source = null;

    this.plotSensor = false;
  }

  render() {
    return html`
      <sc-text>source: ${this.source.get('id')}</sc-text>
      <sc-status ?active=${this.source.get('active')}></sc-status>
      <sc-record
        ?value=${this.source.get('record')}
        @change=${e => this.source.set('record', e.detail.value)}
      ></sc-record>
      <sc-icon
        type="waveform"
        ?active=${this.plotSensor}
        @input=${e => this.plotSensor = !this.plotSensor}
      ></sc-icon>
      ${this.plotSensor
        ? html`<como-sensor .como=${this.como} source-id=${this.source.get('id')}></como-sensor>`
        : nothing
      }
    `;
  }

  connectedCallback() {
    super.connectedCallback();
    this.#unsubscribeSource = this.source.onUpdate(() => this.requestUpdate());
  }

  disconnectedCallback() {
    this.#unsubscribeSource();
    super.disconnectedCallback();
  }
}

if (customElements.get('como-source') === undefined) {
  customElements.define('como-source', ComoSource);
}
