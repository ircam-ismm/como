import { LitElement, html, css, nothing } from 'lit';

import { rawLink } from '@ircam/comote-helpers/qrcode.js';

import '@ircam/sc-components/sc-text.js';
import '@ircam/sc-components/sc-status.js';
import '@ircam/sc-components/sc-record.js';
import '@ircam/sc-components/sc-qrcode.js';

class ComoSource extends LitElement {
  #unsubscribeSource;

  static properties = {
    plotSensor: {
      type: Boolean,
      reflect: true,
      attribute: 'plot-sensor',
    },
    showQrCode: {
      type: Boolean,
    },
  };

  static styles = css`

  `;

  constructor() {
    super();

    this.como = null;
    this.source = null;

    this.plotSensor = false;
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
      <!-- QRCode for comote -->
      ${this.source.get('type') === 'comote' ?
        html`
          <sc-icon
            type="gear"
            ?active=${this.showQrCode}
            @input=${e => this.showQrCode = !this.showQrCode}
          ></sc-icon>
          ${this.showQrCode
            ? html`<sc-qrcode value=${rawLink(this.source.get('infos'))}></sc-qrcode>`
            : nothing
          }
        ` : nothing
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
