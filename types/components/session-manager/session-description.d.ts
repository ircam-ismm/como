export default Session;
declare namespace Session {
    namespace uuid {
        let type: string;
        let required: boolean;
        namespace metas {
            let persist: boolean;
        }
    }
    namespace dirty {
        let type_1: string;
        export { type_1 as type };
        let _default: boolean;
        export { _default as default };
    }
    namespace name {
        let type_2: string;
        export { type_2 as type };
        let required_1: boolean;
        export { required_1 as required };
        export namespace metas_1 {
            let persist_1: boolean;
            export { persist_1 as persist };
        }
        export { metas_1 as metas };
    }
    namespace defaultScript {
        let type_3: string;
        export { type_3 as type };
        let _default_1: any;
        export { _default_1 as default };
        export let nullable: boolean;
        export namespace metas_2 {
            let persist_2: boolean;
            export { persist_2 as persist };
        }
        export { metas_2 as metas };
    }
    namespace mute {
        let type_4: string;
        export { type_4 as type };
        let _default_2: boolean;
        export { _default_2 as default };
        export namespace metas_3 {
            let persist_3: boolean;
            export { persist_3 as persist };
        }
        export { metas_3 as metas };
    }
    namespace volume {
        let type_5: string;
        export { type_5 as type };
        let _default_3: number;
        export { _default_3 as default };
        export let min: number;
        export let max: number;
        export namespace metas_4 {
            let persist_4: boolean;
            export { persist_4 as persist };
        }
        export { metas_4 as metas };
    }
    namespace soundbank {
        let type_6: string;
        export { type_6 as type };
        let _default_4: any[];
        export { _default_4 as default };
        export namespace metas_5 {
            let persist_5: boolean;
            export { persist_5 as persist };
        }
        export { metas_5 as metas };
    }
}
//# sourceMappingURL=session-description.d.ts.map