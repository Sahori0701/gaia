const express = require("express")
const cors = require("cors")
const helmet = require("helmet")
const morgan = require("morgan")
const rateLimit = require("express-rate-limit")
const compression = require("compression")
require("dotenv").config()

const { findAvailablePort } = require("./utils/port-finder")

// Importar configuraciones
const { logger } = require("./config/logger")
const { auditMiddleware } = require("./middleware/auth.middleware")
const { prisma, testConnection, getDatabaseStats } = require("./config/database")

// Importar rutas
const authRoutes = require("./routes/auth.routes")
const patientRoutes = require("./routes/patient.routes")
const appointmentRoutes = require("./routes/appointment.routes")
const medicalRecordRoutes = require("./routes/medical-record.routes")

// Crear aplicación Express
const app = express()

// Configuración del puerto
const PORT = process.env.PORT || 3001
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

// Rate limiting más estricto para autenticación
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: NODE_ENV === "production" ? 10 : 50, // límite más bajo para auth
  message: {
    error: "Demasiados intentos de autenticación, intente nuevamente en 15 minutos.",
    code: "AUTH_RATE_LIMIT_EXCEEDED",
  },
  standardHeaders: true,
  legacyHeaders: false,
})
app.use("/api/auth/login", authLimiter)
app.use("/api/auth/register", authLimiter)

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

// ===== RUTAS DE LA API =====

// Rutas de autenticación
app.use("/api/auth", authRoutes)

// Rutas de pacientes
app.use("/api/patients", patientRoutes)

// Rutas de citas médicas
app.use("/api/appointments", appointmentRoutes)

// Rutas de historia clínica
app.use("/api/medical-records", medicalRecordRoutes)

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
      "Autenticación JWT con roles",
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
      database_stats: "/api/test/database-stats",
    },
    authEndpoints: {
      register: "POST /api/auth/register",
      login: "POST /api/auth/login",
      refresh: "POST /api/auth/refresh",
      logout: "POST /api/auth/logout",
      profile: "GET /api/auth/profile",
      changePassword: "PUT /api/auth/change-password",
      testProtected: "GET /api/auth/test/protected",
    },
    patientEndpoints: {
      list: "GET /api/patients",
      create: "POST /api/patients",
      getById: "GET /api/patients/:id",
      update: "PUT /api/patients/:id",
      stats: "GET /api/patients/stats",
    },
    appointmentEndpoints: {
      list: "GET /api/appointments",
      create: "POST /api/appointments",
      getById: "GET /api/appointments/:id",
      update: "PUT /api/appointments/:id",
      cancel: "PATCH /api/appointments/:id/cancel",
      stats: "GET /api/appointments/stats",
      availableSlots: "GET /api/appointments/available-slots",
    },
    medicalRecordEndpoints: {
      list: "GET /api/medical-records",
      create: "POST /api/medical-records",
      getById: "GET /api/medical-records/:id",
      update: "PUT /api/medical-records/:id",
      patientHistory: "GET /api/medical-records/patient/:patientId/history",
      stats: "GET /api/medical-records/stats",
    },
  }

  res.status(200).json(systemInfo)
})

// Ruta de prueba de autenticación
app.get("/api/test/auth", (req, res) => {
  res.status(200).json({
    message: "✅ Sistema de autenticación JWT configurado",
    endpoints: {
      register: "POST /api/auth/register",
      login: "POST /api/auth/login",
      refresh: "POST /api/auth/refresh",
      logout: "POST /api/auth/logout (requiere token)",
      profile: "GET /api/auth/profile (requiere token)",
      changePassword: "PUT /api/auth/change-password (requiere token)",
      testProtected: "GET /api/auth/test/protected (requiere token)",
    },
    testCredentials: {
      admin: {
        email: "admin@gaia-eps.com",
        password: "Admin123!",
      },
      doctor: {
        email: "dr.garcia@gaia-eps.com",
        password: "Doctor123!",
      },
      patient: {
        email: "juan.perez@email.com",
        password: "Patient123!",
      },
    },
    timestamp: new Date().toISOString(),
    ready: true,
  })
})

// Ruta de prueba de base de datos mejorada
app.get("/api/test/database", async (req, res) => {
  try {
    const isConnected = await testConnection()

    if (isConnected) {
      const stats = await getDatabaseStats()

      res.status(200).json({
        message: "✅ Conexión a base de datos exitosa",
        database: "PostgreSQL (Neon)",
        status: "connected",
        stats: stats,
        timestamp: new Date().toISOString(),
      })
    } else {
      res.status(500).json({
        error: "❌ Error en conexión a base de datos",
        database: "PostgreSQL (Neon)",
        status: "disconnected",
        timestamp: new Date().toISOString(),
      })
    }
  } catch (error) {
    logger.error("Error en prueba de base de datos", { error: error.message })
    res.status(500).json({
      error: "Error en conexión a base de datos",
      message: error.message,
      timestamp: new Date().toISOString(),
    })
  }
})

// Nueva ruta para estadísticas detalladas de la base de datos
app.get("/api/test/database-stats", async (req, res) => {
  try {
    const stats = await getDatabaseStats()

    // Obtener algunos datos de ejemplo
    const sampleData = {
      latestUsers: await prisma.user.findMany({
        take: 3,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          email: true,
          role: true,
          firstName: true,
          lastName: true,
          createdAt: true,
        },
      }),
      specialties: await prisma.specialty.findMany({
        select: {
          name: true,
          code: true,
          _count: {
            select: {
              medicalProfessionals: true,
              appointments: true,
            },
          },
        },
      }),
      upcomingAppointments: await prisma.appointment.findMany({
        where: {
          scheduledDate: {
            gte: new Date(),
          },
          status: "SCHEDULED",
        },
        take: 5,
        orderBy: { scheduledDate: "asc" },
        include: {
          patient: {
            include: {
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
          medicalProfessional: {
            include: {
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                },
              },
              specialty: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      }),
    }

    res.status(200).json({
      message: "📊 Estadísticas de base de datos Gaia",
      stats: stats,
      sampleData: sampleData,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    logger.error("Error obteniendo estadísticas de BD", { error: error.message })
    res.status(500).json({
      error: "Error obteniendo estadísticas",
      message: error.message,
      timestamp: new Date().toISOString(),
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

// Función para iniciar el servidor con puerto dinámico
async function startServer() {
  try {
    // Probar conexión a la base de datos al iniciar
    const isConnected = await testConnection()
    if (!isConnected) {
      logger.error("❌ No se pudo conectar a la base de datos al iniciar")
      process.exit(1)
    }

    const availablePort = await findAvailablePort(PORT)

    const server = app.listen(availablePort, () => {
      logger.info(`🏥 Servidor Gaia iniciado`, {
        port: availablePort,
        requestedPort: PORT,
        environment: NODE_ENV,
        timezone: process.env.TIMEZONE || "America/Bogota",
        timestamp: new Date().toISOString(),
      })

      console.log(`
  🏥 ===== GAIA - SISTEMA DE GESTIÓN DE SALUD EPS =====
  
  ✅ Servidor corriendo en: http://localhost:${availablePort}
  ✅ Base de datos conectada: PostgreSQL (Neon)
  ✅ Autenticación JWT configurada
  ✅ Endpoints completos disponibles
  ${availablePort !== PORT ? `⚠️  Puerto ${PORT} estaba ocupado, usando ${availablePort}` : ""}
  🌍 Entorno: ${NODE_ENV}
  🕐 Zona horaria: America/Bogota
  📋 Cumplimiento normativo: Colombia
  
  📍 Endpoints principales:
  • Health Check: http://localhost:${availablePort}/health
  • Info Sistema: http://localhost:${availablePort}/api/info
  • Test Auth: http://localhost:${availablePort}/api/test/auth
  
  🔐 Endpoints de autenticación:
  • Register: POST http://localhost:${availablePort}/api/auth/register
  • Login: POST http://localhost:${availablePort}/api/auth/login
  • Profile: GET http://localhost:${availablePort}/api/auth/profile
  • Test Protected: GET http://localhost:${availablePort}/api/auth/test/protected
  
  👥 Endpoints de pacientes:
  • List: GET http://localhost:${availablePort}/api/patients
  • Create: POST http://localhost:${availablePort}/api/patients
  • Get by ID: GET http://localhost:${availablePort}/api/patients/:id
  • Update: PUT http://localhost:${availablePort}/api/patients/:id
  • Stats: GET http://localhost:${availablePort}/api/patients/stats
  
  📅 Endpoints de citas médicas:
  • List: GET http://localhost:${availablePort}/api/appointments
  • Create: POST http://localhost:${availablePort}/api/appointments
  • Get by ID: GET http://localhost:${availablePort}/api/appointments/:id
  • Update: PUT http://localhost:${availablePort}/api/appointments/:id
  • Cancel: PATCH http://localhost:${availablePort}/api/appointments/:id/cancel
  • Stats: GET http://localhost:${availablePort}/api/appointments/stats
  • Available Slots: GET http://localhost:${availablePort}/api/appointments/available-slots
  
  📋 Endpoints de historia clínica:
  • List: GET http://localhost:${availablePort}/api/medical-records
  • Create: POST http://localhost:${availablePort}/api/medical-records
  • Get by ID: GET http://localhost:${availablePort}/api/medical-records/:id
  • Update: PUT http://localhost:${availablePort}/api/medical-records/:id
  • Patient History: GET http://localhost:${availablePort}/api/medical-records/patient/:patientId/history
  • Stats: GET http://localhost:${availablePort}/api/medical-records/stats
  
  👥 Credenciales de prueba:
  • Admin: admin@gaia-eps.com / Admin123!
  • Doctor: dr.garcia@gaia-eps.com / Doctor123!
  • Paciente: juan.perez@email.com / Patient123!
  
  🔧 Herramientas de desarrollo:
  • Prisma Studio: npx prisma studio
  
  🔒 Características de seguridad:
  • JWT con refresh tokens
  • Rate limiting por IP
  • Validaciones colombianas
  • Logs de auditoría
  • Encriptación de contraseñas
  • Datos sensibles encriptados
  
  ===================================================
      `)
    })

    // Manejo de cierre graceful
    process.on("SIGTERM", () => {
      logger.info("SIGTERM recibido, cerrando servidor gracefully")
      server.close(async () => {
        await prisma.$disconnect()
        logger.info("Servidor cerrado correctamente")
        process.exit(0)
      })
    })

    process.on("SIGINT", () => {
      logger.info("SIGINT recibido, cerrando servidor gracefully")
      server.close(async () => {
        await prisma.$disconnect()
        logger.info("Servidor cerrado correctamente")
        process.exit(0)
      })
    })

    return server
  } catch (error) {
    logger.error("Error iniciando servidor", { error: error.message })
    process.exit(1)
  }
}

// Iniciar el servidor
startServer()
module.exports = app
