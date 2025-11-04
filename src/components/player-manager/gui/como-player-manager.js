import { LitElement, html, css, nothing } from 'lit';
import { repeat } from 'lit/directives/repeat.js';

import '@ircam/sc-components/sc-text.js';
import '@ircam/sc-components/sc-select.js';
import '@ircam/sc-components/sc-status.js';

import './como-player-script-shared-state.js';

class ComoPlayerManager extends LitElement {
  #unsubscribePlayersChange;
  #unsubscribeSessionsChange;
  #unsubscribeSourcesChange;

  static properties = {
    sessionId: {
      type: String,
      reflect: true,
    }
  }

  static styles = css`
    :host {
      display: block;
      margin-top: 20px;
    }
  `;

  constructor() {
    super();

    this.como = null;
    this.sessionId = null; // filter players by sessionId
  }

  render() {
    const sessionList = {
      'none': null,
    };

    for (let session of this.como.sessionManager.sessions) {
      sessionList[session.get('name')] = session.get('uuid');
    }

    const players = this.sessionId !== null
      ? this.como.playerManager.players.filter(player => player.get('sessionId') === this.sessionId)
      : this.como.playerManager.players;

    return repeat(players, player => player.get('id'), player => {
      const source = this.como.sourceManager.getSourceFiltered(player.get('sourceId'));
      const session = this.como.sessionManager.getSession(player.get('sessionId'));

      return html`
        <sc-text>${player.get('id')}</sc-text>
        <div>
          <como-source .source=${source}></como-source>
        </div>
        <sc-select
          .options=${sessionList}
          value=${session ? session.get('uuid') : null}
          @change=${async e => await player.set('sessionId', e.detail.value)}
        >/</sc-select>
        <sc-text>script: ${player.get('scriptName')}</sc-text>
        <div>
          <sc-text>volume</sc-text>
          <sc-slider
            number-box
            min=${player.getDescription('volume').min}
            max=${player.getDescription('volume').max}
            value=${player.get('volume')}
            @input=${e => player.set('volume', e.detail.value)}
          ></sc-slider>
          <sc-text>mute</sc-text>
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
      `
    });
  }

  connectedCallback() {
    super.connectedCallback();

    this.#unsubscribePlayersChange = this.como.playerManager.players.onChange(() => {
      this.requestUpdate();
    });

    this.#unsubscribeSessionsChange = this.como.sessionManager.sessions.onChange(() => {
      this.requestUpdate();
    });

    this.#unsubscribeSourcesChange = this.como.sourceManager.sources.onChange(() => {
      this.requestUpdate();
    });
  }

  disconnectedCallback() {
    super.disconnectedCallback();

    this.#unsubscribePlayersChange();
    this.#unsubscribeSessionsChange();
    this.#unsubscribeSourcesChange();
  }
}

if (customElements.get('como-player-manager') === undefined) {
  customElements.define('como-player-manager', ComoPlayerManager);
}
