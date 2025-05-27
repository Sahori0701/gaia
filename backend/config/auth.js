const jwt = require("jsonwebtoken")
const { logger } = require("./logger")

// Configuración JWT
const JWT_CONFIG = {
  secret: process.env.JWT_SECRET,
  refreshSecret: process.env.JWT_REFRESH_SECRET,
  expiresIn: process.env.JWT_EXPIRE || "24h",
  refreshExpiresIn: process.env.JWT_REFRESH_EXPIRE || "7d",
  issuer: "gaia-eps",
  audience: "gaia-users",
}

/**
 * Genera un token JWT
 * @param {Object} payload - Datos del usuario
 * @param {string} type - Tipo de token ('access' | 'refresh')
 * @returns {string} - Token JWT
 */
function generateToken(payload, type = "access") {
  const secret = type === "refresh" ? JWT_CONFIG.refreshSecret : JWT_CONFIG.secret
  const expiresIn = type === "refresh" ? JWT_CONFIG.refreshExpiresIn : JWT_CONFIG.expiresIn

  return jwt.sign(
    {
      ...payload,
      type,
      iat: Math.floor(Date.now() / 1000),
    },
    secret,
    {
      expiresIn,
      issuer: JWT_CONFIG.issuer,
      audience: JWT_CONFIG.audience,
    },
  )
}

/**
 * Verifica un token JWT
 * @param {string} token - Token a verificar
 * @param {string} type - Tipo de token ('access' | 'refresh')
 * @returns {Object} - Payload decodificado
 */
function verifyToken(token, type = "access") {
  try {
    const secret = type === "refresh" ? JWT_CONFIG.refreshSecret : JWT_CONFIG.secret

    const decoded = jwt.verify(token, secret, {
      issuer: JWT_CONFIG.issuer,
      audience: JWT_CONFIG.audience,
    })

    // Verificar que el tipo de token coincida
    if (decoded.type !== type) {
      throw new Error(`Token type mismatch. Expected ${type}, got ${decoded.type}`)
    }

    return decoded
  } catch (error) {
    logger.warn("Token verification failed", {
      error: error.message,
      tokenType: type,
    })
    throw error
  }
}

/**
 * Genera par de tokens (access + refresh)
 * @param {Object} user - Datos del usuario
 * @returns {Object} - Tokens generados
 */
function generateTokenPair(user) {
  const payload = {
    userId: user.id,
    email: user.email,
    role: user.role,
    status: user.status,
  }

  const accessToken = generateToken(payload, "access")
  const refreshToken = generateToken({ userId: user.id }, "refresh")

  return {
    accessToken,
    refreshToken,
    expiresIn: JWT_CONFIG.expiresIn,
    tokenType: "Bearer",
  }
}

module.exports = {
  JWT_CONFIG,
  generateToken,
  verifyToken,
  generateTokenPair,
}
