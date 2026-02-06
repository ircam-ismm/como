export default class Player {
    constructor(como: any, sourceId: any);
    get id(): any;
    get nodeId(): any;
    get source(): any;
    get state(): any;
    init(withState?: any): Promise<void>;
    delete(): Promise<void>;
    setScript(scriptName?: any): Promise<void>;
    #private;
}
//# sourceMappingURL=Player.d.ts.map