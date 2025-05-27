const { prisma } = require("../config/database")
const { logger, auditLog } = require("../config/logger")
const {
  validateCedulaColombia,
  validateColombianPhone,
  validateColombianDepartment,
} = require("../utils/colombia-validators")

/**
 * Obtener todos los pacientes (con paginación y filtros)
 */
async function getAllPatients(req, res) {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      department,
      epsCode,
      bloodType,
      gender,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query

    const skip = (Number.parseInt(page) - 1) * Number.parseInt(limit)
    const take = Number.parseInt(limit)

    // Construir filtros
    const where = {}

    if (search) {
      where.OR = [
        {
          user: {
            firstName: {
              contains: search,
              mode: "insensitive",
            },
          },
        },
        {
          user: {
            lastName: {
              contains: search,
              mode: "insensitive",
            },
          },
        },
        {
          user: {
            email: {
              contains: search,
              mode: "insensitive",
            },
          },
        },
        {
          affiliationNumber: {
            contains: search,
            mode: "insensitive",
          },
        },
      ]
    }

    if (department) where.department = department
    if (epsCode) where.epsCode = epsCode
    if (bloodType) where.bloodType = bloodType
    if (gender) where.gender = gender

    // Obtener pacientes
    const [patients, total] = await Promise.all([
      prisma.patient.findMany({
        where,
        skip,
        take,
        orderBy: {
          [sortBy]: sortOrder,
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              documentType: true,
              documentNumber: true,
              phone: true,
              status: true,
              createdAt: true,
              updatedAt: true,
            },
          },
          _count: {
            select: {
              appointments: true,
              medicalRecords: true,
              documents: true,
            },
          },
        },
      }),
      prisma.patient.count({ where }),
    ])

    const totalPages = Math.ceil(total / take)

    auditLog(
      "PATIENTS_LISTED",
      {
        filters: { search, department, epsCode, bloodType, gender },
        pagination: { page, limit, total },
      },
      req.user.id,
      req.ip,
    )

    res.json({
      message: "Pacientes obtenidos exitosamente",
      data: patients,
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
    logger.error("Error obteniendo pacientes", {
      error: error.message,
      userId: req.user?.id,
    })

    res.status(500).json({
      error: "Error obteniendo pacientes",
      code: "GET_PATIENTS_ERROR",
    })
  }
}

/**
 * Obtener un paciente por ID
 */
async function getPatientById(req, res) {
  try {
    const { id } = req.params

    const patient = await prisma.patient.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            documentType: true,
            documentNumber: true,
            phone: true,
            status: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        appointments: {
          take: 10,
          orderBy: { scheduledDate: "desc" },
          include: {
            medicalProfessional: {
              include: {
                user: {
                  select: {
                    firstName: true,
                    lastName: true,
                  },
                },
                specialty: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
        },
        medicalRecords: {
          take: 5,
          orderBy: { createdAt: "desc" },
          include: {
            medicalProfessional: {
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
        },
        _count: {
          select: {
            appointments: true,
            medicalRecords: true,
            documents: true,
          },
        },
      },
    })

    if (!patient) {
      return res.status(404).json({
        error: "Paciente no encontrado",
        code: "PATIENT_NOT_FOUND",
      })
    }

    // Verificar permisos: solo el mismo paciente, médicos, admin pueden ver
    if (req.user.role === "PATIENT" && req.user.patient?.id !== patient.id) {
      auditLog(
        "UNAUTHORIZED_PATIENT_ACCESS",
        { targetPatientId: patient.id, requestingUserId: req.user.id },
        req.user.id,
        req.ip,
      )
      return res.status(403).json({
        error: "No tienes permisos para ver este paciente",
        code: "INSUFFICIENT_PERMISSIONS",
      })
    }

    auditLog("PATIENT_VIEWED", { patientId: patient.id }, req.user.id, req.ip)

    res.json({
      message: "Paciente obtenido exitosamente",
      data: patient,
    })
  } catch (error) {
    logger.error("Error obteniendo paciente", {
      error: error.message,
      patientId: req.params.id,
      userId: req.user?.id,
    })

    res.status(500).json({
      error: "Error obteniendo paciente",
      code: "GET_PATIENT_ERROR",
    })
  }
}

/**
 * Crear nuevo paciente
 */
async function createPatient(req, res) {
  try {
    const {
      // Datos del usuario
      email,
      password,
      firstName,
      lastName,
      documentType,
      documentNumber,
      phone,
      // Datos del paciente
      birthDate,
      gender,
      bloodType = "UNKNOWN",
      address,
      city,
      department,
      postalCode,
      affiliationNumber,
      affiliationType,
      epsCode,
      ipsCode,
      allergies,
      chronicDiseases,
      medications,
      emergencyContactName,
      emergencyContactPhone,
      occupation,
      educationLevel,
      maritalStatus,
    } = req.body

    // Validaciones específicas para Colombia
    if (documentType === "CC" && !validateCedulaColombia(documentNumber)) {
      return res.status(400).json({
        error: "Número de cédula inválido",
        code: "INVALID_CEDULA",
      })
    }

    if (phone && !validateColombianPhone(phone)) {
      return res.status(400).json({
        error: "Número de teléfono inválido",
        code: "INVALID_PHONE",
      })
    }

    if (!validateColombianDepartment(department)) {
      return res.status(400).json({
        error: "Departamento inválido",
        code: "INVALID_DEPARTMENT",
      })
    }

    // Verificar si el usuario ya existe
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email }, { documentNumber }],
      },
    })

    if (existingUser) {
      const field = existingUser.email === email ? "email" : "documento"
      return res.status(409).json({
        error: `Ya existe un usuario con este ${field}`,
        code: "USER_ALREADY_EXISTS",
        field,
      })
    }

    // Verificar número de afiliación único
    const existingPatient = await prisma.patient.findUnique({
      where: { affiliationNumber },
    })

    if (existingPatient) {
      return res.status(409).json({
        error: "Ya existe un paciente con este número de afiliación",
        code: "AFFILIATION_NUMBER_EXISTS",
      })
    }

    // Hash de la contraseña
    const bcrypt = require("bcryptjs")
    const hashedPassword = await bcrypt.hash(password, 12)

    // Crear usuario y paciente en una transacción
    const result = await prisma.$transaction(async (tx) => {
      // Crear usuario
      const user = await tx.user.create({
        data: {
          email,
          password: hashedPassword,
          firstName,
          lastName,
          documentType,
          documentNumber,
          phone,
          role: "PATIENT",
          status: "ACTIVE",
          emailVerified: true,
          emailVerifiedAt: new Date(),
        },
      })

      // Crear paciente
      const patient = await tx.patient.create({
        data: {
          userId: user.id,
          birthDate: new Date(birthDate),
          gender,
          bloodType,
          address,
          city,
          department,
          postalCode,
          affiliationNumber,
          affiliationType,
          epsCode,
          ipsCode,
          allergies: allergies ? JSON.stringify(allergies) : null,
          chronicDiseases: chronicDiseases ? JSON.stringify(chronicDiseases) : null,
          medications: medications ? JSON.stringify(medications) : null,
          emergencyContactName,
          emergencyContactPhone,
          occupation,
          educationLevel,
          maritalStatus,
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              documentType: true,
              documentNumber: true,
              phone: true,
              status: true,
              createdAt: true,
            },
          },
        },
      })

      return patient
    })

    auditLog(
      "PATIENT_CREATED",
      {
        patientId: result.id,
        userId: result.userId,
        affiliationNumber: result.affiliationNumber,
      },
      req.user.id,
      req.ip,
    )

    res.status(201).json({
      message: "Paciente creado exitosamente",
      data: result,
    })
  } catch (error) {
    logger.error("Error creando paciente", {
      error: error.message,
      stack: error.stack,
      userId: req.user?.id,
    })

    res.status(500).json({
      error: "Error creando paciente",
      code: "CREATE_PATIENT_ERROR",
    })
  }
}

/**
 * Actualizar paciente
 */
async function updatePatient(req, res) {
  try {
    const { id } = req.params
    const updateData = req.body

    // Verificar que el paciente existe
    const existingPatient = await prisma.patient.findUnique({
      where: { id },
      include: { user: true },
    })

    if (!existingPatient) {
      return res.status(404).json({
        error: "Paciente no encontrado",
        code: "PATIENT_NOT_FOUND",
      })
    }

    // Verificar permisos
    if (req.user.role === "PATIENT" && req.user.patient?.id !== id) {
      return res.status(403).json({
        error: "No tienes permisos para actualizar este paciente",
        code: "INSUFFICIENT_PERMISSIONS",
      })
    }

    // Preparar datos de actualización
    const patientUpdateData = {}
    const userUpdateData = {}

    // Campos del paciente
    const patientFields = [
      "birthDate",
      "gender",
      "bloodType",
      "address",
      "city",
      "department",
      "postalCode",
      "affiliationType",
      "epsCode",
      "ipsCode",
      "emergencyContactName",
      "emergencyContactPhone",
      "occupation",
      "educationLevel",
      "maritalStatus",
    ]

    patientFields.forEach((field) => {
      if (updateData[field] !== undefined) {
        if (field === "birthDate") {
          patientUpdateData[field] = new Date(updateData[field])
        } else {
          patientUpdateData[field] = updateData[field]
        }
      }
    })

    // Campos especiales que requieren JSON
    if (updateData.allergies !== undefined) {
      patientUpdateData.allergies = updateData.allergies ? JSON.stringify(updateData.allergies) : null
    }
    if (updateData.chronicDiseases !== undefined) {
      patientUpdateData.chronicDiseases = updateData.chronicDiseases ? JSON.stringify(updateData.chronicDiseases) : null
    }
    if (updateData.medications !== undefined) {
      patientUpdateData.medications = updateData.medications ? JSON.stringify(updateData.medications) : null
    }

    // Campos del usuario
    const userFields = ["firstName", "lastName", "phone"]
    userFields.forEach((field) => {
      if (updateData[field] !== undefined) {
        userUpdateData[field] = updateData[field]
      }
    })

    // Actualizar en transacción
    const result = await prisma.$transaction(async (tx) => {
      // Actualizar usuario si hay cambios
      if (Object.keys(userUpdateData).length > 0) {
        await tx.user.update({
          where: { id: existingPatient.userId },
          data: userUpdateData,
        })
      }

      // Actualizar paciente
      const updatedPatient = await tx.patient.update({
        where: { id },
        data: patientUpdateData,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              documentType: true,
              documentNumber: true,
              phone: true,
              status: true,
              updatedAt: true,
            },
          },
        },
      })

      return updatedPatient
    })

    auditLog(
      "PATIENT_UPDATED",
      {
        patientId: id,
        updatedFields: Object.keys({ ...patientUpdateData, ...userUpdateData }),
      },
      req.user.id,
      req.ip,
    )

    res.json({
      message: "Paciente actualizado exitosamente",
      data: result,
    })
  } catch (error) {
    logger.error("Error actualizando paciente", {
      error: error.message,
      patientId: req.params.id,
      userId: req.user?.id,
    })

    res.status(500).json({
      error: "Error actualizando paciente",
      code: "UPDATE_PATIENT_ERROR",
    })
  }
}

/**
 * Obtener estadísticas de pacientes
 */
async function getPatientStats(req, res) {
  try {
    const stats = await prisma.$transaction(async (tx) => {
      const [
        totalPatients,
        patientsByGender,
        patientsByDepartment,
        patientsByBloodType,
        patientsByEPS,
        recentPatients,
      ] = await Promise.all([
        tx.patient.count(),
        tx.patient.groupBy({
          by: ["gender"],
          _count: true,
        }),
        tx.patient.groupBy({
          by: ["department"],
          _count: true,
          orderBy: {
            _count: {
              department: "desc",
            },
          },
          take: 10,
        }),
        tx.patient.groupBy({
          by: ["bloodType"],
          _count: true,
        }),
        tx.patient.groupBy({
          by: ["epsCode"],
          _count: true,
          orderBy: {
            _count: {
              epsCode: "desc",
            },
          },
          take: 5,
        }),
        tx.patient.count({
          where: {
            createdAt: {
              gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // últimos 30 días
            },
          },
        }),
      ])

      return {
        totalPatients,
        recentPatients,
        demographics: {
          byGender: patientsByGender,
          byDepartment: patientsByDepartment,
          byBloodType: patientsByBloodType,
          byEPS: patientsByEPS,
        },
      }
    })

    auditLog("PATIENT_STATS_VIEWED", {}, req.user.id, req.ip)

    res.json({
      message: "Estadísticas de pacientes obtenidas exitosamente",
      data: stats,
    })
  } catch (error) {
    logger.error("Error obteniendo estadísticas de pacientes", {
      error: error.message,
      userId: req.user?.id,
    })

    res.status(500).json({
      error: "Error obteniendo estadísticas",
      code: "GET_PATIENT_STATS_ERROR",
    })
  }
}

module.exports = {
  getAllPatients,
  getPatientById,
  createPatient,
  updatePatient,
  getPatientStats,
}
