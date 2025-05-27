const { PrismaClient } = require("@prisma/client")
const bcrypt = require("bcryptjs")

const prisma = new PrismaClient()

async function main() {
  console.log("🌱 Iniciando seed de la base de datos Gaia...")

  // Limpiar datos existentes (solo en desarrollo)
  if (process.env.NODE_ENV === "development") {
    console.log("🧹 Limpiando datos existentes...")
    await prisma.auditLog.deleteMany()
    await prisma.document.deleteMany()
    await prisma.medicalRecord.deleteMany()
    await prisma.appointment.deleteMany()
    await prisma.patient.deleteMany()
    await prisma.medicalProfessional.deleteMany()
    await prisma.specialty.deleteMany()
    await prisma.user.deleteMany()
    await prisma.systemConfiguration.deleteMany()
  }

  // 1. Crear especialidades médicas (según normativa colombiana)
  console.log("🏥 Creando especialidades médicas...")
  const specialties = await Promise.all([
    prisma.specialty.create({
      data: {
        name: "Medicina General",
        code: "MG001",
        description: "Atención médica general y preventiva",
        defaultDuration: 20,
        requiresReferral: false,
      },
    }),
    prisma.specialty.create({
      data: {
        name: "Cardiología",
        code: "CAR001",
        description: "Especialidad en enfermedades del corazón",
        defaultDuration: 30,
        requiresReferral: true,
      },
    }),
    prisma.specialty.create({
      data: {
        name: "Pediatría",
        code: "PED001",
        description: "Atención médica para niños y adolescentes",
        defaultDuration: 25,
        requiresReferral: false,
      },
    }),
    prisma.specialty.create({
      data: {
        name: "Ginecología",
        code: "GIN001",
        description: "Salud reproductiva femenina",
        defaultDuration: 30,
        requiresReferral: false,
      },
    }),
    prisma.specialty.create({
      data: {
        name: "Psicología",
        code: "PSI001",
        description: "Salud mental y bienestar psicológico",
        defaultDuration: 45,
        requiresReferral: true,
      },
    }),
    prisma.specialty.create({
      data: {
        name: "Dermatología",
        code: "DER001",
        description: "Enfermedades de la piel",
        defaultDuration: 20,
        requiresReferral: true,
      },
    }),
  ])

  // 2. Crear usuario administrador
  console.log("👤 Creando usuario administrador...")
  const hashedPassword = await bcrypt.hash("Admin123!", 12)
  const adminUser = await prisma.user.create({
    data: {
      email: "admin@gaia-eps.com",
      password: hashedPassword,
      role: "ADMIN",
      status: "ACTIVE",
      emailVerified: true,
      emailVerifiedAt: new Date(),
      firstName: "Administrador",
      lastName: "Sistema",
      documentType: "CC",
      documentNumber: "1000000000",
      phone: "+57 300 000 0000",
    },
  })

  // 3. Crear médicos de ejemplo
  console.log("👨‍⚕️ Creando médicos de ejemplo...")
  const doctorPassword = await bcrypt.hash("Doctor123!", 12)

  const doctorGeneral = await prisma.user.create({
    data: {
      email: "dr.garcia@gaia-eps.com",
      password: doctorPassword,
      role: "DOCTOR",
      status: "ACTIVE",
      emailVerified: true,
      emailVerifiedAt: new Date(),
      firstName: "Carlos",
      lastName: "García",
      documentType: "CC",
      documentNumber: "12345678",
      phone: "+57 301 234 5678",
      medicalProfessional: {
        create: {
          licenseNumber: "MP12345",
          specialtyId: specialties[0].id, // Medicina General
          hospitalAffiliation: "Hospital Central Gaia",
          consultingRoomNumber: "101",
          workSchedule: JSON.stringify({
            monday: { start: "08:00", end: "17:00" },
            tuesday: { start: "08:00", end: "17:00" },
            wednesday: { start: "08:00", end: "17:00" },
            thursday: { start: "08:00", end: "17:00" },
            friday: { start: "08:00", end: "15:00" },
          }),
          consultationDuration: 20,
          maxDailyAppointments: 25,
        },
      },
    },
    include: {
      medicalProfessional: true,
    },
  })

  const cardiologist = await prisma.user.create({
    data: {
      email: "dra.rodriguez@gaia-eps.com",
      password: doctorPassword,
      role: "SPECIALIST",
      status: "ACTIVE",
      emailVerified: true,
      emailVerifiedAt: new Date(),
      firstName: "María",
      lastName: "Rodríguez",
      documentType: "CC",
      documentNumber: "87654321",
      phone: "+57 302 876 5432",
      medicalProfessional: {
        create: {
          licenseNumber: "MP54321",
          specialtyId: specialties[1].id, // Cardiología
          hospitalAffiliation: "Clínica Cardiovascular Gaia",
          consultingRoomNumber: "205",
          workSchedule: JSON.stringify({
            monday: { start: "09:00", end: "16:00" },
            wednesday: { start: "09:00", end: "16:00" },
            friday: { start: "09:00", end: "16:00" },
          }),
          consultationDuration: 30,
          maxDailyAppointments: 15,
          acceptsEmergencies: true,
        },
      },
    },
    include: {
      medicalProfessional: true,
    },
  })

  // 4. Crear pacientes de ejemplo
  console.log("🏥 Creando pacientes de ejemplo...")
  const patientPassword = await bcrypt.hash("Patient123!", 12)

  const patient1 = await prisma.user.create({
    data: {
      email: "juan.perez@email.com",
      password: patientPassword,
      role: "PATIENT",
      status: "ACTIVE",
      emailVerified: true,
      emailVerifiedAt: new Date(),
      firstName: "Juan",
      lastName: "Pérez",
      documentType: "CC",
      documentNumber: "98765432",
      phone: "+57 310 987 6543",
      patient: {
        create: {
          birthDate: new Date("1985-03-15"),
          gender: "MALE",
          bloodType: "O_POSITIVE",
          address: "Calle 123 #45-67",
          city: "Bogotá",
          department: "Cundinamarca",
          postalCode: "110111",
          affiliationNumber: "EPS001234567",
          affiliationType: "Contributivo",
          epsCode: "EPS001",
          allergies: JSON.stringify(["Penicilina", "Mariscos"]),
          emergencyContactName: "María Pérez",
          emergencyContactPhone: "+57 311 123 4567",
          occupation: "Ingeniero de Sistemas",
          educationLevel: "Universitario",
          maritalStatus: "Casado",
        },
      },
    },
    include: {
      patient: true,
    },
  })

  const patient2 = await prisma.user.create({
    data: {
      email: "ana.martinez@email.com",
      password: patientPassword,
      role: "PATIENT",
      status: "ACTIVE",
      emailVerified: true,
      emailVerifiedAt: new Date(),
      firstName: "Ana",
      lastName: "Martínez",
      documentType: "CC",
      documentNumber: "45678912",
      phone: "+57 315 456 7891",
      patient: {
        create: {
          birthDate: new Date("1992-07-22"),
          gender: "FEMALE",
          bloodType: "A_POSITIVE",
          address: "Carrera 45 #12-34",
          city: "Medellín",
          department: "Antioquia",
          postalCode: "050001",
          affiliationNumber: "EPS007654321",
          affiliationType: "Contributivo",
          epsCode: "EPS001",
          emergencyContactName: "Luis Martínez",
          emergencyContactPhone: "+57 316 789 1234",
          occupation: "Diseñadora Gráfica",
          educationLevel: "Universitario",
          maritalStatus: "Soltera",
        },
      },
    },
    include: {
      patient: true,
    },
  })

  // 5. Crear citas de ejemplo
  console.log("📅 Creando citas de ejemplo...")
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  tomorrow.setHours(10, 0, 0, 0)

  const nextWeek = new Date()
  nextWeek.setDate(nextWeek.getDate() + 7)
  nextWeek.setHours(14, 30, 0, 0)

  await prisma.appointment.create({
    data: {
      patientId: patient1.patient.id,
      medicalProfessionalId: doctorGeneral.medicalProfessional.id,
      specialtyId: specialties[0].id,
      scheduledDate: tomorrow,
      scheduledTime: tomorrow,
      duration: 20,
      type: "CONSULTATION",
      status: "SCHEDULED",
      reason: "Consulta de control general",
      consultingRoom: "101",
      createdById: adminUser.id,
    },
  })

  await prisma.appointment.create({
    data: {
      patientId: patient2.patient.id,
      medicalProfessionalId: cardiologist.medicalProfessional.id,
      specialtyId: specialties[1].id,
      scheduledDate: nextWeek,
      scheduledTime: nextWeek,
      duration: 30,
      type: "CONSULTATION",
      status: "SCHEDULED",
      reason: "Evaluación cardiológica preventiva",
      consultingRoom: "205",
      createdById: adminUser.id,
    },
  })

  // 6. Crear configuraciones del sistema
  console.log("⚙️ Creando configuraciones del sistema...")
  await Promise.all([
    prisma.systemConfiguration.create({
      data: {
        key: "EPS_NAME",
        value: "Gaia EPS",
        description: "Nombre de la EPS",
        category: "GENERAL",
      },
    }),
    prisma.systemConfiguration.create({
      data: {
        key: "EPS_CODE",
        value: "EPS001",
        description: "Código de la EPS según normativa",
        category: "COMPLIANCE",
      },
    }),
    prisma.systemConfiguration.create({
      data: {
        key: "AUDIT_RETENTION_YEARS",
        value: "7",
        description: "Años de retención de logs de auditoría",
        category: "COMPLIANCE",
      },
    }),
    prisma.systemConfiguration.create({
      data: {
        key: "MAX_APPOINTMENT_DAYS_ADVANCE",
        value: "30",
        description: "Días máximos para agendar cita con anticipación",
        category: "APPOINTMENTS",
      },
    }),
    prisma.systemConfiguration.create({
      data: {
        key: "TIMEZONE",
        value: "America/Bogota",
        description: "Zona horaria del sistema",
        category: "GENERAL",
      },
    }),
  ])

  console.log("✅ Seed completado exitosamente!")
  console.log(`
  📊 Datos creados:
  • ${specialties.length} especialidades médicas
  • 1 usuario administrador
  • 2 médicos (1 general, 1 cardiólogo)
  • 2 pacientes
  • 2 citas programadas
  • 5 configuraciones del sistema
  
  🔐 Credenciales de prueba:
  
  Administrador:
  • Email: admin@gaia-eps.com
  • Password: Admin123!
  
  Médico General:
  • Email: dr.garcia@gaia-eps.com
  • Password: Doctor123!
  
  Cardióloga:
  • Email: dra.rodriguez@gaia-eps.com
  • Password: Doctor123!
  
  Pacientes:
  • Email: juan.perez@email.com
  • Password: Patient123!
  
  • Email: ana.martinez@email.com
  • Password: Patient123!
  `)
}

main()
  .catch((e) => {
    console.error("❌ Error durante el seed:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
