import { LitElement, html, css, nothing } from 'lit';

import '@soundworks/helpers/components/sw-editor.js';


class ComoScriptManager extends LitElement {
  static properties() {

  }

  static styles = css`
    :host {
      display: block;
      width: 100vw;
      height: 100vh;
    }

    sw-editor {
      width: 100%;
      height: 100%;
    }
  `;

  constructor() {
    super();

    this.como = null;
  }

  render() {
    return html`
      <sw-editor .plugin=${this.como.scriptManager.scripting}></sw-editor>
    `
  }
}

if (customElements.get('como-script-manager') === undefined) {
  customElements.define('como-script-manager', ComoScriptManager);
}
