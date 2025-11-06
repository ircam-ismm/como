import { LitElement, html, css, nothing } from 'lit';
import { repeat } from 'lit/directives/repeat.js';

import '@ircam/sc-components/sc-text.js';
import '@ircam/sc-components/sc-icon.js';
import '@ircam/sc-components/sc-modal.js';
import './como-source.js';

class ComoSourceManager extends LitElement {
  static properties = {
    expanded: {
      type: Boolean,
      reflect: true,
    },
  };

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      padding: 4px;
      border-bottom: 1px solid #454545;
    }

    section {
      display: block;
    }

    como-source {
      display: block;
      margin-bottom: 2px;
    }

    como-source:first-child {
      margin-top: 4px;
    }
  `;

  constructor() {
    super();

    this.como = null;
    this.expanded = false;
  }

  render() {
    return html`
      <header>
        <sc-text>Sources</sc-text>
        <sc-icon
          type="plus"
          ?active=${this.expanded}
          @input=${e => this.expanded = !this.expanded}
        ></sc-icon>
      </header>
      <section>
        ${this.expanded
          ? repeat(this.como.sourceManager.sources, source => source.get('id'), source => {
              return html`
                <como-source .como=${this.como} .source=${source}></como-source>
              `;
            })
          : nothing
        }
      </section>
    `
  }
}

if (!customElements.get('como-source-manager')) {
  customElements.define('como-source-manager', ComoSourceManager);
}
