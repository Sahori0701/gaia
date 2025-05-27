const { PrismaClient } = require("@prisma/client")
const { logger } = require("./logger")

// Configuración del cliente Prisma
const prisma = new PrismaClient({
  log: [
    {
      emit: "event",
      level: "query",
    },
    {
      emit: "event",
      level: "error",
    },
    {
      emit: "event",
      level: "info",
    },
    {
      emit: "event",
      level: "warn",
    },
  ],
})

// Configurar logging de Prisma
prisma.$on("query", (e) => {
  if (process.env.NODE_ENV === "development") {
    logger.debug("Prisma Query", {
      query: e.query,
      params: e.params,
      duration: `${e.duration}ms`,
    })
  }
})

prisma.$on("error", (e) => {
  logger.error("Prisma Error", {
    target: e.target,
    message: e.message,
  })
})

prisma.$on("info", (e) => {
  logger.info("Prisma Info", {
    target: e.target,
    message: e.message,
  })
})

prisma.$on("warn", (e) => {
  logger.warn("Prisma Warning", {
    target: e.target,
    message: e.message,
  })
})

// Función para probar la conexión
async function testConnection() {
  try {
    await prisma.$connect()
    logger.info("✅ Conexión a base de datos establecida correctamente")

    // Probar una query simple
    const userCount = await prisma.user.count()
    logger.info(`📊 Base de datos conectada - ${userCount} usuarios registrados`)

    return true
  } catch (error) {
    logger.error("❌ Error conectando a la base de datos", {
      error: error.message,
      stack: error.stack,
    })
    return false
  }
}

// Función para cerrar la conexión gracefully
async function disconnect() {
  try {
    await prisma.$disconnect()
    logger.info("🔌 Conexión a base de datos cerrada correctamente")
  } catch (error) {
    logger.error("❌ Error cerrando conexión a base de datos", {
      error: error.message,
    })
  }
}

// Función para obtener estadísticas de la base de datos
async function getDatabaseStats() {
  try {
    const stats = {
      users: await prisma.user.count(),
      patients: await prisma.patient.count(),
      medicalProfessionals: await prisma.medicalProfessional.count(),
      appointments: await prisma.appointment.count(),
      medicalRecords: await prisma.medicalRecord.count(),
      specialties: await prisma.specialty.count(),
      auditLogs: await prisma.auditLog.count(),
    }

    return stats
  } catch (error) {
    logger.error("Error obteniendo estadísticas de BD", { error: error.message })
    throw error
  }
}

module.exports = {
  prisma,
  testConnection,
  disconnect,
  getDatabaseStats,
}
