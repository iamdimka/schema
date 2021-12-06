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

export type Dependencies<T extends string> = string extends T ? { [key: string]: string[] | { [key: string]: any } } : {
  [P in T]?: Exclude<T, P>[] | {
    [K in Exclude<T, P>]?: KeyValue
  }
}

const checkOrder: string[] = [Type.null, Type.array, Type.binary, Type.object, Type.number, Type.integer, Type.function, Type.boolean, Type.string]
export function sortTypes(typeA: string, typeB: string) {
  const a = checkOrder.indexOf(typeA)
  const b = checkOrder.indexOf(typeB)
  if (a === -1 && b === -1) {
    return typeA.localeCompare(typeB)
  }

  if (b === -1) {
    return -1
  }

  if (a === -1) {
    return 1
  }

  return a - b
}

if (!Array.isArray) {
  Array.isArray = (arg: any): arg is any[] => Object.prototype.toString.call(arg) === '[object Array]'
}

export interface KeyValue<V = any> {
  [key: string]: V
};

export type Result<T> = T extends (...args: any[]) => infer U ? U : any

export function plural(value: number, plural = "s", one = ""): string {
  return value === 1 ? one : plural
}

export function safe(path: string): string {
  return path.replace(/(")/g, "\\$1")
}

export function objectKey(name: string, key: string | number): string {
  if (typeof key === "number") {
    return `${name}[${key}]`
  }

  return /^[a-z$_][a-z0-9_$]*$/i.test(key) ? `${name}.${key}` : `${name}[${JSON.stringify(key)}]`
}

export function json(value: any): any {
  if (!value || typeof value !== "object") {
    return value
  }

  if (Array.isArray(value)) {
    return value.map(json)
  }

  if (typeof value.toJSON === "function") {
    const next = value.toJSON()
    if (next !== value) {
      return json(next)
    }
  }

  const obj: any = {}
  for (const key in value) {
    obj[key] = json(value[key])
  }
  return obj
}

export function extractDefinitions(from: Record<string, any>, definitions: Record<string, any>) {
  if (!from || typeof from !== "object") {
    return from
  }

  const { $id, ...src } = from

  for (const key in src) {
    src[key] = extractDefinitions(src[key], definitions)
  }

  if ($id) {
    definitions[$id] = {
      $id: `#/definitions/${$id}`,
      ...src
    }

    return { $ref: `#/definitions/${$id}` }
  }

  return src
}