/**
 * @param {Object} json JSON comote frame
 * @returns {Array|Bundle} Osc bundle from node-osc package, cf. https://www.npmjs.com/package/node-osc
 */
export function jsonToOscBundle(json: any, { asNodeOscBundle, }?: {
    asNodeOscBundle?: boolean;
}): any[] | Bundle;
export function getMetaFromBundle(bundle: any): {
    source: any;
    api: any;
    id: any;
};
export function getMetaFromMessage(message: any): {
    api: string;
    id: any;
};
/**
 * @param {Object} bundle Osc bundle from node-osc package, cf. https://www.npmjs.com/package/node-osc
 * @returns JSON comote frame
 */
export function oscBundleToJson(bundle: any, { timestampUpdate, useBno055, }?: {
    useBno055?: boolean;
}): {
    source: any;
    api: string;
    id: any;
    timestamp: any;
    frequency: any;
};
export function oscMessageToJson(message: any, { timestampUpdate, }: {
    timestampUpdate: any;
}): any;
//# sourceMappingURL=comote-format.d.ts.map