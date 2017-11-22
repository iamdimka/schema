import { readFileSync } from "fs"
import { resolve } from "path"
export type Signal = "SIGINT" | "SIGTERM" | "SIGUSR1" | "SIGUSR2"

export class Microservice {
  isGoingDown = false

  private static _instance?: Microservice

  protected _cwd = process.cwd()
  protected _env = { ...process.env }
  protected _promises = new Set<Promise<any>>()
  protected _shutdownCallbacks = [] as Function[]

  static instance(): Microservice {
    if (!this._instance) {
      this._instance = new Microservice()
    }

    return this._instance
  }

  setWorkingDirectory(path: string): this {
    this._cwd = path
    return this
  }

  relative(...path: string[]): string {
    return resolve(this._cwd, ...path)
  }

  run(cb: (m?: Microservice) => void | Promise<void>): this {
    try {
      const result = cb(this)

      if (result && result instanceof Promise) {
        result.catch(e => this.shutdown(e))
      }
    } catch (e) {
      this.shutdown(e)
    }

    return this
  }

  extendEnv(data: string | { path: string, env?: string, overwrite?: true }): this {
    if (typeof data === "string") {
      data = {
        path: data
      }
    }

    const file = readFileSync(this.relative(data.path), "utf8")

    if (/\.json?/i.test(data.path)) {
      const payload = JSON.parse(file)

      let override
      for (const key in payload) {
        if (payload.hasOwnProperty(key)) {
          if (typeof payload[key] !== "object") {
            this._env[key] = payload[key]
          } else if (key === data.env) {
            override = payload[key]
          }
        }
      }

      if (override) {
        Object.assign(this._env, override)
      }
    } else {
      const rx = /^\s*(.+?)\s*=\s*(.+?)\s*$/gm
      let m
      while (m = rx.exec(file)) {
        this._env[m[1]] = m[2]
      }
    }

    if (data.overwrite) {
      Object.assign(process.env, this._env)
    }

    return this
  }

  env(name: string, defaultValue?: string): string {
    if (this._env.hasOwnProperty(name)) {
      return this._env[name] as string
    }

    if (process.env.hasOwnProperty(name)) {
      return process.env[name] as string
    }

    if (arguments.length === 1) {
      throw new Error(`Environment variable "${name}" is required`)
    }

    return defaultValue as string
  }

  promise(cbOrPromise: Function | Promise<any>): this {
    while (typeof cbOrPromise === "function") {
      cbOrPromise = cbOrPromise()
    }

    if (cbOrPromise instanceof Promise) {
      this._promises.add(cbOrPromise as Promise<any>)
      cbOrPromise.catch(() => null).then(() => this._promises.delete(cbOrPromise as Promise<any>))
    }

    return this
  }

  handleSignals(...signals: Signal[]): this {
    for (const signal of signals) {
      process.on(signal, () => this.shutdown(signal))
    }

    return this
  }

  async shutdown(reason?: Signal | Error) {
    if (this.isGoingDown) {
      return
    }

    this.isGoingDown = true

    if (typeof reason === "string") {
      console.info(`Going down: Got signal ${reason}`)
    } else if (reason && reason instanceof Error) {
      console.error(`Going down: Unhandled error ${reason.stack}`)
    }

    let code = 0

    this._shutdownCallbacks.push(() => Promise.all(Array.from(this._promises)))

    while (this._shutdownCallbacks.length) {
      try {
        const item = this._shutdownCallbacks.pop() as Function
        await item()
      } catch (e) {
        code = 1
        console.error(e)
      }
    }

    process.exit(code)
  }

  registerShutdownCallback(fn: Function): this {
    this._shutdownCallbacks.push(fn)
    return this
  }
}

export function microservice(fn: (m?: Microservice) => void | Promise<void>): Microservice {
  const m = new Microservice()
  m.run(fn)
  return m
}