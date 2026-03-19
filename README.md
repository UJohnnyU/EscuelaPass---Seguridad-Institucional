# 🎓 Escuela Pass

[![NestJS](https://img.shields.io/badge/NestJS-10.x-E0234E?style=flat&logo=nestjs)](https://nestjs.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15.x-336791?style=flat&logo=postgresql)](https://www.postgresql.org/)
[![JavaScript](https://img.shields.io/badge/JavaScript-ES6+-F7DF1E?style=flat&logo=javascript)](https://developer.mozilla.org/es/docs/Web/JavaScript)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
![Status](https://img.shields.io/badge/status-en%20desarrollo-blue)

**Escuela Pass** es una aplicación web integral desarrollada para **AlfaNetworks** que moderniza la administración y seguridad en instituciones educativas privadas de México y Latinoamérica. Integra tecnologías **NFC**, **códigos QR** y **geolocalización GPS** en una plataforma unificada para optimizar procesos operativos, fortalecer la seguridad estudiantil y garantizar la protección de datos personales conforme a las normativas vigentes (Ley 1581 de 2012 en Colombia y Ley Federal de Protección de Datos en México).

## ✨ Características principales

### 🔐 Autenticación y control de accesos
- Roles diferenciados: administrador, docente, padre de familia, conductor.
- Autenticación segura con **JWT**.
- Control de accesos mediante lectura de tarjetas **NFC** y escaneo de **códigos QR dinámicos**.
- Registro en tiempo real de entradas y salidas.

### 🚌 Circuito vial con geolocalización
- Seguimiento GPS en tiempo real de vehículos de transporte escolar.
- Notificaciones automáticas a padres sobre proximidad y llegada del vehículo.
- Reducción estimada del 35‑40% en tiempos de espera.

### 📚 Gestión académica
- Administración de alumnos, docentes, grupos y asignaturas.
- Registro digital de asistencia y calificaciones.
- Generación de reportes exportables.

### 📱 Comunicación en tiempo real
- Sistema de notificaciones push (Firebase Cloud Messaging).
- Avisos institucionales y comunicación directa escuela‑familia.
- Dashboard administrativo con métricas y reportes básicos.

## 🛠️ Tecnologías utilizadas

| Capa           | Tecnologías                                                                 |
|----------------|-----------------------------------------------------------------------------|
| **Backend**    | NestJS (TypeScript), JWT, TypeORM / Prisma, PostgreSQL                     |
| **Frontend**   | JavaScript, HTML5, CSS3 (diseño responsive)                          |
| **Servicios externos** | Google Maps API / Mapbox (geolocalización), Firebase Cloud Messaging (notificaciones) |
| **Herramientas** | Git, GitHub, Figma, Lucidchart, Postman                                    |
