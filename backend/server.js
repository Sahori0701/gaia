const express = require("express")
const cors = require("cors")
const path = require("path")

// Cargar variables de entorno
require("dotenv").config()

// Crear aplicación Express
const app = express()

// Configuración básica
const PORT = process.env.PORT || 3000
const NODE_ENV = process.env.NODE_ENV || "production"

// ===== MIDDLEWARES BÁSICOS =====

// CORS permisivo para desarrollo
app.use(
  cors({
    origin: true,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  }),
)

// Parsing de JSON
app.use(express.json({ limit: "10mb" }))
app.use(express.urlencoded({ extended: true, limit: "10mb" }))

// ===== RUTAS BÁSICAS =====

// Ruta principal
app.get("/", (req, res) => {
  res.json({
    message: "🏥 Gaia EPS API - Sistema de Gestión de Salud",
    status: "OK",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
    environment: NODE_ENV,
    endpoints: {
      health: "/health",
      info: "/api/info",
      test: "/api/test/basic",
    },
  })
})

// Health check
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: NODE_ENV,
    version: "1.0.0",
    timezone: "America/Bogota",
  })
})

// Información del sistema
app.get("/api/info", (req, res) => {
  res.json({
    name: "Gaia - Sistema de Gestión de Salud EPS",
    version: "1.0.0",
    description: "API para gestión integral de salud en Colombia",
    status: "running",
    timestamp: new Date().toISOString(),
    features: ["Autenticación JWT", "Gestión de pacientes", "Sistema de citas", "Historia clínica digital"],
  })
})

// Test básico
app.get("/api/test/basic", (req, res) => {
  res.json({
    message: "✅ API básica funcionando correctamente",
    timestamp: new Date().toISOString(),
    environment: NODE_ENV,
    database: process.env.DATABASE_URL ? "Configurada" : "No configurada",
    jwt: process.env.JWT_SECRET ? "Configurado" : "No configurado",
  })
})

// ===== CARGAR RUTAS AVANZADAS (CON MANEJO DE ERRORES) =====

try {
  // Solo cargar rutas complejas si las dependencias están disponibles
  console.log("Intentando cargar rutas avanzadas...")

  // Verificar que Prisma esté disponible
  const { prisma } = require("./config/database")

  // Si llegamos aquí, Prisma está disponible
  const authRoutes = require("./routes/auth.routes")
  app.use("/api/auth", authRoutes)
  console.log("✅ Auth routes cargadas")

  const patientRoutes = require("./routes/patient.routes")
  app.use("/api/patients", patientRoutes)
  console.log("✅ Patient routes cargadas")

  const appointmentRoutes = require("./routes/appointment.routes")
  app.use("/api/appointments", appointmentRoutes)
  console.log("✅ Appointment routes cargadas")

  const medicalRecordRoutes = require("./routes/medical-record.routes")
  app.use("/api/medical-records", medicalRecordRoutes)
  console.log("✅ Medical record routes cargadas")
} catch (error) {
  console.warn("⚠️ No se pudieron cargar todas las rutas avanzadas:", error.message)
  console.log("🔄 API funcionando en modo básico")

  // Ruta de fallback para auth
  app.get("/api/auth/test", (req, res) => {
    res.json({
      message: "Auth routes no disponibles",
      error: "Dependencias no cargadas",
      suggestion: "Verificar variables de entorno y base de datos",
    })
  })
}

// ===== MANEJO DE ERRORES =====

// 404 para rutas no encontradas
app.use("*", (req, res) => {
  res.status(404).json({
    error: "Ruta no encontrada",
    message: `La ruta ${req.originalUrl} no existe`,
    availableRoutes: ["/", "/health", "/api/info", "/api/test/basic"],
  })
})

// Error handler global
app.use((error, req, res, next) => {
  console.error("Error:", error.message)

  res.status(500).json({
    error: "Error interno del servidor",
    message: NODE_ENV === "development" ? error.message : "Error inesperado",
    timestamp: new Date().toISOString(),
  })
})

// ===== EXPORTAR PARA VERCEL =====
module.exports = app

// Para desarrollo local
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🏥 Servidor Gaia iniciado en puerto ${PORT}`)
    console.log(`🌍 Entorno: ${NODE_ENV}`)
  })
}
