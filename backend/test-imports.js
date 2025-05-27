// Archivo de prueba para verificar imports
console.log("=== TESTING IMPORTS ===")

try {
  console.log("1. Testing auth controller...")
  const authController = require("./controllers/auth.controller")
  console.log("Auth controller functions:", Object.keys(authController))

  console.log("2. Testing auth middleware...")
  const authMiddleware = require("./middleware/auth.middleware")
  console.log("Auth middleware functions:", Object.keys(authMiddleware))

  console.log("3. Testing config files...")
  const authConfig = require("./config/auth")
  console.log("Auth config functions:", Object.keys(authConfig))

  const logger = require("./config/logger")
  console.log("Logger functions:", Object.keys(logger))

  console.log("4. Testing database...")
  const database = require("./config/database")
  console.log("Database functions:", Object.keys(database))

  console.log("✅ All imports successful!")
} catch (error) {
  console.error("❌ Import error:", error.message)
  console.error("Stack:", error.stack)
}
