
import ComoComponent from '../../core/ComoComponent.js';

/**
 * The KeyValueStore component allows to store and and retrieve key value pairs
 * on the filesystem.
 *
 * For example, the KeyValueStore can be helpful to:
 * - store and retrieve information between application restarts.
 * - share values between different script instances
 * - etc.
 *
 * ```js
 * como.store.set('hello', 'world');
 * const world = como.store.get('hello');
 * ```
 */
class KeyValueStore extends ComoComponent {
  /**
   * @hideconstructor
   * @param {ComoNode} como
   * @param {String} name
   */
  constructor(como, name) {
    super(como, name);
  }

  /**
   * Get a stored value.
   *
   * @param {String} key - Key of the value to retrieve
   * @returns {Any} The value associated to the key
   */
  async get(key) {
    return await this.como.requestRfc(this.como.constants.SERVER_ID, 'store:get', { key });
  }

  /**
   * Store a key / value pair
   *
   * @param {String} key - Key of the value to store
   * @param {Any} value - Value to store
   */
  async set(key, value) {
    return await this.como.requestRfc(this.como.constants.SERVER_ID, 'store:set', { key, value });
  }

  /**
   * Delete a key / value pair
   *
   * @param {String} key - Key of the key / value pair to delete
   */
  async delete(key) {
    return await this.como.requestRfc(this.como.constants.SERVER_ID, 'store:delete', { key });
  }

  /**
   * Clear all values from the store
   */
  async clear() {
    return await this.como.requestRfc(this.como.constants.SERVER_ID, 'store:clear', {});
  }
}

export default  KeyValueStore;
