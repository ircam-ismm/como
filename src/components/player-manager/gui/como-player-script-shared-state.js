import { LitElement, html, css, nothing } from 'lit';
import { ifDefined } from 'lit/directives/if-defined.js';

import { isString } from '@ircam/sc-utils';
import JSON5 from 'json5';

import '@ircam/sc-components';

async function stringToModule(str) {
  const module = `
export function template(html, como, player, state) {
  return html\`${str}\`;
}
  `;
  const blob = new Blob([module], { type: 'text/javascript' });
  const url = URL.createObjectURL(blob);
  const { template } = await import(/* webpackIgnore: true */url);
  URL.revokeObjectURL(url);
  return template;
}

class ComoPlayerScriptSharedState extends LitElement {
  #unsubscribePlayerUpdate;
  #templates = new Map();

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
    if (!this.state) {
      return nothing;
    }
    const description = this.state.getDescription();

    const title = html`<div><sc-text>script state</sc-text></div>`;
    const parts = Object.entries(description).map(([name, desc]) => {
      if (this.#templates.has(name)) {
        const template = this.#templates.get(name);
        return template(html, this.como, this.player, this.state);
      }

      if (desc.event === true) {
        return html`
          <div>
            <sc-text>${name}</sc-text>
            <sc-bang
              ?active=${this.state.get(name)}
              @input=${() => this.state.set(name, true)}
            ></sc-bang>
          </div>
        `;
      }

      switch (desc.type) {
        case 'boolean': {
          return html`
            <div>
              <sc-text>${name}</sc-text>
              <sc-toggle
                ?active=${this.state.get(name)}
                @change=${e => this.state.set(name, e.detail.value)}
              ></sc-toggle>
            </div>
          `;
        }
        case 'integer': {
          return html`
            <div>
              <sc-text>${name}</sc-text>
              <sc-slider
                number-box
                step="1"
                min=${ifDefined(Number.isFinite(desc.min) ? desc.min : undefined)}
                max=${ifDefined(Number.isFinite(desc.max) ? desc.max : undefined)}
                value=${this.state.get(name)}
                @input=${e => this.state.set(name, e.detail.value)}
              ></sc-slider>
            </div>
          `;
        }
        case 'float': {
          return html`
            <div>
              <sc-text>${name}</sc-text>
              <sc-slider
                number-box
                min=${ifDefined(Number.isFinite(desc.min) ? desc.min : undefined)}
                max=${ifDefined(Number.isFinite(desc.max) ? desc.max : undefined)}
                value=${this.state.get(name)}
                @input=${e => this.state.set(name, e.detail.value)}
              ></sc-slider>
            </div>
          `;
        }
        case 'enum': {
          if (desc.list.length < 4) {
            return html`
              <div>
                <sc-text>${name}</sc-text>
                <sc-radio
                  .options=${desc.list}
                  value=${this.state.get(name)}
                  @change=${e => this.state.set(name, e.detail.value)}
                ></sc-radio>
              </div>
            `;
          } else {
            return html`
              <div>
                <sc-text>${name}</sc-text>
                <sc-select
                  .options=${desc.list}
                  value=${this.state.get(name)}
                  @change=${e => this.state.set(name, e.detail.value)}
                ></sc-select>
              </div>
            `;
          }
        }
        case 'string': {
          return html`
            <div>
              <sc-text>${name}</sc-text>
              <sc-text
                editable
                .value=${this.state.get(name)}
                @change=${e => this.state.set(name, e.detail.value)}
              ></sc-text>
            </div>
          `;
        }
        case 'any': {
          return html`
            <div>
              <sc-text>${name}</sc-text>
              <sc-icon
                type="info"
                title="Support only JSON-like format"
              ></sc-icon>
              <sc-editor
                .options=${desc.list}
                value=${JSON5.stringify(this.state.get(name), null, 2)}
                @change=${e => JSON5.parse(this.state.set(name, e.detail.value))}
              ></sc-editor>
            </div>
          `;
        }
      }
    });

    return [title, ...parts];
  }

  connectedCallback() {
    super.connectedCallback();

    this.#unsubscribePlayerUpdate = this.player.onUpdate(async updates => {
      // script name can be more stable than `scriptSharedStateClassName`
      // because the class name changes on each update of the script, while the scriptName
      // does not.
      if ('scriptSharedStateClassName' in updates) {
        if (updates.scriptSharedStateClassName !== null) {
          this.state = await this.como.playerManager.getScriptSharedState(this.player.get('id'));

          // compute template module if any
          const description = this.state.getDescription();
          for (let [name, desc] of Object.entries(description)) {
            if (isString(desc.metas?.gui)) {
              const template = await stringToModule(desc.metas.gui);
              this.#templates.set(name, template);
            }
          }

          if (this.state) {
            this.state.onUpdate(() => this.requestUpdate());
          }
        } else {
          this.state = null;
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
