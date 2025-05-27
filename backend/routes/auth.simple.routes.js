const express = require("express")
const { authenticateToken } = require("../middleware/auth.middleware")
const { register, login, refreshToken, logout, getProfile, changePassword } = require("../controllers/auth.controller")

const router = express.Router()

// ===== RUTAS PÚBLICAS =====
router.post("/register", register)
router.post("/login", login)
router.post("/refresh", refreshToken)

// ===== RUTAS PROTEGIDAS =====
router.post("/logout", authenticateToken, logout)
router.get("/profile", authenticateToken, getProfile)
router.put("/change-password", authenticateToken, changePassword)

// ===== RUTAS DE PRUEBA =====
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
