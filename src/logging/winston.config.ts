import * as winston from 'winston';
import 'winston-daily-rotate-file';

const LOGS_DIR = process.env.LOGS_DIR || 'logs';

const timestampFormat = winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' });

const lineFormat = winston.format.printf(({ timestamp, level, context, message, ...meta }) => {
  const ctx = context ? ` [${context}]` : '';
  const extra = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
  return `${timestamp} ${level.toUpperCase().padEnd(5)}${ctx} ${message}${extra}`;
});

function makeRotateTransport(opts: {
  filename: string;
  level: string;
  maxSize: string;
  maxFiles: string;
}): winston.transport {
  return new winston.transports.DailyRotateFile({
    dirname: LOGS_DIR,
    filename: `${opts.filename}-%DATE%`,
    extension: '.log',
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    maxSize: opts.maxSize,
    maxFiles: opts.maxFiles,
    level: opts.level,
    format: winston.format.combine(timestampFormat, lineFormat),
  });
}

/**
 * Config for NestJS application logger (app-process + app-error).
 * Passed to WinstonModule.createLogger() in main.ts.
 */
export const appWinstonConfig: winston.LoggerOptions = {
  level: 'debug',
  transports: [
    // All LOG/DEBUG → app-process.log (rotated by size 50 MB, kept 7 days)
    makeRotateTransport({ filename: 'app-process', level: 'debug', maxSize: '50m', maxFiles: '7d' }),
    // WARN/ERROR only → app-error.log (kept 14 days)
    makeRotateTransport({ filename: 'app-error', level: 'warn', maxSize: '20m', maxFiles: '14d' }),
    // Console output in development
    ...(process.env.NODE_ENV !== 'production'
      ? [new winston.transports.Console({ format: winston.format.combine(timestampFormat, lineFormat) })]
      : []),
  ],
};

/**
 * Dedicated logger for HTTP access/error used by HttpAccessMiddleware.
 */
export const apiLogger = winston.createLogger({
  level: 'info',
  transports: [
    // All HTTP requests → api-access.log (kept 7 days / 20 MB)
    makeRotateTransport({ filename: 'api-access', level: 'info', maxSize: '20m', maxFiles: '7d' }),
    // HTTP ≥ 400 → api-error.log (kept 14 days)
    makeRotateTransport({ filename: 'api-error', level: 'warn', maxSize: '20m', maxFiles: '14d' }),
  ],
});
