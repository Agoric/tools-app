class Logger {
  error = (...params: any[]) => {
    console.error(...params);
  };
  info = (...params: any[]) => {
    console.info(...params);
  };
  log = (...params: any[]) => {
    console.log(...params);
  };
  warn = (...params: any[]) => {
    console.warn(...params);
  };
}

export const client = new Logger();
