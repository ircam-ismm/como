export default class SourceFactory {
    constructor(como: any);
    como: any;
    createSource(config: any): Promise<StreamPlayerSource>;
    stop(): Promise<void>;
    #private;
}
import StreamPlayerSource from "./StreamPlayerSource.js";
//# sourceMappingURL=factory.browser.d.ts.map