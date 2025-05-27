const express = require("express")
const { body } = require("express-validator")
const {
  getAllPatients,
  getPatientById,
  createPatient,
  updatePatient,
  getPatientStats,
} = require("../controllers/patient.controller")
const { authenticateToken, authorizeRoles } = require("../middleware/auth.middleware")
const {
  handleValidationErrors,
  userValidations,
  patientValidations,
  paramValidations,
  queryValidations,
} = require("../middleware/validation.middleware")

const router = express.Router()

// Todas las rutas requieren autenticación
router.use(authenticateToken)

// Validaciones para crear paciente
const createPatientValidation = [
  // Validaciones de usuario
  userValidations.email,
  userValidations.password,
  userValidations.firstName,
  userValidations.lastName,
  userValidations.documentType,
  userValidations.documentNumber,
  userValidations.phone,

  // Validaciones de paciente
  patientValidations.birthDate,
  patientValidations.gender,
  patientValidations.bloodType,
  patientValidations.address,
  patientValidations.city,
  patientValidations.department,
  patientValidations.affiliationNumber,
  patientValidations.epsCode,

  // Validaciones adicionales
  body("emergencyContactName")
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("Nombre de contacto de emergencia debe tener entre 2 y 100 caracteres"),
  body("emergencyContactPhone").isMobilePhone("es-CO").withMessage("Teléfono de contacto de emergencia inválido"),
  body("affiliationType").isIn(["Contributivo", "Subsidiado", "Especial"]).withMessage("Tipo de afiliación inválido"),
]

// Validaciones para actualizar paciente
const updatePatientValidation = [
  body("firstName").optional().trim().isLength({ min: 2, max: 50 }),
  body("lastName").optional().trim().isLength({ min: 2, max: 50 }),
  body("phone").optional().isMobilePhone("es-CO"),
  body("birthDate").optional().isISO8601(),
  body("gender").optional().isIn(["MALE", "FEMALE", "OTHER", "NOT_SPECIFIED"]),
  body("bloodType")
    .optional()
    .isIn([
      "A_POSITIVE",
      "A_NEGATIVE",
      "B_POSITIVE",
      "B_NEGATIVE",
      "AB_POSITIVE",
      "AB_NEGATIVE",
      "O_POSITIVE",
      "O_NEGATIVE",
      "UNKNOWN",
    ]),
  body("address").optional().trim().isLength({ min: 10, max: 200 }),
  body("city").optional().trim().isLength({ min: 2, max: 50 }),
  body("department").optional().trim().isLength({ min: 2, max: 50 }),
  body("emergencyContactName").optional().trim().isLength({ min: 2, max: 100 }),
  body("emergencyContactPhone").optional().isMobilePhone("es-CO"),
]

/**
 * @route   GET /api/patients
 * @desc    Obtener todos los pacientes (con paginación y filtros)
 * @access  Private (Admin, Doctor, Specialist, Nurse, Administrative)
 */
router.get(
  "/",
  authorizeRoles("ADMIN", "DOCTOR", "SPECIALIST", "NURSE", "ADMINISTRATIVE", "AUDITOR"),
  [queryValidations.page, queryValidations.limit, queryValidations.search],
  handleValidationErrors,
  getAllPatients,
)

/**
 * @route   GET /api/patients/stats
 * @desc    Obtener estadísticas de pacientes
 * @access  Private (Admin, Doctor, Specialist, Administrative, Auditor)
 */
router.get("/stats", authorizeRoles("ADMIN", "DOCTOR", "SPECIALIST", "ADMINISTRATIVE", "AUDITOR"), getPatientStats)

/**
 * @route   GET /api/patients/:id
 * @desc    Obtener un paciente por ID
 * @access  Private (Admin, Doctor, Specialist, Nurse, Administrative, Patient - solo su propio perfil)
 */
router.get("/:id", [paramValidations.id], handleValidationErrors, getPatientById)

/**
 * @route   POST /api/patients
 * @desc    Crear nuevo paciente
 * @access  Private (Admin, Administrative)
 */
router.post(
  "/",
  authorizeRoles("ADMIN", "ADMINISTRATIVE"),
  createPatientValidation,
  handleValidationErrors,
  createPatient,
)

/**
 * @route   PUT /api/patients/:id
 * @desc    Actualizar paciente
 * @access  Private (Admin, Administrative, Patient - solo su propio perfil)
 */
router.put("/:id", [paramValidations.id, ...updatePatientValidation], handleValidationErrors, updatePatient)

module.exports = router
