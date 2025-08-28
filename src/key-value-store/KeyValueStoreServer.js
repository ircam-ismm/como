import KeyValueStore from './KeyValueStore.js';

export default class KeyValueStoreServer extends KeyValueStore {
  #db;

  constructor(como) {
    super(como);

    this.#db = this.como.node.createNamespacedDb('como');

    this.como.setCommandHandler('store:get', this.#get.bind(this));
    this.como.setCommandHandler('store:set', this.#set.bind(this));
    this.como.setCommandHandler('store:delete', this.#delete.bind(this));
    this.como.setCommandHandler('store:clear', this.#clear.bind(this));
  }

  #get({ key }) {
    return this.#db.get(key);
  }

  #set({ key, value }) {
    return this.#db.set(key, value);
  }

  #delete({ key }) {
    return this.#db.delete(key);
  }

  #clear() {
    return this.#db.delete();
  }
}
