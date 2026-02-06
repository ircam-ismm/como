/** @private */
export default class ComoComponent {
    constructor(como: any, name: any);
    get name(): any;
    get como(): CoMoNode;
    init(): Promise<void>;
    start(): Promise<void>;
    stop(): Promise<void>;
    setProject(projectDirname: any): Promise<void>;
    #private;
}
import CoMoNode from './ComoNode.js';
//# sourceMappingURL=ComoComponent.d.ts.map