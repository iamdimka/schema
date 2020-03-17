export const enum Type {
    boolean = "boolean",
    binary = "binary",
    number = "number",
    null = "null",
    integer = "integer",
    object = "object",
    string = "string",
    array = "array",
    function = "function"
}

if (!Number.isInteger) {
    Number.isInteger = n => Math.floor(n) === n;
}

if (!Array.isArray) {
    Array.isArray = (arg: any): arg is any[] => Object.prototype.toString.call(arg) === '[object Array]';
}

export interface KeyValue<V = any> {
    [key: string]: V;
};

export type Result<T> = T extends (...args: any[]) => infer U ? U : any;

export function plural(value: number, plural = "s", one = ""): string {
    return value === 1 ? one : plural;
}

export function safe(path: string): string {
    return path.replace(/(")/g, "\\$1");
}

export function objectKey(name: string, key: string | number): string {
    if (typeof key === "number") {
        return `${name}[${key}]`;
    }

    return /^[a-z$_][a-z0-9_$]*$/i.test(key) ? `${name}.${key}` : `${name}[${JSON.stringify(key)}]`;
}

export function json(value: any): any {
    if (!value || typeof value !== "object") {
        return value;
    }

    if (Array.isArray(value)) {
        return value.map(json);
    }

    if (typeof value.toJSON === "function") {
        const next = value.toJSON();
        if (next !== value) {
            return json(next);
        }
    }

    const obj: any = {};
    for (const key in value) {
        obj[key] = json(value[key]);
    }
    return obj;
}