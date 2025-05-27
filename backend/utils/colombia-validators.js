// Validadores específicos para documentos y datos colombianos

/**
 * Valida número de cédula de ciudadanía colombiana
 * @param {string} cedula - Número de cédula
 * @returns {boolean} - True si es válida
 */
function validateCedulaColombia(cedula) {
  if (!cedula || typeof cedula !== "string") return false

  // Remover espacios y caracteres no numéricos
  const cleanCedula = cedula.replace(/\D/g, "")

  // Debe tener entre 6 y 10 dígitos
  if (cleanCedula.length < 6 || cleanCedula.length > 10) return false

  // Algoritmo de validación de cédula colombiana
  const digits = cleanCedula.split("").map(Number)
  const checkDigit = digits.pop()

  let sum = 0
  let multiplier = 2

  for (let i = digits.length - 1; i >= 0; i--) {
    let result = digits[i] * multiplier
    if (result > 9) {
      result = Math.floor(result / 10) + (result % 10)
    }
    sum += result
    multiplier = multiplier === 2 ? 1 : 2
  }

  const calculatedCheckDigit = (10 - (sum % 10)) % 10
  return calculatedCheckDigit === checkDigit
}

/**
 * Valida formato de teléfono colombiano
 * @param {string} phone - Número de teléfono
 * @returns {boolean} - True si es válido
 */
function validateColombianPhone(phone) {
  if (!phone || typeof phone !== "string") return false

  // Remover espacios y caracteres especiales
  const cleanPhone = phone.replace(/[\s\-$$$$]/g, "")

  // Patrones válidos para Colombia
  const patterns = [
    /^\+57[0-9]{10}$/, // +57 seguido de 10 dígitos
    /^57[0-9]{10}$/, // 57 seguido de 10 dígitos
    /^[0-9]{10}$/, // 10 dígitos (celular)
    /^[0-9]{7}$/, // 7 dígitos (fijo)
  ]

  return patterns.some((pattern) => pattern.test(cleanPhone))
}

/**
 * Valida departamento colombiano
 * @param {string} department - Nombre del departamento
 * @returns {boolean} - True si es válido
 */
function validateColombianDepartment(department) {
  const departments = [
    "Amazonas",
    "Antioquia",
    "Arauca",
    "Atlántico",
    "Bolívar",
    "Boyacá",
    "Caldas",
    "Caquetá",
    "Casanare",
    "Cauca",
    "Cesar",
    "Chocó",
    "Córdoba",
    "Cundinamarca",
    "Guainía",
    "Guaviare",
    "Huila",
    "La Guajira",
    "Magdalena",
    "Meta",
    "Nariño",
    "Norte de Santander",
    "Putumayo",
    "Quindío",
    "Risaralda",
    "San Andrés y Providencia",
    "Santander",
    "Sucre",
    "Tolima",
    "Valle del Cauca",
    "Vaupés",
    "Vichada",
    "Bogotá D.C.",
  ]

  return departments.includes(department)
}

/**
 * Valida código EPS colombiano
 * @param {string} epsCode - Código de la EPS
 * @returns {boolean} - True si es válido
 */
function validateEPSCode(epsCode) {
  if (!epsCode || typeof epsCode !== "string") return false

  // Formato: 3 letras seguidas de 3 números
  const pattern = /^[A-Z]{3}[0-9]{3}$/
  return pattern.test(epsCode.toUpperCase())
}

/**
 * Valida número de afiliación EPS
 * @param {string} affiliationNumber - Número de afiliación
 * @returns {boolean} - True si es válido
 */
function validateAffiliationNumber(affiliationNumber) {
  if (!affiliationNumber || typeof affiliationNumber !== "string") return false

  // Formato: EPS + 9 dígitos
  const pattern = /^EPS[0-9]{9}$/
  return pattern.test(affiliationNumber.toUpperCase())
}

/**
 * Valida código CIE-10 (Clasificación Internacional de Enfermedades)
 * @param {string} code - Código CIE-10
 * @returns {boolean} - True si es válido
 */
function validateCIE10Code(code) {
  if (!code || typeof code !== "string") return false

  // Formato CIE-10: Letra seguida de 2 dígitos, opcionalmente punto y más dígitos
  const pattern = /^[A-Z][0-9]{2}(\.[0-9]{1,2})?$/
  return pattern.test(code.toUpperCase())
}

/**
 * Valida edad mínima para diferentes tipos de documento
 * @param {Date} birthDate - Fecha de nacimiento
 * @param {string} documentType - Tipo de documento
 * @returns {boolean} - True si es válido
 */
function validateAgeForDocumentType(birthDate, documentType) {
  if (!birthDate || !documentType) return false

  const today = new Date()
  let age = today.getFullYear() - birthDate.getFullYear()
  const monthDiff = today.getMonth() - birthDate.getMonth()

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--
  }

  switch (documentType) {
    case "RC": // Registro Civil
      return age < 7
    case "TI": // Tarjeta de Identidad
      return age >= 7 && age < 18
    case "CC": // Cédula de Ciudadanía
      return age >= 18
    case "CE": // Cédula de Extranjería
      return age >= 18
    case "PA": // Pasaporte
      return age >= 0 // Sin restricción de edad
    default:
      return true
  }
}

/**
 * Genera número de afiliación EPS válido
 * @param {string} epsCode - Código de la EPS
 * @returns {string} - Número de afiliación generado
 */
function generateAffiliationNumber(epsCode = "EPS") {
  const randomNumber = Math.floor(Math.random() * 1000000000)
    .toString()
    .padStart(9, "0")
  return `${epsCode}${randomNumber}`
}

module.exports = {
  validateCedulaColombia,
  validateColombianPhone,
  validateColombianDepartment,
  validateEPSCode,
  validateAffiliationNumber,
  validateCIE10Code,
  validateAgeForDocumentType,
  generateAffiliationNumber,
}
