type LogLevel = 'info' | 'warn' | 'error'

type LogDetails = Record<string, unknown>

const SENSITIVE_KEY_PATTERN = /(password|token|secret|cookie|authorization|csrf|pepper)/i

function sanitize(value: unknown): unknown {
  if (value instanceof Error) {
    return serializeError(value)
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitize(item))
  }

  if (!value || typeof value !== 'object') {
    return value
  }

  const sanitized: LogDetails = {}
  for (const [key, nestedValue] of Object.entries(value)) {
    sanitized[key] = SENSITIVE_KEY_PATTERN.test(key) ? '[redacted]' : sanitize(nestedValue)
  }
  return sanitized
}

function writeLog(level: LogLevel, event: string, details: LogDetails): void {
  const safeDetails = sanitize(details) as LogDetails
  const payload = {
    level,
    event,
    timestamp: new Date().toISOString(),
    ...safeDetails,
  }

  const message = JSON.stringify(payload)
  if (level === 'error') {
    console.error(message)
    return
  }

  if (level === 'warn') {
    console.warn(message)
    return
  }

  console.log(message)
}

export function logInfo(event: string, details: LogDetails = {}): void {
  writeLog('info', event, details)
}

export function logWarn(event: string, details: LogDetails = {}): void {
  writeLog('warn', event, details)
}

export function logError(event: string, details: LogDetails = {}): void {
  writeLog('error', event, details)
}

export function serializeError(error: unknown, includeStack = false): LogDetails {
  if (!(error instanceof Error)) {
    return {
      name: 'UnknownError',
      message: String(error),
    }
  }

  return {
    name: error.name || 'Error',
    message: error.message,
    ...(includeStack && error.stack ? { stack: error.stack } : {}),
  }
}
