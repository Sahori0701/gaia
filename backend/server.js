const express = require("express")
const cors = require("cors")
const helmet = require("helmet")
const morgan = require("morgan")
const rateLimit = require("express-rate-limit")
const compression = require("compression")

// Cargar variables de entorno ANTES que todo
require("dotenv").config()

// Importar configuraciones
const { logger } = require("./config/logger")
const { auditMiddleware } = require("./middleware/auth.middleware")

// Crear aplicación Express
const app = express()

// Configuración del puerto para Vercel
const PORT = process.env.PORT || 3000
const NODE_ENV = process.env.NODE_ENV || "production"

// ===== MIDDLEWARES DE SEGURIDAD =====

// Helmet para seguridad HTTP (configuración más permisiva para Vercel)
app.use(
  helmet({
    contentSecurityPolicy: false, // Deshabilitado para evitar problemas en Vercel
    crossOriginEmbedderPolicy: false,
  }),
)

// CORS configurado para producción
app.use(
  cors({
    origin: true, // Permitir todos los orígenes en desarrollo
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  }),
)

// Rate limiting más permisivo para desarrollo
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 1000, // límite alto para desarrollo
  message: {
    error: "Demasiadas solicitudes desde esta IP, intente nuevamente en 15 minutos.",
    code: "RATE_LIMIT_EXCEEDED",
  },
  standardHeaders: true,
  legacyHeaders: false,
})
app.use("/api/", limiter)

// Compresión
app.use(compression())

// Parsing de JSON
app.use(express.json({ limit: "10mb" }))
app.use(express.urlencoded({ extended: true, limit: "10mb" }))

// Logging básico
if (NODE_ENV === "development") {
  app.use(morgan("combined"))
}

// ===== RUTAS BÁSICAS PRIMERO =====

// Ruta de salud del servidor (sin dependencias)
app.get("/", (req, res) => {
  res.json({
    message: "🏥 Gaia EPS API - Sistema de Gestión de Salud",
    status: "OK",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
    environment: NODE_ENV,
  })
})

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

  res.status(200).json(healthCheck)
})

// Ruta de información básica
app.get("/api/info", (req, res) => {
  const systemInfo = {
    name: "Gaia - Sistema de Gestión de Salud EPS",
    version: "1.0.0",
    description: "API para gestión integral de salud en Colombia",
    status: "running",
    timestamp: new Date().toISOString(),
    endpoints: {
      health: "/health",
      info: "/api/info",
      auth: "/api/auth",
    },
  }

  res.status(200).json(systemInfo)
})

// ===== IMPORTAR RUTAS CON MANEJO DE ERRORES =====

try {
  // Importar rutas solo si las dependencias están disponibles
  const authRoutes = require("./routes/auth.routes")
  app.use("/api/auth", authRoutes)

  console.log("✅ Auth routes loaded")
} catch (error) {
  console.error("❌ Error loading auth routes:", error.message)
}

try {
  const patientRoutes = require("./routes/patient.routes")
  app.use("/api/patients", patientRoutes)

  console.log("✅ Patient routes loaded")
} catch (error) {
  console.error("❌ Error loading patient routes:", error.message)
}

try {
  const appointmentRoutes = require("./routes/appointment.routes")
  app.use("/api/appointments", appointmentRoutes)

  console.log("✅ Appointment routes loaded")
} catch (error) {
  console.error("❌ Error loading appointment routes:", error.message)
}

try {
  const medicalRecordRoutes = require("./routes/medical-record.routes")
  app.use("/api/medical-records", medicalRecordRoutes)

  console.log("✅ Medical record routes loaded")
} catch (error) {
  console.error("❌ Error loading medical record routes:", error.message)
}

// ===== RUTAS DE PRUEBA =====

app.get("/api/test/basic", (req, res) => {
  res.json({
    message: "✅ API básica funcionando",
    timestamp: new Date().toISOString(),
    environment: NODE_ENV,
  })
})

// ===== MANEJO DE ERRORES =====

// Middleware para rutas no encontradas
app.use("*", (req, res) => {
  res.status(404).json({
    error: "Ruta no encontrada",
    message: `La ruta ${req.originalUrl} no existe en la API de Gaia`,
    code: "ROUTE_NOT_FOUND",
    availableRoutes: ["/", "/health", "/api/info", "/api/test/basic"],
  })
})

// Middleware global de manejo de errores
app.use((error, req, res, next) => {
  console.error("Error no manejado:", error.message)
  console.error("Stack:", error.stack)

  const errorResponse = {
    error: "Error interno del servidor",
    message: NODE_ENV === "development" ? error.message : "Ha ocurrido un error inesperado",
    code: "INTERNAL_SERVER_ERROR",
    timestamp: new Date().toISOString(),
  }

  res.status(500).json(errorResponse)
})

// ===== EXPORTAR PARA VERCEL =====

// Para Vercel, exportamos la app directamente
module.exports = app

// Para desarrollo local
if (require.main === module) {
  const server = app.listen(PORT, () => {
    console.log(`🏥 Servidor Gaia iniciado en puerto ${PORT}`)
    console.log(`🌍 Entorno: ${NODE_ENV}`)
    console.log(`📍 URL: http://localhost:${PORT}`)
  })

  // Manejo de cierre graceful
  process.on("SIGTERM", () => {
    console.log("SIGTERM recibido, cerrando servidor")
    server.close(() => {
      console.log("Servidor cerrado")
      process.exit(0)
    })
  })
}
