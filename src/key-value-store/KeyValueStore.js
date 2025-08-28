
import { SERVER_ID } from '../constants.js';
import Manager from '../Manager.js';

export default class KeyValueStore extends Manager {
  constructor(como) {
    super(como, 'store');
  }

  async get(key) {
    return await this.como.requestCommand(SERVER_ID, 'store:get', { key });
  }

  async set(key, value) {
    return await this.como.requestCommand(SERVER_ID, 'store:set', { key, value });
  }

  async delete(key) {
    return await this.como.requestCommand(SERVER_ID, 'store:delete', { key });
  }

  async clear() {
    return await this.como.requestCommand(SERVER_ID, 'store:clear', {});
  }
}
