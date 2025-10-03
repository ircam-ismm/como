import { LitElement, html, css, nothing } from 'lit';

class ComoProjectManager extends LitElement {
  #unsubscribeSessionsChange;
  #unsubscribePlayerUpdate;

  static properties = {

  }

  static styles = css`

  `;

  constructor() {
    super();

    this.como = null;
    this.player = null;
  }

  render() {
    return html`
      <p>coucou player</p>
    `;
  }

  connectedCallback() {
    super.connectedCallback();

    this.#unsubscribeSessionsChange = this.como.sessionManager.session.onChange(() => {
      this.requestUpdate();
    });

    this.#unsubscribePlayerUpdate = this.player.onUpdate(() => this.requestUpdate());
  }

  disconnectedCallback() {
    super.disconnectedCallback();

    this.#unsubscribeSessionsChange();
    this.#unsubscribePlayerUpdate();
  }
}

if (customElements.get('como-player') === undefined) {
  customElements.define('como-player', ComoProjectManager);
}
