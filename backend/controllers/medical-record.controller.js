const { prisma } = require("../config/database")
const { logger } = require("../config/logger")
const CryptoJS = require("crypto-js")

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || "gaia-default-key-32-characters"

// Función para encriptar datos sensibles
const encryptSensitiveData = (data) => {
  if (!data) return data
  return CryptoJS.AES.encrypt(JSON.stringify(data), ENCRYPTION_KEY).toString()
}

// Función para desencriptar datos sensibles
const decryptSensitiveData = (encryptedData) => {
  if (!encryptedData) return null
  try {
    const bytes = CryptoJS.AES.decrypt(encryptedData, ENCRYPTION_KEY)
    return JSON.parse(bytes.toString(CryptoJS.enc.Utf8))
  } catch (error) {
    logger.error("Error desencriptando datos", { error: error.message })
    return null
  }
}

// Obtener registros médicos con filtros
const getMedicalRecords = async (req, res) => {
  try {
    const { page = 1, limit = 10, patientId, appointmentId, recordType, startDate, endDate, search } = req.query

    const skip = (Number.parseInt(page) - 1) * Number.parseInt(limit)
    const take = Number.parseInt(limit)

    // Construir filtros
    const where = {}

    if (patientId) where.patientId = patientId
    if (appointmentId) where.appointmentId = appointmentId
    if (recordType) where.recordType = recordType

    // Filtro por rango de fechas
    if (startDate || endDate) {
      where.createdAt = {}
      if (startDate) where.createdAt.gte = new Date(startDate)
      if (endDate) where.createdAt.lte = new Date(endDate)
    }

    // Búsqueda en diagnóstico o notas
    if (search) {
      where.OR = [
        { diagnosis: { contains: search, mode: "insensitive" } },
        { notes: { contains: search, mode: "insensitive" } },
        { treatment: { contains: search, mode: "insensitive" } },
      ]
    }

    // Restricciones por rol
    if (req.user.role === "PATIENT") {
      where.patientId = req.user.patient?.id
    } else if (["DOCTOR", "SPECIALIST", "PSYCHOLOGIST"].includes(req.user.role)) {
      // Los médicos pueden ver registros de sus pacientes
      where.OR = [
        { createdById: req.user.id },
        {
          appointment: {
            medicalProfessionalId: req.user.medicalProfessional?.id,
          },
        },
      ]
    }

    const [medicalRecords, total] = await Promise.all([
      prisma.medicalRecord.findMany({
        where,
        skip,
        take,
        include: {
          patient: {
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  documentType: true,
                  documentNumber: true,
                  birthDate: true,
                  gender: true,
                },
              },
            },
          },
          appointment: {
            include: {
              specialty: {
                select: {
                  id: true,
                  name: true,
                  code: true,
                },
              },
              medicalProfessional: {
                include: {
                  user: {
                    select: {
                      id: true,
                      firstName: true,
                      lastName: true,
                    },
                  },
                  specialty: {
                    select: {
                      id: true,
                      name: true,
                      code: true,
                    },
                  },
                },
              },
            },
          },
          createdBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              role: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.medicalRecord.count({ where }),
    ])

    // Desencriptar datos sensibles si es necesario
    const decryptedRecords = medicalRecords.map((record) => {
      if (record.encryptedData) {
        const decryptedData = decryptSensitiveData(record.encryptedData)
        return {
          ...record,
          sensitiveData: decryptedData,
          encryptedData: undefined, // No enviar datos encriptados al cliente
        }
      }
      return record
    })

    const totalPages = Math.ceil(total / take)

    logger.info("Registros médicos obtenidos", {
      userId: req.user.id,
      role: req.user.role,
      total,
      page,
      filters: { patientId, appointmentId, recordType },
    })

    res.status(200).json({
      success: true,
      data: decryptedRecords,
      pagination: {
        page: Number.parseInt(page),
        limit: take,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    })
  } catch (error) {
    logger.error("Error obteniendo registros médicos", {
      error: error.message,
      userId: req.user?.id,
      stack: error.stack,
    })

    res.status(500).json({
      success: false,
      error: "Error interno del servidor",
      message: "No se pudieron obtener los registros médicos",
    })
  }
}

// Obtener registro médico por ID
const getMedicalRecordById = async (req, res) => {
  try {
    const { id } = req.params

    const medicalRecord = await prisma.medicalRecord.findUnique({
      where: { id },
      include: {
        patient: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                documentType: true,
                documentNumber: true,
                birthDate: true,
                gender: true,
                phone: true,
                email: true,
              },
            },
          },
        },
        appointment: {
          include: {
            specialty: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
            medicalProfessional: {
              include: {
                user: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                  },
                },
                specialty: {
                  select: {
                    id: true,
                    name: true,
                    code: true,
                  },
                },
              },
            },
          },
        },
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
      },
    })

    if (!medicalRecord) {
      return res.status(404).json({
        success: false,
        error: "Registro médico no encontrado",
        message: "El registro médico solicitado no existe",
      })
    }

    // Verificar permisos
    const canAccess =
      req.user.role === "ADMIN" ||
      (req.user.role === "PATIENT" && medicalRecord.patientId === req.user.patient?.id) ||
      (["DOCTOR", "SPECIALIST", "PSYCHOLOGIST"].includes(req.user.role) &&
        (medicalRecord.createdById === req.user.id ||
          medicalRecord.appointment?.medicalProfessionalId === req.user.medicalProfessional?.id))

    if (!canAccess) {
      return res.status(403).json({
        success: false,
        error: "Acceso denegado",
        message: "No tienes permisos para ver este registro médico",
      })
    }

    // Desencriptar datos sensibles
    const decryptedRecord = { ...medicalRecord }
    if (medicalRecord.encryptedData) {
      const decryptedData = decryptSensitiveData(medicalRecord.encryptedData)
      decryptedRecord.sensitiveData = decryptedData
      decryptedRecord.encryptedData = undefined
    }

    logger.info("Registro médico obtenido por ID", {
      recordId: id,
      userId: req.user.id,
      role: req.user.role,
    })

    res.status(200).json({
      success: true,
      data: decryptedRecord,
    })
  } catch (error) {
    logger.error("Error obteniendo registro médico por ID", {
      error: error.message,
      recordId: req.params.id,
      userId: req.user?.id,
      stack: error.stack,
    })

    res.status(500).json({
      success: false,
      error: "Error interno del servidor",
      message: "No se pudo obtener el registro médico",
    })
  }
}

// Crear nuevo registro médico
const createMedicalRecord = async (req, res) => {
  try {
    const {
      patientId,
      appointmentId,
      recordType = "CONSULTATION",
      diagnosis,
      treatment,
      notes,
      symptoms,
      vitalSigns,
      medications,
      allergies,
      familyHistory,
      personalHistory,
      physicalExam,
      labResults,
      imagingResults,
      recommendations,
      followUpDate,
      icd10Codes,
      sensitiveData,
    } = req.body

    // Validaciones básicas
    if (!patientId || !diagnosis) {
      return res.status(400).json({
        success: false,
        error: "Datos incompletos",
        message: "Se requiere patientId y diagnosis",
      })
    }

    // Verificar que el paciente existe
    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
      include: { user: true },
    })

    if (!patient) {
      return res.status(404).json({
        success: false,
        error: "Paciente no encontrado",
        message: "El paciente especificado no existe",
      })
    }

    // Verificar que la cita existe (si se proporciona)
    let appointment = null
    if (appointmentId) {
      appointment = await prisma.appointment.findUnique({
        where: { id: appointmentId },
        include: { medicalProfessional: true },
      })

      if (!appointment) {
        return res.status(404).json({
          success: false,
          error: "Cita no encontrada",
          message: "La cita especificada no existe",
        })
      }

      // Verificar que el médico de la cita coincide con el usuario actual
      if (
        ["DOCTOR", "SPECIALIST", "PSYCHOLOGIST"].includes(req.user.role) &&
        appointment.medicalProfessionalId !== req.user.medicalProfessional?.id
      ) {
        return res.status(403).json({
          success: false,
          error: "Acceso denegado",
          message: "No puedes crear registros para citas de otros médicos",
        })
      }
    }

    // Encriptar datos sensibles si se proporcionan
    let encryptedData = null
    if (sensitiveData) {
      encryptedData = encryptSensitiveData(sensitiveData)
    }

    // Crear el registro médico
    const medicalRecord = await prisma.medicalRecord.create({
      data: {
        patientId,
        appointmentId,
        recordType,
        diagnosis,
        treatment,
        notes,
        symptoms: symptoms ? JSON.stringify(symptoms) : null,
        vitalSigns: vitalSigns ? JSON.stringify(vitalSigns) : null,
        medications: medications ? JSON.stringify(medications) : null,
        allergies: allergies ? JSON.stringify(allergies) : null,
        familyHistory: familyHistory ? JSON.stringify(familyHistory) : null,
        personalHistory: personalHistory ? JSON.stringify(personalHistory) : null,
        physicalExam: physicalExam ? JSON.stringify(physicalExam) : null,
        labResults: labResults ? JSON.stringify(labResults) : null,
        imagingResults: imagingResults ? JSON.stringify(imagingResults) : null,
        recommendations: recommendations ? JSON.stringify(recommendations) : null,
        followUpDate: followUpDate ? new Date(followUpDate) : null,
        icd10Codes: icd10Codes ? JSON.stringify(icd10Codes) : null,
        encryptedData,
        createdById: req.user.id,
      },
      include: {
        patient: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                documentType: true,
                documentNumber: true,
              },
            },
          },
        },
        appointment: {
          include: {
            specialty: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
          },
        },
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
      },
    })

    // Actualizar el estado de la cita si existe
    if (appointmentId && appointment) {
      await prisma.appointment.update({
        where: { id: appointmentId },
        data: { status: "COMPLETED" },
      })
    }

    logger.info("Registro médico creado exitosamente", {
      recordId: medicalRecord.id,
      patientId,
      appointmentId,
      recordType,
      createdBy: req.user.id,
    })

    res.status(201).json({
      success: true,
      message: "Registro médico creado exitosamente",
      data: {
        ...medicalRecord,
        encryptedData: undefined, // No enviar datos encriptados
        sensitiveData: sensitiveData || null,
      },
    })
  } catch (error) {
    logger.error("Error creando registro médico", {
      error: error.message,
      userId: req.user?.id,
      requestBody: req.body,
      stack: error.stack,
    })

    res.status(500).json({
      success: false,
      error: "Error interno del servidor",
      message: "No se pudo crear el registro médico",
    })
  }
}

// Actualizar registro médico
const updateMedicalRecord = async (req, res) => {
  try {
    const { id } = req.params
    const {
      diagnosis,
      treatment,
      notes,
      symptoms,
      vitalSigns,
      medications,
      allergies,
      familyHistory,
      personalHistory,
      physicalExam,
      labResults,
      imagingResults,
      recommendations,
      followUpDate,
      icd10Codes,
      sensitiveData,
    } = req.body

    // Verificar que el registro existe
    const existingRecord = await prisma.medicalRecord.findUnique({
      where: { id },
      include: {
        appointment: {
          include: { medicalProfessional: true },
        },
      },
    })

    if (!existingRecord) {
      return res.status(404).json({
        success: false,
        error: "Registro médico no encontrado",
        message: "El registro médico especificado no existe",
      })
    }

    // Verificar permisos (solo el creador o admin pueden actualizar)
    const canUpdate = req.user.role === "ADMIN" || existingRecord.createdById === req.user.id

    if (!canUpdate) {
      return res.status(403).json({
        success: false,
        error: "Acceso denegado",
        message: "No tienes permisos para actualizar este registro médico",
      })
    }

    // Preparar datos de actualización
    const updateData = {}

    if (diagnosis) updateData.diagnosis = diagnosis
    if (treatment) updateData.treatment = treatment
    if (notes !== undefined) updateData.notes = notes
    if (symptoms) updateData.symptoms = JSON.stringify(symptoms)
    if (vitalSigns) updateData.vitalSigns = JSON.stringify(vitalSigns)
    if (medications) updateData.medications = JSON.stringify(medications)
    if (allergies) updateData.allergies = JSON.stringify(allergies)
    if (familyHistory) updateData.familyHistory = JSON.stringify(familyHistory)
    if (personalHistory) updateData.personalHistory = JSON.stringify(personalHistory)
    if (physicalExam) updateData.physicalExam = JSON.stringify(physicalExam)
    if (labResults) updateData.labResults = JSON.stringify(labResults)
    if (imagingResults) updateData.imagingResults = JSON.stringify(imagingResults)
    if (recommendations) updateData.recommendations = JSON.stringify(recommendations)
    if (followUpDate) updateData.followUpDate = new Date(followUpDate)
    if (icd10Codes) updateData.icd10Codes = JSON.stringify(icd10Codes)

    // Encriptar datos sensibles si se proporcionan
    if (sensitiveData) {
      updateData.encryptedData = encryptSensitiveData(sensitiveData)
    }

    // Actualizar el registro
    const updatedRecord = await prisma.medicalRecord.update({
      where: { id },
      data: updateData,
      include: {
        patient: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                documentType: true,
                documentNumber: true,
              },
            },
          },
        },
        appointment: {
          include: {
            specialty: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
          },
        },
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
      },
    })

    logger.info("Registro médico actualizado exitosamente", {
      recordId: id,
      updatedFields: Object.keys(updateData),
      updatedBy: req.user.id,
    })

    res.status(200).json({
      success: true,
      message: "Registro médico actualizado exitosamente",
      data: {
        ...updatedRecord,
        encryptedData: undefined,
        sensitiveData: sensitiveData || null,
      },
    })
  } catch (error) {
    logger.error("Error actualizando registro médico", {
      error: error.message,
      recordId: req.params.id,
      userId: req.user?.id,
      stack: error.stack,
    })

    res.status(500).json({
      success: false,
      error: "Error interno del servidor",
      message: "No se pudo actualizar el registro médico",
    })
  }
}

// Obtener historia clínica completa de un paciente
const getPatientMedicalHistory = async (req, res) => {
  try {
    const { patientId } = req.params
    const { recordType, startDate, endDate } = req.query

    // Verificar que el paciente existe
    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            documentType: true,
            documentNumber: true,
            birthDate: true,
            gender: true,
            phone: true,
            email: true,
          },
        },
      },
    })

    if (!patient) {
      return res.status(404).json({
        success: false,
        error: "Paciente no encontrado",
        message: "El paciente especificado no existe",
      })
    }

    // Verificar permisos
    const canAccess =
      req.user.role === "ADMIN" ||
      (req.user.role === "PATIENT" && patientId === req.user.patient?.id) ||
      ["DOCTOR", "SPECIALIST", "PSYCHOLOGIST"].includes(req.user.role)

    if (!canAccess) {
      return res.status(403).json({
        success: false,
        error: "Acceso denegado",
        message: "No tienes permisos para ver la historia clínica de este paciente",
      })
    }

    // Construir filtros
    const where = { patientId }

    if (recordType) where.recordType = recordType

    if (startDate || endDate) {
      where.createdAt = {}
      if (startDate) where.createdAt.gte = new Date(startDate)
      if (endDate) where.createdAt.lte = new Date(endDate)
    }

    // Obtener registros médicos
    const medicalRecords = await prisma.medicalRecord.findMany({
      where,
      include: {
        appointment: {
          include: {
            specialty: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
            medicalProfessional: {
              include: {
                user: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                  },
                },
                specialty: {
                  select: {
                    id: true,
                    name: true,
                    code: true,
                  },
                },
              },
            },
          },
        },
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    // Desencriptar datos sensibles
    const decryptedRecords = medicalRecords.map((record) => {
      const decryptedRecord = { ...record }
      if (record.encryptedData) {
        const decryptedData = decryptSensitiveData(record.encryptedData)
        decryptedRecord.sensitiveData = decryptedData
        decryptedRecord.encryptedData = undefined
      }
      return decryptedRecord
    })

    // Obtener estadísticas de la historia clínica
    const stats = {
      totalRecords: medicalRecords.length,
      recordsByType: await prisma.medicalRecord.groupBy({
        by: ["recordType"],
        where: { patientId },
        _count: { recordType: true },
      }),
      lastVisit: medicalRecords.length > 0 ? medicalRecords[0].createdAt : null,
      totalAppointments: await prisma.appointment.count({
        where: { patientId },
      }),
    }

    logger.info("Historia clínica obtenida", {
      patientId,
      recordsCount: medicalRecords.length,
      userId: req.user.id,
      role: req.user.role,
    })

    res.status(200).json({
      success: true,
      data: {
        patient,
        medicalRecords: decryptedRecords,
        stats,
      },
    })
  } catch (error) {
    logger.error("Error obteniendo historia clínica", {
      error: error.message,
      patientId: req.params.patientId,
      userId: req.user?.id,
      stack: error.stack,
    })

    res.status(500).json({
      success: false,
      error: "Error interno del servidor",
      message: "No se pudo obtener la historia clínica",
    })
  }
}

// Obtener estadísticas de registros médicos
const getMedicalRecordStats = async (req, res) => {
  try {
    const { startDate, endDate, patientId, recordType } = req.query

    // Construir filtros base
    const where = {}

    if (startDate || endDate) {
      where.createdAt = {}
      if (startDate) where.createdAt.gte = new Date(startDate)
      if (endDate) where.createdAt.lte = new Date(endDate)
    }

    if (patientId) where.patientId = patientId
    if (recordType) where.recordType = recordType

    // Restricciones por rol
    if (req.user.role === "PATIENT") {
      where.patientId = req.user.patient?.id
    } else if (["DOCTOR", "SPECIALIST", "PSYCHOLOGIST"].includes(req.user.role)) {
      where.createdById = req.user.id
    }

    const [totalRecords, recordsByType, recordsByMonth, recentRecords] = await Promise.all([
      // Total de registros
      prisma.medicalRecord.count({ where }),

      // Registros por tipo
      prisma.medicalRecord.groupBy({
        by: ["recordType"],
        where,
        _count: { recordType: true },
      }),

      // Registros por mes (últimos 12 meses)
      prisma.$queryRaw`
        SELECT 
          DATE_TRUNC('month', "createdAt") as month,
          COUNT(*) as count
        FROM "MedicalRecord"
        WHERE "createdAt" >= NOW() - INTERVAL '12 months'
        ${patientId ? `AND "patientId" = '${patientId}'` : ""}
        ${req.user.role === "PATIENT" ? `AND "patientId" = '${req.user.patient?.id}'` : ""}
        ${["DOCTOR", "SPECIALIST", "PSYCHOLOGIST"].includes(req.user.role) ? `AND "createdById" = '${req.user.id}'` : ""}
        GROUP BY DATE_TRUNC('month', "createdAt")
        ORDER BY month DESC
      `,

      // Registros recientes
      prisma.medicalRecord.findMany({
        where,
        take: 5,
        orderBy: { createdAt: "desc" },
        include: {
          patient: {
            include: {
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
        },
      }),
    ])

    const stats = {
      total: totalRecords,
      byType: recordsByType.reduce((acc, item) => {
        acc[item.recordType] = item._count.recordType
        return acc
      }, {}),
      byMonth: recordsByMonth,
      recent: recentRecords,
    }

    logger.info("Estadísticas de registros médicos obtenidas", {
      userId: req.user.id,
      role: req.user.role,
      filters: { startDate, endDate, patientId, recordType },
    })

    res.status(200).json({
      success: true,
      data: stats,
    })
  } catch (error) {
    logger.error("Error obteniendo estadísticas de registros médicos", {
      error: error.message,
      userId: req.user?.id,
      stack: error.stack,
    })

    res.status(500).json({
      success: false,
      error: "Error interno del servidor",
      message: "No se pudieron obtener las estadísticas",
    })
  }
}

module.exports = {
  getMedicalRecords,
  getMedicalRecordById,
  createMedicalRecord,
  updateMedicalRecord,
  getPatientMedicalHistory,
  getMedicalRecordStats,
}
