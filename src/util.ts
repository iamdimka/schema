export const enum Type {
    boolean = "boolean",
    buffer = "buffer",
    number = "number",
    null = "null",
    integer = "integer",
    object = "object",
    string = "string",
    array = "array",
    function = "function"
}

export interface KeyValue<V = any> {
    [key: string]: V;
};

export type Result<T> = T extends (...args: any[]) => infer U ? U : any;

export function type($: any): Type {
    const type = typeof $;

    if (type !== Type.object) {
        return type as Type;
    }

    if ($ === null) {
        return Type.null;
    }

    if (Array.isArray($)) {
        return Type.array;
    }

    if (Buffer.isBuffer($)) {
        return Type.buffer;
    }

    return type as Type;
}

export function isEqual(a: any, b: any, depth: number = 1e3): boolean {
    if (depth < 0) {
        return false;
    }

    const typeOfA = typeof a;

    if (typeOfA !== "object") {
        return a === b;
    }

    if (typeof b !== typeOfA) {
        return false;
    }

    const isArrayB = Array.isArray(b);

    if (Array.isArray(a)) {
        if (!isArrayB) {
            return false;
        }

        if (a.length !== b.length) {
            return false;
        }

        return a.every((item, i) => isEqual(item, b[i], depth - 1));
    }

    if (isArrayB) {
        return false;
    }

    for (const key in a) {
        if (!isEqual(a[key], b[key], depth - 1)) {
            return false;
        }
    }

    for (const key in b) {
        if (!a.hasOwnProperty(key) && !isEqual(a[key], b[key], depth - 1)) {
            return false;
        }
    }

    return true;
}