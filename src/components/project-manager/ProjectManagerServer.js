import fs from 'node:fs';
import * as fsPromises from 'node:fs/promises'
import path from 'node:path';

import { default as _filenamify } from 'filenamify';
import {
  isString
} from '@ircam/sc-utils';

import ProjectManager from './ProjectManager.js';
import projectDescription from './project-description.js';

function filenamify(value) {
  return _filenamify(value).toLowerCase();
}

export default class ProjectManagerServer extends ProjectManager {
  #projectStore = new Set();

  constructor(como) {
    super(como);

    this.como.stateManager.defineClass(`${this.name}:project`, projectDescription);

    this.como.setRfcHandler(`${this.name}:createProject`, this.#createProject);
    this.como.setRfcHandler(`${this.name}:renameProject`, this.#renameProject);
    this.como.setRfcHandler(`${this.name}:deleteProject`, this.#deleteProject);
  }

  async start() {
    await super.start();

    // init existing projects
    const projectsDirname = this.como.global.get('projectsDirname');
    // if projects directory does not exists yet, nothing more to do
    if (!fs.existsSync(projectsDirname)) {
      return;
    }

    const projectDirectories = fs.readdirSync(projectsDirname, { withFileTypes: true })
      .filter(entry => entry.isDirectory()) // is a directory
      .filter(entry => fs.existsSync(path.join(projectsDirname, entry.name, this.como.constants.PROJECT_INFOS_FILENAME))) // contains a `project-infos.json` file

    for (let entry of projectDirectories) {
      const dirname = path.join(projectsDirname, entry.name);
      let infos;

      try {
        const data = fs.readFileSync(path.join(dirname, this.como.constants.PROJECT_INFOS_FILENAME));
        infos = JSON.parse(data);
      } catch (err) {
        console.log(`> Unable read project file in directory ${entry.name}:`);
        console.log(err.message);
        console.log(`> aborting...`);
        continue;
      }


      const project = await this.como.stateManager.create(`${this.name}:project`, {
        dirname,
        ...infos,
      });

      this.#projectStore.add(project);
    }
  }

  #createProject = async ({ name, templateDirname }) => {
    if (!isString(name)) {
      throw new Error(`Cannot execute "createProject" on ProjectManager: project name is not a string`);
    }

    if (!isString(templateDirname)) {
      throw new Error(`Cannot execute "createProject" on ProjectManager: template dirname is not a string`);
    }

    if (!fs.existsSync(templateDirname) || !fs.statSync(templateDirname).isDirectory()) {
      throw new Error(`Cannot execute "createProject" on ProjectManager: template is not a directory`);
    }

    if (this.projectExists(name)) {
      throw new Error(`Cannot execute "createProject" on ProjectManager: a project with same name (${name}) already exists`);
    }

    const slug = filenamify(name);
    const dirname = path.join(this.como.global.get('projectsDirname'), slug);

    await fsPromises.cp(templateDirname, dirname, { recursive: true });

    const infos = { name, slug };
    const infosFilename = path.join(dirname, this.como.constants.PROJECT_INFOS_FILENAME);
    await fsPromises.writeFile(infosFilename, JSON.stringify(infos, null, 2));

    const project = await this.como.stateManager.create(`${this.name}:project`, {
      dirname,
      ...infos,
    });

    project.onDelete(() => this.#projectStore.delete(project));
    this.#projectStore.add(project);
  }

  #renameProject = async ({ oldName, newName }) => {
    if (!isString(oldName)) {
      throw new Error(`Cannot execute "renameProject" on ProjectManager: oldName is not a string`);
    }

    if (!isString(newName)) {
      throw new Error(`Cannot execute "renameProject" on ProjectManager: newName is not a string`);
    }

    if (!this.projectExists(oldName)) {
      throw new Error(`Cannot execute "renameProject" on "ProjectManager": project ("${oldName}") does not exist`);
    }

    if (this.projectExists(newName)) {
      throw new Error(`Cannot execute "renameProject" on "ProjectManager": a project with same target name ("${newName}") already exists`);
    }

    const project = this.projects.find(p => p.get('name') === oldName);

    const slug = filenamify(newName);
    const dirname = path.join(this.como.global.get('projectsDirname'), slug);
    // rename directory
    await fsPromises.rename(project.get('dirname'), dirname);
    // update infos.json
    const infos = { name: newName, slug };
    const infosFilename = path.join(dirname, this.como.constants.PROJECT_INFOS_FILENAME);
    await fsPromises.writeFile(infosFilename, JSON.stringify(infos, null, 2));
    // update project state
    await project.set({
      dirname,
      ...infos,
    });
  }

  #deleteProject = async ({ name }) => {
    if (!isString(name)) {
      throw new Error(`Cannot execute "deleteProject" on ProjectManager: project name is not a string`);
    }

    if (!this.projectExists(name)) {
      throw new Error(`Cannot execute "deleteProject" on "ProjectManager": project ("${name}") does not exists`);
    }

    // get owned state
    const project = Array.from(this.#projectStore).find(p => p.get('name') === name);
    // delete directory
    await fsPromises.rm(project.get('dirname'), { recursive: true, force: true });
    // delete state
    await project.delete();
  }
};
