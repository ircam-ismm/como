import { LitElement, html, css, nothing } from 'lit';
import { ifDefined } from 'lit/directives/if-defined.js';

import '@ircam/sc-components/sc-text.js';
import '@ircam/sc-components/sc-toggle.js';
import '@ircam/sc-components/sc-bang.js';
import '@ircam/sc-components/sc-slider.js';
import '@ircam/sc-components/sc-radio.js';
import '@ircam/sc-components/sc-editor.js';

class ComoPlayerScriptSharedState extends LitElement {
  #unsubscribePlayerUpdate;

  static properties() {

  }

  static styles = css`
    :host {
      display: inline-block;
      padding: 4px;
      margin: 4px;
      outline: 1px solid #565656;
    }

    :host > div {
      padding-bottom: 2px;
    }
  `;

  constructor() {
    super();

    this.como;
    this.player;
  }

  render() {
    if (!this.scriptState) {
      return nothing;
    }
    const description = this.scriptState.getDescription();

    const title = html`<div><sc-text>script state</sc-text></div>`
    const parts = Object.keys(description).map(key => {
      const desc = description[key];

      if (desc.event === true) {
        return html`
          <div>
            <sc-text>${key}</sc-text>
            <sc-bang
              ?active=${this.scriptState.get(key)}
              @input=${e => this.scriptState.set(key, true)}
            ></sc-bang>
          </div>
        `;
      }

      switch (desc.type) {
        case 'boolean': {
          return html`
            <div>
              <sc-text>${key}</sc-text>
              <sc-toggle
                ?active=${this.scriptState.get(key)}
                @change=${e => this.scriptState.set(key, e.detail.value)}
              ></sc-toggle>
            </div>
          `;
        }
        case 'integer': {
          return html`
            <div>
              <sc-text>${key}</sc-text>
              <sc-slider
                number-box
                step="1"
                min=${ifDefined(Number.isFinite(desc.min) ? desc.min : undefined)}
                max=${ifDefined(Number.isFinite(desc.max) ? desc.max : undefined)}
                value=${this.scriptState.get(key)}
                @input=${e => this.scriptState.set(key, e.detail.value)}
              ></sc-slider>
            </div>
          `;
        }
        case 'float': {
          return html`
            <div>
              <sc-text>${key}</sc-text>
              <sc-slider
                number-box
                min=${ifDefined(Number.isFinite(desc.min) ? desc.min : undefined)}
                max=${ifDefined(Number.isFinite(desc.max) ? desc.max : undefined)}
                value=${this.scriptState.get(key)}
                @input=${e => this.scriptState.set(key, e.detail.value)}
              ></sc-slider>
            </div>
          `;
        }
        case 'enum': {
          return html`
            <div>
              <sc-text>${key}</sc-text>
              <sc-radio
                .options=${desc.list}
                value=${this.scriptState.get(key)}
                @change=${e => this.scriptState.set(key, e.detail.value)}
              ></sc-radio>
            </div>
          `
        }
        case 'any': {
          console.log('Interface for "any" type not implemented yet')
          return nothing;
        }
      }
    });

    return [title, ...parts]
  }

  connectedCallback() {
    super.connectedCallback();

    this.#unsubscribePlayerUpdate = this.player.onUpdate(async updates => {
      // script name can be more stable than `scriptSharedStateClassName`
      // because the class name changes on each update of the script, while the scriptName
      // does not.
      if ('scriptSharedStateClassName' in updates) {
        if (updates.scriptSharedStateClassName !== null) {
          this.scriptState = await this.como.playerManager.getScriptSharedState(this.player.get('id'));

          if (this.scriptState) {
            this.scriptState.onUpdate(() => this.requestUpdate());
          }
        } else {
          this.scriptState = null;
        }

        this.requestUpdate();
      }
    }, true);
  }

  disconnectedCallback() {
    super.disconnectedCallback();

    this.#unsubscribePlayerUpdate();
  }

}

if (customElements.get('como-player-script-shared-state') === undefined) {
  customElements.define('como-player-script-shared-state', ComoPlayerScriptSharedState);
}
