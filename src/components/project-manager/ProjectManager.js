import ComoComponent from '../../core/ComoComponent.js';

export default class ProjectManager extends ComoComponent {
  #projects;

  constructor(como) {
    super(como, 'projectManager');
  }

  async start() {
    await super.start();

    this.#projects = await this.como.stateManager.getCollection(`${this.name}:project`);
  }

  get projects() {
    return this.#projects;
  }

  projectExists(name) {
    const project = this.#projects.find(p => p.get('name') === name);
    return !!project;
  }

  async createProject(name, templateDirname) {
    return await this.como.requestRfc(this.como.constants.SERVER_ID, `${this.name}:createProject`, {
      name,
      templateDirname,
    });
  }

  async renameProject(oldName, newName) {
    return await this.como.requestRfc(this.como.constants.SERVER_ID, `${this.name}:renameProject`, {
      oldName,
      newName,
    });
  }

  async deleteProject(name) {
    return await this.como.requestRfc(this.como.constants.SERVER_ID, `${this.name}:deleteProject`, {
      name,
    });
  }
}
