const isDev = import.meta.env.DEV

type LogMethod = (...args: unknown[]) => void

function devOnly(method: LogMethod): LogMethod {
  return (...args: unknown[]) => {
    if (isDev) method(...args)
  }
}

export const logger = {
  debug: devOnly((...args) => console.debug(...args)),
  info: devOnly((...args) => console.info(...args)),
  log: devOnly((...args) => console.log(...args)),
  warn: devOnly((...args) => console.warn(...args)),
  error: (...args: unknown[]) => console.error(...args),
}
