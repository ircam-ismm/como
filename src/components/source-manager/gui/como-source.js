import { LitElement, html, css } from 'lit';

import '@ircam/sc-components/sc-text.js';
import '@ircam/sc-components/sc-status.js';
import '@ircam/sc-components/sc-record.js';

class ComoSource extends LitElement {
  #unsubscribeSource;

  static properties = {

  };

  static styles = css`

  `;

  constructor() {
    super();

    // this.como = null;
    this.source = null;
  }

  render() {
    return html`
      <sc-text>source: ${this.source.get('id')}</sc-text>
      <sc-status ?active=${this.source.get('active')}></sc-status>
      <sc-record
        ?value=${this.source.get('record')}
        @change=${e => this.source.set('record', e.detail.value)}
      ></sc-record>

      <p>todo "create player from source"</p>
    `;
  }

  connectedCallback() {
    super.connectedCallback();

    this.#unsubscribeSource = this.source.onUpdate(updates => {
      this.requestUpdate();
    });
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.#unsubscribeSource();
  }
}

if (customElements.get('como-source') === undefined) {
  customElements.define('como-source', ComoSource);
}
