import { type } from "./util";

export default function complier() {
    let body = "";
    let getType = false;
    let getProps = false;

    const deps: any[] = [];

    const c = function (items: TemplateStringsArray, ...args: any[]) {
        body += items[0];

        for (let i = 0, l = args.length; i < l; i++) {
            const item = args[i];
            const type = typeof item;

            if (type === "function") {
                body += c.dep(item);
            } else if (type === "object") {
                if (item instanceof RegExp) {
                    body += item;
                } else {
                    body += JSON.stringify(item);
                }
            } else {
                body += JSON.stringify(item);
            }

            body += items[i + 1];
        }

        body += "\n";
    };

    c.write = function (str: string) {
        body += str;
    };

    c.writeLine = function (str: string) {
        body += str + "\n";
    };

    c.type = function () {
        getType = true;
        return this;
    };

    c.props = function () {
        getType = true;
        getProps = true;
        return this;
    };

    c.pre = function (item: string) {
        body = item + "\n" + body;
    };

    c.check = function (cond: string, message: string) {
        body += `if (${cond}) return new TypeError(${JSON.stringify(message)});`;
    };

    c.compile = function () {
        const fn = new Function("$", "$$", c.toString());
        return deps.length ? fn.bind(deps) : fn;
    };

    c.dep = function (item: any, returnIndex = false): string {
        let i = deps.indexOf(item);
        if (i < 0) {
            i = deps.push(item) - 1;
        }

        return returnIndex ? i.toString() : `this[${i}]`;
    };

    c.toString = function () {
        let out = `"use strict"\n`;
        if (getType) {
            out += `const type = ${this.dep(type)}($);\n`;
        }

        if (getProps) {
            out += `const props = type === "object" ? Object.keys($) : undefined;\n`;
        }

        return `${out + body}\nreturn $`;
    };

    return c;
}

// export function compileSchema(schema: KeyValue): Function {
//     const c = complier();

//     const { type, "const": konst, "enum": enam } = schema;

//     if (konst !== undefined) {
//         const k = JSON.stringify(konst);
//         c.check(konst === null || typeof konst !== "object" ? `$ !== ${k}` : `!_.equal($, ${k})`, `should equal ${k}`, { "const": konst });
//         return c.compile();
//     }

//     if (Array.isArray(enam)) {
//         const e = JSON.stringify(enam);
//         let check;

//         if (enam.some(item => item !== null && typeof item === "object")) {
//             check = `${e}.findIndex(item => _.equal(item, $)) < 0`;
//         } else {
//             check = `${e}.indexOf($) < 0`;
//         }

//         c.check(check, `should equal ${enam.map(item => JSON.stringify(item)).join(" or ")}`, { "enum": enam });
//         return c.compile();
//     }

//     if (type) {
//         c.type();

//         if (Array.isArray(type)) {
//             c.check(`${JSON.stringify(type)}.indexOf(type) < 0`, `expected type ${type.join(" or ")}`, { type });
//         } else if (type === "integer") {
//             c.check(`type !== "number" || ($%1)`, "expected type integer", { type });
//         } else {
//             c.check(`type !== "${type}"`, `expected type ${type}`, { type });
//         }
//     }

//     const groups = groupRules(schema);
//     for (const type in groups) {
//         c.type();
//         const entry = groups[type];
//         c`if (type === ${type}) {`;
//         for (let i = 0, l = entry.lenght; i < l; i += 2) {
//             entry[i](c, entry[i + 1]);
//         }
//         c`}`;
//     }

//     return c.compile();
// }