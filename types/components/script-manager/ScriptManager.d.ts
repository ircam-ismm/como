export default ScriptManager;
/**
 * The ScriptManager component is responsible for creating and managing
 * dynamic scripts.
 *
 * Basically a wrapper around <https://github.com/collective-soundworks/soundworks-plugin-scripting/>
 */
declare class ScriptManager extends ComoComponent {
    /**
     * @hideconstructor
     * @param {ComoNode} como
     * @param {String} name
     */
    constructor(como: ComoNode, name: string);
    /** @private */
    private get scripting();
    /**
     * Returns the list of all available scripts.
     * @returns {Array<String>}
     */
    getList(): Array<string>;
    /**
     * Return the SharedStateCollection of all the scripts underlying share states.
     * Provided for build and error monitoring purposes. Can also be used to maintain
     * a list of existing script, e.g. in a drop-down menu
     *
     * If you want a full featured / executable Script instance, use the attach instead.
     * @returns {Promise<SharedStateCollection>}
     */
    getCollection(): Promise<SharedStateCollection>;
    /**
     * Register callback to execute when a script is created or deleted.
     *
     * @param {Function} callback - Function to execute
     * @param {Boolean} [executeListener=false] - If true, execute the given callback immediately.
     */
    onUpdate(...args: any[]): any;
    /**
     * Attach to a script.
     *
     * @param {String} name - Name of the script
     * @returns {Promise<SharedScript>}
     */
    attach(...args: any[]): Promise<SharedScript>;
    #private;
}
import ComoComponent from '../../core/ComoComponent.js';
//# sourceMappingURL=ScriptManager.d.ts.map