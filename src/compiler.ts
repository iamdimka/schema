import { Type, KeyValue, plural, safe, objectKey, isObjectType } from "./util";

const eq = [
    'function eq(a,b){if(a===b)return true;if(!a||!b||typeof a!=="object"||typeof b!=="object")return false;if(a.constructor!==b.constructor)return false;',
    'var l;',
    'if(Array.isArray(a)){l=a.length;if(l!==b.length)return false;while(l--)if(!eq(a[l],b[l]))return false;return true;}',
    'var keys=Object.keys(a);l=keys.length;if(l!==Object.keys(b).length)return false;while(l--)if(!hop.call(b,keys[l]))return false;',
    'l=keys.length;var key;while(l--){key=keys[l];if(!eq(a[key], b[key]))return false;}return true;}'
].join("");

let binaryType = "uint8array";

export function setBinaryType(nameOrInstance: any) {
    binaryType = typeof nameOrInstance === "string" ? nameOrInstance.toLowerCase() : Object.prototype.toString.call(nameOrInstance).slice(8, -1).toLowerCase();
}

const rules: {
    [rule: string]: {
        type: Type;
        writer: (param: any, varName: string, path: string, rules: KeyValue, config: CompilerConfig) => string | undefined;
    };
} = {};

const order: { [key: string]: string[]; } = {};

function extend(type: Type, rule: string, writer: (param: any, varName: string, path: string, rules: KeyValue, config: CompilerConfig) => string | undefined): void;
function extend(type: Type, rules: { [rule: string]: (param: any, varName: string, path: string, rules: KeyValue, config: CompilerConfig) => string | undefined; }): void;
function extend(type: Type, name: any): void {
    if (typeof name === "object") {
        for (const key in name) {
            extend(type, key, name[key]);
        }

        return;
    }

    if (rules.hasOwnProperty(name)) {
        if (rules[name].type !== type) {
            throw new Error(`Rule "${name}" already registered for type ${rules[name].type}`);
        }
    }

    if (!order.hasOwnProperty(type)) {
        order[type] = [name];
    } else if (order[type].indexOf(name) < 0) {
        order[type].push(name);
    }

    rules[name] = {
        type,
        writer: arguments[2]
    };
}

extend(Type.string, {
    trim(param, name, path, rules, config) {
        if (param) {
            config.assignItems = true;
            return `${name}=${name}.trim();`;
        }
    },

    toLower(param, name, path, rules, config) {
        if (param) {
            config.assignItems = true;
            return `${name}=${name}.toLocaleLowerCase();`;
        }
    },

    toUpper(param, name, path, rules, config) {
        if (param) {
            config.assignItems = true;
            return `${name}=${name}.toLocaleUpperCase();`;
        }
    }
});

extend(Type.string, {
    minLength(minLength, name, path) {
        if (typeof minLength === Type.number) {
            return `if(${name}.length<${minLength})throw new Error("${safe(path)} length should be at least ${minLength}");`;
        }
    },

    maxLength(maxLength, name, path) {
        if (typeof maxLength === Type.number) {
            return `if(${name}.length>${maxLength})throw new Error("${safe(path)} length should be at most ${maxLength}");`;
        }
    }
});

extend(Type.string, "pattern", (pattern, name, path) => {
    return `if(!/${pattern}/.test($)) throw new Error("${safe(path)} should match /${pattern}/");`;
});

extend(Type.string, "format", (format, name, path, rules, config) => {
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
            if (!format) {
                return;
            }

            throw new Error(`Format "${format}" is not supported`);
    }

    return `if(${check})throw new Error("${safe(path)} should have format ${format}");`;
});

extend(Type.number, "minimum", (minimum, name, path) => {
    return `if(${name}<${minimum}) throw new Error("${safe(path)} should be at least ${minimum}");`;
});

extend(Type.number, "maximum", (maximum, name, path) => {
    return `if(${name}>${maximum}) throw new Error("${safe(path)} should be at most ${maximum}");`;
});

extend(Type.number, "exclusiveMinimum", (exclusiveMinimum, name, path) => {
    return `if(${name}<=${exclusiveMinimum}) throw new Error("${safe(path)} should be above ${exclusiveMinimum}");`;
});

extend(Type.number, "exclusiveMaximum", (exclusiveMaximum, name, path) => {
    return `if(${name}>=${exclusiveMaximum}) throw new Error("${safe(path)} should be below ${exclusiveMaximum}");`;
});

extend(Type.number, "multipleOf", (multipleOf, name, path) => {
    return `if((${name}/${multipleOf})%1) throw new Error("${safe(path)} should be multiple of ${multipleOf}");`;
});

extend(Type.binary, {
    minBytes(minBytes, varName, path, rules, config) {
        config.ctx.length = true;
        return `if(l${varName}<${minBytes})throw new Error("${safe(path)} should have at least ${minBytes} byte${plural(minBytes)}");`;
    },

    maxBytes(maxBytes, varName, path, rules, config) {
        config.ctx.length = true;
        return `if(l${varName}>${maxBytes})throw new Error("${safe(path)} should have at most ${maxBytes} byte${plural(maxBytes)}");`;
    }
});

extend(Type.array, {
    minItems(minItems, varName, path, rules, config) {
        config.ctx.length = true;
        return `if(l${varName}<${minItems})throw new Error("${safe(path)} should have at least ${minItems} item${plural(minItems)}");`;
    },

    maxItems(maxItems, varName, path, rules, config) {
        config.ctx.length = true;
        return `if(l${varName}>${maxItems})throw new Error("${safe(path)} should have at most ${maxItems} item${plural(maxItems)}");`;
    }
});

extend(Type.array, "uniqueItems", (uniqueItems, varName, path, rules, config) => {
    if (!uniqueItems) {
        return;
    }

    config.hookEqual = true;
    config.ctx.length = true;
    return `for(var i${varName}=0;i${varName}<l${varName};i${varName}++)for(var j${varName}=i${varName}+1;j${varName}<=l${varName};j${varName}++)if(eq(${varName}[i${varName}],${varName}[j${varName}]))return new Error("${safe(path)} items is not unique");`;
});

extend(Type.array, "items", (items, name, path, rules, config) => {
    let fn = "";

    if (Array.isArray(items)) {
        if (rules.additionalItems === false) {
            config.ctx.length = true;
            fn += `if(l${name}!==${items.length})throw new Error("${safe(path)} should have at most ${items.length} item${plural(items.length)}");`;
        }

        for (let i = 0, l = items.length; i < l; i++) {
            if (rules.minItems == null || rules.minItems <= i) {
                config.ctx.length = true;
                fn += `if (l${name}>${i}) {`;
            }
            const nextVar = config.varName();
            const nextPath = objectKey(name, i);
            fn += `var ${nextVar}=${nextPath};`;
            fn += write(nextVar, objectKey(path, i), items[i], config);
            if (config.assignItems) {
                fn += `${nextPath}=${nextVar};`;
            }
            if (rules.minItems == null || rules.minItems <= i) {
                fn += `}`;
            }
        }

        return fn;
    }

    if (typeof items === "object") {
        const nextVar = config.varName();
        config.ctx.length = true;
        fn += `for(var i${name}=0,${nextVar};i${name}<l${name};i${name}++){${nextVar}=${name}[i${name}];`;
        fn += write(nextVar, `${path}[*]`, rules.items, config) + "}";
        if (config.assignItems) {
            fn += `${name}[i${name}]=${nextVar};`;
        }

        return fn;
    }

    throw new Error(`Invalid type "items" at ${safe(path)}`);
});

extend(Type.array, "contains", (contains, name, path, rules, config) => {
    const nextVar = config.varName();
    let fn = `var f${name}=false;`;
    fn += `for(var i${name}=0,${nextVar};i${name}<l${name};i++){${nextVar}=${name}[i${name}];try{`;
    return fn + write(nextVar, `${path}[*]`, contains, config) + `f${name}=true;break;}catch{}}if(!f${name})throw new Error("${safe(path)} should contain special item");`;
});

extend(Type.object, "minProperties", (minProperties, name, path, rules, config) => {
    config.ctx.getProperties = true;
    return `if(p${name}.length<${minProperties})throw new Error("${safe(path)} should have at least ${minProperties} propert${plural(minProperties, "ies", "y")}");`;
});

extend(Type.object, "maxProperties", (maxProperties, name, path, rules, config) => {
    config.ctx.getProperties = true;
    return `if(p${name}.length>${maxProperties})throw new Error("${safe(path)} should have at most ${maxProperties} propert${plural(maxProperties, "ies", "y")}");`;
});

extend(Type.object, "required", (required, name, path, rules, config) => {
    let fn = "";

    for (const key of required) {
        config.hookHop = true;
        fn += `if(!hop.call(${name}, "${key}"))throw new Error("${safe(path)}[\\\"${key}\\\"] required");`;
    }
    return fn;
});

extend(Type.object, "dependencies", (dependencies, name, path, rules, config) => {
    let fn = "";

    for (const key in dependencies) {
        config.hookHop = true;
        fn += `if(hop.call(${name}, "${safe(key)}")){`;
        const entry = dependencies[key];
        if (Array.isArray(entry)) {
            for (const dep of dependencies[key]) {
                fn += `if(!hop.call(${name}, ${JSON.stringify(dep)})) throw new Error("${safe(objectKey(path, dep))} required if ${safe(objectKey(path, key))} presented");`;
            }
        } else if (entry && typeof entry === "object") {
            for (const k in entry) {
                fn += `if(!hop.call(${name}, "${safe(k)}")) throw new Error("${safe(objectKey(path, k))} required if ${safe(objectKey(path, key))} presented");`;
                const nextVar = config.varName();
                const nextPath = objectKey(name, k);
                fn += `var ${nextVar}=${nextPath};`;
                fn += write(nextVar, objectKey(path, k), entry[k], config);
            }
        }

        fn += `}`;
    }
    return fn;
});

extend(Type.object, "additionalProperties", () => {
    return undefined;
});

extend(Type.object, "properties", (properties, name, path, rules, config) => {
    config.ctx.getProperties = true;

    let fn = "";

    if (rules.additionalProperties === false) {
        config.ctx.getProperties = true;
        fn += `if(p${name}.length>${Object.keys(properties).length})throw new Error("${safe(path)} shouldn't have additional properties");`;
    }

    for (const key in properties) {
        config.hookHop = true;
        const isRequired = rules.required && rules.required.indexOf(key) >= 0;
        if (!isRequired) {
            fn += `if(hop.call(${name}, ${JSON.stringify(key)})){`;
        }
        const property = properties[key];
        const nextVar = config.varName();
        const nextPath = objectKey(path, key);
        fn += `var ${nextVar}=${nextPath};`;
        fn += write(nextVar, objectKey(path, key), property, config);
        if (config.assignItems) {
            fn += `${nextPath}=${nextVar};`;
        }

        if (!isRequired) {
            fn += "}";
        }
    }

    const props = Object.keys(properties).map(prop => `k${name}==="${prop}"`).join("||");

    if (rules.additionalProperties === false) {
        if (props) {
            fn += `for(var k${name} in ${name})if(!(${props}))throw new Error("${safe(path)} shouldn't have additional properties");`;
        }
    } else if (rules.additionalProperties && typeof rules.additionalProperties === "object") {
        fn += `for(var k${name} in ${name}){`;
        if (props) {
            fn += `if(${props})continue;`;
        }

        const nextVar = config.varName();
        const nextPath = `${name}[k${name}]`;
        fn += `var ${nextVar}=${nextPath};`;
        fn += write(nextVar, `${safe(path)}.*`, rules.additionalProperties, config) + "}";
        if (config.assignItems) {
            fn += `${nextPath}=${nextVar};`;
        }
    }

    return fn;
});

function contextHooks(varName: string, type: Type, ctx: KeyValue, out: string): string {
    switch (type) {
        case Type.binary:
        case Type.array: {
            if (ctx.length) {
                out = `var l${varName}=${varName}.length;${out}`;
            }
            break;
        }

        case Type.object: {
            if (ctx.getProperties) {
                out = `var p${varName}=Object.keys(${varName});${out}`;
            }
            break;
        }
    }
    return out;
}

interface CompilerConfig {
    assignItems?: boolean;
    hookEqual?: boolean;
    hookToString?: boolean;
    hookHop?: boolean;
    ctx: KeyValue;
    varName(): string;
}

export default function compile(schema: KeyValue, varName: string = "$") {
    let i = 0;
    const config: CompilerConfig = {
        ctx: {},
        varName: () => `v${i++}`
    };

    let fn = write(varName, varName, schema, config) + `return ${varName}`;

    if (config.hookToString) {
        fn = `var toString = Object.prototype.toString;${fn}`;
    }

    if (config.hookEqual) {
        fn = eq + fn;
    }

    if (config.hookHop || config.hookEqual) {
        fn = `var hop = Object.prototype.hasOwnProperty;${fn}`;
    }

    return new Function(varName, `"use strict";\n${fn}`) as (v: any) => any;
}

function getTypes(schema: KeyValue): string[] {
    if (schema.type) {
        if (Array.isArray(schema.type)) {
            return schema.type;
        }

        return [schema.type];
    }

    const types: string[] = [];
    for (const name in schema) {
        if (rules.hasOwnProperty(name)) {
            const { type } = rules[name];

            if (types.indexOf(type) < 0) {
                types.push(type);
            }
        }
    }

    return types;
}

function write(varName: string, path: string, schema: KeyValue, config: CompilerConfig) {
    let next = false;
    const types = getTypes(schema);
    // const intN = types.indexOf(Type.integer);
    // if (intN >= 0) {
    //     if (types.indexOf("number") < 0) {
    //         types[intN] = "number";
    //         checkInteger = true;
    //     } else {
    //         types.splice(intN, 1);
    //     }
    // }
    let fn = "";

    if ("default" in schema) {
        config.assignItems = true;
        fn += `if(${varName}===void 0)${varName}=${JSON.stringify(schema["default"])};`;
    }

    if ("const" in schema) {
        const value = schema["const"];
        if (value === null || typeof value !== "object") {
            return fn + `if(${varName}!==${JSON.stringify(value)})throw new Error("${safe(path)} should equal ${safe(JSON.stringify(value))}");`;
        }

        config.hookEqual = true;
        return fn + `if(!eq(${varName},${JSON.stringify(value)}))throw new Error("${safe(path)} should equal ${safe(JSON.stringify(value))}");`;
    }

    if (Array.isArray(schema.enum)) {
        const values = JSON.stringify(schema.enum);
        const check = schema.enum.map(value => {
            if (value === null || typeof value !== "object") {
                return `${varName}!==${JSON.stringify(value)}`;
            }

            config.hookEqual = true;
            return `!eq(${varName},${JSON.stringify(value)})`;
        }).join("&&");

        return fn + `if(${check})throw new Error("${safe(path)} should be one of ${safe(values)}");`;
    }

    fn += `var t${varName}=typeof ${varName};`;

    if (types.some(isObjectType)) {
        config.hookToString = true;
        const strVar = config.varName();
        fn += `if(t${varName}==="${Type.object}"){var ${strVar}=toString.call(${varName});t${varName}=${strVar}.substring(8, ${strVar}.length-1).toLowerCase();}`;
        // fn += `if(t${varName}==="${Type.object}"){if(${varName}===null){t${varName}="${Type.null}";}else if(Array.isArray(${varName})){t${varName}="${Type.array}";}}`;
    }

    for (let type of types) {
        if (next) {
            fn += "else ";
        } else {
            next = true;
        }

        if (type === "integer") {
            fn += `if(t${varName}==="${Type.number}"&&Number.isInteger(${varName})){`;
        } else if (type === "binary") {
            fn += `if(t${varName}==="${binaryType}"){`;
        } else {
            fn += `if(t${varName}==="${type}"){`;
        }

        if (order.hasOwnProperty(type)) {
            let tmp = "";
            for (const name of order[type]) {
                if (schema.hasOwnProperty(name)) {
                    const chunk = rules[name].writer(schema[name], varName, path, schema, config);
                    if (chunk) {
                        tmp += chunk;
                    }
                }
            }

            fn += contextHooks(varName, type as Type, config.ctx, tmp);
        }

        fn += `}`;
    }

    if (schema.type) {
        fn += `else throw new Error("${safe(path)} should be ${types.join(" or ")}");`;
    }

    return fn;
}

export { extend };