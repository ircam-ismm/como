export default class ProjectManager extends ComoComponent {
    get projects(): any;
    projectExists(name: any): boolean;
    createProject(name: any, templateDirname?: any): Promise<any>;
    renameProject(oldName: any, newName: any): Promise<any>;
    deleteProject(name: any): Promise<any>;
    #private;
}
import ComoComponent from '../../core/ComoComponent.js';
//# sourceMappingURL=ProjectManager.d.ts.map