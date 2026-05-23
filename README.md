# Escuela Pass

[![NestJS](https://img.shields.io/badge/NestJS-10.x-E0234E?style=flat&logo=nestjs)](https://nestjs.com/)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=flat&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=flat&logo=typescript)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?style=flat&logo=postgresql)](https://www.postgresql.org/)
[![License](https://img.shields.io/badge/License-Proprietary-red.svg)](LICENSE)
![Status](https://img.shields.io/badge/status-producción%20%2F%20TDG-blue)

**Escuela Pass** es una plataforma web institucional para la **administración, operación diaria y seguridad escolar** en colegios privados de **México** (con perspectiva de expansión regional). Integra control de accesos con **NFC** y **QR**, circuito de recogida con **geolocalización**, gestión académica, finanzas, comunicación y auditoría en un mismo sistema multi-rol y multi-colegio.

Desarrollada como **Trabajo de Grado** en el Politécnico Colombiano Jaime Isaza Cadavid (POLI JIC) por **Murillo Martínez Jhon Kevin**. El código fuente es **software propietario**; consulte [LICENSE](LICENSE) para condiciones de uso.

## Características principales

### Autenticación, roles y seguridad
- Roles: **administrador**, **administrativo**, **docente**, **padre/madre de familia** y **alumno**.
- Autenticación con **JWT**, refresh tokens, recuperación de contraseña y **throttling** configurable por IP.
- **Auditoría** de acciones sensibles, archivos privados con validación y aceptación de **política de privacidad**.

### Control de accesos al plantel
- Registro de entradas y salidas con credenciales **NFC** (incluye lectura Web NFC) y **códigos QR**.
- Vinculación, revocación y reactivación de credenciales por usuario.
- Escáner operativo para personal autorizado en portería o puntos de control.

### Circuito de recogida y movilidad
- **Circuito del día** para docentes y personal administrativo.
- Seguimiento en mapa (**Mapbox**) del avance del padre/madre hacia el colegio.
- Notificaciones push sobre el estado del circuito (Firebase Cloud Messaging).
- Consentimiento de salida y coordinación con horarios institucionales.

### Gestión académica y operativa
- Alumnos, docentes, padres, grupos, asignaturas y **multi-colegio**.
- **Horarios**, periodos académicos, sesiones de clase y **asistencia por clase**.
- Actividades, calificaciones, boletines y anotaciones docentes.
- Reuniones, visitas externas, avisos institucionales y reportes administrativos.

### Finanzas e integraciones
- Conceptos de pago, deudas, comprobantes y herramientas de gestión financiera por rol.
- **Importación y exportación** de datos operativos.
- Notificaciones push, correo transaccional y panel de inicio por perfil.

## Stack tecnológico

| Capa | Tecnologías |
|------|-------------|
| **Backend** | NestJS 10, TypeScript, TypeORM, PostgreSQL, Passport/JWT, bcrypt |
| **Frontend** | React 18, TypeScript, Vite, Tailwind CSS, React Router |
| **Accesos** | Web NFC, html5-qrcode, QR dinámicos |
| **Mapas y push** | Mapbox GL, Firebase Cloud Messaging |
| **Infraestructura** | Railway (API + Postgres), GitHub Actions (CI/E2E), despliegue frontend separado |

## Estructura del repositorio

| Ruta | Descripción |
|------|-------------|
| [`01 - Escuela Pass/`](01%20-%20Escuela%20Pass/) | Aplicación principal: API NestJS + SPA React |
| [`01 - Escuela Pass/src/`](01%20-%20Escuela%20Pass/src/) | Backend modular por dominio (`access`, `circuit`, `school`, `payments`, etc.) |
| [`01 - Escuela Pass/frontend/`](01%20-%20Escuela%20Pass/frontend/) | Interfaz web responsive con navegación por rol |
| [`01 - Escuela Pass/scripts/`](01%20-%20Escuela%20Pass/scripts/) | Utilidades de base de datos y seeds (**solo dev/staging**) |
| [`.github/workflows/`](.github/workflows/) | CI del backend (build, lint, pruebas E2E con PostgreSQL 16) |
| [`LICENSE`](LICENSE) | Licencia propietaria y autorización académica POLI JIC |

## Inicio rápido

Desde la carpeta de la aplicación:

```bash
cd "01 - Escuela Pass"
cp .env.example .env          # backend
npm install
npm run start:dev

cd frontend
cp .env.example .env          # frontend
npm install
npm run dev
```

Requisitos: **Node.js 20+** y **PostgreSQL**. Para esquema inicial puede usarse `npm run db:apply` (greenfield) o migraciones TypeORM según el entorno. Detalle operativo en [`01 - Escuela Pass/README.md`](01%20-%20Escuela%20Pass/README.md).

## Privacidad y cumplimiento

El diseño contempla buenas prácticas de protección de datos personales en contexto institucional **mexicano**, con referencia a la **LFPDPPP** (Ley Federal de Protección de Datos Personales en Posesión de los Particulares). En el código se aplican controles de acceso por rol, minimización de exposición de PII, redacción en logs y registro de eventos relevantes (módulos `privacy` y `audit`).

La zona horaria operativa predeterminada es **`America/Mexico_City`** (`APP_TIMEZONE`).

## Licencia y contacto

Copyright © 2026 **Murillo Martínez Jhon Kevin**. **All Rights Reserved.**

- Uso, copia, modificación o explotación comercial requieren **autorización escrita** del titular.
- El **POLI JIC** dispone de autorización limitada, no exclusiva y sin fines de lucro, para archivo y consulta académica de la versión entregada como Trabajo de Grado.
- Los componentes de terceros se rigen por sus propias licencias (ver `package.json` de backend y frontend).

Consultas de licenciamiento: **jhonkevinmurillom@gmail.com**
