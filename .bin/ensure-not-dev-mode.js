import { DEV_MODE } from '../src/constants.js'

if (DEV_MODE === true) {
  throw new Error('DEV_MODE is set to true, abort');
}
