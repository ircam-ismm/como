import {
  isBrowser
} from '@ircam/sc-utils';

import ProjectManager from './ProjectManager.js';

if (isBrowser()) {
  // register guis
}

export default class ProjectManagerClient extends ProjectManager {};
