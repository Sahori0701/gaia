const express = require("express")
const app = express()

app.use(express.json())

app.get("/", (req, res) => {
  res.json({
    message: "🏥 Gaia EPS API funcionando",
    status: "OK",
    timestamp: new Date().toISOString(),
  })
})

app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
  })
})

app.use("*", (req, res) => {
  res.status(404).json({
    error: "Ruta no encontrada",
    path: req.originalUrl,
  })
})

module.exports = app
