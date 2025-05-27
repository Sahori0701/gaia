const winston = require("winston")
const DailyRotateFile = require("winston-daily-rotate-file")
const path = require("path")

// Crear directorio de logs si no existe
const fs = require("fs")
const logDir = path.join(__dirname, "../logs")
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true })
}

// Configuración de formato personalizado
const customFormat = winston.format.combine(
  winston.format.timestamp({
    format: "YYYY-MM-DD HH:mm:ss",
  }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    return JSON.stringify({
      timestamp,
      level,
      message,
      ...meta,
      timezone: "America/Bogota",
    })
  }),
)

// Configuración de rotación diaria para auditoría (7 años según normativa)
const auditTransport = new DailyRotateFile({
  filename: path.join(logDir, "audit-%DATE%.log"),
  datePattern: "YYYY-MM-DD",
  maxSize: "20m",
  maxFiles: "2555d", // 7 años según normativas colombianas
  level: "info",
})

const errorTransport = new DailyRotateFile({
  filename: path.join(logDir, "error-%DATE%.log"),
  datePattern: "YYYY-MM-DD",
  maxSize: "20m",
  maxFiles: "2555d",
  level: "error",
})

// Crear logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: customFormat,
  defaultMeta: {
    service: "gaia-backend",
    version: "1.0.0",
    country: "Colombia",
  },
  transports: [
    auditTransport,
    errorTransport,
    // Console transport para desarrollo
    new winston.transports.Console({
      format: winston.format.combine(winston.format.colorize(), winston.format.simple()),
    }),
  ],
})

// Función para logs de auditoría específicos
const auditLog = (action, details, userId = null, ip = null) => {
  logger.info("AUDIT_LOG", {
    action,
    details,
    userId,
    ip,
    timestamp: new Date().toISOString(),
    compliance: "Resolución_3374_2000",
  })
}

module.exports = {
  logger,
  auditLog,
}
