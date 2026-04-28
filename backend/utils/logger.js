const winston = require('winston');
const path = require('path');
const fs = require('fs');

const logsDir = path.join(__dirname, 'logs');

if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, stack, ...metadata }) => {
    let log = `${timestamp} | ${level.toUpperCase().padEnd(7)} | ${message}`;
    
    if (Object.keys(metadata).length > 0) {
      log += ` | ${JSON.stringify(metadata)}`;
    }
    
    if (stack) {
      log += `\n${stack}`;
    }
    
    return log;
  })
);

const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...metadata }) => {
    let log = `${timestamp} | ${level} | ${message}`;
    
    if (Object.keys(metadata).length > 0) {
      log += ` | ${JSON.stringify(metadata)}`;
    }
    
    return log;
  })
);

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  transports: [
    new winston.transports.File({ 
      filename: path.join(logsDir, 'error.log'), 
      level: 'error',
      maxsize: 5 * 1024 * 1024,
      maxFiles: 5
    }),
    new winston.transports.File({ 
      filename: path.join(logsDir, 'combined.log'),
      maxsize: 5 * 1024 * 1024,
      maxFiles: 5
    }),
    new winston.transports.Console({
      format: consoleFormat
    })
  ],
  exceptionHandlers: [
    new winston.transports.File({ 
      filename: path.join(logsDir, 'exceptions.log'),
      maxsize: 5 * 1024 * 1024,
      maxFiles: 5
    }),
    new winston.transports.Console({
      format: consoleFormat
    })
  ],
  rejectionHandlers: [
    new winston.transports.File({ 
      filename: path.join(logsDir, 'rejections.log'),
      maxsize: 5 * 1024 * 1024,
      maxFiles: 5
    }),
    new winston.transports.Console({
      format: consoleFormat
    })
  ]
});

const apiLogger = winston.createLogger({
  level: 'info',
  format: logFormat,
  transports: [
    new winston.transports.File({ 
      filename: path.join(logsDir, 'api.log'),
      maxsize: 10 * 1024 * 1024,
      maxFiles: 10
    }),
    new winston.transports.Console({
      format: consoleFormat
    })
  ]
});

const dbLogger = winston.createLogger({
  level: 'debug',
  format: logFormat,
  transports: [
    new winston.transports.File({ 
      filename: path.join(logsDir, 'database.log'),
      maxsize: 5 * 1024 * 1024,
      maxFiles: 5
    })
  ]
});

const importLogger = winston.createLogger({
  level: 'info',
  format: logFormat,
  transports: [
    new winston.transports.File({ 
      filename: path.join(logsDir, 'import.log'),
      maxsize: 5 * 1024 * 1024,
      maxFiles: 3
    }),
    new winston.transports.Console({
      format: consoleFormat
    })
  ]
});

module.exports = {
  logger,
  apiLogger,
  dbLogger,
  importLogger
};