import BaseModule from './BaseModule';

class Logger extends BaseModule {
  execute(inputFrame) {
    console.log(JSON.stringify(inputFrame.data, null, 2));
    // dead end
    return null;
  }
}

export default Logger;
