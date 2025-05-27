const { body, param, query, validationResult } = require("express-validator")
const { validateCedulaColombia, validateColombianPhone, validateEPSCode } = require("../utils/colombia-validators")

/**
 * Middleware para manejar errores de validación
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: "Datos de entrada inválidos",
      code: "VALIDATION_ERROR",
      details: errors.array().map((error) => ({
        field: error.path,
        message: error.msg,
        value: error.value,
      })),
    })
  }
  next()
}

/**
 * Validador personalizado para cédula colombiana
 */
const validateCedula = (value) => {
  if (!validateCedulaColombia(value)) {
    throw new Error("Número de cédula colombiana inválido")
  }
  return true
}

/**
 * Validador personalizado para teléfono colombiano
 */
const validatePhone = (value) => {
  if (value && !validateColombianPhone(value)) {
    throw new Error("Número de teléfono colombiano inválido")
  }
  return true
}

/**
 * Validador personalizado para código EPS
 */
const validateEPS = (value) => {
  if (value && !validateEPSCode(value)) {
    throw new Error("Código EPS inválido")
  }
  return true
}

/**
 * Validaciones comunes para usuarios
 */
const userValidations = {
  email: body("email").isEmail().normalizeEmail().withMessage("Email inválido"),
  password: body("password")
    .isLength({ min: 8 })
    .withMessage("La contraseña debe tener al menos 8 caracteres")
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage("La contraseña debe contener al menos: 1 minúscula, 1 mayúscula, 1 número y 1 carácter especial"),
  firstName: body("firstName")
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage("Nombre debe tener entre 2 y 50 caracteres"),
  lastName: body("lastName")
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage("Apellido debe tener entre 2 y 50 caracteres"),
  documentType: body("documentType")
    .isIn(["CC", "TI", "CE", "PA", "RC", "MS", "AS"])
    .withMessage("Tipo de documento inválido"),
  documentNumber: body("documentNumber")
    .trim()
    .isLength({ min: 6, max: 15 })
    .custom((value, { req }) => {
      if (req.body.documentType === "CC") {
        return validateCedula(value)
      }
      return true
    }),
  phone: body("phone").optional().custom(validatePhone),
}

/**
 * Validaciones para pacientes
 */
const patientValidations = {
  birthDate: body("birthDate").isISO8601().withMessage("Fecha de nacimiento inválida"),
  gender: body("gender").isIn(["MALE", "FEMALE", "OTHER", "NOT_SPECIFIED"]).withMessage("Género inválido"),
  bloodType: body("bloodType")
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
    ])
    .withMessage("Tipo de sangre inválido"),
  address: body("address")
    .trim()
    .isLength({ min: 10, max: 200 })
    .withMessage("Dirección debe tener entre 10 y 200 caracteres"),
  city: body("city").trim().isLength({ min: 2, max: 50 }).withMessage("Ciudad debe tener entre 2 y 50 caracteres"),
  department: body("department")
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage("Departamento debe tener entre 2 y 50 caracteres"),
  affiliationNumber: body("affiliationNumber")
    .trim()
    .isLength({ min: 10, max: 20 })
    .withMessage("Número de afiliación inválido"),
  epsCode: body("epsCode").custom(validateEPS),
}

/**
 * Validaciones para citas médicas
 */
const appointmentValidations = {
  scheduledDate: body("scheduledDate").isISO8601().withMessage("Fecha de cita inválida"),
  scheduledTime: body("scheduledTime").isISO8601().withMessage("Hora de cita inválida"),
  duration: body("duration").isInt({ min: 15, max: 180 }).withMessage("Duración debe estar entre 15 y 180 minutos"),
  type: body("type")
    .isIn(["CONSULTATION", "FOLLOW_UP", "EMERGENCY", "PROCEDURE", "LABORATORY", "IMAGING", "THERAPY", "VACCINATION"])
    .withMessage("Tipo de cita inválido"),
  reason: body("reason")
    .trim()
    .isLength({ min: 10, max: 500 })
    .withMessage("Motivo debe tener entre 10 y 500 caracteres"),
}

/**
 * Validaciones para parámetros de URL
 */
const paramValidations = {
  id: param("id").isUUID().withMessage("ID inválido"),
  userId: param("userId").isUUID().withMessage("ID de usuario inválido"),
  patientId: param("patientId").isUUID().withMessage("ID de paciente inválido"),
  appointmentId: param("appointmentId").isUUID().withMessage("ID de cita inválido"),
}

/**
 * Validaciones para query parameters
 */
const queryValidations = {
  page: query("page").optional().isInt({ min: 1 }).withMessage("Página debe ser un número mayor a 0"),
  limit: query("limit").optional().isInt({ min: 1, max: 100 }).withMessage("Límite debe estar entre 1 y 100"),
  search: query("search")
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("Búsqueda debe tener entre 2 y 100 caracteres"),
  role: query("role")
    .optional()
    .isIn([
      "ADMIN",
      "PATIENT",
      "DOCTOR",
      "SPECIALIST",
      "PSYCHOLOGIST",
      "NURSE",
      "ADMINISTRATIVE",
      "AUDITOR",
      "LABORATORY",
      "PHARMACY",
    ])
    .withMessage("Rol inválido"),
  status: query("status")
    .optional()
    .isIn(["ACTIVE", "INACTIVE", "SUSPENDED", "PENDING_VERIFICATION"])
    .withMessage("Estado inválido"),
}

module.exports = {
  handleValidationErrors,
  userValidations,
  patientValidations,
  appointmentValidations,
  paramValidations,
  queryValidations,
  validateCedula,
  validatePhone,
  validateEPS,
}
