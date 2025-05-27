const { verifyToken } = require("../config/auth")
const { prisma } = require("../config/database")
const { logger, auditLog } = require("../config/logger")

/**
 * Middleware de autenticación JWT
 */
async function authenticateToken(req, res, next) {
  try {
    const authHeader = req.headers.authorization
    const token = authHeader && authHeader.split(" ")[1] // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        error: "Token de acceso requerido",
        code: "MISSING_TOKEN",
      })
    }

    // Verificar el token
    const decoded = verifyToken(token, "access")

    // Buscar el usuario en la base de datos
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

    if (!user) {
      auditLog("INVALID_TOKEN_USER_NOT_FOUND", { userId: decoded.userId }, null, req.ip)
      return res.status(401).json({
        error: "Usuario no encontrado",
        code: "USER_NOT_FOUND",
      })
    }

    // Verificar que el usuario esté activo
    if (user.status !== "ACTIVE") {
      auditLog("BLOCKED_USER_ACCESS_ATTEMPT", { userId: user.id, status: user.status }, user.id, req.ip)
      return res.status(403).json({
        error: "Usuario inactivo o suspendido",
        code: "USER_INACTIVE",
      })
    }

    // Verificar si la cuenta está bloqueada
    if (user.lockedUntil && new Date() < user.lockedUntil) {
      auditLog("LOCKED_USER_ACCESS_ATTEMPT", { userId: user.id, lockedUntil: user.lockedUntil }, user.id, req.ip)
      return res.status(423).json({
        error: "Cuenta temporalmente bloqueada",
        code: "ACCOUNT_LOCKED",
        lockedUntil: user.lockedUntil,
      })
    }

    // Actualizar último acceso
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    })

    // Agregar usuario a la request
    req.user = user
    req.token = decoded

    next()
  } catch (error) {
    logger.warn("Authentication failed", {
      error: error.message,
      ip: req.ip,
      userAgent: req.get("User-Agent"),
    })

    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        error: "Token expirado",
        code: "TOKEN_EXPIRED",
      })
    }

    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        error: "Token inválido",
        code: "INVALID_TOKEN",
      })
    }

    return res.status(401).json({
      error: "Error de autenticación",
      code: "AUTH_ERROR",
    })
  }
}

/**
 * Middleware de autorización por roles
 * @param {string[]} allowedRoles - Roles permitidos
 */
function authorizeRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: "Usuario no autenticado",
        code: "NOT_AUTHENTICATED",
      })
    }

    if (!allowedRoles.includes(req.user.role)) {
      auditLog(
        "UNAUTHORIZED_ACCESS_ATTEMPT",
        {
          requiredRoles: allowedRoles,
          userRole: req.user.role,
          resource: req.originalUrl,
        },
        req.user.id,
        req.ip,
      )

      return res.status(403).json({
        error: "No tienes permisos para acceder a este recurso",
        code: "INSUFFICIENT_PERMISSIONS",
        requiredRoles: allowedRoles,
        userRole: req.user.role,
      })
    }

    next()
  }
}

/**
 * Middleware opcional de autenticación (no falla si no hay token)
 */
async function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization
    const token = authHeader && authHeader.split(" ")[1]

    if (token) {
      const decoded = verifyToken(token, "access")
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

      if (user && user.status === "ACTIVE") {
        req.user = user
        req.token = decoded
      }
    }

    next()
  } catch (error) {
    // En auth opcional, continuamos sin usuario
    next()
  }
}

/**
 * Middleware de auditoría para cumplir normativas colombianas
 */
const auditMiddleware = (req, res, next) => {
  // Capturar información de la request
  const startTime = Date.now()
  const originalSend = res.send

  // Override del método send para capturar la response
  res.send = function (data) {
    const responseTime = Date.now() - startTime

    // Log de auditoría para todas las requests a la API
    if (req.path.startsWith("/api/")) {
      auditLog(
        "API_REQUEST",
        {
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          responseTime: `${responseTime}ms`,
          userAgent: req.get("User-Agent"),
          contentLength: data ? data.length : 0,
          query: req.query,
          // No loggear el body completo por seguridad, solo metadata
          hasBody: !!req.body && Object.keys(req.body).length > 0,
        },
        req.user?.id || null,
        req.ip,
      )
    }

    // Llamar al método original
    originalSend.call(this, data)
  }

  next()
}

module.exports = {
  authenticateToken,
  authorizeRoles,
  optionalAuth,
  auditMiddleware,
}
