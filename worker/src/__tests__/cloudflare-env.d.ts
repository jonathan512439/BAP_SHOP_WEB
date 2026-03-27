import type { Env } from '../types/env'

declare module 'cloudflare:test' {
  interface ProvidedEnv extends Env {}
}
