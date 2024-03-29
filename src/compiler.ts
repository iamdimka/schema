import { Type, KeyValue, plural, safe, objectKey, sortTypes } from "./util"

const eq = [
  'function eq(a,b){if(a===b)return true;if(!a||!b||typeof a!=="object"||typeof b!=="object")return false;if(a.constructor!==b.constructor)return false;',
  'var l;',
  'if(Array.isArray(a)){l=a.length;if(l!==b.length)return false;while(l--)if(!eq(a[l],b[l]))return false;return true;}',
  'var keys=Object.keys(a);l=keys.length;if(l!==Object.keys(b).length)return false;while(l--)if(b[keys[l]]===undefined)return false;',
  'l=keys.length;var key;while(l--){key=keys[l];if(!eq(a[key], b[key]))return false;}return true;}'
].join("")

let binaryType = "[object Uint8Array]"

export function setBinaryType(nameOrInstance: any) {
  binaryType = typeof nameOrInstance === "string" ? nameOrInstance.toLowerCase() : Object.prototype.toString.call(nameOrInstance).slice(8, -1).toLowerCase()
}

const rules: {
  [rule: string]: {
    type: Type
    writer: (param: any, varName: string, path: string, rules: KeyValue, config: CompilerConfig) => string | undefined
  }
} = {}

const order: { [key: string]: string[] } = {}

function orderFunction(type: Type, name: string) {
  if (!order.hasOwnProperty(type)) {
    order[type] = [name]
  } else if (order[type].indexOf(name) < 0) {
    order[type].push(name)
  }

  if (type === Type.number) {
    orderFunction(Type.integer, name)
  }
}

function extend(type: Type, rule: string, writer: (param: any, varName: string, path: string, rules: KeyValue, config: CompilerConfig) => string | undefined): void
function extend(type: Type, rules: { [rule: string]: (param: any, varName: string, path: string, rules: KeyValue, config: CompilerConfig) => string | undefined }): void
function extend(type: Type, name: any): void {
  if (typeof name === "object") {
    for (const key in name) {
      extend(type, key, name[key])
    }

    return
  }

  if (rules.hasOwnProperty(name)) {
    if (rules[name].type !== type) {
      throw new Error(`Rule "${name}" already registered for type ${rules[name].type}`)
    }
  }

  orderFunction(type, name)

  rules[name] = {
    type,
    writer: arguments[2]
  }
}

extend(Type.string, {
  trim(param, name, path, rules, config) {
    if (param) {
      config.assignItems++
      return `${name}=${name}.trim();`
    }
  },

  toLower(param, name, path, rules, config) {
    if (param) {
      config.assignItems++
      return `${name}=${name}.toLocaleLowerCase();`
    }
  },

  toUpper(param, name, path, rules, config) {
    if (param) {
      config.assignItems++
      return `${name}=${name}.toLocaleUpperCase();`
    }
  }
})

extend(Type.string, {
  minLength(minLength, name, path) {
    if (typeof minLength === Type.number) {
      return `if(${name}.length<${minLength})throw new Error("${safe(path)} length should be at least ${minLength}");`
    }
  },

  maxLength(maxLength, name, path) {
    if (typeof maxLength === Type.number) {
      return `if(${name}.length>${maxLength})throw new Error("${safe(path)} length should be at most ${maxLength}");`
    }
  }
})

extend(Type.string, "pattern", (pattern, name, path) => {
  return `if(!/${pattern}/.test(${name})) throw new Error("${safe(path)} should match /${pattern}/");`
})

extend(Type.string, "format", (format, name, path, rules, config) => {
  let check

  switch (format) {
    case "alpha":
      check = `!/^[a-zA-Z]+$/.test(${name})`
      break

    case "alphanumeric":
      check = `!/^[a-zA-Z0-9]+$/.test(${name})`
      break

    case "hexadecimal":
      check = `!/^[a-fA-F0-9]+$/.test(${name})`
      break

    case "identifier":
      check = `!/^[-_a-zA-Z0-9]+$/.test(${name})`
      break

    case "numeric":
      check = `!/^[0-9]+$/.test(${name})`
      break

    case "date-time":
      check = `isNaN(Date.parse(${name})) || ~${name}.indexOf(\'/\')`
      break

    case "uppercase":
      check = `${name} !== ${name}.toUpperCase()`
      break

    case "lowercase":
      check = `${name} !== ${name}.toLowerCase()`
      break

    case "hostname":
      check = `${name}.length >= 256 || !/^([a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9\\-]{0,61}[a-zA-Z0-9])(\\.([a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9\\-]{0,61}[a-zA-Z0-9]))*$/.test(${name})`
      break

    case "uri":
      check = `!/^[A-Za-z][A-Za-z0-9+\\-.]*:(?:\\/\\/(?:(?:[A-Za-z0-9\\-._~!$&\'()*+,;=:]|%[0-9A-Fa-f]{2})*@)?(?:\\[(?:(?:(?:(?:[0-9A-Fa-f]{1,4}:){6}|::(?:[0-9A-Fa-f]{1,4}:){5}|(?:[0-9A-Fa-f]{1,4})?::(?:[0-9A-Fa-f]{1,4}:){4}|(?:(?:[0-9A-Fa-f]{1,4}:){0,1}[0-9A-Fa-f]{1,4})?::(?:[0-9A-Fa-f]{1,4}:){3}|(?:(?:[0-9A-Fa-f]{1,4}:){0,2}[0-9A-Fa-f]{1,4})?::(?:[0-9A-Fa-f]{1,4}:){2}|(?:(?:[0-9A-Fa-f]{1,4}:){0,3}[0-9A-Fa-f]{1,4})?::[0-9A-Fa-f]{1,4}:|(?:(?:[0-9A-Fa-f]{1,4}:){0,4}[0-9A-Fa-f]{1,4})?::)(?:[0-9A-Fa-f]{1,4}:[0-9A-Fa-f]{1,4}|(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?))|(?:(?:[0-9A-Fa-f]{1,4}:){0,5}[0-9A-Fa-f]{1,4})?::[0-9A-Fa-f]{1,4}|(?:(?:[0-9A-Fa-f]{1,4}:){0,6}[0-9A-Fa-f]{1,4})?::)|[Vv][0-9A-Fa-f]+\\.[A-Za-z0-9\\-._~!$&\'()*+,;=:]+)\\]|(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)|(?:[A-Za-z0-9\\-._~!$&\'()*+,;=]|%[0-9A-Fa-f]{2})*)(?::[0-9]*)?(?:\\/(?:[A-Za-z0-9\\-._~!$&\'()*+,;=:@]|%[0-9A-Fa-f]{2})*)*|\\/(?:(?:[A-Za-z0-9\\-._~!$&\'()*+,;=:@]|%[0-9A-Fa-f]{2})+(?:\\/(?:[A-Za-z0-9\\-._~!$&\'()*+,;=:@]|%[0-9A-Fa-f]{2})*)*)?|(?:[A-Za-z0-9\\-._~!$&\'()*+,;=:@]|%[0-9A-Fa-f]{2})+(?:\\/(?:[A-Za-z0-9\\-._~!$&\'()*+,;=:@]|%[0-9A-Fa-f]{2})*)*|)(?:\\?(?:[A-Za-z0-9\\-._~!$&\'()*+,;=:@\\/?]|%[0-9A-Fa-f]{2})*)?(?:\\#(?:[A-Za-z0-9\\-._~!$&\'()*+,;=:@\\/?]|%[0-9A-Fa-f]{2})*)?$/.test(${name})`
      break

    case "email":
      check = `!/^[^@]+@[^@]+\\.[^@]+$/.test(${name})`
      break

    case "ipv4":
      check = `!/^(\\d?\\d?\\d){0,255}\\.(\\d?\\d?\\d){0,255}\\.(\\d?\\d?\\d){0,255}\\.(\\d?\\d?\\d){0,255}$/.test(${name}) || ${name}.split(".")[3] > 255`
      break

    case "ipv6":
      check = `!/^((?=.*::)(?!.*::.+::)(::)?([\\dA-F]{1,4}:(:|\\b)|){5}|([\\dA-F]{1,4}:){6})((([\\dA-F]{1,4}((?!\\3)::|:\\b|$))|(?!\\2\\3)){2}|(((2[0-4]|1\\d|[1-9])?\\d|25[0-5])\\.?\\b){4})$/.test(${name})`
      break

    case "regex":
      check = `/[^\\\\]\\\\[^.*+?^\${}()|[\\]\\\\bBcdDfnrsStvwWxu0-9]/i.test(${name})`
      break

    case "json-pointer":
      check = `!/^$|^\\/(?:~(?=[01])|[^~])*$/i.test(${name})`
      break

    default:
      if (!format) {
        return
      }

      throw new Error(`Format "${format}" is not supported`)
  }

  return `if(${check})throw new Error("${safe(path)} should have format ${format}");`
})

extend(Type.number, "minimum", (minimum, name, path) => {
  return `if(${name}<${minimum}) throw new Error("${safe(path)} should be at least ${minimum}");`
})

extend(Type.number, "maximum", (maximum, name, path) => {
  return `if(${name}>${maximum}) throw new Error("${safe(path)} should be at most ${maximum}");`
})

extend(Type.number, "exclusiveMinimum", (exclusiveMinimum, name, path) => {
  return `if(${name}<=${exclusiveMinimum}) throw new Error("${safe(path)} should be above ${exclusiveMinimum}");`
})

extend(Type.number, "exclusiveMaximum", (exclusiveMaximum, name, path) => {
  return `if(${name}>=${exclusiveMaximum}) throw new Error("${safe(path)} should be below ${exclusiveMaximum}");`
})

extend(Type.number, "multipleOf", (multipleOf, name, path) => {
  return `if((${name}/${multipleOf})%1) throw new Error("${safe(path)} should be multiple of ${multipleOf}");`
})

extend(Type.binary, {
  minBytes(minBytes, varName, path, rules, config) {
    config.ctx.length = true
    return `if(l${varName}<${minBytes})throw new Error("${safe(path)} should have at least ${minBytes} byte${plural(minBytes)}");`
  },

  maxBytes(maxBytes, varName, path, rules, config) {
    config.ctx.length = true
    return `if(l${varName}>${maxBytes})throw new Error("${safe(path)} should have at most ${maxBytes} byte${plural(maxBytes)}");`
  }
})

extend(Type.array, {
  minItems(minItems, varName, path, rules, config) {
    config.ctx.length = true
    return `if(l${varName}<${minItems})throw new Error("${safe(path)} should have at least ${minItems} item${plural(minItems)}");`
  },

  maxItems(maxItems, varName, path, rules, config) {
    config.ctx.length = true
    return `if(l${varName}>${maxItems})throw new Error("${safe(path)} should have at most ${maxItems} item${plural(maxItems)}");`
  }
})

extend(Type.array, "uniqueItems", (uniqueItems, varName, path, rules, config) => {
  if (!uniqueItems) {
    return
  }

  config.hookEqual = true
  config.ctx.length = true
  return `for(var i${varName}=0;i${varName}<l${varName};i${varName}++)for(var j${varName}=i${varName}+1;j${varName}<=l${varName};j${varName}++)if(eq(${varName}[i${varName}],${varName}[j${varName}]))return new Error("${safe(path)} items is not unique");`
})

extend(Type.array, "items", (items, name, path, rules, config) => {
  let fn = ""

  if (Array.isArray(items)) {
    if (rules.additionalItems === false) {
      config.ctx.length = true
      fn += `if(l${name}!==${items.length})throw new Error("${safe(path)} should have at most ${items.length} item${plural(items.length)}");`
    }

    for (let i = 0, l = items.length; i < l; i++) {
      if (rules.minItems == null || rules.minItems <= i) {
        config.ctx.length = true
        fn += `if (l${name}>${i}) {`
      }
      const nextVar = config.varName()
      const nextPath = objectKey(name, i)
      fn += `var ${nextVar}=${nextPath};`
      fn += write(nextVar, objectKey(path, i), items[i], config)
      if (config.assignItems) {
        config.assignItems--
        fn += `${nextPath}=${nextVar};`
      }
      if (rules.minItems == null || rules.minItems <= i) {
        fn += `}`
      }
    }

    return fn
  }

  if (typeof items === "object") {
    const nextVar = config.varName()
    config.ctx.length = true
    fn += `for(var i${name}=0,${nextVar};i${name}<l${name};i${name}++){${nextVar}=${name}[i${name}];`
    fn += write(nextVar, `${path}[*]`, rules.items, config)
    if (config.assignItems) {
      config.assignItems--
      fn += `${name}[i${name}]=${nextVar};`
    }
    fn += "}"

    return fn
  }

  throw new Error(`Invalid type "items" at ${safe(path)}`)
})

extend(Type.array, "contains", (contains, name, path, rules, config) => {
  const nextVar = config.varName()
  let fn = `var f${name}=false;`
  fn += `for(var i${name}=0,${nextVar};i${name}<l${name};i++){${nextVar}=${name}[i${name}];try{`
  return fn + write(nextVar, `${path}[*]`, contains, config) + `f${name}=true;break;}catch{}}if(!f${name})throw new Error("${safe(path)} should contain special item");`
})

extend(Type.object, "minProperties", (minProperties, name, path, rules, config) => {
  config.ctx.getProperties = true
  return `if(p${name}.length<${minProperties})throw new Error("${safe(path)} should have at least ${minProperties} propert${plural(minProperties, "ies", "y")}");`
})

extend(Type.object, "maxProperties", (maxProperties, name, path, rules, config) => {
  config.ctx.getProperties = true
  return `if(p${name}.length>${maxProperties})throw new Error("${safe(path)} should have at most ${maxProperties} propert${plural(maxProperties, "ies", "y")}");`
})

extend(Type.object, "required", (required, name, path, rules, config) => {
  const hop = Object.prototype.hasOwnProperty
  let fn = ""

  for (const key of required) {
    if (!rules.properties || !hop.call(rules.properties, key)) {
      fn += `if(${objectKey(name, key)}===undefined)throw new Error("${safe(objectKey(path, key))} required");`
    }
  }
  return fn
})

extend(Type.object, "dependencies", (dependencies, name, path, rules, config) => {
  let fn = ""

  for (const key in dependencies) {
    fn += `if(${objectKey(name, key)} !== undefined){`
    const entry = dependencies[key]
    if (Array.isArray(entry)) {
      for (const dep of dependencies[key]) {
        fn += `if(${objectKey(name, dep)}===undefined) throw new Error("${safe(objectKey(path, dep))} required if ${safe(objectKey(path, key))} presented");`
      }
    } else if (entry && typeof entry === "object") {
      for (const k in entry) {
        const nextVar = config.varName()
        const nextPath = objectKey(name, k)
        fn += `var ${nextVar}=${nextPath};`
        fn += `if(${nextVar}===undefined) throw new Error("${safe(objectKey(path, k))} required if ${safe(objectKey(path, key))} presented");`
        fn += write(nextVar, objectKey(path, k), entry[k], config)
      }
    }

    fn += `}`
  }
  return fn
})

extend(Type.object, "additionalProperties", () => {
  return undefined
})

extend(Type.object, "properties", (properties, name, path, rules, config) => {
  config.ctx.getProperties = true

  let fn = ""

  if (rules.additionalProperties === false) {
    config.ctx.getProperties = true
    fn += `if(p${name}.length>${Object.keys(properties).length})throw new Error("${safe(path)} shouldn't have additional properties");`
  }

  for (const key in properties) {
    let property = properties[key]
    const nextVar = config.varName()
    const nextPath = objectKey(name, key)
    const hasDefault = "default" in property
    fn += `var ${nextVar}=${nextPath};`
    if (hasDefault) {
      const { default: defaultValue, ...tmp } = property
      property = tmp
      fn += `if(${nextVar}===undefined) ${nextVar}=${nextPath}=${JSON.stringify(defaultValue)};`
    }
    const checkRequired = rules.required && rules.required.indexOf(key) >= 0
    if (checkRequired) {
      fn += `if(${nextVar}===undefined) throw new Error("${safe(objectKey(path, key))} required");`
    } else if (!hasDefault) {
      fn += `if(${nextVar}!==undefined){`
    }
    fn += write(nextVar, objectKey(path, key), property, config)
    if (config.assignItems) {
      config.assignItems--
      fn += `${nextPath}=${nextVar};`
    }

    if (!checkRequired && !hasDefault) {
      fn += "}"
    }
  }

  const props = Object.keys(properties).map(prop => `k${name}==="${prop}"`).join("||")

  if (rules.additionalProperties === false) {
    if (props) {
      fn += `for(var k${name} in ${name})if(!(${props}))throw new Error("${safe(path)} shouldn't have additional properties");`
    }
  } else if (rules.additionalProperties && typeof rules.additionalProperties === "object") {
    fn += `for(var k${name} in ${name}){`
    if (props) {
      fn += `if(${props})continue;`
    }

    const nextVar = config.varName()
    const nextPath = `${name}[k${name}]`
    fn += `var ${nextVar}=${nextPath};`
    fn += write(nextVar, `${safe(path)}.*`, rules.additionalProperties, config) + "}"
    if (config.assignItems) {
      config.assignItems--
      fn += `${nextPath}=${nextVar};`
    }
  }

  return fn
})

function contextHooks(varName: string, type: Type, ctx: KeyValue, out: string): string {
  switch (type) {
    case Type.binary:
    case Type.array: {
      if (ctx.length) {
        out = `var l${varName}=${varName}.length;${out}`
      }
      break
    }

    case Type.object: {
      if (ctx.getProperties) {
        out = `var p${varName}=Object.keys(${varName});${out}`
      }
      break
    }
  }
  return out
}

interface CompilerConfig {
  assignItems: number
  passUndefined?: boolean
  hookEqual?: boolean
  hookToString?: boolean
  ctx: KeyValue
  varName(): string
}

export default function compile(schema: KeyValue, opts?: { varName?: string; passUndefined?: boolean }) {
  let i = 0

  if (!opts) {
    opts = { varName: "$" }
  }

  if (!opts.varName) {
    opts.varName = "$"
  }

  const config: CompilerConfig = {
    passUndefined: opts.passUndefined,
    assignItems: 0,
    ctx: {},
    varName: () => `v${i++}`
  }

  let fn = write(opts.varName, opts.varName, schema, config) + `return ${opts.varName};`

  if (config.hookToString) {
    fn = `var toString = Object.prototype.toString;${fn}`
  }

  if (config.hookEqual) {
    fn = eq + fn
  }

  return new Function(opts.varName, `"use strict";\n${fn}`) as (v: any) => any
}

function getTypes(schema: KeyValue): string[] {
  if (schema.type) {
    if (Array.isArray(schema.type)) {
      return schema.type.slice(0).sort(sortTypes)
    }

    return [schema.type]
  }

  const types: string[] = []
  for (const name in schema) {
    if (rules.hasOwnProperty(name)) {
      const { type } = rules[name]

      if (types.indexOf(type) < 0) {
        types.push(type)
      }
    }
  }

  return types.sort(sortTypes)
}

function write(varName: string, path: string, schema: KeyValue, config: CompilerConfig) {
  let next = false
  const types = getTypes(schema)

  if (types.indexOf(Type.number) >= 0) {
    const idx = types.indexOf(Type.integer)

    if (idx >= 0) {
      types.splice(idx, 1)
    }
  }

  let fn = ""

  if ("default" in schema) {
    config.assignItems++
    fn += `if(${varName}===undefined)${varName}=${JSON.stringify(schema["default"])};`
  } else if (config.passUndefined) {
    fn += `if(${varName}===undefined)return ${varName};`
  }

  if ("const" in schema) {
    const value = schema["const"]
    if (value === null || typeof value !== "object") {
      return fn + `if(${varName}!==${JSON.stringify(value)})throw new Error("${safe(path)} should equal ${safe(JSON.stringify(value))}");`
    }

    config.hookEqual = true
    return fn + `if(!eq(${varName},${JSON.stringify(value)}))throw new Error("${safe(path)} should equal ${safe(JSON.stringify(value))}");`
  }

  if (Array.isArray(schema.enum)) {
    const values = JSON.stringify(schema.enum)
    const check = schema.enum.map(value => {
      if (value === null || typeof value !== "object") {
        return `${varName}!==${JSON.stringify(value)}`
      }

      config.hookEqual = true
      return `!eq(${varName},${JSON.stringify(value)})`
    }).join("&&")

    return fn + `if(${check})throw new Error("${safe(path)} should be one of ${safe(values)}");`
  }

  for (let type of types) {
    if (next) {
      fn += "else "
    } else {
      next = true
    }

    if (type === Type.null) {
      fn += `if(${varName}===null){`
    } else if (type === "integer") {
      fn += `if(typeof ${varName}==="${Type.number}"&&!(${varName}%1)){`
    } else if (type === Type.array) {
      fn += `if(Array.isArray(${varName})){`
    } else if (type === Type.object) {
      let check = `typeof ${varName}==="${Type.object}"`
      if (types.indexOf(Type.null) < 0) {
        check = `${varName}&&${check}`
      }
      if (types.indexOf(Type.array) < 0) {
        check += `&&!Array.isArray(${varName})`
      }

      fn += `if(${check}){`
    } else if (type === Type.binary) {
      config.hookToString = true
      fn += `if(toString.call(${varName})==="${binaryType}"){`
    } else {
      fn += `if(typeof ${varName}==="${type}"){`
    }

    if (order.hasOwnProperty(type)) {
      let tmp = ""
      for (const name of order[type]) {
        if (schema.hasOwnProperty(name)) {
          const chunk = rules[name].writer(schema[name], varName, path, schema, config)
          if (chunk) {
            tmp += chunk
          }
        }
      }

      fn += contextHooks(varName, type as Type, config.ctx, tmp)
    }

    fn += `}`
  }

  if (schema.type) {
    fn += `else throw new Error("${safe(path)} should be ${types.join(" or ")}");`
  }

  if (schema.anyOf) {
    const vOneOf = config.varName()
    const vOneOfErrors = config.varName()
    fn += `let ${vOneOf}=false,${vOneOfErrors}=[];`

    for (const s of schema.anyOf) {
      fn += `if(!${vOneOf}){try{`
      fn += write(varName, path, s, config)
      fn += `${vOneOf}=true}catch(e){${vOneOfErrors}.push(e.message)}}`
    }

    fn += `if(!${vOneOf})throw new Error(${vOneOfErrors}.join(" or "));`
  }

  if (schema.not) {
    const vNot = config.varName()
    fn += `let ${vNot}=true;try{${write(varName, path, schema.not, config)}}catch(e){${vNot}=false;}`
    fn += `if(${vNot})throw new Error("${safe(path)} should not passed ${safe(JSON.stringify(schema.not))}");`
  }

  return fn
}

export { extend }