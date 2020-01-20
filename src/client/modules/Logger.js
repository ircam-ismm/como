import BaseModule from './BaseModule';
import cloneDeep from 'lodash.clonedeep';

class Logger extends BaseModule {
  execute(inputFrame) {
    console.log(JSON.stringify(inputFrame.data, null, 2));
    // dead end
    return null;
  }
}

export default Logger;
