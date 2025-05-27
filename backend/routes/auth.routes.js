const express = require("express")
const { body, validationResult } = require("express-validator")
const { authenticateToken } = require("../middleware/auth.middleware")

// Importar controladores
const authController = require("../controllers/auth.controller")
const { register, login, refreshToken, logout, getProfile, changePassword } = authController

const router = express.Router()

// Middleware para manejar errores de validación
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: "Datos de entrada inválidos",
      code: "VALIDATION_ERROR",
      details: errors.array(),
    })
  }
  next()
}

// Validaciones para registro
const registerValidation = [
  body("email").isEmail().normalizeEmail().withMessage("Email inválido"),

  body("password")
    .isLength({ min: 8 })
    .withMessage("La contraseña debe tener al menos 8 caracteres")
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage("La contraseña debe contener al menos: 1 minúscula, 1 mayúscula, 1 número y 1 carácter especial"),

  body("confirmPassword").custom((value, { req }) => {
    if (value !== req.body.password) {
      throw new Error("Las contraseñas no coinciden")
    }
    return true
  }),

  body("firstName").trim().isLength({ min: 2, max: 50 }).withMessage("Nombre debe tener entre 2 y 50 caracteres"),

  body("lastName").trim().isLength({ min: 2, max: 50 }).withMessage("Apellido debe tener entre 2 y 50 caracteres"),

  body("documentType").isIn(["CC", "TI", "CE", "PA", "RC", "MS", "AS"]).withMessage("Tipo de documento inválido"),

  body("documentNumber").trim().isLength({ min: 6, max: 15 }).withMessage("Número de documento inválido"),

  body("phone").optional().isMobilePhone("es-CO").withMessage("Número de teléfono inválido para Colombia"),

  body("role")
    .optional()
    .isIn(["PATIENT", "DOCTOR", "SPECIALIST", "PSYCHOLOGIST", "NURSE", "ADMINISTRATIVE"])
    .withMessage("Rol inválido"),
]

// Validaciones para login
const loginValidation = [
  body("email").isEmail().normalizeEmail().withMessage("Email inválido"),

  body("password").notEmpty().withMessage("Contraseña requerida"),
]

// Validaciones para cambio de contraseña
const changePasswordValidation = [
  body("currentPassword").notEmpty().withMessage("Contraseña actual requerida"),

  body("newPassword")
    .isLength({ min: 8 })
    .withMessage("La nueva contraseña debe tener al menos 8 caracteres")
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage(
      "La nueva contraseña debe contener al menos: 1 minúscula, 1 mayúscula, 1 número y 1 carácter especial",
    ),

  body("confirmPassword").custom((value, { req }) => {
    if (value !== req.body.newPassword) {
      throw new Error("Las contraseñas nuevas no coinciden")
    }
    return true
  }),
]

// ===== RUTAS PÚBLICAS =====

/**
 * @route   POST /api/auth/register
 * @desc    Registrar nuevo usuario
 * @access  Public
 */
router.post("/register", registerValidation, handleValidationErrors, register)

/**
 * @route   POST /api/auth/login
 * @desc    Login de usuario
 * @access  Public
 */
router.post("/login", loginValidation, handleValidationErrors, login)

/**
 * @route   POST /api/auth/refresh
 * @desc    Renovar access token
 * @access  Public
 */
router.post("/refresh", refreshToken)

// ===== RUTAS PROTEGIDAS =====

/**
 * @route   POST /api/auth/logout
 * @desc    Logout de usuario
 * @access  Private
 */
router.post("/logout", authenticateToken, logout)

/**
 * @route   GET /api/auth/profile
 * @desc    Obtener perfil del usuario actual
 * @access  Private
 */
router.get("/profile", authenticateToken, getProfile)

/**
 * @route   PUT /api/auth/change-password
 * @desc    Cambiar contraseña
 * @access  Private
 */
router.put("/change-password", authenticateToken, changePasswordValidation, handleValidationErrors, changePassword)

// ===== RUTAS DE PRUEBA =====

/**
 * @route   GET /api/auth/test/protected
 * @desc    Ruta de prueba protegida
 * @access  Private
 */
router.get("/test/protected", authenticateToken, (req, res) => {
  res.json({
    message: "✅ Acceso autorizado a ruta protegida",
    user: {
      id: req.user.id,
      email: req.user.email,
      role: req.user.role,
      firstName: req.user.firstName,
      lastName: req.user.lastName,
    },
    timestamp: new Date().toISOString(),
  })
})

module.exports = router
