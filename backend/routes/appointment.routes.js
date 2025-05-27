const express = require("express")
const router = express.Router()
const {
  getAppointments,
  getAppointmentById,
  createAppointment,
  updateAppointment,
  cancelAppointment,
  getAppointmentStats,
  getAvailableSlots,
} = require("../controllers/appointment.controller")

const { authenticateToken, authorizeRoles } = require("../middleware/auth.middleware")

// Todas las rutas requieren autenticación
router.use(authenticateToken)

// Obtener horarios disponibles (público para usuarios autenticados)
router.get("/available-slots", getAvailableSlots)

// Obtener estadísticas de citas
router.get("/stats", getAppointmentStats)

// Obtener todas las citas (con filtros y paginación)
router.get("/", getAppointments)

// Obtener cita por ID
router.get("/:id", getAppointmentById)

// Crear nueva cita (todos los roles pueden crear citas)
router.post("/", createAppointment)

// Actualizar cita (solo médicos y admin)
router.put("/:id", authorizeRoles(["ADMIN", "DOCTOR", "SPECIALIST", "PSYCHOLOGIST"]), updateAppointment)

// Cancelar cita (pacientes pueden cancelar sus propias citas, médicos y admin pueden cancelar cualquiera)
router.patch("/:id/cancel", cancelAppointment)

module.exports = router
