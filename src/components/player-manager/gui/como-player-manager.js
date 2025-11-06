import { LitElement, html, css, nothing } from 'lit';
import { repeat } from 'lit/directives/repeat.js';

import '@ircam/sc-components/sc-text.js';
import '@ircam/sc-components/sc-select.js';
import '@ircam/sc-components/sc-status.js';
import '@ircam/sc-components/sc-modal.js';

import './como-player-script-shared-state.js';

class ComoPlayerManager extends LitElement {
  #unsubscribePlayersChange;
  #unsubscribeSessionsChange;
  #unsubscribeSourcesChange;

  static properties = {
    sessionId: {
      type: String,
      reflect: true,
    },
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

    .player {
      padding: 4px;
      background-color: #232323;
      margin: 2px 0;
    }

    .player > div {
      padding-bottom: 2px;
    }

    sc-text.small {
      width: 80px;
    }
  `;

  constructor() {
    super();

    this.como = null;
    this.sessionId = null; // filter players by sessionId
    this.sessionList = {}; // for drop-down menu

  }

  render() {
    const players = this.sessionId !== null
      ? this.como.playerManager.players.filter(player => player.get('sessionId') === this.sessionId)
      : this.como.playerManager.players;

    return html`
      <header>
        <sc-text>Players (${players.length})</sc-text>
        <sc-icon
          type="plus"
          ?active=${this.expanded}
          @input=${e => this.expanded = !this.expanded}
        ></sc-icon>
      </header>
      ${this.expanded ?
        repeat(players, player => player.get('id'), player => {
          const source = this.como.sourceManager.getSourceFiltered(player.get('sourceId'));
          const session = this.como.sessionManager.getSession(player.get('sessionId'));

          return html`
            <div class="player">
              <div>
                <sc-text>${player.get('id')}</sc-text>
                <como-source .como=${this.como} .source=${source}></como-source>
              </div>
              <div>
                <sc-text class="small">session</sc-text>
                <sc-select
                  .options=${this.sessionList}
                  value=${session ? session.get('uuid') : null}
                  @change=${async e => await player.set('sessionId', e.detail.value)}
                >/</sc-select>
              </div>
              <div>
                <sc-text class="small">volume</sc-text>
                <sc-slider
                  number-box
                  min=${player.getDescription('volume').min}
                  max=${player.getDescription('volume').max}
                  value=${player.get('volume')}
                  @input=${e => player.set('volume', e.detail.value)}
                ></sc-slider>
                <sc-text class="small">mute</sc-text>
                <sc-toggle
                  ?value=${player.get('mute')}
                  @change=${e => player.set('mute', e.detail.value)}
                ></sc-toggle>
              </div>
              ${session && session.get('defaultScript') !== null
                ? html`
                  <como-player-script-shared-state
                    .como=${this.como}
                    .player=${player}
                  ></como-player-script-shared-state>`
                : nothing
              }
            </div>
          `;
        }) : nothing
      }
    `;
  }

  connectedCallback() {
    super.connectedCallback();

    this.#unsubscribePlayersChange = this.como.playerManager.players.onChange(() => {
      this.requestUpdate();
    });

    this.#unsubscribeSourcesChange = this.como.sourceManager.sources.onChange(() => {
      this.requestUpdate();
    });

    this.#unsubscribeSessionsChange = this.como.sessionManager.sessions.onChange(() => {
      this.sessionList = { 'none': null };

      for (let session of this.como.sessionManager.sessions) {
        this.sessionList[session.get('name')] = session.get('uuid');
      }
      this.requestUpdate();
    }, true);
  }

  disconnectedCallback() {
    super.disconnectedCallback();

    this.#unsubscribePlayersChange();
    this.#unsubscribeSessionsChange();
    this.#unsubscribeSourcesChange();
  }

  #updateSessionList() {}
}

if (customElements.get('como-player-manager') === undefined) {
  customElements.define('como-player-manager', ComoPlayerManager);
}
