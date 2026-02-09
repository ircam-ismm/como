export default class SourceManager extends ComoComponent {
    get sources(): any;
    get list(): any;
    get recordingFilesystem(): any;
    sourceExists(sourceId: any): boolean;
    getSourceFiltered(sourceId: any): any;
    getSource(sourceId: any): Promise<any>;
    createSource(config: any, nodeId?: number): Promise<any>;
    deleteSource(config: any, nodeId?: number): Promise<any>;
    listRecordings(): any;
    readRecording(filename: any): Promise<any>;
    deleteRecording(filename: any): Promise<any>;
    #private;
}
import ComoComponent from '../../core/ComoComponent.js';
//# sourceMappingURL=SourceManager.d.ts.map