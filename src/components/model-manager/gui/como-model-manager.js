import { LitElement, html, css, nothing } from 'lit';
import { repeat } from 'lit/directives/repeat.js';

import '@ircam/sc-components/sc-icon.js';
import '@ircam/sc-components/sc-text.js';

import './como-model-admin.js';

class ComoModelManager extends LitElement {
  #unsubscribeModels = null;

  static properties = {
    expanded: {
      type: Boolean,
      reflect: true,
    },
  };

  constructor() {
    super();
  }

  render() {
    const models = this.como.modelManager.models;

    return html`
      <header>
        <sc-text>Models (${models.length})</sc-text>
        <sc-icon
          type="plus"
          ?active=${this.expanded}
          @input=${() => this.expanded = !this.expanded}
        ></sc-icon>
      </header>
      ${this.expanded ?
        repeat(models, model => model.get('id'), model => {
          return html`
            <como-model-admin
              .como=${this.como}
              model-id=${model.get('id')}
            ></como-model-admin>`;
        }) : nothing
      }
    `;
  }

  connectedCallback() {
    super.connectedCallback();

    this.#unsubscribeModels = this.como.modelManager.models.onChange(() => {
      this.requestUpdate();
    });
  }

  disconnectedCallback() {
    this.#unsubscribeModels();
    super.disconnectedCallback();
  }
}

if (customElements.get('como-model-manager') === undefined) {
  customElements.define('como-model-manager', ComoModelManager);
}
