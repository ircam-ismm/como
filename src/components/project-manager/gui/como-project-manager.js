import { LitElement, html, css, nothing } from 'lit';

import '@ircam/sc-components/sc-text.js';
import '@ircam/sc-components/sc-icon.js';

class ComoProjectManager extends LitElement {
  #unsubscribeProjectsChange;
  #unsubscribeProjectUpdate;

  static properties = {
    extended: {
      type: Boolean,
      reflect: true,
    }
  }

  static styles = css`
    :host {
      display: flex;
      box-sizing: border-box;
    }

    .error-message {
      color: var(--sc-color-secondary-3);
      font-style: italic;
    }

    .header {
      /* padding: 2px; */
      display: flex;
      background-color: var(--sc-color-primary-2);
    }

    .extended {
      padding: 4px;
      position: absolute;
      top: 30px;
      z-index: 100;
      background-color: var(--sc-color-primary-1);
      outline: 1px solid var(--sc-color-primary-3);
    }
  `;

  constructor() {
    super();

    this.como = null;
  }

  render() {
    return html`
      <div class="header">
        <sc-text>current project: ${this.como.project.get('name')}</sc-text>
        <sc-icon
          type="gear"
          @input=${e => this.extended = !this.extended}
        ></sc-icon>
      </div>
      ${this.extended ? html`
        <div class="extended">
          <div>
            <sc-text>create project</sc-text>
            <sc-text editable
              @input=${e => e.currentTarget.nextElementSibling.innerText = ''}
              @change=${async e => {
                // need to store currentTarget before await
                // cf. https://developer.mozilla.org/en-US/docs/Web/API/Event/currentTarget
                const currentTarget = e.currentTarget;
                try {
                  await this.como.projectManager.createProject(e.detail.value);
                  currentTarget.value = '';
                } catch (err) {
                  currentTarget.nextElementSibling.innerText = err.message;
                }
              }}
            ></sc-text>
            <p class="error-message"></p>
          </div>
          <div>
            ${this.como.projectManager.projects.map(project => {
              return html`
                <div>
                  <sc-text
                    editable
                    @change=${async e => {
                      try {
                        await this.como.projectManager.renameProject(project.get('name'), e.detail.value);
                      } catch (err) {
                        console.log(err);
                      }
                    }}
                    value=${project.get('name')}
                  ></sc-text>
                  <sc-icon
                    type="upgrade"
                    @input=${async e => {
                      try {
                        await this.como.setProject(project.get('name'));
                      } catch (err) {
                        console.log(err);
                      }
                    }}
                  ></sc-icon>
                  <sc-icon
                    type="delete"
                    @input=${async e => {
                      if (confirm(`Are you sure you want to delete the "${project.get('name')}" project?`)) {
                        try {
                          await this.como.projectManager.deleteProject(project.get('name'));
                        } catch (err) {
                          console.log(err);
                        }
                      }
                    }}
                  ></sc-icon>
                </div>
              `
            })}
          </div>
        </div>
      ` : nothing}
    `;
  }

  connectedCallback() {
    super.connectedCallback();

    this.#unsubscribeProjectsChange = this.como.projectManager.projects.onChange(() => {
      this.requestUpdate();
    });

    this.#unsubscribeProjectUpdate = this.como.project.onUpdate(() => this.requestUpdate());
  }

  disconnectedCallback() {
    super.disconnectedCallback();

    this.#unsubscribeProjectsChange();
    this.#unsubscribeProjectUpdate();
  }
}

if (customElements.get('como-project-manager') === undefined) {
  customElements.define('como-project-manager', ComoProjectManager);
}
