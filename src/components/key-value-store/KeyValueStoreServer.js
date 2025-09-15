import KeyValueStore from './KeyValueStore.js';

export default class KeyValueStoreServer extends KeyValueStore {
  #db;

  constructor(como) {
    super(como);

    this.#db = this.como.node.createNamespacedDb('como');

    this.como.setRfcHandler('store:get', this.#get);
    this.como.setRfcHandler('store:set', this.#set);
    this.como.setRfcHandler('store:delete', this.#delete);
    this.como.setRfcHandler('store:clear', this.#clear);
  }

  #get = ({ key }) => {
    return this.#db.get(key);
  }

  #set = ({ key, value }) => {
    return this.#db.set(key, value);
  }

  #delete = ({ key }) => {
    return this.#db.delete(key);
  }

  #clear = () => {
    return this.#db.delete();
  }
}
