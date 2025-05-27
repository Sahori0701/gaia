const http = require("http")

// Configuración de pruebas
const BASE_URL = "http://localhost:5000"

// Función helper para hacer requests
function makeRequest(path, method = "GET", data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL)
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Gaia-Test-Client/1.0",
      },
    }

    const req = http.request(options, (res) => {
      let body = ""
      res.on("data", (chunk) => (body += chunk))
      res.on("end", () => {
        try {
          const jsonBody = JSON.parse(body)
          resolve({ status: res.statusCode, data: jsonBody, headers: res.headers })
        } catch (e) {
          resolve({ status: res.statusCode, data: body, headers: res.headers })
        }
      })
    })

    req.on("error", reject)

    if (data) {
      req.write(JSON.stringify(data))
    }

    req.end()
  })
}

// Función para ejecutar pruebas
async function runTests() {
  console.log("🧪 ===== PRUEBAS DEL SERVIDOR GAIA =====\n")

  const tests = [
    {
      name: "Health Check",
      path: "/health",
      expectedStatus: 200,
    },
    {
      name: "Información del Sistema",
      path: "/api/info",
      expectedStatus: 200,
    },
    {
      name: "Test de Autenticación",
      path: "/api/test/auth",
      expectedStatus: 200,
    },
    {
      name: "Test de Base de Datos",
      path: "/api/test/database",
      expectedStatus: 200,
    },
    {
      name: "Ruta No Encontrada",
      path: "/api/ruta-inexistente",
      expectedStatus: 404,
    },
  ]

  let passed = 0
  let failed = 0

  for (const test of tests) {
    try {
      console.log(`🔍 Probando: ${test.name}`)
      const response = await makeRequest(test.path)

      if (response.status === test.expectedStatus) {
        console.log(`✅ PASÓ - Status: ${response.status}`)
        console.log(`   Respuesta: ${JSON.stringify(response.data, null, 2).substring(0, 100)}...\n`)
        passed++
      } else {
        console.log(`❌ FALLÓ - Esperado: ${test.expectedStatus}, Recibido: ${response.status}`)
        console.log(`   Respuesta: ${JSON.stringify(response.data, null, 2)}\n`)
        failed++
      }
    } catch (error) {
      console.log(`❌ ERROR - ${test.name}: ${error.message}\n`)
      failed++
    }
  }

  // Prueba POST para auditoría
  try {
    console.log("🔍 Probando: Test de Auditoría (POST)")
    const auditResponse = await makeRequest("/api/test/audit", "POST", {
      action: "test_audit",
      details: "Prueba del sistema de auditoría desde test automatizado",
    })

    if (auditResponse.status === 200) {
      console.log("✅ PASÓ - Test de Auditoría")
      console.log(`   Respuesta: ${JSON.stringify(auditResponse.data, null, 2)}\n`)
      passed++
    } else {
      console.log(`❌ FALLÓ - Test de Auditoría: ${auditResponse.status}`)
      failed++
    }
  } catch (error) {
    console.log(`❌ ERROR - Test de Auditoría: ${error.message}\n`)
    failed++
  }

  // Resumen
  console.log("📊 ===== RESUMEN DE PRUEBAS =====")
  console.log(`✅ Pruebas pasadas: ${passed}`)
  console.log(`❌ Pruebas fallidas: ${failed}`)
  console.log(`📈 Total: ${passed + failed}`)
  console.log(`🎯 Porcentaje de éxito: ${((passed / (passed + failed)) * 100).toFixed(1)}%`)

  if (failed === 0) {
    console.log("\n🎉 ¡Todas las pruebas pasaron! El servidor está funcionando correctamente.")
  } else {
    console.log("\n⚠️  Algunas pruebas fallaron. Revisa la configuración del servidor.")
  }
}

// Ejecutar pruebas si el archivo se ejecuta directamente
if (require.main === module) {
  runTests().catch(console.error)
}

module.exports = { makeRequest, runTests }
