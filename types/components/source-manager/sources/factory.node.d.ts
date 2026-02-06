export default class SourceFactory {
    constructor(como: any);
    como: any;
    createSource(config: any): Promise<AggregatedSource | ComoteSource | OscBridgeSource | RiotSource | StreamPlayerSource>;
    stop(): Promise<void>;
    #private;
}
import AggregatedSource from './AggregatedSource.js';
import ComoteSource from './ComoteSource.js';
import OscBridgeSource from './OscBridgeSource.js';
import RiotSource from './RiotSource.js';
import StreamPlayerSource from './StreamPlayerSource.js';
//# sourceMappingURL=factory.node.d.ts.map