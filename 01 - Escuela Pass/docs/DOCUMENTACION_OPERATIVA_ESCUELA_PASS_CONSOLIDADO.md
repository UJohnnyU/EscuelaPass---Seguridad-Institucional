# Documentación Markdown consolidada — Escuela Pass (DOCUMENTACION_OPERATIVA_ESCUELA_PASS_CONSOLIDADO.md)

Cada bloque conserva el contenido íntegro del archivo indicado.

**Aviso (estructura actual del repo):** Las líneas `# Fuente: docs/tdg/...` y bloques copiados de `docs/README.md` pueden reflejar rutas antiguas al momento de la consolidación. En el árbol actual, los diagramas están en **`docs/imagenes/`**; los scripts `docs/tdg/*.py` de la época del TDG ya no forman parte de la entrega.

||||||||||||||||||||||||||||||||||||||||||||

# Fuente: docs/CODESTYLE-COMMENTS.md

# Convención de comentarios (código)

**Objetivo:** comentarios útiles para mantenimiento y entrega institucional, sin ruido.

## Idioma y tono

- **Español** en comentarios y documentación en código (alineado al resto del proyecto).
- Frases completas cuando aporten contexto; evitar telegráficos incomprensibles.
- No usar el comentario para repetir el nombre obvio del símbolo (p. ej. “constructor” sobre un `constructor` vacío).

## Qué sí documentar

- **Cabezal de archivo** (opcional pero recomendado en módulos con lógica de negocio): rol del módulo y dependencias relevantes hacia otros bounded contexts.
- **APIs públicas**: controladores Nest (prefijos, reglas de autorización resumidas), guards, pipes que alteren datos.
- **DTOs y tipos compartidos**: JSDoc breve en la clase o en propiedades no evidentes (unidades, formatos, restricciones de negocio).
- **Algoritmos o ramas no obvias**: por qué existe un `if` especial, límites temporales, idempotencia, compensación.
- **Integraciones externas**: FCM, Mapbox, pasarelas o correo — qué variable de entorno las gobierna y qué falla de forma silenciosa vs. explícita.

## Qué no hace falta documentar

- Entidades TypeORM cuyos nombres y columnas coinciden con el dominio y no hay regla oculta.
- Cada método CRUD que solo delegue en el repositorio.
- Tests salvo que el caso de prueba documente una regla de negocio contraintuitiva.

## Frontend (React)

- Componentes de página: una o dos líneas sobre el rol de la pantalla y el rol de usuario objetivo si no es obvio por la ruta.
- Hooks y utilidades compartidas (`lib/`): contrato de uso (cuándo llamarlos, efectos secundarios).

## Preferencias técnicas

- En **TypeScript**, preferir tipos claros y nombres descriptivos antes que comentarios largos.
- Respetar **accesibilidad**: no sustituir `aria-*` o labels visibles con comentarios en código.
- Para cambios temporales o deuda técnica, preferir un TODO con referencia a issue o decisión (“hasta migración X”).


||||||||||||||||||||||||||||||||||||||||||||

# Fuente: nota diagramas (equivalente vivo: [docs/README.md](./README.md) — carpeta `docs/imagenes/`)

# Diagramas Mermaid exportados (PNG)

- **Ubicación:** `docs/imagenes/*.mmd` y `docs/imagenes/*.png` (mismo nombre base por figura).

## Regenerar un PNG

Desde la raíz del repositorio (Node.js instalado), por ejemplo:

```bash
npx -y @mermaid-js/mermaid-cli@10 -i docs/imagenes/01-arquitectura-contexto-lr.mmd -o docs/imagenes/01-arquitectura-contexto-lr.png
```

## Uso en Word

Los PNG se pueden insertar manualmente en `docs/tdg/word/*.docx`. Regenerar Word desde Markdown requeriría restaurar desde git el pipeline del TDG si aún existe en el historial.


||||||||||||||||||||||||||||||||||||||||||||

# Fuente: docs/README.md

# Documentación

## TDG y anexos (un solo Markdown)

- **[DOCUMENTACION_ESCUELA_PASS_CONSOLIDADO.md](./DOCUMENTACION_ESCUELA_PASS_CONSOLIDADO.md)** — texto íntegro del trabajo de grado y entregables que antes estaban en `docs/tdg/`. Las versiones entregables en Word siguen en **`docs/tdg/word/`** (principal + `anexos/`).
- Diagramas: **`docs/imagenes/`** (`.mmd` y `.png` con el mismo nombre base). Regenerar PNG con `npx @mermaid-js/mermaid-cli` (ver [docs/README.md](./README.md) en el repo actual).

## Operación del proyecto

- **[technical-setup.md](./technical-setup.md)** — variables, API, flujos y opciones para PostgreSQL.
- **[CODESTYLE-COMMENTS.md](./CODESTYLE-COMMENTS.md)** — comentarios en código (backend y frontend).
- **`releases/`** — runbooks, checklists y actas de release.

### Opcional: un solo Markdown “solo operativo”

En la entrega final ya no se incluye `docs/tdg/consolidate_docs_md.py`. Para volver a generar este archivo puede unir manualmente los Markdown de referencia o recuperar el script desde el historial de git. `DOCUMENTACION_OPERATIVA_ESCUELA_PASS_CONSOLIDADO.md` no sustituye al consolidado del TDG.


||||||||||||||||||||||||||||||||||||||||||||

# Fuente: docs/releases/archive/acta-cierre-estabilizacion-v1.3.md

# Acta de cierre de estabilización v1.3

Fecha: 2026-04-26  
Producto: Escuela Pass  
Release base: v1.3 - Gestión integral institucional  
Fase: Estabilización post-release

## Alcance de estabilización ejecutado

- Seguimiento operativo de SLA de reportes internos.
- Monitoreo de acuse de lectura en comunicados críticos.
- Control semanal de cartera/conciliación y ajustes financieros.
- Revisión de alertas KPI accionables con responsables.
- Consolidación de decisiones operativas y riesgos residuales.

## Checklist de cierre de estabilización (Gate A10)

- C1 - Operación estable sin incidentes críticos abiertos: **Cumplido**
- C2 - SLA de reportes sostenido en objetivo operativo: **Cumplido**
- C3 - Lectura de comunicados críticos en objetivo operativo: **Cumplido**
- C4 - Tendencia de KPIs críticos estable/positiva: **Cumplido**
- C5 - Ajustes finos documentados y socializados: **Cumplido**

## Evidencia de control operativo

- Parte semanal reusable emitido y en uso por equipos.
- Semáforo ejecutivo disponible para seguimiento recurrente.
- Métricas y decisiones centralizadas para gobernanza institucional.
- Criterios de cierre explícitos y verificables por gate.

## Riesgos residuales

- Riesgos no bloqueantes para continuidad operativa.
- Recomendación: mantener revisión semanal de KPI y decisiones por 30 días adicionales.

## Decisión final

- Estado de estabilización v1.3: **CERRADA**
- Estado operativo institucional: **GO SOSTENIDO**
- Se autoriza transición a modo de mejora continua.

## Responsables

- Producto: Equipo funcional institucional
- Tecnología: Equipo backend/frontend
- QA/Operaciones: Equipo de seguimiento E2E y operación


||||||||||||||||||||||||||||||||||||||||||||

# Fuente: docs/releases/archive/acta-salida-v1.2.md

# Acta de salida release v1.2

Fecha: 2026-04-25  
Producto: Escuela Pass  
Release: v1.2 - Operacion escolar defendible

## Alcance aprobado

- E4 Asistencia robusta con evidencia (T6)
- E5 Evaluacion institucional estandarizada (T7)
- E6 Estados de vida escolar (T8, T9)

## Checklist Go/No-Go

- G1 - T6/T7 en produccion estable: **Cumplido**
  - Asistencia por sesion activa.
  - Calculo ponderado y lock por periodos CLOSED operativo.
- G2 - T8/T9 funcional backend+UI: **Cumplido**
  - Transicion lifecycle de alumno/docente con motivo, fecha efectiva y responsable.
  - Historial por entidad y bloqueos operativos aplicados.
- G3 - Pruebas E2E lifecycle por rol: **Cumplido**
  - Suite institucional E2E en verde (23/23).
- G4 - Auditoria lifecycle visible/exportable: **Cumplido**
  - Panel administrativo con listado consolidado.
  - Export CSV operativo de eventos lifecycle.
- G5 - Go/No-Go con evidencia: **Cumplido**
  - Evidencia funcional integrada en backend, frontend, pruebas y canvas.

## Evidencia tecnica consolidada

- Backend:
  - Endpoints lifecycle por alumno/docente.
  - Endpoint unificado de auditoria lifecycle.
  - Export CSV de eventos lifecycle.
- Frontend:
  - Gestion lifecycle en modulo de grupos y personas.
  - Seccion de auditoria lifecycle con descarga CSV.
- Calidad:
  - Build backend exitoso.
  - Linter sin errores en archivos tocados.
  - Suite E2E institucional estabilizada en verde.

## Riesgos residuales

- No bloqueantes para salida v1.2.
- Riesgo principal remanente: adopcion operativa de comunicacion con acuse y SLA (siguiente frente T10/T11).

## Decisiones de salida

- Estado de release v1.2: **GO**
- Se autoriza paso a cierre formal y comunicacion interna de salida.
- Siguiente bloque aprobado: inicio de T10/T11 (acuse de lectura + SLA de reportes).

## Responsables

- Producto: Equipo funcional institucional
- Tecnologia: Equipo backend/frontend
- QA: Suite E2E institucional


||||||||||||||||||||||||||||||||||||||||||||

# Fuente: docs/releases/archive/acta-salida-v1.3.md

# Acta de salida release v1.3

Fecha: 2026-04-26  
Producto: Escuela Pass  
Release: v1.3 - Gestion integral institucional

## Alcance aprobado

- E7 Comunicacion y atencion con SLA (T10, T11)
- E8 Finanzas operativas y KPI ejecutivos (T12, T13, T14)

## Checklist Go/No-Go

- G1 - T10/T11 en produccion estable: **Cumplido**
  - Acuse de lectura en comunicados criticos con seguimiento operativo.
  - Reportes internos con estados y SLA de respuesta/resolucion.
- G2 - T12/T13 en produccion estable: **Cumplido**
  - Politicas de cartera (mora/recargo) operativas.
  - Convenio manual y bitacora de ajustes financieros trazable.
- G3 - T14 KPI accionable: **Cumplido**
  - Dashboard con alerta -> accion sugerida -> responsable operativo.
- G4 - Validacion E2E release v1.3: **Cumplido**
  - Suite institucional en verde (25/25) con cobertura T10-T14.
- G5 - Go/No-Go v1.3 con evidencia: **Cumplido**
  - Evidencia funcional consolidada en backend, frontend, pruebas y canvas.

## Evidencia tecnica consolidada

- Backend:
  - Endpoints de SLA/reportes y acuse critico.
  - Endpoints de cartera y conciliacion (politicas, convenios, ajustes).
  - Endpoint KPI accionable para panel ejecutivo.
- Frontend:
  - Panel operativo con SLA y acuse de lectura.
  - Herramientas de finanzas con politicas y bitacora.
  - Dashboard ejecutivo con alertas KPI accionables.
- Calidad:
  - Build backend exitoso.
  - Linter sin errores en archivos tocados.
  - Suite E2E institucional completa en verde.

## Riesgos residuales

- No bloqueantes para salida v1.3.
- Riesgo principal remanente: adopcion continua de decisiones operativas guiadas por KPI.

## Decisiones de salida

- Estado de release v1.3: **GO**
- Se autoriza cierre formal de E8 y comunicacion de release integral.
- Siguiente frente recomendado: optimizacion de analitica avanzada y adopcion operativa.

## Responsables

- Producto: Equipo funcional institucional
- Tecnologia: Equipo backend/frontend
- QA: Suite E2E institucional


||||||||||||||||||||||||||||||||||||||||||||

# Fuente: docs/releases/archive/backlog-mejora-continua-v1.3.md

# Backlog de mejora continua v1.3 (2-4 semanas)

Fecha: 2026-04-26  
Producto: Escuela Pass  
Base: release v1.3 estabilizada (GO sostenido)

## Objetivo

Priorizar mejoras incrementales de alto impacto para consolidar adopción, reducir fricción operativa y fortalecer analítica accionable.

## Criterio de priorización

- Impacto en operación institucional (alto/medio/bajo).
- Esfuerzo de implementación (alto/medio/bajo).
- Riesgo de no implementar en el corto plazo.
- Dependencias técnicas/funcionales.

## Backlog priorizado (impacto vs esfuerzo)

### Onda 1 (rápidas, alto impacto)

1. **Alertas KPI con ownership obligatorio**
   - Impacto: Alto | Esfuerzo: Bajo
   - Acción: impedir cierre de alerta sin responsable y fecha objetivo.
   - Resultado esperado: mayor trazabilidad de ejecución.

2. **Mejora de UX en semáforo SLA**
   - Impacto: Alto | Esfuerzo: Bajo
   - Acción: etiquetas más explícitas y estado resumido por escuela.
   - Resultado esperado: lectura ejecutiva más clara y decisiones más rápidas.

3. **Recordatorios críticos con ventana adaptable**
   - Impacto: Medio-Alto | Esfuerzo: Bajo
   - Acción: parametrizar frecuencia por tipo de comunicado.
   - Resultado esperado: mejor tasa de lectura sin saturación de notificaciones.

### Onda 2 (estructurales, impacto alto)

4. **Reglas de cartera con perfil de riesgo por escuela**
   - Impacto: Alto | Esfuerzo: Medio
   - Acción: ajustar mora/recargo por umbrales configurables institucionales.
   - Resultado esperado: menor fricción y mejor cobranza contextual.

5. **Tablero ejecutivo con tendencia semanal y variación**
   - Impacto: Alto | Esfuerzo: Medio
   - Acción: agregar comparativas semana contra semana en KPI críticos.
   - Resultado esperado: mejor lectura de evolución operativa.

6. **Cierre guiado de incidentes operativos**
   - Impacto: Medio | Esfuerzo: Medio
   - Acción: checklist mínimo para cerrar incidencias recurrentes.
   - Resultado esperado: menos reaperturas y mayor calidad de resolución.

### Onda 3 (optimización avanzada)

7. **Consolidado de auditoría transversal**
   - Impacto: Medio-Alto | Esfuerzo: Medio-Alto
   - Acción: vista unificada lifecycle + finanzas + comunicaciones.
   - Resultado esperado: trazabilidad completa para control institucional.

8. **Scoring de salud operativa por escuela**
   - Impacto: Alto | Esfuerzo: Alto
   - Acción: índice compuesto (SLA, lectura, cartera, incidencias).
   - Resultado esperado: priorización automática de intervención por riesgo.

## Plan recomendado de ejecución (4 semanas)

- Semana 1: ítems 1, 2, 3.
- Semana 2: ítems 4, 5.
- Semana 3: ítem 6 + validación de impacto de ondas previas.
- Semana 4: ítem 7 (MVP) y diseño técnico del ítem 8.

## Definición de éxito de A11

- Al menos 5 mejoras implementadas o cerradas en diseño validado.
- Reducción de incidencias operativas repetitivas.
- Mejoría observable en adopción de paneles y decisiones por KPI.
- Hoja de ruta de optimización avanzada (A12) aprobada.


||||||||||||||||||||||||||||||||||||||||||||

# Fuente: docs/releases/archive/parte-semanal-estabilizacion-v1.3.md

# Parte semanal de estabilización v1.3

Semana: ____ / 2026  
Fecha de corte: ____  
Responsable de consolidación: ____  
Release: v1.3 - Gestión integral institucional

## 1) Estado ejecutivo (semáforo)

- Estado general de operación: [Verde | Amarillo | Rojo]
- SLA de reportes internos: [Verde | Amarillo | Rojo]
- Acuse de comunicados críticos: [Verde | Amarillo | Rojo]
- Cartera y conciliación: [Verde | Amarillo | Rojo]
- KPI accionables (uso y cierre): [Verde | Amarillo | Rojo]

## 2) Métricas de la semana

- Cumplimiento SLA de reportes (%): ____
- Tasa de lectura de comunicados críticos en 48h (%): ____
- Alertas KPI generadas (#): ____
- Alertas KPI con responsable asignado en <=24h (# / %): ____
- Alertas KPI cerradas en semana (# / %): ____
- Deudas vencidas nuevas (#) vs semana anterior (#): ____ / ____
- Comprobantes pendientes al cierre (#): ____

## 3) Incidencias y degradaciones relevantes

- Incidencia 1: ____ | Severidad: ____ | Estado: ____ | Responsable: ____ | ETA: ____
- Incidencia 2: ____ | Severidad: ____ | Estado: ____ | Responsable: ____ | ETA: ____
- Incidencia 3: ____ | Severidad: ____ | Estado: ____ | Responsable: ____ | ETA: ____

## 4) Decisiones operativas tomadas

- Decisión 1: ____  
  Justificación: ____  
  Impacto esperado: ____  
  Responsable: ____  
  Fecha objetivo: ____

- Decisión 2: ____  
  Justificación: ____  
  Impacto esperado: ____  
  Responsable: ____  
  Fecha objetivo: ____

## 5) Ajustes finos ejecutados

- Ajuste aplicado: ____ | Dominio: [SLA | Comunicaciones | Finanzas | KPI] | Resultado preliminar: ____
- Ajuste aplicado: ____ | Dominio: [SLA | Comunicaciones | Finanzas | KPI] | Resultado preliminar: ____

## 6) Riesgos residuales y mitigación

- Riesgo: ____ | Probabilidad: ____ | Impacto: ____ | Mitigación activa: ____ | Dueño: ____
- Riesgo: ____ | Probabilidad: ____ | Impacto: ____ | Mitigación activa: ____ | Dueño: ____

## 7) Plan de la próxima semana

- Prioridad 1: ____ | Responsable: ____ | Fecha: ____
- Prioridad 2: ____ | Responsable: ____ | Fecha: ____
- Prioridad 3: ____ | Responsable: ____ | Fecha: ____

## 8) Gate de cierre de estabilización (14 días)

- [ ] 5 días consecutivos sin incidentes críticos abiertos.
- [ ] SLA >= 85% sostenido.
- [ ] Lectura de comunicados críticos >= 90% sostenida.
- [ ] Tendencia estable/positiva de KPI críticos.
- [ ] Ajustes finos documentados y socializados con equipos.

## 9) Aprobaciones

- Producto: ____  
- Tecnología: ____  
- QA/Operaciones: ____


||||||||||||||||||||||||||||||||||||||||||||

# Fuente: docs/releases/archive/revision-pre-release-v1.3.md

# Revisión pre-release v1.3 (web app)

Fecha: 2026-04-26  
Objetivo: validar estado técnico real para despliegue profesional.

## Validaciones ejecutadas

- Backend `npm run build`: **OK**
- Backend `npm run test:e2e`: **OK (25/25)**
- Backend `npm run lint`: **OK sin errores** (con advertencias no bloqueantes)
- Frontend `npm run build`: **OK**
- Frontend `npm run lint`: **OK sin errores** (con advertencias no bloqueantes)

## Correcciones aplicadas durante la revisión

- Frontend:
  - Corregidos errores de lint por variables no usadas y orden de hooks.
  - Ajustes en `NotificationsBadge`, `AppHomePage` y `modulos/Operativos`.
- Backend:
  - Habilitado `eslint.config.js` compatible con ESLint 9 para restaurar lint funcional.

## Hallazgos no bloqueantes

- Advertencias de hooks/fast-refresh en frontend (no rompen build).
- Advertencias de tipado `any` y variables no usadas en backend (no rompen build ni e2e).
- Bundle frontend principal > 500kB (recomendación de code-splitting para optimización).

## Decisión de salida técnica

- Estado técnico para despliegue: **GO**
- Recomendación post-release:
  - Reducir tamaño de bundle mediante división de chunks.
  - Cerrar advertencias de lint restantes en ciclo de mejora continua.


||||||||||||||||||||||||||||||||||||||||||||

# Fuente: docs/releases/checklist-operativo-post-release-v1.3.md

# Checklist operativo post-release v1.3

Fecha: 2026-04-26  
Producto: Escuela Pass  
Objetivo: asegurar adopción operativa de v1.3 y ejecutar ajustes finos guiados por KPI.

## 1) Monitoreo de adopción (primeros 7 días)

- [ ] Revisar diariamente uso de panel "SLA de reportes internos" por equipo administrativo.
- [ ] Verificar lectura de comunicados críticos y tasa de no lectura por escuela.
- [ ] Confirmar ejecución diaria de políticas de cartera (mora/recargo) y registrar incidencias.
- [ ] Validar consulta semanal de "Alertas KPI accionables" con responsable asignado.
- [ ] Registrar bloqueos operativos detectados por usuarios (flujo, permisos o datos incompletos).

## 2) Umbrales de control KPI (operación semanal)

- [ ] SLA de reportes cumplido >= 85%.
- [ ] Tasa de lectura de comunicados críticos >= 90% en ventanas de 48h.
- [ ] Alertas de deuda vencida con tendencia descendente semana contra semana.
- [ ] Comprobantes pendientes de revisión dentro de ventana operativa definida.
- [ ] Alertas académicas críticas (ausentismo alto) con acción asignada en <= 24h.

## 3) Rutina de seguimiento por rol

- [ ] ADMINISTRATIVO: revisar semáforos SLA, acuses y cartera al inicio de jornada.
- [ ] ADMIN: validar escuelas con mayor desviación y priorizar intervención.
- [ ] SOPORTE/QA: consolidar incidencias funcionales y degradaciones de experiencia.
- [ ] PRODUCTO/TECNOLOGÍA: evaluar ajustes de reglas y mejoras UX con base en evidencia.

## 4) Criterios de ajuste fino (sin bloquear operación)

- [ ] Ajustar reglas de recordatorio en comunicados críticos (frecuencia/ventana) si baja adopción.
- [ ] Afinar criterios de recargo/convenio cuando existan falsos positivos de cartera.
- [ ] Recalibrar umbrales de alertas KPI para reducir ruido y priorizar acción real.
- [ ] Mejorar textos/etiquetas de paneles cuando se detecten errores de interpretación operativa.

## 5) Cadencia de revisión

- [ ] Daily operativo (15 min): incidentes + KPI rojo + responsables.
- [ ] Weekly de estabilización (45 min): métricas, ajustes aplicados, deuda técnica funcional.
- [ ] Corte a 14 días: decisión de cierre de estabilización post-release v1.3.

## 6) Criterio de cierre de A8

- [ ] Operación estable sin incidentes críticos abiertos por 5 días consecutivos.
- [ ] Tendencia positiva o estable en KPIs críticos definidos.
- [ ] Lista de ajustes finos ejecutados y documentados.
- [ ] Comunicación de cierre de estabilización emitida a equipos institucionales.


||||||||||||||||||||||||||||||||||||||||||||

# Fuente: docs/releases/README.md

# Entregas y operación

Documentación **viva** para despliegue y verificación post-release.

| Documento | Uso |
|-----------|-----|
| [runbook-railway-v1.3.md](./releases/runbook-railway-v1.3.md) | Despliegue backend en Railway y variables. |
| [checklist-operativo-post-release-v1.3.md](./releases/checklist-operativo-post-release-v1.3.md) | Comprobaciones tras publicar. |

## Archivo histórico

Actas, partes y revisiones de la estabilización v1.3 (y v1.2) están en [`releases/archive/`](./releases/archive/) solo como referencia institucional; no forman parte del flujo técnico diario.


||||||||||||||||||||||||||||||||||||||||||||

# Fuente: docs/releases/runbook-railway-v1.3.md

# Runbook Railway v1.3

Fecha: 2026-04-26  
Objetivo: desplegar Escuela Pass con esquema formal, sin depender de parches invisibles de arranque.

## Decisión técnica

- El esquema v1.3 queda formalizado en migración TypeORM.
- `ensureRuntimeSchema` se mantiene como red de seguridad idempotente para entornos heredados, pero no reemplaza `npm run migration:run`.
- En Railway se debe ejecutar la migración antes de publicar tráfico a la versión nueva.

## Variables requeridas

- `DATABASE_URL`
- `JWT_SECRET`
- `FRONTEND_URL`
- Variables de correo/push si están habilitadas en producción.
- Volumen persistente configurado para archivos subidos.

## Pasos de despliegue

1. Verificar que la base actual tiene respaldo reciente.
2. Ejecutar en Railway Shell o job temporal:

   ```bash
   npm run migration:run
   ```

3. Revisar que la migración `InstitutionalV13RuntimeSchema1778100000000` quede registrada en la tabla `migrations`.
4. Desplegar la app con `npm run start:prod`.
5. Probar smoke test:
   - Login `ADMINISTRATIVO`.
   - Crear asignatura, asignar docente a grupo y crear sesión con día/hora.
   - Entrar como alumno/docente y validar horario.
   - Crear circuito de recogida con `Otro vehículo o taxi`.
   - Exportar auditoría lifecycle en `.xlsx`.
   - Revisar dashboard operativo y finanzas.

## Si falla la migración

- No publicar nueva versión.
- Revisar permisos del usuario de base sobre tipos enum y tablas.
- Si falla por enum `circuit_status`, aplicar la instrucción documentada en la migración `CircuitPadreEnCamino1776100000000` con usuario dueño del tipo.
- Restaurar desde backup solo si hubo una migración parcialmente aplicada que no puede completarse de forma idempotente.

## Criterio de salida

- Migraciones OK.
- Backend build/lint/e2e OK.
- Frontend build/lint OK.
- Smoke test funcional por rol OK.


||||||||||||||||||||||||||||||||||||||||||||

# Fuente: docs/technical-setup.md

# Configuración técnica — Escuela Pass

Documento de referencia del **monorepo** backend (NestJS + TypeORM + PostgreSQL) y frontend (React + Vite). La lista exhaustiva de rutas y esquemas de body/query está en **Swagger** (`/docs`) una vez levantada la API.

## Visión general

| Pieza | Ubicación | Notas |
|--------|-----------|--------|
| API | Raíz del proyecto (`src/`) | Node **≥ 20**, NestJS 10, prefijo global `API_PREFIX` (por defecto `api/v1`). |
| Web | `frontend/` | React 18, Vite 6, Tailwind; escaneo con **html5-qrcode**; mapas Mapbox; push FCM opcional. |
| DDL de referencia | `escuela_pass_schema_v4.sql` | Greenfield + `npm run db:apply` (solo esquema, vía `DATABASE_URL`). |
| Cadena TypeORM | `src/database/migrations/` | Baseline + migraciones incrementales; también se ejecutan **al arranque** del proceso (ver abajo). |

### Arranque del backend (`src/main.ts`)

- Crea subcarpetas de uploads (`comprobantes`, `avatars`, `school-logos`, `excuses`) bajo `UPLOADS_DIR` o `./uploads`.
- Migra archivos legacy al volumen si aplica (`migrateUploadsToVolume`).
- **Ejecuta migraciones TypeORM pendientes** en una transacción; si fallan, el proceso no sirve tráfico.
- Llama a `ensureRuntimeSchema` como red de seguridad idempotente (no sustituye migraciones formales).
- Sirve estáticos bajo `/uploads` (primero `UPLOADS_DIR`, fallback `./uploads`).
- `ValidationPipe` global: `whitelist`, `forbidNonWhitelisted`, `transform`.
- `helmet`, CORS (orígenes desde `CORS_ORIGIN`, separados por coma; `credentials: true`), cabeceras expuestas `X-Bulletin-Count` y `Content-Disposition` (PDFs / ZIPs masivos).
- Swagger en **`http://localhost:<PORT>/docs`** (Bearer JWT `access-token`).

## Decisión ORM: TypeORM

Se mantiene TypeORM por integración con Nest (`@nestjs/typeorm`), PostgreSQL y alineación con el DDL de referencia y la cadena de migraciones.

## Estructura modular (backend)

Registrados en `src/app.module.ts`:

- **Core / infra:** `health`, `auth`, `mail` (SMTP global opcional), `uploads` (multipart), `audit`, `privacy`, `schools` (multi-institución, rol `ADMIN` plataforma).
- **Operación:** `access` (QR/NFC/credenciales), `circuit`, `departure-consent`, `vehicles`, `settings`.
- **Comunicación:** `notices`, módulo de `notifications` (bandeja, FCM, informes administrativos con flujo SLA).
- **Académico:** `attendance`, `school-calendar` (ruta HTTP `calendar`), `schedules`, `class-sessions`, `academic-periods`, `activities` (tableros + calificaciones por actividad), `report-cards`, `documents` (PDF boletines / horarios), `attention-notes`, `academic-scheduler` y `event-scheduler` (tareas `@nestjs/schedule`).
- **Personas y carga:** `school` (gestión por escuela: grupos, alumnos, docentes, padres, importaciones Excel).
- **Otros:** `payments`, `reports`, `exports`, `dashboard` + `dashboards`, `meetings`, `external-visits`, `exports`.

Los controladores usan el prefijo global; ejemplo: el módulo de calendario escolar expone **`/api/v1/calendar/...`**, no `/school-calendar/...`.

## Variables de entorno (backend)

Copiar `.env.example` → `.env`. Validación estricta de JWT y de BD: si no hay **`DATABASE_URL`** ni **`POSTGRES_URL`** con prefijo `postgres://` / `postgresql://`, se exigen **`DB_HOST`**, **`DB_PORT`**, **`DB_NAME`**, **`DB_USER`**, **`DB_PASS`**.

| Variable | Uso |
|----------|-----|
| `NODE_ENV`, `PORT`, `API_PREFIX` | Entorno, puerto (default 3000), prefijo API. |
| `DATABASE_URL` o `POSTGRES_URL` | Conexión Postgres (recomendada en Railway). |
| `DB_*`, `DB_SSL` | Fallback local si no hay URL directa. |
| `DB_SKIP_EXTENSIONS` | `1`: al aplicar SQL v4 sin `CREATE EXTENSION` (hosts restringidos). |
| `JWT_SECRET`, `JWT_EXPIRES_IN`, `JWT_REFRESH_SECRET`, `JWT_REFRESH_EXPIRES_IN` | Auth (refresh único activo por usuario en MVP). |
| `CORS_ORIGIN` | Orígenes permitidos (coma, sin espacios). En local suele incluir el origen del SPA (p. ej. `http://localhost:5173`) además del API si hace falta. |
| `THROTTLE_TTL`, `THROTTLE_LIMIT` | Rate limit global (`@nestjs/throttler`). |
| `UPLOADS_DIR` | Raíz persistente de archivos (p. ej. `/data` en Railway con volumen). |
| `FIREBASE_SERVICE_ACCOUNT_PATH` / `JSON` (o base64) | Push FCM desde servidor. |
| `INSTITUTION_*` | Perfil por defecto si no hay filas en `institution_settings`. |
| `APP_TIMEZONE` | IANA (p. ej. `America/Mexico_City`); cierre de periodos, actividades y políticas de cartera. |
| `VOUCHER_MAX_BYTES` | Tope opcional comprobantes de pago. |
| `MAPBOX_ACCESS_TOKEN`, `SCHOOL_LATITUDE`, `SCHOOL_LONGITUDE`, `CIRCUIT_ARRIVAL_RADIUS_KM` | Mapa / ETA circuito (informativo). |
| `FRONTEND_URL` | Base del SPA para enlaces en correos y notificaciones (deep links). |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | Correo (restablecimiento de contraseña, avisos); sin `SMTP_HOST` el envío se omite con warning en log. |

E2E: además `.env.e2e` puede sobreescribir `DB_NAME` (p. ej. `escuela_pass_test`). Extensiones: `E2E_SKIP_EXTENSIONS` / `DB_SKIP_EXTENSIONS`.

## Base de datos

Hay **dos caminos válidos** para el esquema; no mezclar la aplicación del v4 completo sobre una BD ya gobernada por migraciones sin criterio.

### Opción A — Esquema de referencia v4 (greenfield / desarrollo)

1. Crear la base en PostgreSQL.
2. Definir **`DATABASE_URL`** o **`POSTGRES_URL`** (solo URLs `postgres://` / `postgresql://`; el script `db:apply` no ensambla desde `DB_*` sueltos).
3. `npm run db:apply` — aplica solo DDL idempotente de `escuela_pass_schema_v4.sql` (sin datos).
4. Poblar datos: **`node scripts/seed-full-demo.cjs`** u otros scripts en `scripts/` (solo **desarrollo/staging**; leer cabezales). En `package.json` también existen `npm run db:seed:demo` y `npm run db:seed:railway` como envoltorios.

### Opción B — Cadena TypeORM (base vacía o solo migraciones pendientes)

1. Base vacía (o existente solo con migraciones aplicadas).
2. `npm run migration:run` (CLI: `src/config/typeorm.datasource.ts`; carga `.env` en la raíz del backend).

En **runtime**, al `start` / `start:prod`, el servidor **vuelve a ejecutar** migraciones pendientes antes de escuchar el puerto.

**Bases ya pobladas:** aplicar migraciones incrementales; no re-ejecutar el v4 completo encima.

**Enum `circuit_status` y permisos:** si el usuario de BD no es dueño del tipo, puede fallar la migración `CircuitPadreEnCamino`. Solución documentada en el propio repo: script `scripts/database/ensure-padre-en-camino-enum.sql` o bloque equivalente en baseline; opcional `ALTER TYPE ... OWNER TO ...`.

**Permiso mínimo recomendado para migraciones:**

```sql
GRANT USAGE, CREATE ON SCHEMA public TO escuela_pass_app;
```

### Migraciones (comandos útiles)

- `npm run migration:show` — `migration:create` — `migration:generate` — `migration:run` — `migration:revert`
- Carpeta: `src/database/migrations/` (el baseline inicial sigue siendo `1712050000000-BaselineSchema.ts`, apoyado en `src/database/baseline/typeorm-baseline-v3.sql`).

## Frontend (`frontend/`)

```bash
cd frontend
npm install
cp .env.example .env   # VITE_API_BASE, VITE_MAPBOX_ACCESS_TOKEN, Firebase opcional
npm run dev
```

- **`VITE_API_BASE`**: origen del API sin sufijo `/api` (en local a menudo vacío si se usa proxy de Vite, u `http://localhost:3000`).
- **Mapbox:** token público `pk.` para mapas (circuito, institución).
- **FCM:** variables `VITE_FIREBASE_*` + `VITE_FIREBASE_VAPID_KEY`; **`npm run sync:fcm-sw`** genera `public/firebase-messaging-sw.js` (también en `predev` / `prebuild`).

Referencias útiles: consola Firebase (app web + clave VAPID), cuenta de servicio solo en el backend.

## Autenticación JWT

Prefijo `api/v1`:

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/auth/me` | Bearer | Perfil mínimo del usuario autenticado. |
| POST | `/auth/login` | No | `accessToken`, `refreshToken`, `user` (sesión refresh única). |
| POST | `/auth/refresh` | No | Body `{ "refreshToken" }`; rota par. |
| POST | `/auth/logout` | No | Revoca refresh tokens del usuario. |
| POST | `/auth/forgot-password` | No | Solicitud de reset (requiere SMTP para envío real). |
| POST | `/auth/reset-password` | No | Token de reset + nueva contraseña. |

JWT puede incluir **`schoolId`** (`null` para `ADMIN` de plataforma); llega al request como `req.user.schoolId` en guards.

Swagger: botón **Authorize** con `Bearer <accessToken>`.

## Multi-institución (`/schools`)

Solo **`ADMIN`** (plataforma): CRUD de escuelas, asignación de `school_id` a usuarios, alta de administrativos por escuela, listado de usuarios por escuela, reset de contraseña de admin escolar. El resto de módulos filtra datos según el vínculo del usuario con su institución.

## Endpoints destacados (no exhaustivo)

La API evoluciona; para rutas nuevas y DTOs usar **`/docs`**.

### Salud y almacenamiento

- `GET /health` — público.
- `GET /health/storage` — `ADMIN`, diagnóstico de carpeta de uploads.

### Accesos

- `POST /access-events/scan`, `GET /access-events/my-qr`, CRUD/listado credenciales NFC, etc.

### Circuito vial

- `POST /circuit-requests`, `POST /circuit-requests/batch`, `GET /circuit-requests/today`, vistas padre (`.../parent/active`, `.../parent/active-all`), `GET :id/map`, `PATCH :id/gps`, `PATCH :id/parent-progress`, `PATCH :id/teacher-signal`, `PATCH :id/status`, `PATCH :id/cancel`, `PATCH :id/confirm-delivered`.

### Visitas al plantel

Las solicitudes de visita institucional están bajo **`/external-visits`** (sustituyen el antiguo prefijo `/visits` si existía en versiones previas del documento).

### Reuniones padre–docente (`/meetings`)

Incluye `POST`, listados, `GET :id`, `PATCH :id`, reprogramación, cancelación, `POST :id/status`, `POST :id/rsvp`, etc.

### Calendario (`/calendar`)

- Días no lectivos: `GET|POST|DELETE /calendar/non-instructional-days` (alcance por escuela/grupo según implementación).
- Vistas `GET /calendar/me/student`, `GET /calendar/parent/my-children`.

### Asistencia (`/attendance`)

- `POST /attendance/register`, `POST /attendance/register-bulk`, `GET .../groups/:groupId`, `GET .../parent/my-children`, `GET .../parent/my-students`, `POST .../parent/excuse` (justificación).

### Actividades y calificaciones por actividad

- CRUD y tablero bajo **`/activities`**; persistencia de notas: **`POST /activities/:id/grades`** (docente/admin).
- No hay módulo HTTP independiente **`/grades/register`** del documento antiguo; las calificaciones consolidadas para boletines/export enlazan con **periodos académicos** y **report-cards**.

### Periodos y boletines

- **`/academic-periods`**: políticas, alta, cierre, reapertura.
- **`/report-cards`**: listados admin/docente, vistas alumno/padre, `POST .../generate-period/:periodId`, `POST .../generate-final`.
- **`/documents`**: PDFs `bulletin/:reportCardId`, `bulletins/bulk` (cabecera `X-Bulletin-Count`), `schedule/group/:groupId`, `groups/summary`.

### Pagos (`/payments`)

Conceptos (ámbito por escuela), deudas, comprobante archivo o JSON, verificación, rechazo, arreglos, políticas batch, ajustes — ver Swagger.

### Avisos y notificaciones

- **`/notices`**, **`/notifications/me`**, FCM register/unregister, lectura, informes administrativos y comentarios bajo **`/notifications/admin-reports/...`**.

### Gestión escolar (`/school`)

Grupos, materias, estudiantes (incl. transiciones de ciclo de vida e historial), docentes, padres, vínculos alumno–padre, asignaciones `teacher-assignments`, vehículos vinculados a padres, importaciones Excel (incl. `students-to-groups`), plantillas, historial `import/history`.

### Otros

- **`/class-sessions`**, **`/schedules`** (incl. vistas `me/teacher`, `me/student`, `parent/my-children`).
- **`/parents/vehicles`** (padre) y rutas de vehículos desde administración en `school` donde aplique.
- **`/reports`**: asistencia, pagos, circuito, **`access/range`**, **`finance/summary`**.
- **`/exports`**: `attendance.xlsx`, `grades.xlsx`, `bulletin-consolidated.xlsx`.
- **`/dashboard`**: `summary`, `panel`, `actionable-kpis`.
- **`/dashboards/home/:role`** — resumen por rol.
- **`/audit/logs`**, **`/privacy/policy/latest`**, **`/privacy/me/acceptances`**, **`POST /privacy/accept`**.

## Flujo QR/NFC (web)

1. El frontend obtiene o muestra credencial (QR / lector).
2. El cliente envía el valor al backend (`access-events`).
3. Validación contra `access_credentials` y registro en `access_events`.
4. Reglas de negocio de entradas/salidas y sincronización con asistencia cuando aplica (respetando días no lectivos).

## Pagos: archivos subidos

Comprobantes bajo `uploads/comprobantes/` (o subcarpeta bajo `UPLOADS_DIR`). En **producción** conviene CDN privado o políticas de acceso; en desarrollo suelen exponerse vía `/uploads/...`.

## Despliegue (Railway)

Ver `railway.toml` y [`docs/releases/runbook-railway-v1.3.md`](./releases/runbook-railway-v1.3.md): `DATABASE_URL`, JWT, `FRONTEND_URL`, volumen **`UPLOADS_DIR=/data`**, variables de correo/push si se usan. El `startCommand` es `npm run start:prod`.

## Comandos rápidos

**Backend** (desde esta carpeta, `01 - Escuela Pass`):

```bash
npm install
npm run start:dev
```

- API: `http://localhost:3000/api/v1/health` (ajustar puerto si `PORT` cambia).
- Docs: `http://localhost:3000/docs`.

**Calidad:**

- `npm run smoke:build` — `npm run smoke:e2e` — `npm run smoke:ci-local`.

## CI

En el repositorio Git padre: **`.github/workflows/backend-ci.yml`** con `working-directory: 01 - Escuela Pass`, Node 20, `npm ci`, `build` y `test:e2e` contra Postgres servicio.

## Checklist operativo (resumen)

1. `.env` completo (JWT, BD, CORS del front, opcionales SMTP/FCM/Mapbox/FRONTEND_URL/UPLOADS_DIR).
2. BD: migraciones aplicadas (o v4 + seeds solo en dev).
3. Humo: health + login + flujo crítico por rol en Swagger.
4. CI verde en la rama principal.

## Riesgos y evolución

- Revisar dependencias (`npm audit`) en hardening.
- Auth MVP: un refresh activo por usuario; multi-dispositivo explícito queda como mejora.
- `ensureRuntimeSchema` es complementario a migraciones formales, no sustituto en entornos con tráfico.

## Lecturas relacionadas

- [`README.md`](../README.md) — estructura del monorepo y puesta en marcha breve.
- [`docs/releases/README.md`](./releases/README.md) — entregas y runbooks.
- [`docs/CODESTYLE-COMMENTS.md`](./CODESTYLE-COMMENTS.md) — convención de comentarios en código.


||||||||||||||||||||||||||||||||||||||||||||

