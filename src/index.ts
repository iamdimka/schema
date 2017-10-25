export type Signal = "SIGINT" | "SIGTERM" | "SIGUSR1" | "SIGUSR2"

export class Microservice {
  isGoingDown = false

  protected _env = { ...process.env }
  protected _promises = new Set<Promise<any>>()
  protected _shutdownCallbacks = [] as Function[]

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

  extendEnv(data: string | { path: string, env?: string }) {
    if (typeof data === "string") {
      data = {
        path: data
      }
    }

    const payload = require(data.path)
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
  }

  env(name: string, defaultValue?: string) {
    if (this._env.hasOwnProperty(name)) {
      return this._env[name]
    }

    if (arguments.length === 1) {
      throw new Error(`Environment variable "${name}" is required`)
    }

    return defaultValue
  }

  promise(cbOrPromise: Function | Promise<any>) {
    while (typeof cbOrPromise === "function") {
      cbOrPromise = cbOrPromise()
    }

    if (cbOrPromise instanceof Promise) {
      this._promises.add(cbOrPromise as Promise<any>)
      cbOrPromise.catch(() => null).then(() => this._promises.delete(cbOrPromise as Promise<any>))
    }
  }

  handleSignals(...signals: Signal[]) {
    for (const signal of signals) {
      process.on(signal, () => this.shutdown(signal))
    }
  }

  async shutdown(reason?: Signal | Error) {
    if (this.isGoingDown) {
      return
    }

    this.isGoingDown = true

    if (typeof reason === "string") {
      console.info(`Going down: Got signal ${reason}`)
    } else if (reason && reason instanceof Error) {
      console.error(`Going down: Unhandled error ${reason.message}`)
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