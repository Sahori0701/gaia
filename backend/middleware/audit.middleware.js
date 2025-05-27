const { auditLog } = require("../config/logger")

// Middleware de auditoría para cumplir normativas colombianas
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
  auditMiddleware,
}
