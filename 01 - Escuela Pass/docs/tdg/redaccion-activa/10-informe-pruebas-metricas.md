# ESCUELA PASS — Administración y seguridad escolar

## 10. Informe de pruebas y métricas Escuela Pass

**Jhon Kevin Murillo Martínez**  
Ingeniería Informática — Área de Programas Informáticos y Telecomunicaciones (APIT)  
Facultad de Ingenierías — Politécnico Colombiano Jaime Isaza Cadavid  

**Tipo de documento:** Anexo documental del trabajo de grado  
**Versión:** 1.0 documental  
**Año:** 2026  

---

**Proyecto:** Escuela Pass — Administración y seguridad escolar  
**Autor:** Jhon Kevin Murillo Martínez  
**Programa:** Ingeniería Informática — Área de Programas Informáticos y Telecomunicaciones  
**Tipo de documento:** Validación funcional y operativa  
**Versión:** 1.0 documental  

---

## 1. Propósito

**Nota de acrónimos del anexo.** **E2E** (*end-to-end*), **CI** (Continuous Integration), **CD** (Continuous Deployment), **KPI** (Key Performance Indicator), **SLA** (Service Level Agreement), **SUS** (System Usability Scale; Brooke, 1996), **UMUX** (Usability Metric for User Experience; Lewis & Sauro, 2018), **RNF** (requerimiento no funcional), **JWT** (JSON Web Token), **PDF** (Portable Document Format), **XLSX** (Office Open XML Spreadsheet).

Este anexo consolida la estrategia de pruebas, la trazabilidad entre requerimientos y evidencias automáticas o manuales, las métricas propuestas para acreditar los requerimientos no funcionales de eficiencia de desempeño y usabilidad, y los riesgos conocidos de cobertura. La estructura sigue la práctica recomendada de la **IEEE Std 829-2008** sobre documentación de pruebas de software (IEEE, 2008), articulada con el modelo de calidad **ISO/IEC 25010:2011** (ISO, 2011). Complementa la **matriz del Anexo 00**, los criterios del **Anexo 01**, la arquitectura y limitaciones del **Anexo 03**, los diagramas del **Anexo 05**, el inventario de interfaz del **Anexo 06** y el **manual del Anexo 09**. Los contratos HTTP de referencia están en el **Anexo 08**; la puesta en marcha y el *pipeline*, en el **Anexo 07**. La sección 13 reúne líneas de mejora profesionales y académicas del plan de validación.

*[Figura 7. Plantilla del cuestionario System Usability Scale (SUS) traducida al español para evaluación de usabilidad con usuarios piloto, conforme a Brooke (1996) y benchmarks de Lewis y Sauro (2018). Recomendado: documento Word o Google Forms con escala Likert de 1 a 5.]*

*[Figura 8. Plan de medición de tiempos de respuesta para flujos críticos (autenticación, escaneo, circuito, exportaciones), con identificación de método, entorno, tamaño de muestra y umbral esperable, alineado con el atributo de eficiencia de desempeño de la ISO/IEC 25010. Recomendado: hoja de cálculo o tabla en el documento maquetado.]*

---

## 2. Marco documental y criterio de redacción

La presentación del trabajo de grado sigue el **manual de estilo APIT** (p. ej. Times New Roman 12 pt, márgenes estándar, títulos numerados, citación autor-fecha y referencias **APA 7** donde aplique) y la **plantilla TDG** institucional. Los alcances se alinean a la **propuesta FTG** (RF1–RF8, RNF1–RNF6). Esta síntesis se apoya en la propuesta, el **código fuente** (`test/`, `package.json`, flujo GitHub Actions) y la documentación técnica del repositorio.

---

## 3. Objetivo de la validación

Validar que Escuela Pass **cumple** los requerimientos funcionales y no funcionales definidos en el **Anexo 01** y la **matriz del Anexo 00**, con evidencia **reproducible** donde el repositorio lo permite (compilación, E2E con PostgreSQL, acciones manuales documentadas) y con **honestidad metodológica** donde la cobertura es parcial (pruebas unitarias acotadas, *frontend* fuera de CI, métricas de usuario piloto opcionales).

---

## 4. Estrategia de pruebas

| Tipo | Evidencia / artefacto | Propósito |
| --- | --- | --- |
| Compilación backend | `npm run build` (`nest build`) | Verificar que el servicio NestJS compila para despliegue. |
| E2E backend | `npm run test:e2e` (Jest, `test/jest-e2e.json`) | Ejecuta `*.e2e-spec.ts` bajo `test/` con **PostgreSQL** preparado por `pretest:e2e` → `node ./test/setup-e2e-db.js`. |
| E2E throttle IP | `npm run test:e2e:auth-throttle-ip` → `test/run-auth-throttle-e2e.cjs` | **Solo** con límite estricto (`AUTH_THROTTLE_LIMIT=5`); la suite `auth-throttle-ip` está en **`describe.skip`** salvo ese entorno (evitar 429 en la suite principal). |
| *Smoke* local | `npm run smoke:build`, `npm run smoke:e2e`, `npm run smoke:ci-local` | Secuencias cortas antes de entrega (*build* + E2E). |
| CI en GitHub | `.github/workflows/backend-ci.yml` en la **raíz del repositorio remoto**; job con `working-directory: 01 - Escuela Pass`, servicio **PostgreSQL 16**, pasos `npm ci`, `npm run build`, `npm run test:e2e` | Reproducibilidad en *pull request* y rama `main`. |
| Compilación *frontend* | `cd frontend && npm run build` | Recomendado para *release*; **no** forma parte del flujo *Backend CI* actual. |
| Pruebas manuales | Swagger (`/docs` si está habilitado), cliente React | Flujos de rol, UI y integraciones opcionales (FCM, mapas, SMTP). |
| Métricas | Tiempos, *health*, encuesta piloto | Acreditar **RNF4** y **RNF5** con mediciones y no solo con diseño. |

---

## 5. Casos críticos (síntesis funcional)

| Caso | Resultado esperado |
| --- | --- |
| **Login por rol** | *Tokens* válidos, sesión coherente; menú y permisos acordes al rol y a la API. |
| **Escaneo QR/NFC** | Registro de acceso o rechazo con mensaje controlado; duplicados acotados según reglas. |
| **Circuito (padre/tutor)** | Solicitud creada, estados y transiciones; *mapa*/avance donde aplique; confirmación explícita; bloqueos si el circuito está deshabilitado. |
| **Asistencia** | Registro por personal autorizado; consultas autorizadas para familia donde el dominio lo permite. |
| **Calificaciones y boletines** | Actividades con notas; boletines; restricciones con **periodo cerrado** donde aplique. |
| **Pagos (RF6)** | Deuda, comprobante, verificación o rechazo; archivos privados sirven solo con permiso. |
| **Avisos y RF7** | Bandeja; *push* FCM si el *token* y el servidor están configurados; **reportes administrativos** y SLA según roles. |
| **Panel y reportes (RF8)** | *Dashboard*, KPIs accionables, reportes y exportaciones según permisos. |

---

## 6. Métricas propuestas y alineación con RNF4 / RNF5

- **Tiempo de respuesta:** un objetivo orientativo (p. ej. orden de **2 segundos** en operaciones frecuentes de lectura) solo **acredita** **RNF4** si se documentan **método**, **entorno** (hardware, red, tamaño de datos) y **resultado** medido. El **Anexo 01** explicita que **no** se asume cumplimiento de umbrales históricos sin medición.  
- **Porcentaje de flujos críticos exitosos** en una corrida E2E o en una sesión de prueba manual registrada.  
- **Incidencias por rol** en prueba piloto (si se realiza).  
- **Satisfacción percibida** mediante encuesta breve o entrevista estructurada (**RNF5**).  
- **Disponibilidad / salud:** `GET /api/v1/health` (y variantes documentadas) como señal mínima de servicio en el entorno de prueba o producción.

---

## 7. Riesgos y limitaciones conocidas

- El **CI** documentado ejecuta *build* y **E2E del backend**; **no** ejecuta `npm run build` del **frontend** ni *lint* del cliente en ese flujo.  
- La **suite unitaria** (`npm test`) es **acotada**; el peso principal de la verificación automatizada está en **E2E** y *smokes*.  
- **Métricas de satisfacción** dependen de **usuarios piloto** o de convenio institucional; sin ellas, **RNF5** se apoya en criterios de diseño (**Anexo 06**) y manual (**Anexo 09**).  
- **Integraciones opcionales** (SMTP, FCM, Mapbox): ausencia de credenciales no invalida el núcleo RF, pero debe declararse en la demo (**Anexo 07**, **Anexo 01**).

---

## 8. Cobertura E2E documentada en el repositorio

`test/jest-e2e.json` selecciona archivos que coinciden con `\\.e2e-spec\\.ts$` bajo `test/`.

| Archivo | Contenido principal (ilustrativo) |
| --- | --- |
| `test/app.e2e-spec.ts` | Salud, autenticación y *refresh*, asistencia, credenciales y escaneo, clase, notas, circuito, reportes, exportaciones, *settings*, *dashboard*, importaciones, visitas, reuniones, *lifecycle* académico y otros flujos restaurados o ampliados. |
| `test/phase7-closure.e2e-spec.ts` | Casos de cierre: cruces de seguridad, circuito duplicado/deshabilitado, periodo cerrado, doble escaneo, comprobantes, revocación JWT, calificaciones con *force*, archivos privados, privacidad, *class-attendance* desde familia, entre otros. |
| `test/auth-throttle-ip.e2e-spec.ts` | *Throttle* estricto por IP en `auth/login` hacia **429**; **debe** ejecutarse vía `npm run test:e2e:auth-throttle-ip` (en la suite principal el bloque queda **omitido** salvo `AUTH_THROTTLE_LIMIT=5`). |

**Artefactos opcionales:** en `phase7-closure` pueden generarse PDF mínimos válidos con `pdfkit` bajo `uploads/`; con **`E2E_KEEP_UPLOAD_FIXTURES=1`** (o `true` / `yes`) pueden conservarse para inspección (**comentario en código** del spec).

### 8.1. Enumeración exhaustiva de casos `it(...)` en las suites E2E

Se enumeran los **47 casos** automatizados presentes en los tres archivos `*.e2e-spec.ts` del repositorio. La columna *identificador textual* corresponde literalmente al primer argumento del bloque `it(...)`; sirve como base de auditoría reproducible y se cita por nombre en la bitácora de pruebas (sección 8.3).

#### 8.1.1. `test/app.e2e-spec.ts` (33 casos)

| # | Identificador textual del caso |
| --- | --- |
| E2E‑A‑01 | `health (GET)` |
| E2E‑A‑02 | `auth: login -> refresh rotacion -> logout invalida refresh` |
| E2E‑A‑03 | `auth: refresh token invalido y logout invalido responden 401` |
| E2E‑A‑04 | `attendance: admin registra y upsert actualiza` |
| E2E‑A‑05 | `calendario: día sin clases bloquea registro de asistencia y export Excel` |
| E2E‑A‑06 | `access scan: ENTRY de alumno por QR marca asistencia automatica` |
| E2E‑A‑07 | `class-attendance: docente registra asistencia por clase y padre la consulta` |
| E2E‑A‑08 | `access scan: ENTRY tardio marca RETARDO sin pisar asistencia manual` |
| E2E‑A‑09 | `grades: docente registra y padre puede leer` |
| E2E‑A‑10 | `circuit + reports: circuito hoy y reportes responden` |
| E2E‑A‑11 | `circuit: docente solo ve solicitudes de alumnos en su clase actual` |
| E2E‑A‑12 | `circuit: sin registro presente/tardanza hoy bloquea solicitud del padre` |
| E2E‑A‑13 | `authz: padre no puede registrar asistencia (403)` |
| E2E‑A‑14 | `validation: asistencia con studentId invalido responde 400` |
| E2E‑A‑15 | `authz: padre no puede consultar reportes de pagos pendientes (403)` |
| E2E‑A‑16 | `school: administrativo lista grupos` |
| E2E‑A‑17 | `exports: Excel asistencia, calificaciones y boletín consolidado` |
| E2E‑A‑18 | `settings: perfil institucional lectura y actualización admin` |
| E2E‑A‑19 | `settings: circuito deshabilitado bloquea nuevas solicitudes de circuito` |
| E2E‑A‑20 | `circuit: padre actualiza GPS de su solicitud` |
| E2E‑A‑21 | `circuit: padre confirma entrega de su solicitud` |
| E2E‑A‑22 | `dashboard: admin consulta resumen y padre recibe 403` |
| E2E‑A‑23 | `school import: admin carga grupos por Excel y padre no puede` |
| E2E‑A‑24 | `school import: asignaciones por Excel y plantilla xlsx` |
| E2E‑A‑25 | `school import: historial de importaciones disponible para admin` |
| E2E‑A‑26 | `visitas, reuniones y horarios: padre solicita y staff responde` |
| E2E‑A‑27 | `lifecycle: transición alumno/docente con bloqueo operativo e historial` |
| E2E‑A‑28 | `t10/t11: SLA reportes + acuse crítico + recordatorio manual` |
| E2E‑A‑29 | `t12/t13: políticas de cartera + bitácora de ajustes` |
| E2E‑A‑30 | `t14: circuito GPS — auto-transición a NOTIFICADO_LLEGADA al entrar al radio` |
| E2E‑A‑31 | `t15: NFC — asignar, listar y revocar credencial` |
| E2E‑A‑32 | `t16: reuniones, visitas y anotaciones (padre) responden tras restaurar módulos` |
| E2E‑A‑33 | `t17: admin-reports (tickets SLA) están disponibles` |

#### 8.1.2. `test/phase7-closure.e2e-spec.ts` (13 casos)

| # | Identificador textual del caso |
| --- | --- |
| E2E‑P‑01 | `Circuito: padre crea solicitud y un segundo intento el mismo día devuelve 400` |
| E2E‑P‑02 | `Circuito deshabilitado cancela solicitudes abiertas y bloquea creación de nuevas` |
| E2E‑P‑03 | `Asistencia en periodo cerrado: docente sin acceso 403; ADMIN con force=true registra + audita` |
| E2E‑P‑04 | `Doble escaneo: segundo scan en <10s devuelve duplicate=true; tras la ventana se admite un nuevo evento` |
| E2E‑P‑05 | `Comprobantes pagos: 3 rechazos consecutivos bloquean el cuarto intento de carga` |
| E2E‑P‑06 | `Lifecycle revocación: desactivar al docente invalida su JWT en la siguiente request (401)` |
| E2E‑P‑07 | `Calificaciones publicadas: docente sin force 400; docente con force 403; ADMIN con force 200 + audit` |
| E2E‑P‑08 | `GET /files/comprobantes/* sin JWT devuelve 401` |
| E2E‑P‑09 | `Padre A no puede acceder a comprobante de hijo del Padre B (403); Padre B sí (200)` |
| E2E‑P‑10 | `ADMINISTRATIVO de otra escuela no puede leer reports/* de la escuela principal (403)` |
| E2E‑P‑11 | `/class-attendance/parent/me devuelve agrupación con registros para 2 hijos del padre` |
| E2E‑P‑12 | `JWT status off: admin desactiva usuario tras login y la próxima request responde 401` |
| E2E‑P‑13 | `Privacy gate: usuario sin aceptación recibe [] en /privacy/me/acceptances y mantiene acceso al backend` |

#### 8.1.3. `test/auth-throttle-ip.e2e-spec.ts` (1 caso)

| # | Identificador textual del caso |
| --- | --- |
| E2E‑T‑01 | `login con credenciales inválidas repeticiones terminan en 429` |

**Total automatizado:** 47 casos (33 + 13 + 1).

### 8.2. Convención de identificadores

Los identificadores `E2E‑A‑NN`, `E2E‑P‑NN` y `E2E‑T‑NN` permiten referenciar cada caso en la matriz de trazabilidad y en la bitácora de pruebas sin transcribir el identificador textual completo. La numeración sigue el orden de aparición en cada archivo del repositorio.

### 8.3. Plantilla de bitácora de pruebas (sesión real)

La siguiente plantilla se completa al ejecutar la suite en una sesión específica. Se recomienda guardar una copia diligenciada por entrega académica.

| ID | Identificador textual | Estado | Tiempo (s) | Observaciones |
| --- | --- | --- | --- | --- |
| E2E‑A‑01 | `health (GET)` | ☐ Pasó / ☐ Falló / ☐ Omitido | _____ | _____________________________________ |
| E2E‑A‑02 | `auth: login -> refresh rotacion -> logout invalida refresh` | ☐ Pasó / ☐ Falló / ☐ Omitido | _____ | _____________________________________ |
| E2E‑A‑… | (continuar con los 33 casos de `app.e2e-spec.ts`) | ☐ ☐ ☐ | _____ | _____________________________________ |
| E2E‑P‑01 | `Circuito: padre crea solicitud y un segundo intento el mismo día devuelve 400` | ☐ ☐ ☐ | _____ | _____________________________________ |
| E2E‑P‑… | (continuar con los 13 casos de `phase7-closure.e2e-spec.ts`) | ☐ ☐ ☐ | _____ | _____________________________________ |
| E2E‑T‑01 | `login con credenciales inválidas repeticiones terminan en 429` | ☐ ☐ ☐ | _____ | Requiere `AUTH_THROTTLE_LIMIT=5`. |

**Datos de la sesión:**

- **Fecha y hora de ejecución:** _________________________________________________________
- **Commit del repositorio:** ____________________________________________________________
- **Entorno:** ☐ Local ☐ CI ☐ Otro: _______________________________________________
- **Versión de PostgreSQL:** ____________________________________________________________
- **Resultado global:** ☐ Verde ☐ Amarillo (con omisiones documentadas) ☐ Rojo
- **Adjuntos:** captura de consola Jest, captura de GitHub Actions o equivalente.
- **Firma del responsable de la sesión:** ________________________________________________

---

## 9. Matriz pruebas — evidencia por requerimiento

| Requerimiento | Evidencia de prueba (orientativa) |
| --- | --- |
| **RF1** | Login, *refresh*, *logout*, cuenta inactiva, *throttle* (suite dedicada). |
| **RF2** | QR/NFC, duplicados, reglas de acceso. |
| **RF3** | Crear solicitud, bloqueo duplicado, GPS/estados, confirmación, circuito deshabilitado. |
| **RF4** | Nómina escolar, importaciones, *lifecycle*. |
| **RF5** | Asistencia, asistencia por clase, actividades, notas, boletines, periodo cerrado. |
| **RF6** | Comprobantes, rechazos, archivos privados. |
| **RF7** | *Admin reports*, SLA, recordatorios; FCM cuando el entorno lo permita. |
| **RF8** | Resumen de *dashboard*, KPIs accionables, reportes y exportaciones. |

*Nota:* Esta tabla es **síntesis**; el detalle vive en los `it(...)` de cada spec y en la **matriz del Anexo 00**.

---

## 10. Métricas a registrar en la entrega final del TDG

| Métrica | Fuente sugerida | Estado |
| --- | --- | --- |
| Resultado `npm run test:e2e` | Consola local o **GitHub Actions** | Adjuntar captura o enlace al *run*. |
| Tiempo total E2E | Salida Jest | Indicar commit o tag. |
| `npm run build` (backend) | Consola | Captura o log en anexo gráfico. |
| `npm run build` (*frontend*) | Consola en `frontend/` | Recomendado; captura si aplica. |
| Disponibilidad / salud | `GET .../health` | Captura desde Swagger o cliente HTTP. |
| Usabilidad / piloto | Encuesta o guión de sesión | **Pendiente** si no hay usuarios reales; declarar en conclusiones. |
| Medición **RNF4** (opcional) | Cronómetro sobre 2–3 endpoints o pantallas | Método y entorno descritos en texto del TDG. |

---

## 11. Evidencias gráficas recomendadas

- [Figura 1. Resultado exitoso de `npm run test:e2e`]
- [Figura 2. *Build* backend exitoso]
- [Figura 3. *Build* frontend exitoso]
- [Figura 4. Swagger: *health* y autenticación]
- [Figura 5. Flujo de circuito desde UI o trazas E2E documentadas]
- [Figura 6. Acceso a comprobante privado: autorizado vs no autorizado]

---

## 12. Comandos y artefactos en el repositorio

| Comando / artefacto | Ubicación o uso |
| --- | --- |
| `npm test` | Pruebas **unitarias** Jest (cobertura acotada). |
| `npm run test:e2e` | E2E con `pretest:e2e` → `test/setup-e2e-db.js`; configuración `.env` / `.env.e2e`. |
| `npm run test:e2e:auth-throttle-ip` | *Throttle* IP con patrón `auth-throttle-ip`. |
| `npm run smoke:ci-local` | `smoke:build` + `smoke:e2e`. |
| `.github/workflows/backend-ci.yml` | **Raíz del repo**: CI con PostgreSQL y carpeta de trabajo `01 - Escuela Pass`. |

---

## 13. Líneas de mejora profesional, académicas y de completitud (plan de pruebas)

### 13.1 Ampliar CI y *quality gate*

Incluir **frontend**: al menos `npm run build` y, cuando sea viable, *lint* (`eslint`) en un flujo dedicado, para coherencia con el **Anexo 07** y reducción de riesgo de regresión visual o de empaquetado.

### 13.2 Pirámide de pruebas y *unit tests*

Aumentar pruebas **unitarias** en servicios de dominio crítico (*payments*, *circuit*, *auth*) para fallos más rápidos que E2E y para documentar reglas de negocio en *assertions*.

### 13.3 Contrato API ↔ E2E ↔ OpenAPI

Exportar **OpenAPI** por *tag* de *release* y contrastar con escenarios E2E; evitar *drift* entre **Anexo 08**, Swagger y lo realmente ejecutado (**Anexo 08**, §12.1).

### 13.4 Manual de usuario ↔ evidencia

La **matriz** “paso del **Anexo 09** ↔ caso E2E ↔ sesión manual” cierra **RNF5** en el marco de evidencias del trabajo (**Anexo 09**, §16.5).

### 13.5 Seguridad y *abuse cases*

Mantener la suite de *throttle* por IP como **regresión** explícita; valorar *rate limit* en otros *endpoints* sensibles según marco de amenazas (**Anexo 03**).

### 13.6 Datos syntéticos y privacidad en evidencias

Las capturas de CI, Swagger y UI deben usar **cuentas y datos ficticios**, coherente con tratamiento de datos de menores.

### 13.7 Priorización sugerida

1. Registrar en el TDG **resultados E2E** y **build** (**§10–§11**).  
2. Medir al menos **un** flujo para **RNF4** (**§6**).  
3. Añadir **CI frontend** (**§13.1**).  
4. Matriz **manual ↔ prueba** (**§13.4**).  
5. Fortalecer **unit tests** en dominio crítico (**§13.2**).

---

## 14. Patrones de rutas HTTP ejercitados en E2E (referencia)

Lista de **prefijos o rutas** detectados en especificaciones E2E (puede ampliarse al evolucionar `test/`). No sustituye el catálogo **241** operaciones del **Anexo 08**.

| Patrón / recurso bajo prefijo documental `api/v1` |
| --- |
| `academic-periods` |
| `access-events/credentials`, `access-events/credentials/nfc`, `access-events/scan` |
| `activities`, `activities/parent/my-children` |
| `attention-notes/parent/my-children` |
| `attendance/groups`, `attendance/register` |
| `auth/login`, `auth/logout`, `auth/refresh` |
| `calendar/non-instructional-days` |
| `circuit-requests`, `circuit-requests/parent/active`, `circuit-requests/today` |
| `class-attendance/bulk`, `class-attendance/student` |
| `dashboard/actionable-kpis`, `dashboard/summary` |
| `exports/attendance.xlsx`, `exports/bulletin-consolidated.xlsx`, `exports/class-attendance.xlsx`, `exports/grades.xlsx` |
| `external-visits`, `external-visits/me` |
| `health` |
| `meetings` |
| `notices`, `notices/critical/read-receipts` |
| `notifications`, `notifications/me`, `notifications/admin-reports`, `notifications/admin-reports/mine`, `notifications/admin-reports/sla-reminders/run`, `notifications/admin-reports/sla-summary` |
| `payments/concepts`, `payments/concepts/ensure-base`, `payments/debts`, `payments/debts/adjustments`, `payments/debts/policies/run` |
| `reports/attendance/classes`, `reports/attendance/today`, `reports/circuit/today`, `reports/payments/pending` |
| `schedules`, `schedules/me/teacher` |
| `school/groups`, `school/import/groups/xlsx`, `school/import/history`, `school/import/teacher-assignments/xlsx`, `school/import/templates/teacher-assignments.xlsx`, `school/parents`, `school/students`, `school/subjects`, `school/teacher-assignments`, `school/teachers` |
| `settings/circuit`, `settings/institution` |

*Query params* ilustrativos (p. ej. `academic-periods?schoolId=`) se usan en casos concretos del spec.

---

## 15. Relación con otros anexos del TDG

| Anexo | Contenido vinculado a este documento |
| --- | --- |
| 00 | Matriz RF/RNF **§2** y ampliación **§2.1**; destino de la evidencia E2E. |
| 01 | RF1–RF8, RNF1–RNF6; **§5.1** criterios medibles; **RNF4** sin asumir umbrales sin medición. |
| 03 | Estrategia de pruebas y limitaciones **§12.4**; supuestos de integración. |
| 04 | Esquema asumido por migraciones y seeds de E2E. |
| 05 | Casos de uso y lista de escenarios **§8** frente a evidencia aquí. |
| 06 | Rutas UI complementarias a la verificación manual. |
| 07 | Entorno de ejecución, variables, CI y rutas del monorepo. |
| 08 | Catálogo REST completo y Swagger. |
| 09 | Manual de usuario; matriz pasos ↔ prueba (**§13.4** arriba). |

---

*Fin del anexo 10 — Informe de pruebas y métricas.*
