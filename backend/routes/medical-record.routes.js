const express = require("express")
const router = express.Router()
const {
  getMedicalRecords,
  getMedicalRecordById,
  createMedicalRecord,
  updateMedicalRecord,
  getPatientMedicalHistory,
  getMedicalRecordStats,
} = require("../controllers/medical-record.controller")

const { authenticateToken, authorizeRoles } = require("../middleware/auth.middleware")

// Todas las rutas requieren autenticación
router.use(authenticateToken)

// Obtener estadísticas de registros médicos
router.get("/stats", getMedicalRecordStats)

// Obtener historia clínica completa de un paciente
router.get("/patient/:patientId/history", getPatientMedicalHistory)

// Obtener todos los registros médicos (con filtros y paginación)
router.get("/", getMedicalRecords)

// Obtener registro médico por ID
router.get("/:id", getMedicalRecordById)

// Crear nuevo registro médico (solo médicos y admin)
router.post("/", authorizeRoles(["ADMIN", "DOCTOR", "SPECIALIST", "PSYCHOLOGIST"]), createMedicalRecord)

// Actualizar registro médico (solo el creador o admin)
router.put("/:id", authorizeRoles(["ADMIN", "DOCTOR", "SPECIALIST", "PSYCHOLOGIST"]), updateMedicalRecord)

module.exports = router
