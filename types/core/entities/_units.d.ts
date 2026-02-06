declare namespace timestamp {
    let unit: string;
}
declare namespace frequency {
    let unit_1: string;
    export { unit_1 as unit };
}
declare namespace accelerometer {
    namespace x {
        let unit_2: string;
        export { unit_2 as unit };
        export function normalize(val: any): number;
    }
    namespace y {
        let unit_3: string;
        export { unit_3 as unit };
        export function normalize_1(val: any): number;
        export { normalize_1 as normalize };
    }
    namespace z {
        let unit_4: string;
        export { unit_4 as unit };
        export function normalize_2(val: any): number;
        export { normalize_2 as normalize };
    }
}
//# sourceMappingURL=_units.d.ts.map