import { LitElement, html, css, nothing } from 'lit';
import { repeat } from 'lit/directives/repeat.js';

import '@ircam/sc-components/sc-text.js';
import '@ircam/sc-components/sc-transport.js';
import '@ircam/sc-components/sc-icon.js';
import '@ircam/sc-components/sc-toggle.js';

class ComoSoundbankManager extends LitElement {
  #unsubscribeSession;
  #unsubscribeSoundbankManager;

  static properties = {
    sessionId: {
      type: String,
    },
    open: {
      type: Boolean,
      reflect: true,
    },
  };

  static styles = css`
    .header {
      margin-bottom: 8px;
    }

    audio {
      display: none;
    }
  `;

  constructor() {
    super();

    this.como = null;
    this.session = null;

    this.open = true;
  }

  connectedCallback() {
    super.connectedCallback();

    if (this.sessionId) {
      this.session = this.como.sessionManager.getSession(this.sessionId);
      this.#unsubscribeSession = this.session.onUpdate(() => this.requestUpdate());
    }

    this.#unsubscribeSoundbankManager = this.como.soundbankManager.onUpdate(() => this.requestUpdate());

  }

  disconnectedCallback() {
    this.#unsubscribeSession();
    this.#unsubscribeSoundbankManager();

    super.disconnectedCallback();
  }

  render() {
    const urlMap = this.como.soundbankManager.getTreeAsUrlMap();

    // @todo
    // - delete
    // - upload

    return html`
      <div class="header">
        <sc-text>soundbank</sc-text>
        <sc-icon
          @click=${e => this.open = !this.open}
          ?active=${this.open}
          type="plus"
        ></sc-icon>
      </div>

      ${this.open
        ? repeat(Object.entries(urlMap), ([url]) => url, ([name, url]) => {
            return html`
              <div>
                <sc-text>${name}</sc-text>
                <sc-transport
                  .buttons=${['play', 'stop']}
                  value="stop"
                  @change=${e => {
                    const audio = e.currentTarget.nextElementSibling;

                    if (e.detail.value === 'play') {
                      audio.play();
                    } else {
                      audio.pause();
                      audio.currentTime = 0;
                    }
                  }}
                ></sc-transport>
                <audio src=${url} controls></audio>
                ${this.session
                  ? html`
                      <sc-toggle
                        ?active=${this.session.getUnsafe('soundbank').includes(name)}
                        @change=${e => {
                          const set = new Set(this.session.getUnsafe('soundbank'));
                          e.detail.value ? set.add(name) : set.delete(name);
                          this.session.set({ soundbank: Array.from(set) })
                        }}
                      ></sc-toggle>
                    `
                  : nothing // @todo - upload / delete
                }
              </div>
            `
          })
        : nothing
      }
    `
  }
}

if (customElements.get('como-soundbank-manager') === undefined) {
  customElements.define('como-soundbank-manager', ComoSoundbankManager);
}
