export type KeyValue<V = any> = { [key: string]: V }
export type Rules<T> = {
  default?: () => T
}

export class ValidatorError extends Error {
  data: {
    field: string
    validator: string
    arg: any
  }

  constructor(message: string, field: string, validator: string, arg: any) {
    super(message)

    this.data = {
      field,
      validator,
      arg
    }
  }
}

function isEqual(a: any, b: any): boolean {
  const typeOfA = typeof a

  if (typeOfA !== "object") {
    return a === b
  }

  if (typeof b !== typeOfA) {
    return false
  }

  const isArrayB = b instanceof Array

  if (a instanceof Array) {
    if (!isArrayB) {
      return false
    }

    if (a.length !== b.length) {
      return false
    }

    return a.every((item, i) => isEqual(item, b[i]))
  }

  if (isArrayB) {
    return false
  }

  for (const key in a) {
    if (a.hasOwnProperty(key)) {
      if (a[key] !== b[key]) {
        return false
      }
    }
  }

  for (const key in b) {
    if (b.hasOwnProperty(key)) {
      if (!a.hasOwnProperty(key)) {
        return false
      }
    }
  }

  return true
}


export abstract class Validator<T> {
  readonly type?: string
  readonly rules: KeyValue = {}

  protected abstract _validate(item: T, name: string, rules: KeyValue): T
  abstract example(): T

  protected _with(rule: string, value: any): this {
    const validator = Object.create(this)

    validator.rules = {
      ...this.rules,
      [rule]: value
    }

    return validator
  }

  optional(): Validator<T | void> {
    return this._with("default", () => undefined)
  }

  default(value?: T | (() => T)): this {
    let result

    switch (type(value)) {
      case "function":
        result = value
        break

      case "array":
      case "object":
        result = () => clone(value)
        break

      default:
        result = () => value
        break
    }

    return this._with("default", result)
  }

  validate(item: any, name: string): T {
    const type = typeof item

    if (type === "undefined" && this.rules.hasOwnProperty("default")) {
      return this.rules.default()
    }

    if (this.type && type !== this.type && (this.type !== "array" || type !== "object" || !(item instanceof Array))) {
      throw new ValidatorError(`"${name}" should have type ${this.type}, got ${type}`, name, "type", this.type)
    }

    return this._validate(item, name, this.rules)
  }
}

export class BooleanValidator extends Validator<boolean> {
  readonly type = "boolean"

  protected _validate(item: boolean, name: string): boolean {
    return item
  }

  example(): boolean {
    return Math.random() < 0.5
  }
}

export class StringValidator extends Validator<string> {
  readonly type = "string"

  toLower(toLower: boolean = true): this {
    return this._with("toLower", toLower)
  }

  trim(trim: boolean = true): this {
    return this._with("trim", trim)
  }

  length(length: number): this {
    return this._with("length", length)
  }

  min(min: number): this {
    return this._with("min", min)
  }

  max(max: number): this {
    return this._with("max", max)
  }

  match(match: RegExp): this {
    return this._with("match", match)
  }

  protected _generateAz09() {
    const code = Math.floor(Math.random() * 62)

    if (code < 10) {
      return String.fromCharCode(code + 48)
    }

    if (code < 36) {
      return String.fromCharCode(code + 55)
    }

    return String.fromCharCode(code + 61)
  }

  example(): string {
    let min = this.rules.min || 0
    let max = this.rules.max || 50

    if (this.rules.length) {
      min = max = this.rules.length
    }

    let example = ""

    for (let i = 0, l = min + Math.random() * (max - min); i < l; i++) {
      example += this._generateAz09()
    }

    return this.rules.toLower ? example.toLowerCase() : example
  }

  protected _validate(item: string, name: string, { trim, toLower, length, min, max, match }: KeyValue): string {
    if (trim) {
      item = item.trim()
    }

    if (toLower) {
      item = item.toLocaleLowerCase()
    }

    if (length !== undefined && item.length !== length) {
      throw new ValidatorError(`"${name}" length should be ${length}`, name, "length", length)
    }

    if (min !== undefined && item.length < min) {
      throw new ValidatorError(`"${name}" length should be at least ${min}`, name, "min", min)
    }

    if (max !== undefined && item.length > max) {
      throw new ValidatorError(`"${name}" length should be at most ${max}`, name, "max", max)
    }

    if (match && !match.test(item)) {
      throw new ValidatorError(`"${name}" should match ${match}`, name, "match", match)
    }

    return item
  }
}


export class NumberValidator extends Validator<number> {
  readonly type = "number"

  min(min: number) {
    return this._with("min", min)
  }

  max(max: number) {
    return this._with("max", max)
  }

  above(above: number) {
    return this._with("above", above)
  }

  below(below: number) {
    return this._with("below", below)
  }

  step(step: number) {
    return this._with("step", step)
  }

  example() {
    const min = this.rules.min || this.rules.above || 0
    const max = this.rules.max || this.rules.below || 0
    let value = min + Math.random() * (max - min)
    return this.rules.step ? Math.floor(value / this.rules.step) * this.rules.step : value
  }

  protected _validate(item: number, name: string, { min, max, above, below, step }: KeyValue): number {
    if (min !== undefined && item < min) {
      throw new ValidatorError(`"${name}" should be at least ${min}`, name, "min", min)
    }

    if (max !== undefined && item > max) {
      throw new ValidatorError(`"${name}" should be at most ${max}`, name, "max", max)
    }

    if (above !== undefined && item <= above) {
      throw new ValidatorError(`"${name}" should be above ${above}`, name, "above", above)
    }

    if (below !== undefined && item >= below) {
      throw new ValidatorError(`"${name}" should be below ${below}`, name, "below", below)
    }

    if (step !== undefined && (item / step) % 1) {
      throw new ValidatorError(`"${name}" should be step ${step}`, name, "step", step)
    }

    return item
  }
}

export class ObjectValidator<T extends KeyValue = {}> extends Validator<T> {
  readonly type = "object"

  schema<S>(schema: { [K in keyof S]: Validator<S[K]> }): ObjectValidator<S> {
    return this._with("schema", schema) as any
  }

  other<O>(other?: Validator<O>): ObjectValidator<{ [key: string]: O } & T> {
    if (!other) {
      return this._with("other", true)
    }

    return this._with("other", other)
  }

  protected _validate(item: T, name: string, rules: KeyValue): T {
    const result = {} as T

    if (rules.schema) {
      for (const key in rules.schema) {
        if (rules.schema.hasOwnProperty(key)) {
          const value = rules.schema[key].validate(item[key], `${name}.${key}`)
          if (value !== undefined) {
            result[key] = value
          }
        }
      }
    }

    if (rules.other) {
      for (const key in item) {
        if (item.hasOwnProperty(key) && !rules.schema.hasOwnProperty(key)) {
          if (rules.other === true) {
            result[key] = item[key]
          } else {
            const value = rules.other.validate(item[key], `${name}.${key}`)
            
            if (value !== undefined) {
              result[key] = value
            }
          }
        }
      }
    } else {
      for (const key in item) {
        if (item.hasOwnProperty(key) && !rules.schema.hasOwnProperty(key)) {
          throw new ValidatorError(`"${name}" has key ${key} which is not expected`, name, "other", null)
        }
      }
    }

    return result
  }

  example() {
    const example = {} as T
    if (this.rules.schema) {
      for (const key in this.rules.schema) {
        if (this.rules.schema.hasOwnProperty(key)) {
          example[key] = this.rules.schema[key].example()
        }
      }
    }

    return example
  }
}


export class BinaryValidator extends Validator<Buffer> {
  readonly type = "object"

  length(length: number): this {
    return this._with("length", length)
  }

  min(min: number): this {
    return this._with("min", min)
  }

  max(max: number): this {
    return this._with("max", max)
  }

  example(): Buffer {
    if (this.rules.length !== undefined) {
      return Buffer.allocUnsafe(this.rules.length)
    }

    const min = this.rules.min || 0
    const max = this.rules.max || 64
    return Buffer.allocUnsafe(min + Math.floor(Math.random() * (max - min)))
  }

  protected _validate(item: Buffer, name: string, { length, min, max }: KeyValue): Buffer {
    if (!(item instanceof Buffer)) {
      throw new ValidatorError(`"${name}" should be instance of Buffer`, name, "type", "buffer")
    }

    if (length !== undefined && item.length !== length) {
      throw new ValidatorError(`"${name}" length should equal ${length}`, name, "length", length)
    }

    if (min !== undefined && item.length < min) {
      throw new ValidatorError(`"${name}" length should be at least ${min}`, name, "min", min)
    }

    if (max !== undefined && item.length > max) {
      throw new ValidatorError(`"${name}" length should be at most ${max}`, name, "max", max)
    }

    return item
  }
}


export class ArrayValidator<T = any> extends Validator<T[]> {
  readonly type = "array"

  of<V>(of: Validator<V>): ArrayValidator<V> {
    return this._with("of", of) as any
  }

  length(length: number): this {
    return this._with("length", length)
  }

  min(min: number): this {
    return this._with("min", min)
  }

  max(max: number): this {
    return this._with("max", max)
  }

  example() {
    let min = this.rules.min || 0
    let max = this.rules.max || 8

    if (this.rules.length !== undefined) {
      min = max = this.rules.lenght
    }

    const result: T[] = []
    for (let i = 0, l = Math.floor(min + Math.random() * (max - min)); i < l; i++) {
      if (this.rules.of === undefined) {
        result.push((Math.random() < 0.5) as any)
      } else {
        result.push(this.rules.of.example())
      }
    }
    return result
  }

  protected _validate(item: T[], name: string, { length, min, max, of }: KeyValue): T[] {
    if (length !== undefined && item.length !== length) {
      throw new ValidatorError(`"${name}" length should be ${length}`, name, "length", length)
    }

    if (min !== undefined && item.length < min) {
      throw new ValidatorError(`"${name}" length should be at least ${min}`, name, "min", min)
    }

    if (max !== undefined && item.length > max) {
      throw new ValidatorError(`"${name}" length should be at most ${max}`, name, "max", max)
    }

    if (of) {
      for (let i = 0, l = item.length; i < l; i++) {
        item[i] = of.validate(item[i], `${name}[${i}]`)
      }
    }

    return item
  }
}

export class EqualValidator<T> extends Validator<T> {
  protected _equal(a: any, b: any, name: string) {
    let t1 = type(a)
    let t2 = type(b)

    if (t1 !== t2) {
      throw new Error(`"${name}" should have type ${t2}, got ${t1}`)
    }

    if (t1 === "object") {
      for (const key in a) {
        if (a.hasOwnProperty(key) && !b.hasOwnProperty(key)) {
          throw new Error(`"${name}.${key}" is not expected`)
        }
      }

      for (const key in b) {
        if (b.hasOwnProperty(key)) {
          this._equal(a[key], b[key], `${name}.${key}`)
        }
      }
      return true
    }

    if (t1 === "array") {
      const l = a.length

      if (l !== b.length) {
        throw new Error(`"${name}" length should be ${b.length}`)
      }

      for (let i = 0; i < l; i++) {
        this._equal(a[i], b[i], `${name}[${i}]`)
      }

      return true
    }

    if (a !== b) {
      throw new Error(`"${name}" should equal ${b}`)
    }

    return true
  }

  example(): T {
    return this.rules.equal
  }

  protected _validate(item: T, name: string, rules: KeyValue): T {
    this._equal(item, rules.equal, name)
    return item
  }

  constructor(value: T) {
    super()
    this.rules.equal = value
  }
}

export class AnyValidator<T = any> extends Validator<T> {
  oneOf(...values: T[]) {
    this.rules.oneOf = values
    return this
  }

  maybe<V>(...maybe: Array<Validator<V> | V>): AnyValidator<V> {
    return this._with("maybe", maybe.map(item => {
      if (item instanceof Validator) {
        return item
      }

      return equal(item)
    })) as any
  }

  example(): T {
    if (this.rules.oneOf) {
      return this.rules.oneOf[Math.floor(Math.random() * this.rules.oneOf.lenght)]
    }

    if (this.rules.maybe && this.rules.maybe.lenght) {
      return this.rules.maybe[Math.floor(Math.random() * this.rules.maybe.lenght)].example()
    }

    return null as any
  }

  protected _validate(item: T, name: string, rules: this["rules"]): T {
    if (rules.maybe && rules.maybe.length > 0) {
      const errors = []

      for (const check of rules.maybe) {
        try {
          return check.validate(item, name)
        } catch (e) {
          errors.push(e.message)
        }
      }

      throw new Error(errors.join(" or "))
    }

    if (rules.oneOf) {
      const found = this.rules.oneOf.some((example: any) => isEqual(example, item))

      if (!found) {
        throw new Error(`"${name}" has unexpected value`)
      }
    }

    return item
  }
}

export function binary(): BinaryValidator {
  return new BinaryValidator()
}

export function boolean(): BooleanValidator {
  return new BooleanValidator()
}

export function number(): NumberValidator {
  return new NumberValidator()
}

export function string(): StringValidator {
  return new StringValidator()
}

export function object<T>(schema?: { [K in keyof T]: Validator<T[K]> }): ObjectValidator<T> {
  const v = new ObjectValidator<T>()
  return schema ? v.schema(schema) : v
}

export function array<T>(of?: Validator<T>): ArrayValidator<T> {
  const v = new ArrayValidator<T>()
  return of ? v.of(of) : v
}

export function any<T>(...maybe: Validator<any>[]): AnyValidator<T> {
  const v = new AnyValidator<T>()
  return v.maybe(...maybe)
}

export function equal<T>(item: T): EqualValidator<T> {
  return new EqualValidator<T>(item)
}

function type(item: any): "null" | "undefined" | "boolean" | "number" | "string" | "object" | "array" | "symbol" | "function" {
  const type = typeof item

  if (type !== "object") {
    return type
  }

  if (item === null) {
    return "null"
  }

  return item instanceof Array ? "array" : item
}

function clone<T>(item: T): T {
  if (!item || typeof item !== "object") {
    return item
  }

  if (item instanceof Array) {
    return item.map(clone) as any
  }

  const obj = {} as T

  for (const key in item) {
    if (item.hasOwnProperty(key)) {
      obj[key] = item[key]
    }
  }

  return obj
}

function oneOf<T>(...values: T[]) {
  const v = new AnyValidator<T>()
  return v.oneOf(...values)
}

export interface ValidateBuilder {
  boolean(): BooleanValidator
  binary(): BinaryValidator
  number(): NumberValidator
  string(): StringValidator
  object<T>(schema?: { [K in keyof T]: Validator<T[K]> }): ObjectValidator<T>
  array<T>(of?: Validator<T>): ArrayValidator<T>
  equal<T>(item: T): EqualValidator<T>
  any<T>(...maybe: Validator<T>[]): AnyValidator<T>
  oneOf<T>(...values: T[]): AnyValidator<T>
}

export default {
  boolean,
  binary,
  number,
  string,
  object,
  array,
  equal,
  oneOf,
  any
} as ValidateBuilder
