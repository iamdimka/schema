import compile, { extend, setBinaryType } from "./compiler";
import { KeyValue, Type, json } from "./util";

export type Rules<T> = {
    default?: () => T;
};

export { compile, extend, setBinaryType };

export class Validator<T> {
    readonly schema: KeyValue;
    isOptional = false;
    type?: string;

    protected compiled?: (value: any, varName?: string) => T;

    constructor(schema?: KeyValue) {
        this.schema = schema || {};
    }

    set(rule: string, value: any): this;
    set(rules: { [rule: string]: any; }): this;
    set(rule: any): this {
        if (typeof rule === "object") {
            for (const key in rule) {
                this.schema[key] = json(rule[key]);
            }
        } else {
            this.schema[rule] = json(arguments[1]);
        }

        this.compiled = undefined;
        return this;
    }

    enum(values: T[]) {
        return this.set("enum", values);
    }

    constEqual(value: T) {
        return this.set("const", value);
    }

    clone(): this {
        const validator = Object.create(this);

        validator.type = this.type;
        validator.isOptional = this.isOptional;
        validator.schema = {
            ...this.schema
        };

        return validator;
    }

    optional(): Validator<T | undefined> {
        this.isOptional = true;
        return this;
    }

    title(title: string): this {
        return this.set("title", title);
    }

    description(description: string): this {
        return this.set("description", description);
    }

    examples(examples: T[]): this {
        return this.set("examples", examples);
    }

    default(value: T): this {
        this.isOptional = true;
        return this.set("default", value);
    }

    compile(varName?: string): (item: any) => T {
        if (this.type) {
            this.set("type", this.type);
        }

        if (varName) {
            return compile(this.schema, { varName, passUndefined: this.isOptional });
        }

        return this.compiled || (this.compiled = compile(this.schema, { passUndefined: this.isOptional }));
    }

    validate(item: any): T {
        return this.compile()(item);
    }

    toJSON() {
        const res = { ...this.schema };
        if (this.type) {
            res.type = this.type;
        }
        return json(res);
    }
}

export class BooleanValidator extends Validator<boolean> {
    type = Type.boolean;
}

export class StringValidator extends Validator<string> {
    type = Type.string;

    toLower(toLower: boolean = true): this {
        return this.set("toLower", toLower);
    }

    trim(trim: boolean = true): this {
        return this.set("trim", trim);
    }

    length(length: number): this {
        return this.min(length).max(length);
    }

    min(min: number) {
        return this.minLength(min);
    }

    minLength(minLength: number) {
        return this.set("minLength", minLength);
    }

    max(max: number) {
        return this.maxLength(max);
    }

    maxLength(maxLength: number) {
        return this.set("maxLength", maxLength);
    }

    match(pattern: RegExp) {
        return this.pattern(pattern.source);
    }

    numeric() {
        return this.set("format", "numeric");
    }

    pattern(pattern: string | RegExp) {
        return this.set("pattern", typeof pattern === "string" ? pattern : pattern.source);
    }

    format(format: "alpha" | "alphanumeric" | "hexadecimal" | "identifier" | "numeric" | "date-time" | "uppercase" | "lowercase" | "hostname" | "uri" | "email" | "ipv4" | "ipv6" | "regex" | "json-pointer") {
        return this.set("format", format);
    }
}

export class NumberValidator extends Validator<number> {
    type = Type.number;

    min(minimum: number) {
        return this.minimum(minimum);
    }

    minimum(minimum: number) {
        return this.set("minimum", minimum);
    }

    max(maximum: number) {
        return this.maximum(maximum);
    }

    maximum(maximum: number) {
        return this.set("maximum", maximum);
    }

    above(above: number) {
        return this.exclusiveMinimum(above);
    }

    exclusiveMinimum(exclusiveMinimum: number) {
        return this.set("exclusiveMinimum", exclusiveMinimum);
    }

    below(below: number) {
        return this.exclusiveMaximum(below);
    }

    exclusiveMaximum(exclusiveMaximum: number) {
        return this.set("exclusiveMaximum", exclusiveMaximum);
    }

    step(step: number) {
        return this.multipleOf(step);
    }

    multipleOf(multipleOf: number) {
        return this.set("multipleOf", multipleOf);
    }

    integer() {
        this.type = Type.integer;
        this.compiled = undefined;
        return this;
    }
}

export class ObjectValidator<T extends KeyValue = {}> extends Validator<T> {
    type = Type.object;

    properties<S>(properties: { [K in keyof S]: Validator<S[K]> }): ObjectValidator<S> {
        const required = this.schema.required ? this.schema.required.slice() : [];
        const props: any = {};

        for (const key in properties) {
            const v = properties[key];
            props[key] = v.toJSON();

            if (!v.isOptional) {
                required.push(key);
            }
        }

        if (required.length) {
            this.required(required);
        }

        return this.set("properties", props) as any;
    }

    additionalProperties(additionalProperties: boolean | Validator<any>) {
        return this.set("additionalProperties", additionalProperties);
    }

    maxProperties(maxProperties: number) {
        return this.set("maxProperties", maxProperties);
    }

    minProperties(minProperties: number) {
        return this.set("minProperties", minProperties);
    }

    required(required: Array<keyof T>) {
        return this.set("required", required);
    }

    dependencies<T extends { [key: string]: string[] | KeyValue; }>(dependencies: any): this {
        return this.set("dependencies", dependencies);
    }
}

export class BinaryValidator extends Validator<Buffer> {
    type = Type.binary;

    length(length: number): this {
        return this.min(length).max(length);
    }

    min(min: number): this {
        return this.minBytes(min);
    }

    max(max: number): this {
        return this.maxBytes(max);
    }

    minBytes(minBytes: number): this {
        return this.set("minBytes", minBytes);
    }

    maxBytes(maxBytes: number): this {
        return this.set("maxBytes", maxBytes);
    }
}

export class ArrayValidator<T> extends Validator<T> {
    type = Type.array;

    items<T1, T2, T3, T4, T5>(items: [Validator<T1>, Validator<T2>, Validator<T3>, Validator<T4>, Validator<T5>]): ArrayValidator<[T1, T2, T3, T4, T5]>;
    items<T1, T2, T3, T4>(items: [Validator<T1>, Validator<T2>, Validator<T3>, Validator<T4>]): ArrayValidator<[T1, T2, T3, T4]>;
    items<T1, T2, T3>(items: [Validator<T1>, Validator<T2>, Validator<T3>]): ArrayValidator<[T1, T2, T3]>;
    items<T1, T2>(items: [Validator<T1>, Validator<T2>]): ArrayValidator<[T1, T2]>;
    items<T1>(items: [Validator<T1>]): ArrayValidator<[T1]>;
    items<V>(items: Validator<V>[]): ArrayValidator<V[]>;
    items<V>(items: Validator<V>): ArrayValidator<V[]>;
    items(items: any): any {
        return this.set("items", json(items)) as any;
    }

    tuple<T1, T2, T3, T4, T5>(tuple: [Validator<T1>, Validator<T2>, Validator<T3>, Validator<T4>, Validator<T5>]): ArrayValidator<[T1, T2, T3, T4, T5]>;
    tuple<T1, T2, T3, T4>(tuple: [Validator<T1>, Validator<T2>, Validator<T3>, Validator<T4>]): ArrayValidator<[T1, T2, T3, T4]>;
    tuple<T1, T2, T3>(tuple: [Validator<T1>, Validator<T2>, Validator<T3>]): ArrayValidator<[T1, T2, T3]>;
    tuple<T1, T2>(tuple: [Validator<T1>, Validator<T2>]): ArrayValidator<[T1, T2]>;
    tuple<T1>(tuple: [Validator<T1>]): ArrayValidator<[T1]>;
    tuple(tuple: any[]): any {
        return this.set({
            items: json(tuple),
            additionalItems: false,
            minItems: tuple.length
        });
    }

    length(length: number): this {
        return this.min(length).max(length);
    }

    uniqueItems() {
        return this.set("uniqueItems", true);
    }

    additionalItems(additionalItems = true) {
        return this.set("additionalItems", additionalItems);
    }

    contains<V>(contains: Validator<V>) {
        return this.set("contains", contains.toJSON());
    }

    min(min: number): this {
        return this.minItems(min);
    }

    minItems(minItems: number) {
        return this.set("minItems", minItems);
    }

    max(max: number): this {
        return this.maxItems(max);
    }

    maxItems(maxItems: number) {
        return this.set("maxItems", maxItems);
    }
}

function object<T>(schema?: { [K in keyof T]: Validator<T[K]> }): ObjectValidator<T> {
    const v = new ObjectValidator<T>({ additionalProperties: false });
    return schema ? v.properties(schema) : v;
}

function array<T1, T2, T3, T4, T5>(items: [Validator<T1>, Validator<T2>, Validator<T3>, Validator<T4>, Validator<T5>]): ArrayValidator<[T1, T2, T3, T4, T5]>;
function array<T1, T2, T3, T4>(items: [Validator<T1>, Validator<T2>, Validator<T3>, Validator<T4>]): ArrayValidator<[T1, T2, T3, T4]>;
function array<T1, T2, T3>(items: [Validator<T1>, Validator<T2>, Validator<T3>]): ArrayValidator<[T1, T2, T3]>;
function array<T1, T2>(items: [Validator<T1>, Validator<T2>]): ArrayValidator<[T1, T2]>;
function array<T1>(items: [Validator<T1>]): ArrayValidator<[T1]>;
function array<T>(items: Validator<T>): ArrayValidator<T[]>;
function array(): ArrayValidator<any[]>;
function array(items?: any): ArrayValidator<any[]> {
    const v = new ArrayValidator<any[]>();
    return items ? v.items(items) : v;
}

function tuple<T1, T2, T3, T4, T5>(items: [Validator<T1>, Validator<T2>, Validator<T3>, Validator<T4>, Validator<T5>]): ArrayValidator<[T1, T2, T3, T4, T5]>;
function tuple<T1, T2, T3, T4>(items: [Validator<T1>, Validator<T2>, Validator<T3>, Validator<T4>]): ArrayValidator<[T1, T2, T3, T4]>;
function tuple<T1, T2, T3>(items: [Validator<T1>, Validator<T2>, Validator<T3>]): ArrayValidator<[T1, T2, T3]>;
function tuple<T1, T2>(items: [Validator<T1>, Validator<T2>]): ArrayValidator<[T1, T2]>;
function tuple<T1>(items: [Validator<T1>]): ArrayValidator<[T1]>;
function tuple<T>(items: Validator<T>): ArrayValidator<T[]>;
function tuple(items: any): ArrayValidator<any[]> {
    const v = new ArrayValidator<any[]>();
    return v.tuple(items);
}

export const v = {
    raw: <T = any>(schema: KeyValue) => new Validator<T>(schema),
    boolean: () => new BooleanValidator(),
    binary: () => new BinaryValidator(),
    number: () => new NumberValidator(),
    integer: () => new NumberValidator().integer(),
    string: () => new StringValidator(),
    object,
    array,
    tuple,
    equal: <T>(item: T) => new Validator<T>({ "const": item }),
    enum: <T>(items: T[]) => new Validator<T>({ "enum": items }),
    any: () => new Validator<any>()
};

export type ValidateBuilder = typeof v;
export default v;
