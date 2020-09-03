import modules from '../../common/modules/module-list.js';

import AudioDestination from './AudioDestination.js';
import ScriptAudio from './ScriptAudio.js';

const clientModules = modules.concat([
  AudioDestination,
  ScriptAudio,
]);

export default clientModules;
