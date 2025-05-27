const net = require("net")

/**
 * Encuentra un puerto disponible
 * @param {number} startPort - Puerto inicial para buscar
 * @returns {Promise<number>} - Puerto disponible
 */
function findAvailablePort(startPort = 3000) {
  return new Promise((resolve, reject) => {
    const server = net.createServer()

    server.listen(startPort, () => {
      const port = server.address().port
      server.close(() => {
        resolve(port)
      })
    })

    server.on("error", (err) => {
      if (err.code === "EADDRINUSE") {
        // Si el puerto está en uso, probar el siguiente
        findAvailablePort(startPort + 1)
          .then(resolve)
          .catch(reject)
      } else {
        reject(err)
      }
    })
  })
}

module.exports = { findAvailablePort }
