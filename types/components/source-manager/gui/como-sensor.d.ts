export default class MemoryBuffer {
    static properties: {
        sourceId: {
            type: StringConstructor;
            attribute: string;
        };
    };
    constructor(size: any, _initData: any);
    get length(): any;
    push(value: any): void;
    forEach(func: any): void;
    toArray(): void;
    #private;
}
//# sourceMappingURL=como-sensor.d.ts.map