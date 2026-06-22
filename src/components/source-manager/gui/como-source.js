import { LitElement, html, css, nothing } from 'lit';

import { rawLink } from '@ircam/comote-helpers/qrcode.js';

import '@ircam/sc-components/sc-text.js';
import '@ircam/sc-components/sc-status.js';
import '@ircam/sc-components/sc-record.js';
import '@ircam/sc-components/sc-qrcode.js';

class ComoSource extends LitElement {
  #unsubscribeSource;

  static properties = {
    plotSensors: {
      type: Boolean,
      reflect: true,
      attribute: 'plot-sensors',
    },
    showQrCode: {
      type: Boolean,
      reflect: true,
      attribute: 'show-qr-code',
    },
  };

  static styles = css`
    :host {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }
  `;

  constructor() {
    super();

    this.como = null;
    this.source = null;

    this.plotSensors = false;
  }

  render() {
    return html`
      <div style="width: 100%; display: flex; gap: 10px; align-items: center;">
        <sc-text>source: ${this.source.get('id')}</sc-text>
        <sc-status ?active=${this.source.get('active')}></sc-status>
        <sc-record
          ?value=${this.source.get('record')}
          @change=${e => this.source.set('record', e.detail.value)}
        ></sc-record>
        <sc-icon
          type="waveform"
          ?active=${this.plotSensors}
          @input=${() => this.plotSensors = !this.plotSensors}
        ></sc-icon>
      </div>
      ${this.plotSensors
        ? html`<como-sensor .como=${this.como} source-id=${this.source.get('id')}></como-sensor>`
        : nothing
      }
      <!-- QRCode for comote -->
      ${this.source.get('type') === 'comote' ?
        html`
          <sc-icon
            type="gear"
            ?active=${this.showQrCode}
            @input=${() => this.showQrCode = !this.showQrCode}
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
