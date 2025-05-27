const express = require("express")
const cors = require("cors")

// Crear aplicación Express
const app = express()

// Variables de entorno básicas
const PORT = process.env.PORT || 3000
const NODE_ENV = process.env.NODE_ENV || "production"

// ===== MIDDLEWARES BÁSICOS =====

// CORS
app.use(
  cors({
    origin: true,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
)

// JSON parsing
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// ===== RUTAS BÁSICAS =====

// Ruta principal
app.get("/", (req, res) => {
  try {
    res.status(200).json({
      message: "🏥 Gaia EPS API - Sistema de Gestión de Salud",
      status: "OK",
      version: "1.0.0",
      timestamp: new Date().toISOString(),
      environment: NODE_ENV,
      endpoints: {
        health: "/health",
        info: "/api/info",
        test: "/api/test",
      },
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Health check
app.get("/health", (req, res) => {
  try {
    res.status(200).json({
      status: "OK",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: NODE_ENV,
      version: "1.0.0",
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Info del sistema
app.get("/api/info", (req, res) => {
  try {
    res.status(200).json({
      name: "Gaia - Sistema de Gestión de Salud EPS",
      version: "1.0.0",
      description: "API para gestión integral de salud en Colombia",
      status: "running",
      timestamp: new Date().toISOString(),
      features: ["Autenticación JWT", "Gestión de pacientes", "Sistema de citas", "Historia clínica digital"],
      compliance: ["Resolución 3374 de 2000", "Ley 1581 de 2012", "Resolución 2003 de 2014"],
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Test básico
app.get("/api/test", (req, res) => {
  try {
    res.status(200).json({
      message: "✅ API funcionando correctamente",
      timestamp: new Date().toISOString(),
      environment: NODE_ENV,
      checks: {
        server: "OK",
        cors: "OK",
        json: "OK",
        routing: "OK",
      },
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Test con datos
app.get("/api/test/data", (req, res) => {
  try {
    const testData = {
      patients: [
        { id: 1, name: "Juan Pérez", document: "12345678" },
        { id: 2, name: "María García", document: "87654321" },
      ],
      appointments: [
        { id: 1, patient: "Juan Pérez", date: "2024-01-30", specialty: "Medicina General" },
        { id: 2, patient: "María García", date: "2024-01-31", specialty: "Cardiología" },
      ],
      stats: {
        totalPatients: 2,
        totalAppointments: 2,
        activeUsers: 5,
      },
    }

    res.status(200).json({
      message: "✅ Test de datos exitoso",
      data: testData,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Test POST
app.post("/api/test/post", (req, res) => {
  try {
    res.status(200).json({
      message: "✅ POST request funcionando",
      received: req.body,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// ===== RUTAS DE AUTENTICACIÓN SIMULADAS =====

app.post("/api/auth/login", (req, res) => {
  try {
    const { email, password } = req.body

    // Simulación de login
    if (email === "admin@gaia-eps.com" && password === "Admin123!") {
      res.status(200).json({
        message: "Login exitoso",
        user: {
          id: "1",
          email: "admin@gaia-eps.com",
          role: "ADMIN",
          firstName: "Administrador",
          lastName: "Sistema",
        },
        token: "simulated-jwt-token-12345",
        timestamp: new Date().toISOString(),
      })
    } else {
      res.status(401).json({
        error: "Credenciales inválidas",
        message: "Email o contraseña incorrectos",
      })
    }
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.get("/api/auth/test", (req, res) => {
  try {
    res.status(200).json({
      message: "✅ Sistema de autenticación disponible",
      endpoints: {
        login: "POST /api/auth/login",
        register: "POST /api/auth/register (próximamente)",
        profile: "GET /api/auth/profile (próximamente)",
      },
      testCredentials: {
        email: "admin@gaia-eps.com",
        password: "Admin123!",
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// ===== RUTAS DE PACIENTES SIMULADAS =====

app.get("/api/patients", (req, res) => {
  try {
    const patients = [
      {
        id: "1",
        firstName: "Juan",
        lastName: "Pérez",
        documentType: "CC",
        documentNumber: "12345678",
        email: "juan.perez@email.com",
        phone: "+57 310 123 4567",
        birthDate: "1985-03-15",
        gender: "MALE",
        city: "Bogotá",
        department: "Cundinamarca",
      },
      {
        id: "2",
        firstName: "María",
        lastName: "García",
        documentType: "CC",
        documentNumber: "87654321",
        email: "maria.garcia@email.com",
        phone: "+57 315 987 6543",
        birthDate: "1992-07-22",
        gender: "FEMALE",
        city: "Medellín",
        department: "Antioquia",
      },
    ]

    res.status(200).json({
      message: "Pacientes obtenidos exitosamente",
      data: patients,
      total: patients.length,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// ===== MANEJO DE ERRORES =====

// 404 para rutas no encontradas
app.use("*", (req, res) => {
  res.status(404).json({
    error: "Ruta no encontrada",
    message: `La ruta ${req.originalUrl} no existe`,
    availableRoutes: [
      "/",
      "/health",
      "/api/info",
      "/api/test",
      "/api/test/data",
      "/api/auth/test",
      "/api/auth/login",
      "/api/patients",
    ],
    timestamp: new Date().toISOString(),
  })
})

// Error handler global
app.use((error, req, res, next) => {
  console.error("Error:", error.message)
  console.error("Stack:", error.stack)

  res.status(500).json({
    error: "Error interno del servidor",
    message: error.message,
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
    console.log(`📍 Endpoints disponibles:`)
    console.log(`  - GET  /`)
    console.log(`  - GET  /health`)
    console.log(`  - GET  /api/info`)
    console.log(`  - GET  /api/test`)
    console.log(`  - POST /api/auth/login`)
    console.log(`  - GET  /api/patients`)
  })
}
