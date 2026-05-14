# Matriz Propuesta Aceptada Vs Desarrollo Real Escuela Pass

**Proyecto:** Escuela Pass — Administración y Seguridad Escolar  
**Autor:** Jhon Kevin Murillo Martínez  
**Tipo de documento:** Comparación de alcance, cumplimiento y cambios justificados  
**Fuentes:** `FTG_Propuesta Aceptada.docx`, código fuente, pruebas E2E y documentación técnica  
**Versión:** 1.0

## 1. Propósito

Esta matriz compara la propuesta aceptada con el desarrollo real implementado en el repositorio. Su
función es preparar una defensa técnica y académica de los cambios ocurridos durante el desarrollo,
evitando contradicciones entre el trabajo de grado, los anexos y el código.

## 2. Objetivo General Propuesto

La propuesta plantea desarrollar una aplicación web integral para AlfaNetworks orientada a la
administración y seguridad escolar en instituciones educativas privadas de México, mediante NestJS,
PostgreSQL, JavaScript, NFC y QR, con el fin de optimizar procesos operativos, fortalecer la seguridad
estudiantil y proteger datos personales.

El desarrollo conserva ese núcleo y lo amplía con controles de privacidad, auditoría, archivos
privados, pruebas E2E, multiinstitución, boletines académicos, visitas, reuniones y mecanismos de
operación institucional.

## 3. Objetivos Específicos Y Evidencia

| Objetivo específico de la propuesta | Evidencia en desarrollo | Estado | Justificación |
| --- | --- | --- | --- |
| Analizar requerimientos funcionales y no funcionales. | Entregables `00` y `01`, E2E, módulos por dominio, documentación técnica. | Cumplido. | La especificación se consolidó en RF/RNF y se refinó con hallazgos del código. |
| Diseñar arquitectura, modelo relacional e interfaces responsive. | `src/app.module.ts`, entidades TypeORM, `frontend/src/App.tsx`, `navConfig`, entregables `03`, `04`, `05`, `06`. | Cumplido y ampliado. | Se agregaron flujos de privacidad, multiinstitución, archivos privados y paneles. |
| Implementar backend con NestJS y PostgreSQL para autenticación, acceso, gestión, circuito y pagos. | Módulos `auth`, `access`, `school`, `circuit`, `payments`, `attendance`, `activities`, `report-cards`, `files`, `privacy`, `audit`. | Cumplido y ampliado. | El backend supera el alcance mínimo al incluir módulos académicos y de cumplimiento. |
| Desarrollar frontend con JavaScript moderno para perfiles administrativos, docentes, padres y personal. | React/Vite, rutas protegidas, páginas por rol, componentes de circuito, finanzas, académico, perfil y administración. | Cumplido. | La solución funciona como SPA responsive, incluyendo pantallas móviles para padres. |
| Validar el sistema mediante pruebas funcionales, integración, usabilidad y métricas. | `test/app.e2e-spec.ts`, `test/phase7-closure.e2e-spec.ts`, `test/auth-throttle-ip.e2e-spec.ts`, smoke scripts. | Parcialmente cumplido con evidencia técnica fuerte. | Existen E2E amplias; las pruebas de usabilidad con usuarios piloto deben documentarse como recomendación o pendiente si no se ejecutan formalmente. |

## 4. RF/RNF Frente A Implementación

| Código | Propuesta aceptada | Implementación real | Estado | Observación para TDG |
| --- | --- | --- | --- | --- |
| RF1 | Autenticación con roles diferenciados y JWT. | `auth`, JWT, refresh/logout, `RolesGuard`, `JwtStrategy`, rutas protegidas y gates frontend. | Cumplido. | Mencionar validación adicional de usuario activo e invalidación de cuentas inactivas. |
| RF2 | Acceso mediante NFC y QR. | `access`, credenciales QR/NFC/manual, deduplicación, aislamiento por escuela y registro de eventos. | Cumplido. | La lectura NFC/QR se integra con asistencia cuando aplica. |
| RF3 | Circuito vial con GPS y conductor. | `circuit`, mapa, GPS padre, estados, notificaciones, vehículos de padres y autorización de entrega. | Cumplido con ajuste interpretativo. | Debe explicarse que el conductor operativo es el padre/tutor, no un conductor institucional. |
| RF4 | Administración de alumnos, docentes, grupos y asignaturas. | `school`, `schools`, importaciones Excel, lifecycle, asignaciones, multiinstitución. | Ampliado. | Se incorporó gestión multiinstitución y estados de ciclo de vida. |
| RF5 | Asistencia y calificaciones con exportaciones/reportes. | `attendance`, `class-attendance`, `activities`, `academic-periods`, `report-cards`, `documents`, `exports`. | Ampliado. | Incluye boletines PDF, asistencia por clase y periodos cerrados. |
| RF6 | Pagos y colegiaturas con comprobantes manuales. | `payments`, `uploads`, `files`, comprobantes privados, verificación/rechazo y límites de intentos. | Cumplido y fortalecido. | No hay pasarela automática; se respeta el fuera de alcance. |
| RF7 | Avisos y notificaciones. | `notices`, `notifications`, FCM, bandeja, correo y reportes administrativos. | Cumplido y ampliado. | Documentar FCM como opcional según configuración. |
| RF8 | Dashboard administrativo con reportes básicos. | `dashboard`, `dashboards`, `reports`, `exports`, KPIs y panel por rol. | Ampliado. | La implementación incluye indicadores accionables y exportaciones. |
| RNF1 | NestJS y PostgreSQL. | NestJS 10, TypeORM, PostgreSQL, migraciones y esquema v4. | Cumplido. | TypeORM se justifica por integración con NestJS. |
| RNF2 | Diseño responsive. | React/Vite/Tailwind, rutas móviles, circuito padre y dark mode. | Cumplido. | Respaldar con capturas UI/UX en anexos. |
| RNF3 | bcrypt, HTTPS, validación e inyección SQL. | bcrypt, ValidationPipe, TypeORM, SQL parametrizado, helmet, CORS, archivos privados. | Cumplido parcialmente por entorno. | HTTPS depende del despliegue; la API implementa controles internos. |
| RNF4 | Respuestas menores a 2 segundos. | Índices, consultas optimizadas, E2E, dashboard/reportes. | Requiere métrica formal. | Debe validarse con mediciones o presentarse como criterio de prueba propuesto. |
| RNF5 | Interfaz intuitiva. | Navegación por rol, componentes reutilizables, skeletons, error boundary, dark mode. | Requiere validación de usuarios. | Recomendable encuesta o prueba piloto. |
| RNF6 | Hosting de AlfaNetworks. | Railway para API, PostgreSQL y volumen; frontend estático/Vercel. | Ajustado. | Justificar como cambio técnico por despliegue cloud y mantenimiento. |

## 5. Cambios Y Ampliaciones Justificadas

| Cambio real | Motivo | Beneficio | Dónde documentarlo |
| --- | --- | --- | --- |
| Railway/Vercel en lugar de cPanel. | Facilita despliegue Node/PostgreSQL, variables y volumen persistente. | Menor fricción operativa y mejor alineación con backend NestJS. | Metodología, arquitectura y despliegue. |
| Mapbox y Haversine. | Requiere mapa y cálculo de distancia para circuito. | Visualización y fallback sin dependencia completa de proveedor externo. | Arquitectura e RF3. |
| Privacidad y auditoría. | El sistema trata datos de menores y requiere trazabilidad. | Mejora cumplimiento, seguridad y defensa académica. | Marco legal, desarrollo y resultados. |
| Archivos privados. | Comprobantes y evidencias no deben exponerse públicamente. | Reduce riesgo IDOR y acceso indebido. | Seguridad, manual técnico e informe de pruebas. |
| Boletines, periodos y asistencia por clase. | El alcance académico evolucionó más allá de notas básicas. | Mayor completitud funcional para institución educativa. | Desarrollo académico y anexos. |
| Lifecycle de alumnos/docentes. | Se requieren bloqueos operativos al cambiar estados. | Evita operaciones con usuarios inactivos o trasladados. | Gestión escolar, seguridad y pruebas. |
| E2E Phase 7. | Necesidad de QA cruzado y evidencia de cierre. | Mayor confianza para entrega y anexos de pruebas. | Informe de pruebas. |

## 6. Fuera De Alcance Conservado

La implementación respeta los principales elementos fuera de alcance de la propuesta:

- No se desarrollaron aplicaciones móviles nativas; se usa aplicación web responsive.
- No se implementó pasarela automática de pagos.
- No se implementó reconocimiento facial.
- No se implementó soporte multiidioma.
- No se implementó analítica avanzada con inteligencia artificial como funcionalidad de producto.

## 7. Puntos De Defensa Académica

- Las ampliaciones no cambian el problema central: fortalecen administración, seguridad y protección
  de datos en instituciones educativas.
- El cambio de interpretación de RF3 debe expresarse con claridad: los padres o tutores son quienes
  conducen al recoger a sus hijos; por tanto, la aplicación web móvil del conductor corresponde al
  dispositivo del padre/tutor.
- Las herramientas no previstas se justifican por compatibilidad técnica, disponibilidad, seguridad,
  costo de operación o facilidad de despliegue.
- Las métricas de rendimiento y usabilidad deben documentarse con evidencia real si se ejecutan; si
  no, se deben presentar como plan de validación o recomendación futura.
