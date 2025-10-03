import { LitElement, html, css, nothing } from 'lit';
import { repeat } from 'lit/directives/repeat.js';

import '@ircam/sc-components/sc-text.js';
import '@ircam/sc-components/sc-select.js';
import '@ircam/sc-components/sc-slider.js';
import '@ircam/sc-components/sc-toggle.js';


class ComoScriptManager extends LitElement {
  #unsubscribeSessionChange;

  static properties() {

  }

  static styles = css`
    :host {
      display: block;
    }

    .session {
      padding: 10px 0;
      border-bottom: 1px solid #efefef;
    }
  `;

  constructor() {
    super();

    this.como = null;
  }

  render() {
    this.como.sessionManager.sessions.sort((a, b) => a.get('name') < b.get('name') ? -1 : 1);

    return html`
      <div>
        <sc-text>create session</sc-text>
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
      </div>
      ${repeat(this.como.sessionManager.sessions, session => session.get('uuid'), session => {
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
              <sc-text>${session.get('uuid')}</sc-text>
              <sc-select
                .options=${this.como.scriptManager.getList()}
                placeholder="select default script"
                value=${session.get('defaultScript')}
                @change=${e => session.set('defaultScript', e.detail.value || null)}
              ></sc-select>
              <sc-slider
                min=${session.getDescription('volume').min}
                max=${session.getDescription('volume').max}
                value=${session.get('volume')}
                @input=${e => session.set('volume', e.detail.value)}
              ></sc-slider>
              <sc-toggle
                ?active=${session.get('mute')}
                @change=${e => session.set('mute', e.detail.value)}
              ></sc-toggle>
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
            <como-player-manager .como=${this.como} sessionId=${session.get('uuid')}></como-player-manager>
          </div>
        `;
      })}
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
