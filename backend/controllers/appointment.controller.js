const { prisma } = require("../config/database")
const { logger } = require("../config/logger")
const { validateColombianDocument, validateColombianPhone } = require("../utils/colombia-validators")

// Obtener todas las citas con filtros y paginación
const getAppointments = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      specialtyId,
      patientId,
      medicalProfessionalId,
      startDate,
      endDate,
      search,
    } = req.query

    const skip = (Number.parseInt(page) - 1) * Number.parseInt(limit)
    const take = Number.parseInt(limit)

    // Construir filtros
    const where = {}

    if (status) where.status = status
    if (specialtyId) where.specialtyId = specialtyId
    if (patientId) where.patientId = patientId
    if (medicalProfessionalId) where.medicalProfessionalId = medicalProfessionalId

    // Filtro por rango de fechas
    if (startDate || endDate) {
      where.scheduledDate = {}
      if (startDate) where.scheduledDate.gte = new Date(startDate)
      if (endDate) where.scheduledDate.lte = new Date(endDate)
    }

    // Búsqueda por nombre de paciente o médico
    if (search) {
      where.OR = [
        {
          patient: {
            user: {
              OR: [
                { firstName: { contains: search, mode: "insensitive" } },
                { lastName: { contains: search, mode: "insensitive" } },
                { email: { contains: search, mode: "insensitive" } },
              ],
            },
          },
        },
        {
          medicalProfessional: {
            user: {
              OR: [
                { firstName: { contains: search, mode: "insensitive" } },
                { lastName: { contains: search, mode: "insensitive" } },
              ],
            },
          },
        },
      ]
    }

    // Restricciones por rol
    if (req.user.role === "PATIENT") {
      where.patientId = req.user.patient?.id
    } else if (["DOCTOR", "SPECIALIST", "PSYCHOLOGIST"].includes(req.user.role)) {
      where.medicalProfessionalId = req.user.medicalProfessional?.id
    }

    const [appointments, total] = await Promise.all([
      prisma.appointment.findMany({
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
                  email: true,
                  phone: true,
                  documentType: true,
                  documentNumber: true,
                },
              },
            },
          },
          medicalProfessional: {
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
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
          specialty: {
            select: {
              id: true,
              name: true,
              code: true,
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
        orderBy: { scheduledDate: "asc" },
      }),
      prisma.appointment.count({ where }),
    ])

    const totalPages = Math.ceil(total / take)

    logger.info("Citas obtenidas", {
      userId: req.user.id,
      role: req.user.role,
      total,
      page,
      filters: { status, specialtyId, patientId, medicalProfessionalId },
    })

    res.status(200).json({
      success: true,
      data: appointments,
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
    logger.error("Error obteniendo citas", {
      error: error.message,
      userId: req.user?.id,
      stack: error.stack,
    })

    res.status(500).json({
      success: false,
      error: "Error interno del servidor",
      message: "No se pudieron obtener las citas",
    })
  }
}

// Obtener cita por ID
const getAppointmentById = async (req, res) => {
  try {
    const { id } = req.params

    const appointment = await prisma.appointment.findUnique({
      where: { id },
      include: {
        patient: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
                documentType: true,
                documentNumber: true,
                birthDate: true,
                gender: true,
              },
            },
          },
        },
        medicalProfessional: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
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
        specialty: {
          select: {
            id: true,
            name: true,
            code: true,
            description: true,
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
        medicalRecords: {
          include: {
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
        },
      },
    })

    if (!appointment) {
      return res.status(404).json({
        success: false,
        error: "Cita no encontrada",
        message: "La cita solicitada no existe",
      })
    }

    // Verificar permisos
    const canAccess =
      req.user.role === "ADMIN" ||
      (req.user.role === "PATIENT" && appointment.patientId === req.user.patient?.id) ||
      (["DOCTOR", "SPECIALIST", "PSYCHOLOGIST"].includes(req.user.role) &&
        appointment.medicalProfessionalId === req.user.medicalProfessional?.id)

    if (!canAccess) {
      return res.status(403).json({
        success: false,
        error: "Acceso denegado",
        message: "No tienes permisos para ver esta cita",
      })
    }

    logger.info("Cita obtenida por ID", {
      appointmentId: id,
      userId: req.user.id,
      role: req.user.role,
    })

    res.status(200).json({
      success: true,
      data: appointment,
    })
  } catch (error) {
    logger.error("Error obteniendo cita por ID", {
      error: error.message,
      appointmentId: req.params.id,
      userId: req.user?.id,
      stack: error.stack,
    })

    res.status(500).json({
      success: false,
      error: "Error interno del servidor",
      message: "No se pudo obtener la cita",
    })
  }
}

// Crear nueva cita
const createAppointment = async (req, res) => {
  try {
    const {
      patientId,
      medicalProfessionalId,
      specialtyId,
      scheduledDate,
      reason,
      notes,
      priority = "NORMAL",
      type = "CONSULTATION",
    } = req.body

    // Validaciones básicas
    if (!patientId || !medicalProfessionalId || !specialtyId || !scheduledDate || !reason) {
      return res.status(400).json({
        success: false,
        error: "Datos incompletos",
        message: "Todos los campos obligatorios deben ser proporcionados",
      })
    }

    // Validar fecha
    const appointmentDate = new Date(scheduledDate)
    const now = new Date()

    if (appointmentDate <= now) {
      return res.status(400).json({
        success: false,
        error: "Fecha inválida",
        message: "La fecha de la cita debe ser futura",
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

    // Verificar que el médico existe y está activo
    const medicalProfessional = await prisma.medicalProfessional.findUnique({
      where: { id: medicalProfessionalId },
      include: {
        user: true,
        specialty: true,
      },
    })

    if (!medicalProfessional || !medicalProfessional.user.isActive) {
      return res.status(404).json({
        success: false,
        error: "Médico no encontrado",
        message: "El médico especificado no existe o no está activo",
      })
    }

    // Verificar que la especialidad existe
    const specialty = await prisma.specialty.findUnique({
      where: { id: specialtyId },
    })

    if (!specialty) {
      return res.status(404).json({
        success: false,
        error: "Especialidad no encontrada",
        message: "La especialidad especificada no existe",
      })
    }

    // Verificar disponibilidad del médico (no debe tener otra cita en la misma hora)
    const conflictingAppointment = await prisma.appointment.findFirst({
      where: {
        medicalProfessionalId,
        scheduledDate: appointmentDate,
        status: {
          in: ["SCHEDULED", "IN_PROGRESS"],
        },
      },
    })

    if (conflictingAppointment) {
      return res.status(409).json({
        success: false,
        error: "Horario no disponible",
        message: "El médico ya tiene una cita programada en ese horario",
      })
    }

    // Verificar que el paciente no tenga otra cita en la misma hora
    const patientConflict = await prisma.appointment.findFirst({
      where: {
        patientId,
        scheduledDate: appointmentDate,
        status: {
          in: ["SCHEDULED", "IN_PROGRESS"],
        },
      },
    })

    if (patientConflict) {
      return res.status(409).json({
        success: false,
        error: "Paciente no disponible",
        message: "El paciente ya tiene una cita programada en ese horario",
      })
    }

    // Crear la cita
    const appointment = await prisma.appointment.create({
      data: {
        patientId,
        medicalProfessionalId,
        specialtyId,
        scheduledDate: appointmentDate,
        reason,
        notes,
        priority,
        type,
        status: "SCHEDULED",
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
                email: true,
                phone: true,
              },
            },
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
        specialty: {
          select: {
            id: true,
            name: true,
            code: true,
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

    logger.info("Cita creada exitosamente", {
      appointmentId: appointment.id,
      patientId,
      medicalProfessionalId,
      scheduledDate: appointmentDate,
      createdBy: req.user.id,
    })

    res.status(201).json({
      success: true,
      message: "Cita creada exitosamente",
      data: appointment,
    })
  } catch (error) {
    logger.error("Error creando cita", {
      error: error.message,
      userId: req.user?.id,
      requestBody: req.body,
      stack: error.stack,
    })

    res.status(500).json({
      success: false,
      error: "Error interno del servidor",
      message: "No se pudo crear la cita",
    })
  }
}

// Actualizar cita
const updateAppointment = async (req, res) => {
  try {
    const { id } = req.params
    const { scheduledDate, reason, notes, priority, status, type } = req.body

    // Verificar que la cita existe
    const existingAppointment = await prisma.appointment.findUnique({
      where: { id },
      include: {
        patient: { include: { user: true } },
        medicalProfessional: { include: { user: true } },
      },
    })

    if (!existingAppointment) {
      return res.status(404).json({
        success: false,
        error: "Cita no encontrada",
        message: "La cita especificada no existe",
      })
    }

    // Verificar permisos
    const canUpdate =
      req.user.role === "ADMIN" ||
      (["DOCTOR", "SPECIALIST", "PSYCHOLOGIST"].includes(req.user.role) &&
        existingAppointment.medicalProfessionalId === req.user.medicalProfessional?.id)

    if (!canUpdate) {
      return res.status(403).json({
        success: false,
        error: "Acceso denegado",
        message: "No tienes permisos para actualizar esta cita",
      })
    }

    // Preparar datos de actualización
    const updateData = {}

    if (scheduledDate) {
      const appointmentDate = new Date(scheduledDate)
      const now = new Date()

      if (appointmentDate <= now && status !== "COMPLETED" && status !== "CANCELLED") {
        return res.status(400).json({
          success: false,
          error: "Fecha inválida",
          message: "La fecha de la cita debe ser futura",
        })
      }

      // Verificar disponibilidad si se cambia la fecha
      if (appointmentDate.getTime() !== existingAppointment.scheduledDate.getTime()) {
        const conflictingAppointment = await prisma.appointment.findFirst({
          where: {
            id: { not: id },
            medicalProfessionalId: existingAppointment.medicalProfessionalId,
            scheduledDate: appointmentDate,
            status: {
              in: ["SCHEDULED", "IN_PROGRESS"],
            },
          },
        })

        if (conflictingAppointment) {
          return res.status(409).json({
            success: false,
            error: "Horario no disponible",
            message: "El médico ya tiene una cita programada en ese horario",
          })
        }
      }

      updateData.scheduledDate = appointmentDate
    }

    if (reason) updateData.reason = reason
    if (notes !== undefined) updateData.notes = notes
    if (priority) updateData.priority = priority
    if (type) updateData.type = type
    if (status) updateData.status = status

    // Actualizar la cita
    const updatedAppointment = await prisma.appointment.update({
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
                email: true,
                phone: true,
              },
            },
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
        specialty: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    })

    logger.info("Cita actualizada exitosamente", {
      appointmentId: id,
      updatedFields: Object.keys(updateData),
      updatedBy: req.user.id,
    })

    res.status(200).json({
      success: true,
      message: "Cita actualizada exitosamente",
      data: updatedAppointment,
    })
  } catch (error) {
    logger.error("Error actualizando cita", {
      error: error.message,
      appointmentId: req.params.id,
      userId: req.user?.id,
      stack: error.stack,
    })

    res.status(500).json({
      success: false,
      error: "Error interno del servidor",
      message: "No se pudo actualizar la cita",
    })
  }
}

// Cancelar cita
const cancelAppointment = async (req, res) => {
  try {
    const { id } = req.params
    const { reason } = req.body

    // Verificar que la cita existe
    const appointment = await prisma.appointment.findUnique({
      where: { id },
      include: {
        patient: { include: { user: true } },
        medicalProfessional: { include: { user: true } },
      },
    })

    if (!appointment) {
      return res.status(404).json({
        success: false,
        error: "Cita no encontrada",
        message: "La cita especificada no existe",
      })
    }

    // Verificar permisos
    const canCancel =
      req.user.role === "ADMIN" ||
      (req.user.role === "PATIENT" && appointment.patientId === req.user.patient?.id) ||
      (["DOCTOR", "SPECIALIST", "PSYCHOLOGIST"].includes(req.user.role) &&
        appointment.medicalProfessionalId === req.user.medicalProfessional?.id)

    if (!canCancel) {
      return res.status(403).json({
        success: false,
        error: "Acceso denegado",
        message: "No tienes permisos para cancelar esta cita",
      })
    }

    // Verificar que la cita se puede cancelar
    if (appointment.status === "CANCELLED") {
      return res.status(400).json({
        success: false,
        error: "Cita ya cancelada",
        message: "Esta cita ya ha sido cancelada",
      })
    }

    if (appointment.status === "COMPLETED") {
      return res.status(400).json({
        success: false,
        error: "Cita completada",
        message: "No se puede cancelar una cita que ya fue completada",
      })
    }

    // Cancelar la cita
    const cancelledAppointment = await prisma.appointment.update({
      where: { id },
      data: {
        status: "CANCELLED",
        notes: reason ? `${appointment.notes || ""}\n\nCancelada: ${reason}`.trim() : appointment.notes,
      },
      include: {
        patient: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
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
          },
        },
      },
    })

    logger.info("Cita cancelada exitosamente", {
      appointmentId: id,
      cancelledBy: req.user.id,
      reason,
    })

    res.status(200).json({
      success: true,
      message: "Cita cancelada exitosamente",
      data: cancelledAppointment,
    })
  } catch (error) {
    logger.error("Error cancelando cita", {
      error: error.message,
      appointmentId: req.params.id,
      userId: req.user?.id,
      stack: error.stack,
    })

    res.status(500).json({
      success: false,
      error: "Error interno del servidor",
      message: "No se pudo cancelar la cita",
    })
  }
}

// Obtener estadísticas de citas
const getAppointmentStats = async (req, res) => {
  try {
    const { startDate, endDate, specialtyId, medicalProfessionalId } = req.query

    // Construir filtros base
    const where = {}

    if (startDate || endDate) {
      where.scheduledDate = {}
      if (startDate) where.scheduledDate.gte = new Date(startDate)
      if (endDate) where.scheduledDate.lte = new Date(endDate)
    }

    if (specialtyId) where.specialtyId = specialtyId
    if (medicalProfessionalId) where.medicalProfessionalId = medicalProfessionalId

    // Restricciones por rol
    if (req.user.role === "PATIENT") {
      where.patientId = req.user.patient?.id
    } else if (["DOCTOR", "SPECIALIST", "PSYCHOLOGIST"].includes(req.user.role)) {
      where.medicalProfessionalId = req.user.medicalProfessional?.id
    }

    const [
      totalAppointments,
      appointmentsByStatus,
      appointmentsBySpecialty,
      appointmentsByPriority,
      appointmentsByType,
      upcomingAppointments,
      todayAppointments,
    ] = await Promise.all([
      // Total de citas
      prisma.appointment.count({ where }),

      // Citas por estado
      prisma.appointment.groupBy({
        by: ["status"],
        where,
        _count: { status: true },
      }),

      // Citas por especialidad
      prisma.appointment.groupBy({
        by: ["specialtyId"],
        where,
        _count: { specialtyId: true },
        include: {
          specialty: {
            select: { name: true, code: true },
          },
        },
      }),

      // Citas por prioridad
      prisma.appointment.groupBy({
        by: ["priority"],
        where,
        _count: { priority: true },
      }),

      // Citas por tipo
      prisma.appointment.groupBy({
        by: ["type"],
        where,
        _count: { type: true },
      }),

      // Próximas citas (siguientes 7 días)
      prisma.appointment.count({
        where: {
          ...where,
          scheduledDate: {
            gte: new Date(),
            lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          },
          status: "SCHEDULED",
        },
      }),

      // Citas de hoy
      prisma.appointment.count({
        where: {
          ...where,
          scheduledDate: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
            lte: new Date(new Date().setHours(23, 59, 59, 999)),
          },
        },
      }),
    ])

    // Obtener nombres de especialidades
    const specialtyIds = appointmentsBySpecialty.map((item) => item.specialtyId)
    const specialties = await prisma.specialty.findMany({
      where: { id: { in: specialtyIds } },
      select: { id: true, name: true, code: true },
    })

    const specialtyMap = specialties.reduce((acc, specialty) => {
      acc[specialty.id] = specialty
      return acc
    }, {})

    // Formatear datos de especialidades
    const formattedSpecialtyStats = appointmentsBySpecialty.map((item) => ({
      specialtyId: item.specialtyId,
      specialty: specialtyMap[item.specialtyId],
      count: item._count.specialtyId,
    }))

    const stats = {
      total: totalAppointments,
      today: todayAppointments,
      upcoming: upcomingAppointments,
      byStatus: appointmentsByStatus.reduce((acc, item) => {
        acc[item.status] = item._count.status
        return acc
      }, {}),
      bySpecialty: formattedSpecialtyStats,
      byPriority: appointmentsByPriority.reduce((acc, item) => {
        acc[item.priority] = item._count.priority
        return acc
      }, {}),
      byType: appointmentsByType.reduce((acc, item) => {
        acc[item.type] = item._count.type
        return acc
      }, {}),
    }

    logger.info("Estadísticas de citas obtenidas", {
      userId: req.user.id,
      role: req.user.role,
      filters: { startDate, endDate, specialtyId, medicalProfessionalId },
    })

    res.status(200).json({
      success: true,
      data: stats,
    })
  } catch (error) {
    logger.error("Error obteniendo estadísticas de citas", {
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

// Obtener horarios disponibles para un médico
const getAvailableSlots = async (req, res) => {
  try {
    const { medicalProfessionalId, date, specialtyId } = req.query

    if (!medicalProfessionalId || !date) {
      return res.status(400).json({
        success: false,
        error: "Parámetros faltantes",
        message: "Se requiere medicalProfessionalId y date",
      })
    }

    const targetDate = new Date(date)
    const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0))
    const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999))

    // Verificar que el médico existe
    const medicalProfessional = await prisma.medicalProfessional.findUnique({
      where: { id: medicalProfessionalId },
      include: { user: true, specialty: true },
    })

    if (!medicalProfessional) {
      return res.status(404).json({
        success: false,
        error: "Médico no encontrado",
        message: "El médico especificado no existe",
      })
    }

    // Obtener citas existentes del médico para ese día
    const existingAppointments = await prisma.appointment.findMany({
      where: {
        medicalProfessionalId,
        scheduledDate: {
          gte: startOfDay,
          lte: endOfDay,
        },
        status: {
          in: ["SCHEDULED", "IN_PROGRESS"],
        },
      },
      select: {
        scheduledDate: true,
      },
    })

    // Generar horarios disponibles (ejemplo: 8:00 AM a 6:00 PM, cada 30 minutos)
    const availableSlots = []
    const startHour = 8 // 8:00 AM
    const endHour = 18 // 6:00 PM
    const slotDuration = 30 // 30 minutos

    for (let hour = startHour; hour < endHour; hour++) {
      for (let minute = 0; minute < 60; minute += slotDuration) {
        const slotTime = new Date(targetDate)
        slotTime.setHours(hour, minute, 0, 0)

        // Verificar si el horario no está ocupado
        const isOccupied = existingAppointments.some(
          (appointment) => appointment.scheduledDate.getTime() === slotTime.getTime(),
        )

        if (!isOccupied && slotTime > new Date()) {
          availableSlots.push({
            time: slotTime,
            available: true,
          })
        }
      }
    }

    logger.info("Horarios disponibles obtenidos", {
      medicalProfessionalId,
      date,
      availableSlots: availableSlots.length,
      userId: req.user.id,
    })

    res.status(200).json({
      success: true,
      data: {
        medicalProfessional: {
          id: medicalProfessional.id,
          name: `${medicalProfessional.user.firstName} ${medicalProfessional.user.lastName}`,
          specialty: medicalProfessional.specialty.name,
        },
        date: targetDate,
        availableSlots,
      },
    })
  } catch (error) {
    logger.error("Error obteniendo horarios disponibles", {
      error: error.message,
      userId: req.user?.id,
      stack: error.stack,
    })

    res.status(500).json({
      success: false,
      error: "Error interno del servidor",
      message: "No se pudieron obtener los horarios disponibles",
    })
  }
}

module.exports = {
  getAppointments,
  getAppointmentById,
  createAppointment,
  updateAppointment,
  cancelAppointment,
  getAppointmentStats,
  getAvailableSlots,
}
