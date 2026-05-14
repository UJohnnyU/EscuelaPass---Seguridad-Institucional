# Inventario De Fuentes Para El TDG Escuela Pass

**Proyecto:** Escuela Pass — Administración y Seguridad Escolar  
**Autor:** Jhon Kevin Murillo Martínez  
**Programa:** Ingeniería Informática — Área de Programas Informáticos y Telecomunicaciones  
**Tipo de documento:** Inventario de fuentes y alcance documental  
**Versión:** 1.0  
**Fecha de trabajo:** 2026  

## 1. Propósito

Este documento consolida las fuentes disponibles para la elaboración de los entregables, anexos y documento principal del Trabajo de Grado (TDG) de Escuela Pass. Su finalidad es evitar redacción superficial, contradicciones entre código y documentación, omisiones de alcance y afirmaciones sin evidencia técnica.

El inventario sirve como punto de partida para las fases de análisis profundo, comparación propuesta-desarrollo, elaboración de anexos y validación global de coherencia.

## 2. Alcance Del Análisis

El análisis documental se limita al contenido versionado y relevante del proyecto. Se excluyen dependencias, archivos generados, evidencias temporales y artefactos que no representan el diseño real del sistema.

### 2.1 Fuentes Incluidas

| Categoría | Rutas principales | Uso documental |
| --- | --- | --- |
| Backend | `src/` | Arquitectura, módulos, servicios, controladores, DTO, seguridad, lógica de negocio y persistencia. |
| Frontend | `frontend/src/` | Flujos de usuario, navegación, páginas por rol, componentes, UI/UX y consumo de API. |
| Base de datos | `src/database/`, `scripts/database/` | Entidades, migraciones, esquema de referencia, seeds y modelo de datos. |
| Pruebas | `test/` | Evidencia de validación funcional, seguridad, flujos críticos y pruebas E2E. |
| Documentación técnica | `README.md`, `docs/`, `docs/releases/` | Instalación, despliegue, configuración, decisiones operativas y runbooks. |
| Entregables base | `docs/tdg/entregables/` | Anexos documentales a completar con estructura profesional y trazabilidad. |
| Configuración | `package.json`, `frontend/package.json`, `railway.toml`, archivos de entorno ejemplo | Tecnologías, scripts, despliegue y dependencias relevantes. |

### 2.2 Fuentes Excluidas

| Categoría | Motivo de exclusión |
| --- | --- |
| `node_modules/` | Dependencias externas, no representan autoría ni diseño del proyecto. |
| `dist/`, `build/`, `coverage/` | Artefactos generados. |
| `uploads/` | Archivos cargados, comprobantes, evidencias y salidas temporales de prueba. |
| PDFs E2E temporales | Fixtures de pruebas, no documentación final. |
| Logs y salidas de terminal | Evidencia auxiliar, no fuente normativa permanente. |

## 3. Documentos Académicos Requeridos

Los siguientes documentos fueron indicados como insumos obligatorios por el autor del proyecto:

| Documento | Ruta confirmada | Uso previsto | Estado |
| --- | --- | --- | --- |
| `TDG_Plantilla y Normas.docx` | `docs/tdg/TDG_Plantilla y Normas.docx` | Plantilla del TDG, estructura institucional, portada, contraportada, logos, orden de páginas y capítulos. | Disponible y versionado. |
| `CLASE MANUAL DE ESTILO.pdf` | `docs/tdg/CLASE MANUAL DE ESTILO.pdf` | Manual de estilo APIT, adaptación APA, formato general, títulos, tablas, figuras, citación y referencias. | Disponible y versionado. |
| `FTG_Propuesta Aceptada.docx` | `docs/tdg/FTG_Propuesta Aceptada.docx` | Fuente oficial de planteamiento del problema, justificación, objetivos, alcance, RF/RNF y entregables aprobados. | Disponible y versionado. |
| `TDG_santiago_alvarez82192_20251020.docx` | `docs/tdg/TDG_santiago_alvarez82192_20251020.docx` | Trabajo externo de referencia para observar buenas prácticas de estructura, nivel de detalle y distribución de anexos, sin copiar redacción. | Disponible y versionado. |

**Condición de calidad actualizada:** la redacción final del TDG ya puede incorporar la lectura normativa, la propuesta aprobada y la referencia estructural. El trabajo externo solo debe usarse como insumo metodológico y formal; queda prohibida la reutilización de párrafos, títulos específicos o secuencias textuales que puedan generar similitud indebida.

## 4. Fuentes Técnicas Identificadas

### 4.1 Backend

El backend se implementa con NestJS, TypeORM y PostgreSQL. El módulo raíz (`src/app.module.ts`) registra contextos de autenticación, acceso, circuito, asistencia, actividades, periodos académicos, boletines, pagos, reportes, dashboard, archivos privados, privacidad, auditoría, visitas, reuniones, configuración institucional y multiinstitución.

Tecnologías verificadas en `package.json`:

- NestJS 10.
- TypeORM.
- PostgreSQL mediante `pg`.
- JWT, Passport y bcrypt.
- `class-validator` y `class-transformer`.
- `@nestjs/throttler`.
- `@nestjs/schedule`.
- `pdfkit`, `exceljs`, `multer`, `magic-bytes.js`.
- Firebase Admin y Nodemailer.

### 4.2 Frontend

El frontend se implementa con React 18, Vite, TypeScript, Tailwind, Axios, React Router, Mapbox, Firebase Web, `html5-qrcode` y `qrcode.react`. Su análisis se orienta a páginas por rol, flujos de operación, pantallas para anexos UI/UX y manual de usuario.

### 4.3 Base De Datos

La persistencia usa entidades TypeORM, migraciones y SQL de referencia. El repositorio documenta dos rutas válidas: aplicar esquema de referencia en entornos greenfield o ejecutar la cadena formal de migraciones TypeORM.

### 4.4 Pruebas Y Validación

La evidencia principal de validación está en:

- `test/app.e2e-spec.ts`.
- `test/phase7-closure.e2e-spec.ts`.
- `test/auth-throttle-ip.e2e-spec.ts`.
- `test/setup-e2e-db.js`.

Estas pruebas cubren autenticación, asistencia, circuito, pagos, privacidad, seguridad, archivos privados, lifecycle, reportes, dashboards, boletines y flujos críticos.

## 5. Entregables Base Disponibles

| Código | Documento | Propósito |
| --- | --- | --- |
| 00 | Matriz de trazabilidad | Relacionar propuesta, requerimientos, código y evidencia. |
| 01 | Documento de requerimientos | Definir actores, RF, RNF, reglas y criterios. |
| 02 | Actas de reuniones | Registrar decisiones, cambios, acuerdos y evidencias de seguimiento. |
| 03 | Documento de arquitectura | Explicar vistas lógica, despliegue, seguridad, persistencia e integraciones. |
| 04 | Modelo entidad-relación | Documentar entidades, relaciones y reglas de datos. |
| 05 | Diagramas UML | Consolidar casos de uso, secuencia, componentes y flujos. |
| 06 | Prototipos UI/UX | Indicar pantallas, capturas y prototipos requeridos. |
| 07 | Manual técnico | Guiar instalación, configuración, despliegue y mantenimiento. |
| 08 | Documentación API | Presentar endpoints, autenticación, permisos y cuerpos relevantes. |
| 09 | Manual de usuario | Explicar operación por rol. |
| 10 | Informe de pruebas y métricas | Evidenciar validación funcional, técnica y operativa. |
| 99 | Nota de verificación | Checklist final de coherencia documental. |

## 6. Reglas De Redacción Para Las Siguientes Fases

- No afirmar cumplimiento de un requerimiento sin evidencia en código, prueba, documentación técnica o propuesta.
- No copiar redacción de la propuesta ni del TDG externo; cuando se use una fuente, debe citarse o parafrasearse con rigor.
- Mantener los anexos detallados fuera del límite de 50 páginas del documento principal.
- Usar Mermaid para diagramas textuales reproducibles.
- Usar placeholders entre corchetes para imágenes, capturas o prototipos que deban insertarse manualmente.
- Explicar siglas y términos en inglés en su primera aparición.
- Mantener la interpretación de RF3 como circuito de recogida operado por padres o tutores, no por conductores institucionales.

## 7. Riesgos Y Pendientes

| Riesgo | Impacto | Acción requerida |
| --- | --- | --- |
| Lectura parcial de documentos normativos | Podría generar formato inconsistente con la plantilla o el manual de estilo. | Extraer reglas de portada, contraportada, títulos, tablas, figuras, citación y estructura antes de redactar entregables finales. |
| Comparación incompleta propuesta-código | Podría omitir cambios reales frente al FTG aprobado. | Construir matriz propuesta-desarrollo con evidencia de módulos, pruebas, pantallas y decisiones técnicas. |
| Similitud con el TDG externo | Riesgo académico y de Turnitin si se copian expresiones o estructura textual. | Usarlo solo para buenas prácticas abstractas; redactar todo el contenido con voz propia y evidencia del proyecto. |
| Límite de 50 páginas | Riesgo de exceso si se incluye detalle técnico en el documento principal. | Mantener manuales, matrices y diagramas como anexos. |

## 8. Resultado De La Fase 0

La Fase 0 establece el alcance, fuentes técnicas disponibles, exclusiones, entregables base y documentos académicos ya localizados. Con esto se puede iniciar la lectura profunda del repositorio, la extracción normativa, la comparación entre propuesta aceptada y desarrollo real, y la mejora progresiva de los entregables anexos.
