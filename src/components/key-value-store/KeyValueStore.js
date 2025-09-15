
import ComoComponent from '../../core/ComoComponent.js';

export default class KeyValueStore extends ComoComponent {
  constructor(como) {
    super(como, 'store');
  }

  async get(key) {
    return await this.como.requestRfc(this.como.constants.SERVER_ID, 'store:get', { key });
  }

  async set(key, value) {
    return await this.como.requestRfc(this.como.constants.SERVER_ID, 'store:set', { key, value });
  }

  async delete(key) {
    return await this.como.requestRfc(this.como.constants.SERVER_ID, 'store:delete', { key });
  }

  async clear() {
    return await this.como.requestRfc(this.como.constants.SERVER_ID, 'store:clear', {});
  }
}
