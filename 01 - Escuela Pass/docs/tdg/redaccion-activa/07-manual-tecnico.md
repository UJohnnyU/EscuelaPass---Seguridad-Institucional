# ESCUELA PASS — Administración y seguridad escolar

## 07. Manual técnico Escuela Pass

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
**Tipo de documento:** Instalación, configuración y mantenimiento  
**Versión:** 1.0 documental  

---

## 1. Propósito

Este anexo describe **requisitos**, **instalación local**, **base de datos**, **despliegue**, **mantenimiento** y **variables críticas** del monorepo Escuela Pass (API NestJS y cliente React/Vite). Profundiza en lo operativo sin duplicar el detalle de módulos y rutas HTTP: ese nivel de referencia vive en **`docs/technical-setup.md`**, el **Anexo 03** (arquitectura) y el **Anexo 08** (API). El detalle de pantallas y rutas del cliente está en el **Anexo 06**. La **sección 13** consolida **líneas de mejora** profesionales y académicas derivadas de la auditoría del repositorio.

---

## 2. Requisitos

- **Node.js** 20 o superior (`engines` en `package.json` de la raíz).
- **PostgreSQL** 13 o superior (motores **15–16** en servicios gestionados como Railway son habituales).
- Archivo **`.env`** en la raíz y en `frontend/` a partir de los `.env.example` correspondientes (JWT, base de datos, CORS, servicios opcionales).
- **Firebase** (proyecto y cuenta de servicio o equivalente) si se habilita notificación *push* desde el backend.
- **Mapbox** (*token* de acceso) si se desea mapa y ETA informativos en el circuito.

---

## 3. Instalación del backend

Desde la raíz del repositorio:

```bash
npm install
cp .env.example .env
npm run start:dev
```

Por defecto la API escucha en el puerto definido por `PORT` (**3000** si no se define). Con prefijo global `API_PREFIX` por defecto **`api/v1`**:

- **Salud del servicio:** `http://localhost:3000/api/v1/health` (ajustar puerto y prefijo si se cambian).
- **Swagger (OpenAPI):** `http://localhost:3000/docs` (la documentación interactiva no va bajo el prefijo global; véase `src/main.ts` y **`docs/technical-setup.md`**).

---

## 4. Base de datos

**Opción A — Esquema de referencia (desarrollo *greenfield*):** aplicar el DDL de referencia y flujos documentados; el archivo está en `scripts/database/escuela_pass_schema_v4.sql`. El repositorio expone **`npm run db:apply`** para aplicación asistida del esquema cuando el entorno lo permite (**`docs/technical-setup.md`**).

**Opción B — Cadena TypeORM:** migraciones versionadas en `src/database/migrations/`, ejecutables vía CLI (`npm run migration:run`, etc.) y **también al arranque** del proceso en la configuración actual: si las migraciones fallan, el servicio no debe atender tráfico.

El procedimiento **`ensureRuntimeSchema`** actúa como **red de alineación idempotente** y **no** sustituye las migraciones formales (**Anexo 03**, §12.1). La **checklist operativa** para cambios de tablas y columnas (migración + entidad + Anexo 04) está en **`docs/technical-setup.md`**, apartado *Política de cambios de esquema*.

---

## 5. Instalación del frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Variables típicas del cliente (prefijo `VITE_`): **`VITE_API_BASE`**, **`VITE_MAPBOX_ACCESS_TOKEN`**, credenciales y claves **Firebase** / **VAPID** según `frontend/.env.example` y el uso de *push* en el navegador.

En **desarrollo local**, el SPA suele correr en `http://localhost:5173` (Vite); conviene que **`CORS_ORIGIN`** en el `.env` del backend incluya ese origen (junto con la URL pública del API si aplica), o el navegador bloqueará las peticiones aunque la API esté levantada (**`docs/technical-setup.md`**, tabla de variables).

---

## 6. Despliegue

- **API (referencia Railway):** variables como `DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `FRONTEND_URL`, `CORS_ORIGIN`; volumen montado (p. ej. en **`/data`**) con **`UPLOADS_DIR=/data`** para persistir subidas. Comentarios operativos en `railway.toml` y en **`docs/releases/runbook-railway-v1.3.md`**.
- **Frontend:** compilación estática Vite (`npm run build` en `frontend/`) y alojamiento en Vercel u otro *hosting* de archivos estáticos, con `VITE_API_BASE` apuntando al origen público de la API.
- **Integración continua:** el paquete raíz incluye `smoke:ci-local` (`build` + `test:e2e`); la versión concreta de PostgreSQL en *CI* debe alinearse con la documentación del pipeline del repositorio o del entorno institucional.

---

## 7. Mantenimiento

- Ejecutar pruebas de humo o E2E antes de publicar (p. ej. `npm run smoke:ci-local` en la raíz).
- Revisar **logs** de arranque: migraciones TypeORM y mensajes de `ensureRuntimeSchema`.
- **Respaldar PostgreSQL** antes de cambios de esquema en producción.
- Revisar periódicamente *tokens* **FCM**, credenciales **SMTP** y permisos de escritura en **`UPLOADS_DIR`**.
- Actualizar anexos técnicos cuando cambien prefijos globales, módulos o rutas documentadas.

---

## 8. Variables críticas

| Variable (ejemplos) | Uso |
| --- | --- |
| `DATABASE_URL` o `POSTGRES_URL` | Conexión principal a PostgreSQL (recomendada en nube). |
| `DB_*`, `DB_SSL` | Alternativa por host, puerto, nombre y credenciales cuando no hay URL única. |
| `JWT_SECRET`, `JWT_REFRESH_SECRET` | Firma de *access* y *refresh*; rotación y complejidad son responsabilidad operativa. |
| `API_PREFIX`, `PORT` | Prefijo global de rutas REST y puerto HTTP del proceso. |
| `CORS_ORIGIN` | Orígenes permitidos del cliente web (lista separada por comas). |
| `UPLOADS_DIR` | Directorio persistente de comprobantes, avatares, logos, excusas y demás *uploads* servidos o referenciados por la API. |
| `FRONTEND_URL` | Base del cliente en enlaces por correo u otros flujos que genera el servidor. |
| `MAPBOX_ACCESS_TOKEN`, `SCHOOL_LATITUDE`, `SCHOOL_LONGITUDE`, `CIRCUIT_ARRIVAL_RADIUS_KM` | Mapa y lógica informativa de llegada en circuito. |
| `FIREBASE_SERVICE_ACCOUNT_PATH` / JSON o equivalente | Envío de *push* desde el backend. |
| `SMTP_*` o variables de correo configur en `mail` | Recuperación de contraseña y notificaciones por correo cuando apliquen. |
| `ENABLE_SWAGGER`, `SWAGGER_USER`, `SWAGGER_PASSWORD` | Exposición y protección opcional de `/docs` en producción. |

La tabla ampliada y notas de validación están en **`docs/technical-setup.md`**.

---

## 9. Procedimiento de *release* recomendado

1. Verificar `.env` y variables del proveedor cloud.
2. `npm run build` (raíz).
3. `npm run test:e2e` (o `npm run smoke:ci-local` para *build* + E2E). Los E2E asumen **PostgreSQL** accesible y, según el repo, pueden usar **`.env.e2e`** para `DB_NAME` u otras sobreescrituras; el *pretest* prepara la base de prueba (`pretest:e2e` en `package.json`).
4. `cd frontend && npm run build`.
5. `npm run migration:show` (o equivalente) para revisar migraciones pendientes en el entorno objetivo.
6. Confirmar volumen y **`UPLOADS_DIR`** con permisos de escritura.
7. Desplegar backend; esperar migraciones correctas en arranque.
8. Desplegar frontend con `VITE_API_BASE` acorde al backend público.
9. *Smoke* manual: inicio de sesión, `GET …/health`, flujo de circuito, pagos o archivos privados según rol de prueba, y comprobación CORS.

Lista de comprobación operativa adicional: **`docs/releases/checklist-operativo-post-release-v1.3.md`** (ajustar versión si el repositorio evoluciona).

---

## 10. Manejo de incidentes

| Síntoma | Revisión inicial |
| --- | --- |
| La API no inicia | `DATABASE_URL` / `POSTGRES_*`, errores de migración, `JWT_SECRET` y *logs* del proceso. |
| El frontend no obtiene datos | `VITE_API_BASE`, `CORS_ORIGIN`, certificados y URL pública del backend. |
| Archivos no cargan o 403 inesperado | `UPLOADS_DIR`, rutas `/files` y políticas de rol; existencia física del objeto. |
| *Push* no llega | *Token* FCM del navegador, cuenta de servicio, permisos del usuario. |
| Circuito rechaza operación | Reglas de negocio del día (asistencia), solicitud duplicada, configuración institucional del circuito, vínculo padre–estudiante. |
| *Login* falla tras cambios de ciclo de vida | Estado `user.status` e inactivación; el *backend* puede invalidar sesiones de cuentas inactivas. |

---

## 11. Seguridad operativa

No versionar `.env` con secretos reales, claves privadas de Firebase, contraseñas SMTP ni volcados de base de datos. Los comprobantes y documentos sensibles deben servirse por rutas autenticadas (**Anexo 03**, §4). En producción, **Swagger** debe permanecer deshabilitado o acotado con controles adicionales según política institucional.

---

## 12. Documentación complementaria en el repositorio

| Documento | Contenido principal |
| --- | --- |
| `docs/technical-setup.md` | Monorepo, módulos, variables de entorno, arranque, prefijos API, calendario HTTP `calendar`, Swagger; **Política de cambios de esquema** (checklist migración ↔ entidad ↔ Anexo 04). |
| `docs/releases/runbook-railway-v1.3.md` | Runbook de despliegue en Railway y comprobaciones posteriores. |
| `docs/releases/checklist-operativo-post-release-v1.3.md` | Lista de verificación tras publicar versión. |
| `docs/releases/archive/*.md` | Actas de salida/cierre, partes semanales y *backlog* de estabilización (contexto histórico). |

Para exportar diagramas Mermaid a imágenes en flujos de documentación, puede usarse **`@mermaid-js/mermaid-cli`** (`mmdc` vía `npx`) sobre ficheros fuente del TDG; no es obligación del producto en tiempo de ejecución.

---

## 13. Líneas de mejora profesional, académicas y de completitud

Las recomendaciones siguientes surgen de **revisar el monorepo en conjunto** (NestJS, TypeORM, React/Vite, pruebas, scripts SQL, documentación en `docs/` y anexos en `docs/tdg/redaccion-activa/`): objetivo **profesional** (operación y mantenimiento), **académico** (rigor del TDG ante evaluación del programa) y de **alineación** entre lo prometido en RF/RNF, lo implementado y lo documentado.

### 13.1 Persistencia y gobernanza del esquema

El proyecto combina **tres mecanismos** que deben mantenerse explícitamente coherentes: cadena **TypeORM** en `src/database/migrations/` (decenas de archivos versionados); **`ensureRuntimeSchema`** (`src/database/ensure-runtime-schema.ts`, SQL idempotente de gran tamaño ejecutado al arranque); y el DDL de referencia **`scripts/database/escuela_pass_schema_v4.sql`** más `npm run db:apply` para entornos *greenfield*. Esa superposición es habitual en evoluciones iterativas, pero genera **riesgo de deriva** si un cambio se refleja solo en uno de los caminos.

- **Política normativa del repositorio:** la tabla de decisiones “qué hacer en cada situación” está en **`docs/technical-setup.md`**, apartado **Política de cambios de esquema**; este manual no la sustituye, la complementa en clave de rigor documental.  
- **Recomendación:** en el día a día, **migración en PR → revisión → despliegue**, usando `ensureRuntimeSchema` como **red** para huecos ya acordados, no como sustituto sistemático de nuevas funcionalidades.  
- **Académico:** en el **Anexo 03** (§12.1), un párrafo de **trade-off** puede citar la coexistencia migraciones / *runtime* / SQL v4 frente a restricciones de despliegue.  
- **Operativo:** tras *releases* mayores, contrastar esquema real en PostgreSQL con el inventario del **Anexo 04**.

### 13.2 Pruebas y calidad de software

La base de código concentra **pruebas automatizadas** muy visiblemente en **E2E** (`test/app.e2e-spec.ts`), mientras la **cobertura unitaria** es marginal (pocos `*.spec.ts` en el árbol principal). Los E2E son valiosos como evidencia integral pero son **lentos** y **sensibles** a cambios de contrato o de UI.

- **Profesional:** añadir **tests unitarios o de integración** en servicios de alto riesgo: autenticación y *refresh*, circuito, pagos/comprobantes, archivos privados, límites multiinstitución (`schoolId`).  
- **Profesional:** factorizar **datos de prueba** (fábricas o *fixtures*) compartidos entre E2E y *seeds* controlados.  
- **Académico:** en el **Anexo 10**, relacionar **RF/RNF** con el tipo de prueba que los respalda (*unit*, integración, E2E, manual con usuarios), cerrando el ciclo con el **Anexo 00**.

### 13.3 Integración continua y reproducibilidad

Puede (y conviene) documentarse en el TDG un **pipeline** explícito (*install* → *lint* → *build* → *test:e2e* con servicio PostgreSQL) aunque el repositorio evolucione fuera del alcance del trabajo: los scripts `smoke:ci-local` y `pretest:e2e` ya orientan ese flujo.

- **Recomendación:** versionar la configuración de *CI* y **fijar la versión mayor de PostgreSQL** usada en pruebas, alineada con §2 de este anexo.  
- **Académico:** una figura o anexo con el resultado del pipeline refuerza el carácter **ingenieril** del entregable.

### 13.4 Seguridad y cumplimiento en operación

La aplicación adopta buenas prácticas base (Helmet, JWT, *rate limiting*, `ValidationPipe`, rutas de archivos autenticadas), pero el mantenimiento institucional exige procesos, no solo código.

- **Secretos:** procedimiento de **rotación** de `JWT_SECRET` / `JWT_REFRESH_SECRET` y de credenciales Firebase/SMTP sin ventanas de vulnerabilidad innecesarias.  
- **Dependencias:** integrar **auditoría** (`npm audit` u homólogos) en el flujo de release; política frente a *CVE* en dependencias directas.  
- **Cliente:** persistencia de *tokens* en `localStorage` (`frontend/src/lib/storage.ts`) simplifica la SPA pero incrementa superficie ante XSS (**Anexo 03**, §12.2); puede proponerse como **línea de mejora** cookies `httpOnly`, CSP o capa BFF, con citas a literatura o OWASP en el marco teórico.  
- **Datos personales:** el dominio incluye **auditoría** (`audit_logs`, uso desde varios servicios); el TDG debe explicitar **qué acciones se auditan**, **retención** y relación con normativa (p. ej. habeas data / tratamiento de datos de menores en el caso de estudio).

### 13.5 Observabilidad y continuidad del servicio

- **Salud:** documentar si el *health check* valida sólo el proceso o también dependencias críticas; valorar comprobación de conexión a BD en entornos que lo permitan.  
- **Logs:** correlación con `requestId` / usuario / escuela acelera la tabla del §10.  
- **Backups:** **RPO/RTO** explícitos para PostgreSQL y para el volumen de **`UPLOADS_DIR`** (comprobantes y evidencias no deben quedar solo en el filesystem efímero del contenedor).

### 13.6 Rendimiento (RNF4) y escalabilidad documental

El **Anexo 01** no asume umbrales de tiempo sin medición; para la defensa del cumplimiento de **RNF4** es útil **medir** al menos un conjunto pequeño de operaciones (exportaciones, reportes, listados paginados) y consignar método, entorno y resultado en el **Anexo 10**. Las migraciones de **índices** en `src/database/migrations/` deben mencionarse al explicar diseño físico junto al **Anexo 04**.

### 13.7 Interfaz, accesibilidad y usabilidad

Completar el **Anexo 06** con **capturas reales** o prototipo Figma ligado a rutas `App.tsx`. Un checklist **WCAG 2.1** nivel mínimo (contraste, foco visible, etiquetas en formularios de autenticación y circuito) encaja en el **Anexo 09** como evidencia de RNF5.

### 13.8 Documentación y trazabilidad interna

- Mantener **`docs/tdg/redaccion-activa/`** como **fuente prioritaria** de anexos numerados; si existe un consolidado extenso, declararlo *snapshot* y evitar divergencias de cifras (rutas, tablas, pruebas).  
- Al añadir variables en `.env.example`, reflejarlas en la **§8** de este anexo y en `docs/technical-setup.md`.  
- El script `tdg:enrich` (`package.json`) puede integrarse a un procedimiento de actualización documental si se exige trazabilidad automatizada entre código y anexos.

### 13.9 Alcance explícito frente a expectativas

Recordar en conclusiones o en el **Anexo 01** los **límites** ya asumidos: sin pasarela bancaria automática (**RF6**), circuito familiar (**RF3**), FCM/Mapbox/SMTP **opcionales** según variables. Una demo académica debe **configurar** esas integraciones o justificar su omisión para no crear expectativa de funcionalidad no desplegada.

### 13.10 Priorización sugerida

1. Gobernanza **esquema ↔ entidades ↔ anexo 04** (§13.1).  
2. **Pipeline CI** reproducible con E2E (§13.3).  
3. Ampliación de **pruebas** bajo la pirámide de pruebas (§13.2).  
4. Evidencias **RNF4/RNF5** en anexos 09–10 (§13.6–13.7).  
5. **Backups**, rotación de secretos y observabilidad (§13.4–13.5).

---

## 14. Relación con otros anexos del TDG

| Anexo | Contenido vinculado a este documento |
| --- | --- |
| 00 | Matriz de trazabilidad; evidencia de despliegue y pruebas alineadas con este manual y con **§13.2**. |
| 01 | RNF de infraestructura y supuestos de operación; **§13.6–13.9** cierran medición y límites explícitos. |
| 03 | Arquitectura, persistencia, seguridad y limitaciones §12; **§13.1** (esquema) y **§13.4** (operación). |
| 04 | Cadena de migraciones y respaldo del esquema; **§13.1** gobernanza frente a la BD real. |
| 05 | E2E y diagramas; **§13.2** propone ampliar pirámide de pruebas. |
| 06 | Variables `VITE_*` y construcción del cliente; **§13.7** UX y accesibilidad. |
| 08 | Documentación API: dominios, catálogo HTTP (**§10**), RF (**§7**), mejoras **§12–§13**; complementa este manual frente a Swagger. |
| 09 | Manual de usuario Escuela Pass: perfiles, flujos, mensajes frecuentes y rutas **`/app/...`**; evidencia **RNF5** junto al **Anexo 10**. |
| 10 | Informe de pruebas y métricas (**Anexo 10**): E2E, CI, registro **RNF4/RNF5**; **§13.1–§13.7** alineado a **§13.6–13.7** aquí. |

---

*Fin del anexo 07 — Manual técnico.*
