import { LitElement, html, css, nothing } from 'lit';
import { repeat } from 'lit/directives/repeat.js';

import '@ircam/sc-components/sc-button.js';
import '@ircam/sc-components/sc-editor.js';
import '@ircam/sc-components/sc-icon.js';
import '@ircam/sc-components/sc-text.js';

import JSON5 from 'json5';

class ComoModelAdmin extends LitElement {
  static styles = css`
    :host {
      display: flex;
      flex-direction: row;
      background-color: #232323;
      padding: 4px;
      gap: 10px;
    }

    .examples {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
  `;

  static properties = {
    modelId: {
      type: String,
      reflect: true,
      attribute: 'model-id',
    },
  };

  #unsubscribeModels = null;

  constructor() {
    super();
  }

  render() {
    const model = this.como.modelManager.models.find(model => model.get('id') === this.modelId);

    if (!model) {
      return nothing;
    }

    return html`
      <sc-text>${model.get('id')}</sc-text>
      <sc-editor
        value=${JSON5.stringify(model.get('config'), null, 2)}
        @change=${e => {
          try {
            const config = JSON5.parse(e.detail.value);
            model.set('config', config);
          } catch (err) {
            console.log(err.message);
          }
        }}
        save-button
      ></sc-editor>
      <div class="examples">
        <div>
          <sc-text>Examples</sc-text>
          <sc-button
            @input=${() => this.como.modelManager.clearExamples(model.get('id'))}
          >clear all</sc-button>
        </div>
        ${repeat(Object.entries(model.get('infos')), ([label]) => label, ([label, infos]) => {
          return html`
            <div>
              <sc-text>${label} (${infos.numExamples})</sc-text>
              <sc-icon
                type="delete"
                @input=${() => this.como.modelManager.clearExamples(model.get('id'), label)}
              ></sc-icon>
              ${infos.uuids.map((uuid, index) => {
                return html`
                  <sc-button
                    @input=${() => this.como.modelManager.deleteExample(model.get('id'), uuid)}
                  >delete example ${index + 1}</sc-button>
                `;
              })}
            </div>
          `;
        })}
      </div>
    `;
  }

  connectedCallback() {
    super.connectedCallback();

    this.#unsubscribeModels = this.como.modelManager.models.onUpdate(model => {
      if (model.get('id') === this.modelId) {
        this.requestUpdate();
      }
    });
  }

  disconnectedCallback() {
    this.#unsubscribeModels();
    super.disconnectedCallback();
  }
}

if (customElements.get('como-model-admin') === undefined) {
  customElements.define('como-model-admin', ComoModelAdmin);
}

