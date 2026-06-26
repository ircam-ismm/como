import { EOL as _EOL } from 'node:os';
import os from 'node:os';
import { SERVER_ID } from '../core/constants.js';
// make web audio api available globally
import 'node-web-audio-api/polyfill.js';

export const EOL = _EOL;

/**
 * return 'server' or hostname
 * @param {Server} node
 */
export function getId(nodeId) {
  if (nodeId === SERVER_ID) {
    return 'server';
  }

  // normalize so that we always got `.local`
  return `${os.hostname().split('.')[0]}.local`;
}
