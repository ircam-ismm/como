import SourceManager from './SourceManager.js';

import {
  isBrowser
} from '@ircam/sc-utils';

if (isBrowser()) {
  // @todo - rename these files
  await import ('./gui/como-sensor-3d.js');
  await import ('./gui/como-sensor-plot.js');
  await import ('./gui/como-sensor.js');
}

export default class SourceManagerClient extends SourceManager {}
