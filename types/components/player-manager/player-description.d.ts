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
    namespace sourceId {
        let type_2: string;
        export { type_2 as type };
        let required_2: boolean;
        export { required_2 as required };
    }
    namespace sessionId {
        let type_3: string;
        export { type_3 as type };
        let _default: any;
        export { _default as default };
        export let nullable: boolean;
    }
    namespace sessionLoading {
        let type_4: string;
        export { type_4 as type };
        let _default_1: boolean;
        export { _default_1 as default };
    }
    namespace scriptName {
        let type_5: string;
        export { type_5 as type };
        let nullable_1: boolean;
        export { nullable_1 as nullable };
        let _default_2: any;
        export { _default_2 as default };
    }
    namespace scriptSharedStateClassName {
        let type_6: string;
        export { type_6 as type };
        let nullable_2: boolean;
        export { nullable_2 as nullable };
        let _default_3: any;
        export { _default_3 as default };
    }
    namespace scriptSharedStateId {
        let type_7: string;
        export { type_7 as type };
        let nullable_3: boolean;
        export { nullable_3 as nullable };
        let _default_4: any;
        export { _default_4 as default };
    }
    namespace scriptLoaded {
        let type_8: string;
        export { type_8 as type };
        export let event: boolean;
    }
    namespace mute {
        let type_9: string;
        export { type_9 as type };
        let _default_5: boolean;
        export { _default_5 as default };
    }
    namespace volume {
        let type_10: string;
        export { type_10 as type };
        export let min: number;
        export let max: number;
        let _default_6: number;
        export { _default_6 as default };
    }
}
export default _default;
export type PlayerClassDescription = {
    /**
     * - Id of the player (generated or user-defined)
     */
    id: string;
    /**
     * - Id of the node on which the player has been created
     */
    nodeId: string;
    /**
     * - Id of the source associated with the player
     */
    sourceId: string;
    /**
     * - If the session with which the player is associated.
     * null is associated to no session.
     */
    sessionId: string;
    /**
     * - True if the session is currently loading, false otherwise
     */
    sessionLoading: boolean;
    /**
     * - Name of the script associated to this player.
     */
    scriptName: string;
    /**
     * - Event that triggers whe the script is ready.
     */
    scriptLoaded: boolean;
    /**
     * - Mute the audio of this player.
     */
    mute: boolean;
    /**
     * - Volume of the audio of this player, in dB.
     */
    volume: number;
};
//# sourceMappingURL=player-description.d.ts.map