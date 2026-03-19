declare namespace _default {
    namespace id {
        let type: string;
        let required: boolean;
    }
    namespace nodeId {
        let type_1: string;
        export { type_1 as type };
        let required_1: boolean;
        export { required_1 as required };
    }
    namespace role {
        let type_2: string;
        export { type_2 as type };
        let required_2: boolean;
        export { required_2 as required };
    }
    namespace runtime {
        let type_3: string;
        export { type_3 as type };
        let required_3: boolean;
        export { required_3 as required };
    }
}
export default _default;
/**
 * Shared state class description representing a ComoNode
 */
export type ComoNodeClassDescription = {
    /**
     * - Topological id (can be fixed between different restarts):
     * - For browser clients: generated from soundworks node id, or user defined
     * through query parameter, i.e. http://host.local?id=my-client-id
     * - For node clients: hostname
     * - For server: 'server' constant
     */
    id: string;
    /**
     * - Underlying soundworks id, unstable across restarts
     */
    nodeId: number;
    /**
     * - Role of the node in the application
     */
    role: string;
    /**
     * - Javascript runtime in which the node is running
     */
    runtime: "browser" | "node";
};
//# sourceMappingURL=node-description.d.ts.map