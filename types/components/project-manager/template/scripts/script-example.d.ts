/**
 * Return the description of a shared state, to dynamically create remote interfaces
 * cf. https://soundworks.dev/soundworks/global.html#SharedStateClassDescription
 *
 * @param {*} como - instance of the como node
 */
export function defineSharedState(como: any): Promise<{
    classDescription: {};
}>;
/**
 * Function executed when the player enters the script
 * @param {*} context
 */
export function enter(context: any): Promise<void>;
/**
 * Function executed when the player exits the script
 * @param {*} context
 */
export function exit(context: any): Promise<void>;
/**
 * Function executed on each frame of the player motion data source.
 * Note that frame is multi channel even if it contains only one source
 * @param {*} context
 */
export function process(context: any, frame: any): Promise<void>;
//# sourceMappingURL=script-example.d.ts.map