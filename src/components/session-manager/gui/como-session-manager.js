import { LitElement, html, css, nothing } from 'lit';
import { repeat } from 'lit/directives/repeat.js';

import '@ircam/sc-components/sc-text.js';
import '@ircam/sc-components/sc-select.js';
import '@ircam/sc-components/sc-slider.js';
import '@ircam/sc-components/sc-toggle.js';


class ComoScriptManager extends LitElement {
  #unsubscribeSessionChange;

  static properties = {
    expanded: {
      type: Boolean,
      reflect: true,
    },
  };

  static styles = css`
    :host {
      display: block;
      padding: 4px;
      border-bottom: 1px solid #454545;
    }

    header {
      display: block;
    }

    div.create-session {
      padding: 4px 0;
    }

    .session {
      padding: 4px;
      background-color: #242424;
      margin-top: 4px;
    }

    .session:first-child {

    }

    sc-text.small {
      width: 80px;
    }
  `;

  constructor() {
    super();

    this.como = null;
  }

  render() {
    this.como.sessionManager.sessions.sort((a, b) => a.get('name') < b.get('name') ? -1 : 1);

    return html`
      <header>
        <sc-text>Session</sc-text>
        <sc-icon
          type="plus"
          ?active=${this.expanded}
          @input=${e => this.expanded = !this.expanded}
        ></sc-icon>
        <sc-text class="small">new session</sc-text>
        <sc-text
          editable
          @change=${async e => {
            const currentTarget = e.currentTarget;
            try {
              await this.como.sessionManager.createSession(e.detail.value.trim());
              currentTarget.value = '';
            } catch (err) {
              console.log(err);
            }
          }}
        ></sc-text>
      </header>
      ${this.expanded ?
        repeat(this.como.sessionManager.sessions, session => session.get('uuid'), session => {
          return html`
            <div class="session">
              <div>
                <sc-text
                  editable
                  @change=${async e => {
                    try {
                      await this.como.sessionManager.renameSession(session.get('uuid'), e.detail.value.trim())
                    } catch (err) {
                      console.log(err);
                    }
                  }}
                >${session.get('name')}</sc-text>
                <sc-status
                  ?active=${!session.get('dirty')}
                ></sc-status>
                <sc-icon
                  type="save"
                  @input=${async e => {
                    try {
                      await this.como.sessionManager.persistSession(session.get('uuid'));
                    } catch (err) {
                      console.log(err.message);
                    }
                  }}
                ></sc-icon>
                <sc-icon
                  type="delete"
                  @input=${async e => {
                    try {
                      await this.como.sessionManager.deleteSession(session.get('uuid'));
                    } catch (err) {
                      console.log(err.message);
                    }
                  }}
                ></sc-icon>
              </div>
              <div>
                <sc-select
                  .options=${this.como.scriptManager.getList()}
                  placeholder="select default script"
                  value=${session.get('defaultScript')}
                  @change=${e => session.set('defaultScript', e.detail.value || null)}
                ></sc-select>
                <sc-slider
                  number-box
                  min=${session.getDescription('volume').min}
                  max=${session.getDescription('volume').max}
                  value=${session.get('volume')}
                  @input=${e => session.set('volume', e.detail.value)}
                ></sc-slider>
                <sc-toggle
                  ?active=${session.get('mute')}
                  @change=${e => session.set('mute', e.detail.value)}
                ></sc-toggle>
              </div>
              <como-player-manager .como=${this.como} sessionId=${session.get('uuid')}></como-player-manager>
              <como-soundbank-manager .como=${this.como} sessionId=${session.get('uuid')}></como-soundbank-manager>
            </div>
          `;
        }) : nothing
      }
    `
  }

  connectedCallback() {
    super.connectedCallback();

    this.#unsubscribeSessionChange = this.como.sessionManager.sessions.onChange(() => {
      this.requestUpdate();
    });
  }

  disconnectedCallback() {
    this.#unsubscribeSessionChange();

    super.disconnectedCallback();
  }
}

if (customElements.get('como-session-manager') === undefined) {
  customElements.define('como-session-manager', ComoScriptManager);
}
