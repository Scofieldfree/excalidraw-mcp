// 日志工具
type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface Logger {
  debug(message: string, ...args: unknown[]): void
  info(message: string, ...args: unknown[]): void
  warn(message: string, ...args: unknown[]): void
  error(message: string, ...args: unknown[]): void
}

function createLogger(prefix: string): Logger {
  const log = (level: LogLevel, message: string, ...args: unknown[]) => {
    const timestamp = new Date().toISOString()
    console.error(`[${timestamp}] [${level.toUpperCase()}] ${prefix}: ${message}`, ...args)
  }

  return {
    debug: (message: string, ...args: unknown[]) => log('debug', message, ...args),
    info: (message: string, ...args: unknown[]) => log('info', message, ...args),
    warn: (message: string, ...args: unknown[]) => log('warn', message, ...args),
    error: (message: string, ...args: unknown[]) => log('error', message, ...args),
  }
}

export const log = createLogger('Excalidraw MCP')
