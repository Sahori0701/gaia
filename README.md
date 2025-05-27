# 🏥 Gaia - Sistema de Gestión de Salud EPS

Sistema integral de gestión de salud para EPS en Colombia, desarrollado con Node.js, Express, Prisma y PostgreSQL.

## 🌟 Características

- ✅ **Autenticación JWT** con roles y permisos
- ✅ **Gestión de Pacientes** con validaciones colombianas
- ✅ **Sistema de Citas Médicas** con disponibilidad
- ✅ **Historia Clínica Digital** con encriptación
- ✅ **Logs de Auditoría** para cumplimiento normativo
- ✅ **API RESTful** completa y documentada
- ✅ **Cumplimiento normativo** colombiano

## 🏗️ Arquitectura

\`\`\`
gaia/
├── backend/                 # API Backend
│   ├── config/             # Configuraciones
│   ├── controllers/        # Controladores
│   ├── middleware/         # Middlewares
│   ├── routes/            # Rutas
│   ├── utils/             # Utilidades
│   ├── prisma/            # Esquema de BD
│   └── server.js          # Servidor principal
└── frontend/              # Frontend Next.js (próximamente)
\`\`\`

## 🚀 Instalación y Configuración

### Prerrequisitos

- Node.js 18+
- PostgreSQL (Neon)
- npm o yarn

### 1. Clonar el repositorio

\`\`\`bash
git clone https://github.com/tu-usuario/gaia-eps.git
cd gaia-eps/backend
\`\`\`

### 2. Instalar dependencias

\`\`\`bash
npm install
\`\`\`

### 3. Configurar variables de entorno

Crea un archivo `.env` en el directorio `backend/`:

\`\`\`env
# Base de datos
DATABASE_URL="postgresql://username:password@ep-xxx.us-east-1.aws.neon.tech/gaia_db?sslmode=require"

# JWT
JWT_SECRET=tu_jwt_secret_muy_seguro
JWT_REFRESH_SECRET=tu_refresh_secret_muy_seguro
JWT_EXPIRE=24h
JWT_REFRESH_EXPIRE=7d

# Encriptación
ENCRYPTION_KEY=tu_encryption_key_32_caracteres

# Servidor
PORT=3001
NODE_ENV=development

# Colombia
TIMEZONE=America/Bogota
COUNTRY_CODE=CO
\`\`\`

### 4. Configurar base de datos

\`\`\`bash
# Generar cliente Prisma
npx prisma generate

# Aplicar esquema
npx prisma db push

# Poblar con datos de prueba
npm run db:seed
\`\`\`

### 5. Iniciar servidor

\`\`\`bash
# Desarrollo
npm run dev

# Producción
npm start
\`\`\`

## 📚 API Endpoints

### 🔐 Autenticación
- `POST /api/auth/register` - Registrar usuario
- `POST /api/auth/login` - Iniciar sesión
- `POST /api/auth/refresh` - Renovar token
- `GET /api/auth/profile` - Obtener perfil
- `PUT /api/auth/change-password` - Cambiar contraseña

### 👥 Pacientes
- `GET /api/patients` - Listar pacientes
- `POST /api/patients` - Crear paciente
- `GET /api/patients/:id` - Obtener paciente
- `PUT /api/patients/:id` - Actualizar paciente
- `GET /api/patients/stats` - Estadísticas

### 📅 Citas Médicas
- `GET /api/appointments` - Listar citas
- `POST /api/appointments` - Crear cita
- `GET /api/appointments/:id` - Obtener cita
- `PUT /api/appointments/:id` - Actualizar cita
- `PATCH /api/appointments/:id/cancel` - Cancelar cita
- `GET /api/appointments/stats` - Estadísticas
- `GET /api/appointments/available-slots` - Horarios disponibles

### 📋 Historia Clínica
- `GET /api/medical-records` - Listar registros
- `POST /api/medical-records` - Crear registro
- `GET /api/medical-records/:id` - Obtener registro
- `PUT /api/medical-records/:id` - Actualizar registro
- `GET /api/medical-records/patient/:id/history` - Historia completa
- `GET /api/medical-records/stats` - Estadísticas

## 🔒 Seguridad

- **JWT** con refresh tokens
- **Rate limiting** por IP
- **Encriptación** de datos sensibles
- **Validaciones** de documentos colombianos
- **Logs de auditoría** por 7 años
- **CORS** configurado
- **Helmet** para headers de seguridad

## 📊 Cumplimiento Normativo

- ✅ Resolución 3374 de 2000 (Historia clínica)
- ��� Ley 1581 de 2012 (Habeas Data)
- ✅ Resolución 2003 de 2014 (RIPS)
- ✅ Circular 030 de 2013 (Seguridad información)

## 🧪 Pruebas

\`\`\`bash
# Probar servidor
npm run test

# Probar endpoints específicos
npm run test:endpoints
\`\`\`

## 👥 Credenciales de Prueba

- **Admin**: `admin@gaia-eps.com` / `Admin123!`
- **Doctor**: `dr.garcia@gaia-eps.com` / `Doctor123!`
- **Paciente**: `juan.perez@email.com` / `Patient123!`

## 🛠️ Tecnologías

- **Backend**: Node.js, Express.js
- **Base de datos**: PostgreSQL (Neon)
- **ORM**: Prisma
- **Autenticación**: JWT
- **Validación**: express-validator
- **Logs**: Winston
- **Seguridad**: Helmet, CORS, bcryptjs
- **Encriptación**: crypto-js

## 📈 Roadmap

- [ ] Frontend Next.js
- [ ] Módulo de farmacia
- [ ] Generación de reportes RIPS
- [ ] Integración con laboratorios
- [ ] App móvil
- [ ] Telemedicina

## 🤝 Contribuir

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📄 Licencia

Este proyecto está bajo la Licencia MIT - ver el archivo [LICENSE](LICENSE) para detalles.

## 📞 Contacto

- **Proyecto**: Gaia EPS
- **Email**: contacto@gaia-eps.com
- **Website**: https://gaia-eps.vercel.app

---

Desarrollado con ❤️ para el sistema de salud colombiano
