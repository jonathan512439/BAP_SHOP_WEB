import type { Env as WorkerEnv } from '../types/env'

declare global {
  namespace Cloudflare {
    interface Env extends WorkerEnv {}
  }
}

declare module 'cloudflare:test' {
  interface ProvidedEnv extends WorkerEnv {}
}

export {}
