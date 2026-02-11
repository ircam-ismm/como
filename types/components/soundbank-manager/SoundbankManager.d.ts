export default SoundbankManager;
/**
 * The SoundbankManager component is responsible for loading and retrieving
 * [AudioBuffer](https://developer.mozilla.org/en-US/docs/Web/API/AudioBuffer)s
 * from the projects audio files.
 */
declare class SoundbankManager extends ComoComponent {
    /**
     * @hideconstructor
     * @param {ComoNode} como
     * @param {String} name
     */
    constructor(como: ComoNode, name: string);
    /** @private */
    private get filesystem();
    /** @private */
    private start;
    /**
     * Get the list of audio files (mp3 or wav) as filename / url object
     * @see {@link https://github.com/collective-soundworks/soundworks-plugin-filesystem?tab=readme-ov-file#gettreeasurlmap-1}
     * @returns {Object<String, String>}
     */
    getTreeAsUrlMap(): any;
    /**
     * Register a callback to be triggered when the underlying filesystem changes
     * @see {@link https://github.com/collective-soundworks/soundworks-plugin-filesystem?tab=readme-ov-file#onupdate-1}
     *
     * @param {Function} callback - Callback function to execute
     * @param {Boolean} executeListener - If true, execute the given callback immediately. (optional, default false)
     */
    onUpdate(...args: any[]): any;
    /**
     * Get an AudioBuffer from its filename
     *
     * @param {String} filename - Filename of the related audio buffer
     * @returns {AudioBuffer}
     */
    getBuffer(filename: string): AudioBuffer;
    /**
     * Get a set of AudioBuffers from their filenames
     *
     * @param {Array<String>} fileList - List of filenames to retrieve
     * @returns {Object<String, AudioBuffer>}
     */
    getBuffers(fileList: Array<string>): any;
    #private;
}
import ComoComponent from '../../core/ComoComponent.js';
//# sourceMappingURL=SoundbankManager.d.ts.map