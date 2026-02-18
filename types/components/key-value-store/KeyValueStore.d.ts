export default KeyValueStore;
/**
 * The KeyValueStore component allows to store and and retrieve key value pairs
 * on the filesystem, allowing to store and retrieve information between application
 * restarts.
 */
declare class KeyValueStore extends ComoComponent {
    /**
     * @hideconstructor
     * @param {ComoNode} como
     * @param {String} name
     */
    constructor(como: ComoNode, name: string);
    /**
     * Get a stored value.
     *
     * @param {String} key - Key of the value to retrieve
     * @returns {Any} The value associated to the key
     */
    get(key: string): Any;
    /**
     * Store a key / value pair
     *
     * @param {String} key - Key of the value to store
     * @param {Any} value - Value to store
     */
    set(key: string, value: Any): Promise<any>;
    /**
     * Delete a key / value pair
     *
     * @param {String} key - Key of the key / value pair to delete
     */
    delete(key: string): Promise<any>;
    /**
     * Clear all values from the store
     */
    clear(): Promise<any>;
}
import ComoComponent from '../../core/ComoComponent.js';
//# sourceMappingURL=KeyValueStore.d.ts.map