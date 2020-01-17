import compiler from "./compiler";
import { KeyValue, Result, Type, isEqual } from "./util";

type Compiler = Result<typeof compiler>;

export type Rules<T> = {
    default?: () => T;
};

if (!Number.isInteger) {
    Number.isInteger = n => Math.trunc(n) === n;
}

if (!Array.isArray) {
    Array.isArray = (arg: any): arg is any[] => arg instanceof Array;
}

export class ValidatorError extends Error {
    readonly data: {
        field: string;
        validator: string;
        arg: any;
    };

    constructor(message: string, field: string, validator: string, arg: any) {
        super(message);

        this.data = {
            field,
            validator,
            arg
        };

        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, ValidatorError);
        }
    }
}

function checkType(c: Compiler, t: Type) {
    c.type();
    c`if (type !== ${t}) throw new TypeError("expected " + $$ + " to have type " + ${t});\n`;
}

export abstract class Validator<T> {
    readonly rules: KeyValue = {};

    protected compiled?: () => T;
    protected abstract _compile(c: Compiler, rules: KeyValue): void;
    abstract example(): T;

    protected set(rule: string, value: any): this {
        this.rules[rule] = value;
        this.compiled = undefined;
        return this;
    }

    clone(): this {
        const validator = Object.create(this);

        validator.rules = {
            ...this.rules
        };

        return this;
    }

    optional(): Validator<T | undefined> {
        return this.set("default", () => undefined);
    }

    default(value?: T | (() => T)): this {
        return this.set("default", value);
    }

    compile(): (item: any, name: string) => T {
        if (this.compiled) {
            return this.compiled;
        }

        const c = compiler();
        const { rules } = this;

        if (typeof rules.default === "function") {
            c`if ($ == null) return ${rules.default}();`;
        } else if ("default" in rules) {
            c`if ($ == null) return ${rules.default};`;
        }

        this._compile(c, rules);
        return this.compiled = c.compile();
    }

    validate(item: any, name: string): T {
        return this.compile()(item, name);
    }
}

export class BooleanValidator extends Validator<boolean> {
    protected _compile(c: Compiler) {
        checkType(c, Type.boolean);
    }

    example(): boolean {
        return Math.random() < 0.5;
    }
}

export class StringValidator extends Validator<string> {
    toLower(toLower: boolean = true): this {
        return this.set("toLower", toLower);
    }

    trim(trim: boolean = true): this {
        return this.set("trim", trim);
    }

    length(length: number): this {
        return this.set("length", length);
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
        return this.set("pattern", pattern);
    }

    numeric() {
        return this.set("format", "numeric");
    }

    pattern(pattern: string | RegExp) {
        return this.set("pattern", typeof pattern === "string" ? new RegExp(pattern) : pattern);
    }

    format(format: "alpha" | "alphanumeric" | "hexadecimal" | "identifier" | "numeric" | "date-time" | "uppercase" | "lowercase" | "hostname" | "uri" | "email" | "ipv4" | "ipv6" | "regex" | "json-pointer") {
        return this.set("format", format);
    }

    protected _generateAz09() {
        const code = Math.floor(Math.random() * 62);

        if (code < 10) {
            return String.fromCharCode(code + 48);
        }

        if (code < 36) {
            return String.fromCharCode(code + 55);
        }

        return String.fromCharCode(code + 61);
    }

    example(): string {
        let min = this.rules.minLength || 0;
        let max = this.rules.maxLength || 50;

        if (this.rules.length) {
            min = max = this.rules.length;
        }

        let example = "";

        for (let i = 0, l = min + Math.random() * (max - min); i < l; i++) {
            example += this._generateAz09();
        }

        return this.rules.toLower ? example.toLowerCase() : example;
    }

    protected _compile(c: Compiler, { trim, toLower, length, minLength, maxLength, pattern, format }: KeyValue) {
        checkType(c, Type.string);

        if (trim) {
            c`$ = $.trim();`;
        }

        if (toLower) {
            c`$ = $.toLocaleLowerCase();`;
        }

        if (format) {
            let check;

            switch (format) {
                case "alpha":
                    check = `!/^[a-zA-Z]+$/.test($)`;
                    break;

                case "alphanumeric":
                    check = `!/^[a-zA-Z0-9]+$/.test($)`;
                    break;

                case "hexadecimal":
                    check = `!/^[a-fA-F0-9]+$/.test($)`;
                    break;

                case "identifier":
                    check = `!/^[-_a-zA-Z0-9]+$/.test($)`;
                    break;

                case "numeric":
                    check = `!/^[0-9]+$/.test($)`;
                    break;

                case "date-time":
                    check = `isNaN(Date.parse($)) || ~$.indexOf(\'/\')`;
                    break;

                case "uppercase":
                    check = `$ !== $.toUpperCase()`;
                    break;

                case "lowercase":
                    check = `$ !== $.toLowerCase()`;
                    break;

                case "hostname":
                    check = `$.length >= 256 || !/^([a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9\\-]{0,61}[a-zA-Z0-9])(\\.([a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9\\-]{0,61}[a-zA-Z0-9]))*$/.test($)`;
                    break;

                case "uri":
                    check = `!/^[A-Za-z][A-Za-z0-9+\\-.]*:(?:\\/\\/(?:(?:[A-Za-z0-9\\-._~!$&\'()*+,;=:]|%[0-9A-Fa-f]{2})*@)?(?:\\[(?:(?:(?:(?:[0-9A-Fa-f]{1,4}:){6}|::(?:[0-9A-Fa-f]{1,4}:){5}|(?:[0-9A-Fa-f]{1,4})?::(?:[0-9A-Fa-f]{1,4}:){4}|(?:(?:[0-9A-Fa-f]{1,4}:){0,1}[0-9A-Fa-f]{1,4})?::(?:[0-9A-Fa-f]{1,4}:){3}|(?:(?:[0-9A-Fa-f]{1,4}:){0,2}[0-9A-Fa-f]{1,4})?::(?:[0-9A-Fa-f]{1,4}:){2}|(?:(?:[0-9A-Fa-f]{1,4}:){0,3}[0-9A-Fa-f]{1,4})?::[0-9A-Fa-f]{1,4}:|(?:(?:[0-9A-Fa-f]{1,4}:){0,4}[0-9A-Fa-f]{1,4})?::)(?:[0-9A-Fa-f]{1,4}:[0-9A-Fa-f]{1,4}|(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?))|(?:(?:[0-9A-Fa-f]{1,4}:){0,5}[0-9A-Fa-f]{1,4})?::[0-9A-Fa-f]{1,4}|(?:(?:[0-9A-Fa-f]{1,4}:){0,6}[0-9A-Fa-f]{1,4})?::)|[Vv][0-9A-Fa-f]+\\.[A-Za-z0-9\\-._~!$&\'()*+,;=:]+)\\]|(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)|(?:[A-Za-z0-9\\-._~!$&\'()*+,;=]|%[0-9A-Fa-f]{2})*)(?::[0-9]*)?(?:\\/(?:[A-Za-z0-9\\-._~!$&\'()*+,;=:@]|%[0-9A-Fa-f]{2})*)*|\\/(?:(?:[A-Za-z0-9\\-._~!$&\'()*+,;=:@]|%[0-9A-Fa-f]{2})+(?:\\/(?:[A-Za-z0-9\\-._~!$&\'()*+,;=:@]|%[0-9A-Fa-f]{2})*)*)?|(?:[A-Za-z0-9\\-._~!$&\'()*+,;=:@]|%[0-9A-Fa-f]{2})+(?:\\/(?:[A-Za-z0-9\\-._~!$&\'()*+,;=:@]|%[0-9A-Fa-f]{2})*)*|)(?:\\?(?:[A-Za-z0-9\\-._~!$&\'()*+,;=:@\\/?]|%[0-9A-Fa-f]{2})*)?(?:\\#(?:[A-Za-z0-9\\-._~!$&\'()*+,;=:@\\/?]|%[0-9A-Fa-f]{2})*)?$/.test($)`;
                    break;

                case "email":
                    check = `!/^[^@]+@[^@]+\\.[^@]+$/.test($)`;
                    break;

                case "ipv4":
                    check = `!/^(\\d?\\d?\\d){0,255}\\.(\\d?\\d?\\d){0,255}\\.(\\d?\\d?\\d){0,255}\\.(\\d?\\d?\\d){0,255}$/.test($) || $.split(".")[3] > 255`;
                    break;

                case "ipv6":
                    check = `!/^((?=.*::)(?!.*::.+::)(::)?([\\dA-F]{1,4}:(:|\\b)|){5}|([\\dA-F]{1,4}:){6})((([\\dA-F]{1,4}((?!\\3)::|:\\b|$))|(?!\\2\\3)){2}|(((2[0-4]|1\\d|[1-9])?\\d|25[0-5])\\.?\\b){4})$/.test($)`;
                    break;

                case "regex":
                    check = `/[^\\\\]\\\\[^.*+?^\${}()|[\\]\\\\bBcdDfnrsStvwWxu0-9]/i.test($)`;
                    break;

                case "json-pointer":
                    check = `!/^$|^\\/(?:~(?=[01])|[^~])*$/i.test($)`;
                    break;

                default:
                    throw new Error(`Format ${format} is not supported`);
            }

            c.writeLine(`if (${check}) throw new Error($$ + " should have format ${format}")`);
        }

        if (typeof length === Type.number) {
            c`if ($.length !== ${length}) throw new TypeError($$ + " length should be ${length}");`;
        }

        if (typeof minLength === Type.number) {
            c`if ($.length < ${minLength}) throw new TypeError($$ + " length should be at least ${minLength}");`;
        }

        if (typeof maxLength === Type.number) {
            c`if ($.length > ${maxLength}) throw new TypeError($$ + " length should be at most ${maxLength}");`;
        }

        if (pattern) {
            c`if (!${pattern}.test($)) throw new TypeError($$ + " should match ${pattern}")`;
        }
    }
}

export class NumberValidator extends Validator<number> {
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

    integer(integer: boolean = true) {
        return this.set("integer", integer);
    }

    example(): number {
        const min = this.rules.minimum || this.rules.exclusiveMinimum || 0;
        const max = this.rules.maximum || this.rules.exclusiveMaximum || 0;
        let value = min + Math.random() * (max - min);
        if (this.rules.integer) {
            return Math.round(value);
        }

        return this.rules.multipleOf ? Math.floor(value / this.rules.multipleOf) * this.rules.multipleOf : value;
    }

    protected _compile(c: Compiler, { integer, minimum, maximum, exclusiveMinimum, exclusiveMaximum, multipleOf }: KeyValue) {
        checkType(c, Type.number);

        if (integer) {
            c`if (!Number.isInteger($)) throw new TypeError($$ + " should be an integer");`;
        }

        if (typeof minimum === Type.number) {
            c`if ($ < ${minimum}) throw new TypeError($$ + " should be at least ${minimum}");`;
        }

        if (typeof maximum === Type.number) {
            c`if ($ > ${maximum}) throw new TypeError($$ + " should be at most ${maximum}");`;
        }

        if (typeof exclusiveMinimum === Type.number) {
            c`if ($ <= ${exclusiveMinimum}) throw new TypeError($$ + " should be above ${exclusiveMinimum}");`;
        }

        if (typeof exclusiveMaximum === Type.number) {
            c`if ($ >= ${exclusiveMaximum}) throw new TypeError($$ + " should be below ${exclusiveMaximum}");`;
        }

        if (typeof multipleOf === Type.number) {
            c`if (($/${multipleOf})%1) throw new TypeError($$ + " should be multiple of ${multipleOf}");`;
        }
    }
}

export class ObjectValidator<T extends KeyValue = {}> extends Validator<T> {
    schema<S>(schema: { [K in keyof S]: Validator<S[K]> }): ObjectValidator<S> {
        return this.set("schema", schema) as any;
    }

    other<O>(other?: Validator<O>): ObjectValidator<{ [key: string]: O; } & T>;
    other(other?: true): ObjectValidator<{ [key: string]: any; }>;
    other(other?: any): ObjectValidator<any> {
        if (!other) {
            return this.set("other", true);
        }

        return this.set("other", other);
    }

    maxProperties(maxProperties: number) {
        return this.set("maxProperties", maxProperties);
    }

    minProperties(minProperties: number) {
        return this.set("minProperties", minProperties);
    }

    protected _compile(c: Compiler, rules: KeyValue): T {
        checkType(c, Type.object);

        const result = {} as T;

        if (typeof rules.minProperties === Type.number) {
            c.props();
            c`if (props.length < ${rules.minProperties}) throw new TypeError($$ + " should have at least ${rules.minProperties} propert" + ${rules.minProperties === 1 ? "y" : "ies"})`;
        }

        if (typeof rules.maxProperties === Type.number) {
            c.props();
            c`if (props.length > ${rules.maxProperties}) throw new TypeError($$ + " should have at most ${rules.maxProperties} propert" + ${rules.maxProperties === 1 ? "y" : "ies"})`;
        }

        if (rules.schema) {
            for (const key in rules.schema) {
                c`$[${key}] = ${rules.schema[key].compile()}($[${key}], $$ + "." + ${key});`;
            }
        }

        if (rules.other) {
            if (rules.other === true) {
                //nothing
            } else if (rules.schema) {
                c`const keys2 = ${Object.keys(rules.schema)};`;
                const fn = rules.other.compile();
                c`for (const key in $) if (keys2.indexOf(key) < 0) $[key] = ${fn}($[key], $$ + "." + key);`;
            } else {
                const fn = rules.other.compile();
                c`for (const key in $) $[key] = ${fn}($[key], $$ + "." + key);`;
            }
        } else {
            c`const keys2 = ${Object.keys(rules.schema)};`;
            c`for (const key in $) if (keys2.indexOf(key) < 0) throw new TypeError($$ + ' has key "' + '" which is not expected');`;
        }

        return result;
    }

    example(): T {
        const example = {} as T;
        if (this.rules.schema) {
            for (const key in this.rules.schema) {
                if (this.rules.schema.hasOwnProperty(key)) {
                    //@ts-ignore
                    example[key] = this.rules.schema[key].example();
                }
            }
        }

        return example;
    }
}

export class BinaryValidator extends Validator<Buffer> {
    length(length: number): this {
        return this.set("length", length);
    }

    min(min: number): this {
        return this.set("min", min);
    }

    max(max: number): this {
        return this.set("max", max);
    }

    example(): Buffer {
        if (this.rules.length !== undefined) {
            return Buffer.allocUnsafe(this.rules.length);
        }

        const min = this.rules.min || 0;
        const max = this.rules.max || 64;
        return Buffer.allocUnsafe(min + Math.floor(Math.random() * (max - min)));
    }

    protected _compile(c: Compiler, { length, min, max }: KeyValue) {
        checkType(c, Type.buffer);

        if (typeof length === Type.number) {
            c`if ($.length !== ${length}) throw new TypeError($$ + " should have length ${length}")`;
        }

        if (typeof min === "number") {
            c`if ($.length < ${min}) throw new TypeError($$ + " length should be at least ${min}")`;
        }

        if (typeof max === "number") {
            c`if ($.length > ${max}) throw new TypeError($$ + " length should be at most ${max}")`;
        }
    }
}

export class ArrayValidator<T = any> extends Validator<T[]> {
    items<V>(items: Validator<V>): ArrayValidator<V> {
        return this.set("items", items) as any;
    }

    length(length: number): this {
        return this.set("length", length);
    }

    uniqueItems() {
        return this.set("uniqueItems", true);
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

    example() {
        let min = this.rules.minItems || 0;
        let max = this.rules.maxItems || 8;

        if (this.rules.length !== undefined) {
            min = max = this.rules.lenght;
        }

        const result: T[] = [];
        for (let i = 0, l = Math.floor(min + Math.random() * (max - min)); i < l; i++) {
            if (this.rules.items === undefined) {
                result.push((Math.random() < 0.5) as any);
            } else {
                result.push(this.rules.items.example());
            }
        }
        return result;
    }

    protected _compile(c: Compiler, { length, minItems, maxItems, items, uniqueItems }: KeyValue) {
        checkType(c, Type.array);

        if (typeof length === Type.number) {
            c`if ($.length !== ${length}) throw new TypeError($$ + " length should be ${length}")`;
        }

        if (typeof minItems === Type.number) {
            c`if ($.length < ${minItems}) throw new TypeError($$ + " should have at least ${minItems}")`;
        }

        if (typeof maxItems === Type.number) {
            c`if ($.length > ${maxItems}) throw new TypeError($$ + " length should be at most ${maxItems}")`;
        }

        if (uniqueItems) {
            c`for(let i = 0, l = $.length - 1; i < l; i++) for(let j = i+1; j <= l; ++j) if (${equal}($[i], $[j])) return new TypeError($$ + " should be unique");`;
        }

        if (items) {
            const fn = items.compile();
            c`for (let i = 0, l = $.length; i < l; i++) $[i] = ${fn}($[i], $$ + "[" + i + "]");`;
        }
    }
}

export class EqualValidator<T> extends Validator<T> {
    example(): T {
        return this.rules.equal;
    }

    protected _compile(c: Compiler, rules: KeyValue) {
        c`if (!${isEqual}($, ${rules.equal})) throw new TypError($$ + " should equal " + ${JSON.stringify(rules.equal)});`;
    }

    constructor(value: T) {
        super();
        this.rules.equal = value;
    }
}

export class AnyValidator<T = any> extends Validator<T> {
    oneOf(...values: T[]) {
        this.rules.oneOf = values;
        return this;
    }

    maybe<V>(...maybe: Array<Validator<V> | V>): AnyValidator<V> {
        return this.set("maybe", maybe.map(item => {
            if (item instanceof Validator) {
                return item;
            }

            return equal(item);
        })) as any;
    }

    example(): T {
        if (this.rules.oneOf) {
            return this.rules.oneOf[Math.floor(Math.random() * this.rules.oneOf.lenght)];
        }

        if (this.rules.maybe && this.rules.maybe.lenght) {
            return this.rules.maybe[Math.floor(Math.random() * this.rules.maybe.lenght)].example();
        }

        return null as any;
    }

    protected _compile(c: Compiler, { maybe, oneOf }: KeyValue) {
        if (maybe && maybe.length) {
            c`const errors = [];`;
            for (const check of maybe) {
                c`try { return ${check.compile()}($, $$); } catch(e) { errors.push(e.message); }`;
            }
            c`throw new TypeError(errors.join(" or "));`;
            return;
        }

        if (oneOf && oneOf.length) {
            c`const oneOf = this[${c.dep(oneOf, true)}];`;
            c`const found = oneOf.some(example => ${isEqual}($, example));`;
            c`if (!found) throw new TypeError($$ + " has unexpected value");`;
        }
    }
}

export function binary(): BinaryValidator {
    return new BinaryValidator();
}

export function boolean(): BooleanValidator {
    return new BooleanValidator();
}

export function number(): NumberValidator {
    return new NumberValidator();
}

export function integer(): NumberValidator {
    return new NumberValidator().integer();
}

export function string(): StringValidator {
    return new StringValidator();
}

export function object<T>(schema?: { [K in keyof T]: Validator<T[K]> }): ObjectValidator<T> {
    const v = new ObjectValidator<T>();
    return schema ? v.schema(schema) : v;
}

export function array<T>(items?: Validator<T>): ArrayValidator<T> {
    const v = new ArrayValidator<T>();
    return items ? v.items(items) : v;
}

export function any<T>(...maybe: Validator<any>[]): AnyValidator<T> {
    const v = new AnyValidator<T>();
    return v.maybe(...maybe);
}

export function equal<T>(item: T): EqualValidator<T> {
    return new EqualValidator<T>(item);
}

function oneOf<T>(...values: T[]) {
    const v = new AnyValidator<T>();
    return v.oneOf(...values);
}

export interface ValidateBuilder {
    boolean(): BooleanValidator;
    binary(): BinaryValidator;
    number(): NumberValidator;
    integer(): NumberValidator;
    string(): StringValidator;
    object<T>(schema?: { [K in keyof T]: Validator<T[K]> }): ObjectValidator<T>;
    array<T>(of?: Validator<T>): ArrayValidator<T>;
    equal<T>(item: T): EqualValidator<T>;
    any<T>(...maybe: Validator<T>[]): AnyValidator<T>;
    oneOf<T>(...values: T[]): AnyValidator<T>;
}

export const v: ValidateBuilder = {
    boolean,
    binary,
    number,
    integer,
    string,
    object,
    array,
    equal,
    oneOf,
    any
};

export default v;
