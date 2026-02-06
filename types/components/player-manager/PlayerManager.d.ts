export default class PlayerManager extends ComoComponent {
    get players(): any;
    playerExists(playerId: any): boolean;
    getPlayer(playerId: any): Promise<any>;
    getScriptSharedState(playerId: any): Promise<any>;
    createPlayer(sourceId: any, scriptName?: any, nodeId?: any): Promise<any>;
    deletePlayer(playerId: any): Promise<void>;
    #private;
}
import ComoComponent from '../../core/ComoComponent.js';
//# sourceMappingURL=PlayerManager.d.ts.map