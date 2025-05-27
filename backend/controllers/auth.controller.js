const bcrypt = require("bcryptjs")
const { prisma } = require("../config/database")
const { generateTokenPair, verifyToken } = require("../config/auth")
const { logger, auditLog } = require("../config/logger")

// Importar validadores (crear función simple si no existe el archivo)
function validateCedulaColombia(cedula) {
  // Validación básica por ahora
  return cedula && cedula.length >= 6 && cedula.length <= 10
}

function validateColombianPhone(phone) {
  // Validación básica por ahora
  return !phone || phone.length >= 10
}

/**
 * Registro de nuevo usuario
 */
async function register(req, res) {
  try {
    const {
      email,
      password,
      confirmPassword,
      firstName,
      lastName,
      documentType,
      documentNumber,
      phone,
      role = "PATIENT",
    } = req.body

    // Validaciones básicas
    if (password !== confirmPassword) {
      return res.status(400).json({
        error: "Las contraseñas no coinciden",
        code: "PASSWORD_MISMATCH",
      })
    }

    if (password.length < 8) {
      return res.status(400).json({
        error: "La contraseña debe tener al menos 8 caracteres",
        code: "PASSWORD_TOO_SHORT",
      })
    }

    // Validaciones específicas para Colombia
    if (documentType === "CC" && !validateCedulaColombia(documentNumber)) {
      return res.status(400).json({
        error: "Número de cédula inválido",
        code: "INVALID_CEDULA",
      })
    }

    if (phone && !validateColombianPhone(phone)) {
      return res.status(400).json({
        error: "Número de teléfono inválido para Colombia",
        code: "INVALID_PHONE",
      })
    }

    // Verificar si el usuario ya existe
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email }, { documentNumber }],
      },
    })

    if (existingUser) {
      const field = existingUser.email === email ? "email" : "documento"
      return res.status(409).json({
        error: `Ya existe un usuario con este ${field}`,
        code: "USER_ALREADY_EXISTS",
        field,
      })
    }

    // Hash de la contraseña
    const hashedPassword = await bcrypt.hash(password, 12)

    // Crear usuario
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        firstName,
        lastName,
        documentType,
        documentNumber,
        phone,
        role,
        status: "PENDING_VERIFICATION",
      },
    })

    // Log de auditoría
    auditLog(
      "USER_REGISTERED",
      {
        userId: user.id,
        email: user.email,
        role: user.role,
        documentType: user.documentType,
      },
      user.id,
      req.ip,
    )

    // Respuesta sin contraseña
    const { password: _, ...userResponse } = user

    res.status(201).json({
      message: "Usuario registrado exitosamente",
      user: userResponse,
      nextStep: "Verificación de email pendiente",
    })
  } catch (error) {
    logger.error("Error en registro de usuario", {
      error: error.message,
      stack: error.stack,
      ip: req.ip,
    })

    res.status(500).json({
      error: "Error interno del servidor",
      code: "REGISTRATION_ERROR",
    })
  }
}

/**
 * Login de usuario
 */
async function login(req, res) {
  try {
    const { email, password } = req.body

    // Buscar usuario
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        patient: true,
        medicalProfessional: {
          include: {
            specialty: true,
          },
        },
      },
    })

    if (!user) {
      auditLog("LOGIN_ATTEMPT_USER_NOT_FOUND", { email }, null, req.ip)
      return res.status(401).json({
        error: "Credenciales inválidas",
        code: "INVALID_CREDENTIALS",
      })
    }

    // Verificar si la cuenta está bloqueada
    if (user.lockedUntil && new Date() < user.lockedUntil) {
      auditLog("LOGIN_ATTEMPT_LOCKED_ACCOUNT", { userId: user.id }, user.id, req.ip)
      return res.status(423).json({
        error: "Cuenta temporalmente bloqueada",
        code: "ACCOUNT_LOCKED",
        lockedUntil: user.lockedUntil,
      })
    }

    // Verificar contraseña
    const isValidPassword = await bcrypt.compare(password, user.password)

    if (!isValidPassword) {
      // Incrementar intentos fallidos
      const loginAttempts = user.loginAttempts + 1
      const updateData = { loginAttempts }

      // Bloquear cuenta después de 5 intentos
      if (loginAttempts >= 5) {
        updateData.lockedUntil = new Date(Date.now() + 30 * 60 * 1000) // 30 minutos
      }

      await prisma.user.update({
        where: { id: user.id },
        data: updateData,
      })

      auditLog("LOGIN_FAILED_INVALID_PASSWORD", { userId: user.id, attempts: loginAttempts }, user.id, req.ip)

      return res.status(401).json({
        error: "Credenciales inválidas",
        code: "INVALID_CREDENTIALS",
        attemptsRemaining: Math.max(0, 5 - loginAttempts),
      })
    }

    // Verificar estado del usuario
    if (user.status !== "ACTIVE") {
      auditLog("LOGIN_ATTEMPT_INACTIVE_USER", { userId: user.id, status: user.status }, user.id, req.ip)
      return res.status(403).json({
        error: "Usuario inactivo o pendiente de verificación",
        code: "USER_INACTIVE",
        status: user.status,
      })
    }

    // Login exitoso - resetear intentos fallidos
    await prisma.user.update({
      where: { id: user.id },
      data: {
        loginAttempts: 0,
        lockedUntil: null,
        lastLogin: new Date(),
      },
    })

    // Generar tokens
    const tokens = generateTokenPair(user)

    // Log de auditoría
    auditLog("LOGIN_SUCCESS", { userId: user.id, role: user.role }, user.id, req.ip)

    // Respuesta sin contraseña
    const { password: _, loginAttempts, lockedUntil, ...userResponse } = user

    res.json({
      message: "Login exitoso",
      user: userResponse,
      tokens,
    })
  } catch (error) {
    logger.error("Error en login", {
      error: error.message,
      stack: error.stack,
      ip: req.ip,
    })

    res.status(500).json({
      error: "Error interno del servidor",
      code: "LOGIN_ERROR",
    })
  }
}

/**
 * Refresh token
 */
async function refreshToken(req, res) {
  try {
    const { refreshToken } = req.body

    if (!refreshToken) {
      return res.status(401).json({
        error: "Refresh token requerido",
        code: "MISSING_REFRESH_TOKEN",
      })
    }

    // Verificar refresh token
    const decoded = verifyToken(refreshToken, "refresh")

    // Buscar usuario
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: {
        patient: true,
        medicalProfessional: {
          include: {
            specialty: true,
          },
        },
      },
    })

    if (!user || user.status !== "ACTIVE") {
      return res.status(401).json({
        error: "Usuario no válido",
        code: "INVALID_USER",
      })
    }

    // Generar nuevos tokens
    const tokens = generateTokenPair(user)

    auditLog("TOKEN_REFRESHED", { userId: user.id }, user.id, req.ip)

    res.json({
      message: "Token renovado exitosamente",
      tokens,
    })
  } catch (error) {
    logger.warn("Error en refresh token", {
      error: error.message,
      ip: req.ip,
    })

    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        error: "Refresh token expirado",
        code: "REFRESH_TOKEN_EXPIRED",
      })
    }

    res.status(401).json({
      error: "Refresh token inválido",
      code: "INVALID_REFRESH_TOKEN",
    })
  }
}

/**
 * Logout
 */
async function logout(req, res) {
  try {
    // En una implementación más avanzada, aquí se invalidaría el token
    // Por ahora, solo registramos el logout en auditoría

    auditLog("LOGOUT", { userId: req.user?.id }, req.user?.id, req.ip)

    res.json({
      message: "Logout exitoso",
    })
  } catch (error) {
    logger.error("Error en logout", {
      error: error.message,
      userId: req.user?.id,
      ip: req.ip,
    })

    res.status(500).json({
      error: "Error interno del servidor",
      code: "LOGOUT_ERROR",
    })
  }
}

/**
 * Obtener perfil del usuario actual
 */
async function getProfile(req, res) {
  try {
    const { password, loginAttempts, lockedUntil, ...userProfile } = req.user

    res.json({
      message: "Perfil obtenido exitosamente",
      user: userProfile,
    })
  } catch (error) {
    logger.error("Error obteniendo perfil", {
      error: error.message,
      userId: req.user?.id,
    })

    res.status(500).json({
      error: "Error obteniendo perfil",
      code: "PROFILE_ERROR",
    })
  }
}

/**
 * Cambiar contraseña
 */
async function changePassword(req, res) {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        error: "Las contraseñas nuevas no coinciden",
        code: "PASSWORD_MISMATCH",
      })
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        error: "La nueva contraseña debe tener al menos 8 caracteres",
        code: "PASSWORD_TOO_SHORT",
      })
    }

    // Verificar contraseña actual
    const isValidPassword = await bcrypt.compare(currentPassword, req.user.password)

    if (!isValidPassword) {
      auditLog("PASSWORD_CHANGE_FAILED_INVALID_CURRENT", { userId: req.user.id }, req.user.id, req.ip)
      return res.status(401).json({
        error: "Contraseña actual incorrecta",
        code: "INVALID_CURRENT_PASSWORD",
      })
    }

    // Hash de la nueva contraseña
    const hashedPassword = await bcrypt.hash(newPassword, 12)

    // Actualizar contraseña
    await prisma.user.update({
      where: { id: req.user.id },
      data: {
        password: hashedPassword,
        passwordChangedAt: new Date(),
      },
    })

    auditLog("PASSWORD_CHANGED", { userId: req.user.id }, req.user.id, req.ip)

    res.json({
      message: "Contraseña cambiada exitosamente",
    })
  } catch (error) {
    logger.error("Error cambiando contraseña", {
      error: error.message,
      userId: req.user?.id,
    })

    res.status(500).json({
      error: "Error cambiando contraseña",
      code: "PASSWORD_CHANGE_ERROR",
    })
  }
}

// IMPORTANTE: Exportar todas las funciones
module.exports = {
  register,
  login,
  refreshToken,
  logout,
  getProfile,
  changePassword,
}
