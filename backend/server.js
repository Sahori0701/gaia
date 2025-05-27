const express = require("express")
const cors = require("cors")
const helmet = require("helmet")
const morgan = require("morgan")
const rateLimit = require("express-rate-limit")
const compression = require("compression")
require("dotenv").config()

// Importar configuraciones
const { logger } = require("./config/logger")
const { auditMiddleware } = require("../backend/middleware/audit.middlewrae")

// Crear aplicación Express
const app = express()

// Configuración del puerto
const PORT = process.env.PORT || 5000
const NODE_ENV = process.env.NODE_ENV || "development"

// ===== MIDDLEWARES DE SEGURIDAD =====

// Helmet para seguridad HTTP
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
  }),
)

// CORS configurado para Colombia
app.use(
  cors({
    origin:
      process.env.NODE_ENV === "production"
        ? ["https://tu-dominio.vercel.app", "https://gaia-eps.com"]
        : ["http://localhost:3000", "http://localhost:3001"],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  }),
)

// Rate limiting para prevenir ataques
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: NODE_ENV === "production" ? 100 : 1000, // límite de requests
  message: {
    error: "Demasiadas solicitudes desde esta IP, intente nuevamente en 15 minutos.",
    code: "RATE_LIMIT_EXCEEDED",
  },
  standardHeaders: true,
  legacyHeaders: false,
})
app.use("/api/", limiter)

// Compresión para mejorar performance
app.use(compression())

// Parsing de JSON y URL encoded
app.use(express.json({ limit: "10mb" }))
app.use(express.urlencoded({ extended: true, limit: "10mb" }))

// Logging con Morgan
app.use(
  morgan("combined", {
    stream: {
      write: (message) => logger.info(message.trim()),
    },
  }),
)

// Middleware de auditoría para cumplir normativas colombianas
app.use(auditMiddleware)

// ===== RUTAS DE PRUEBA =====

// Ruta de salud del servidor
app.get("/health", (req, res) => {
  const healthCheck = {
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: NODE_ENV,
    version: "1.0.0",
    timezone: "America/Bogota",
    country: "Colombia",
  }

  logger.info("Health check realizado", {
    ip: req.ip,
    userAgent: req.get("User-Agent"),
  })

  res.status(200).json(healthCheck)
})

// Ruta de información del sistema
app.get("/api/info", (req, res) => {
  const systemInfo = {
    name: "Gaia - Sistema de Gestión de Salud EPS",
    version: "1.0.0",
    description: "API para gestión integral de salud en Colombia",
    features: [
      "Agendamiento de citas",
      "Historia clínica digital",
      "Gestión de documentos médicos",
      "Cumplimiento normativo colombiano",
      "Generación de reportes RIPS",
      "Auditoría y trazabilidad",
    ],
    compliance: [
      "Resolución 3374 de 2000 (Historia clínica)",
      "Ley 1581 de 2012 (Habeas Data)",
      "Resolución 2003 de 2014 (RIPS)",
      "Circular 030 de 2013 (Seguridad información)",
    ],
    endpoints: {
      health: "/health",
      auth: "/api/auth",
      patients: "/api/patients",
      appointments: "/api/appointments",
      medical_records: "/api/medical-records",
    },
  }

  res.status(200).json(systemInfo)
})

// Ruta de prueba de autenticación
app.get("/api/test/auth", (req, res) => {
  res.status(200).json({
    message: "Endpoint de autenticación funcionando",
    timestamp: new Date().toISOString(),
    ready: true,
  })
})

// Ruta de prueba de base de datos
app.get("/api/test/database", async (req, res) => {
  try {
    // Aquí irá la conexión a la base de datos cuando configuremos Prisma
    res.status(200).json({
      message: "Conexión a base de datos lista para configurar",
      database: "PostgreSQL (Neon)",
      status: "pending_configuration",
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    logger.error("Error en prueba de base de datos", { error: error.message })
    res.status(500).json({
      error: "Error en conexión a base de datos",
      message: error.message,
    })
  }
})

// Ruta de prueba para logs de auditoría
app.post("/api/test/audit", (req, res) => {
  const { action, details } = req.body

  logger.info("Prueba de auditoría", {
    action: action || "test_action",
    details: details || "Prueba del sistema de auditoría",
    ip: req.ip,
    userAgent: req.get("User-Agent"),
    timestamp: new Date().toISOString(),
  })

  res.status(200).json({
    message: "Log de auditoría registrado correctamente",
    action: action || "test_action",
    timestamp: new Date().toISOString(),
  })
})

// ===== MANEJO DE ERRORES =====

// Middleware para rutas no encontradas
app.use("*", (req, res) => {
  logger.warn("Ruta no encontrada", {
    path: req.originalUrl,
    method: req.method,
    ip: req.ip,
  })

  res.status(404).json({
    error: "Ruta no encontrada",
    message: `La ruta ${req.originalUrl} no existe en la API de Gaia`,
    code: "ROUTE_NOT_FOUND",
  })
})

// Middleware global de manejo de errores
app.use((error, req, res, next) => {
  logger.error("Error no manejado", {
    error: error.message,
    stack: error.stack,
    path: req.originalUrl,
    method: req.method,
    ip: req.ip,
  })

  // No exponer detalles del error en producción
  const errorResponse = {
    error: "Error interno del servidor",
    message: NODE_ENV === "development" ? error.message : "Ha ocurrido un error inesperado",
    code: "INTERNAL_SERVER_ERROR",
    timestamp: new Date().toISOString(),
  }

  res.status(500).json(errorResponse)
})

// ===== INICIO DEL SERVIDOR =====

const server = app.listen(PORT, () => {
  logger.info(`🏥 Servidor Gaia iniciado`, {
    port: PORT,
    environment: NODE_ENV,
    timezone: process.env.TIMEZONE || "America/Bogota",
    timestamp: new Date().toISOString(),
  })

  console.log(`
  🏥 ===== GAIA - SISTEMA DE GESTIÓN DE SALUD EPS =====
  
  ✅ Servidor corriendo en: http://localhost:${PORT}
  🌍 Entorno: ${NODE_ENV}
  🕐 Zona horaria: America/Bogota
  📋 Cumplimiento normativo: Colombia
  
  📍 Endpoints de prueba:
  • Health Check: http://localhost:${PORT}/health
  • Info Sistema: http://localhost:${PORT}/api/info
  • Test Auth: http://localhost:${PORT}/api/test/auth
  • Test Database: http://localhost:${PORT}/api/test/database
  • Test Audit: http://localhost:${PORT}/api/test/audit (POST)
  
  🔒 Características de seguridad activadas:
  • Helmet (Seguridad HTTP)
  • CORS configurado
  • Rate Limiting
  • Logs de auditoría
  • Compresión
  
  ===================================================
  `)
})

// Manejo de cierre graceful
process.on("SIGTERM", () => {
  logger.info("SIGTERM recibido, cerrando servidor gracefully")
  server.close(() => {
    logger.info("Servidor cerrado correctamente")
    process.exit(0)
  })
})

process.on("SIGINT", () => {
  logger.info("SIGINT recibido, cerrando servidor gracefully")
  server.close(() => {
    logger.info("Servidor cerrado correctamente")
    process.exit(0)
  })
})

module.exports = app
