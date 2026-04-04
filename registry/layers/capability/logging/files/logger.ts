import { randomUUID } from 'node:crypto'

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogEntry {
  level: LogLevel
  message: string
  timestamp: string
  service: string
  requestId?: string
  duration?: number
  meta?: Record<string, unknown>
}

interface Logger {
  debug(message: string, meta?: Record<string, unknown>): void
  info(message: string, meta?: Record<string, unknown>): void
  warn(message: string, meta?: Record<string, unknown>): void
  error(message: string, meta?: Record<string, unknown>): void
  withRequestId(id: string): Logger
}

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

const isProduction = () => process.env.NODE_ENV === 'production'

function formatEntry(entry: LogEntry): string {
  if (isProduction()) {
    return JSON.stringify(entry)
  }
  const prefix = entry.requestId ? ` [${entry.requestId}]` : ''
  const dur = entry.duration !== undefined ? ` ${entry.duration}ms` : ''
  const meta = entry.meta ? ` ${JSON.stringify(entry.meta)}` : ''
  return `${entry.timestamp} ${entry.level.toUpperCase().padEnd(5)} [${entry.service}]${prefix} ${entry.message}${dur}${meta}`
}

function makeLogger(service: string, requestId?: string): Logger {
  const minLevel = isProduction() ? 'info' : 'debug'

  const log = (level: LogLevel, message: string, meta?: Record<string, unknown>) => {
    if (LEVEL_PRIORITY[level] < LEVEL_PRIORITY[minLevel]) return
    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      service,
      ...(requestId && { requestId }),
      ...(meta?.duration !== undefined && { duration: meta.duration as number }),
      ...(meta && { meta }),
    }
    const output = formatEntry(entry)
    if (level === 'error') process.stderr.write(output + '\n')
    else process.stdout.write(output + '\n')
  }

  return {
    debug: (msg, meta) => log('debug', msg, meta),
    info: (msg, meta) => log('info', msg, meta),
    warn: (msg, meta) => log('warn', msg, meta),
    error: (msg, meta) => log('error', msg, meta),
    withRequestId: (id: string) => makeLogger(service, id),
  }
}

export function createLogger(service: string): Logger {
  return makeLogger(service)
}

export function generateRequestId(): string {
  return randomUUID()
}

export type { Logger, LogEntry, LogLevel }
