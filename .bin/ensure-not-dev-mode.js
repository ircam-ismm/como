import { DEV_MODE } from '../src/core/constants.js'

if (DEV_MODE === true) {
  throw new Error('DEV_MODE is set to true, abort');
}
