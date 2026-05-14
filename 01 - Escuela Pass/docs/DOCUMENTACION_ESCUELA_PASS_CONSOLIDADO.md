# Documentación Markdown consolidada — Escuela Pass

Generado automáticamente. Cada bloque conserva el contenido íntegro del archivo indicado.

**Aviso (estructura actual del repo):** Las líneas `# Fuente: docs/tdg/...` indican el archivo de origen cuando se armó este consolidado; esos `.md` ya no están en el árbol de trabajo (se conservan en el historial de git si hace falta). Las figuras Mermaid exportadas viven en **`docs/imagenes/`** (`.mmd` y `.png` con el mismo nombre base).

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

- **Ubicación:** `docs/imagenes/*.mmd` (fuente) y `docs/imagenes/*.png` (exportado; mismo nombre base).

## Regenerar un PNG

Desde la raíz del repositorio (Node.js instalado), por ejemplo:

```bash
npx -y @mermaid-js/mermaid-cli@10 -i docs/imagenes/01-arquitectura-contexto-lr.mmd -o docs/imagenes/01-arquitectura-contexto-lr.png
```

En la primera ejecución puede descargar Chromium y tardar varios minutos.

## Uso en Word

Los Markdown referencian las figuras bajo `docs/imagenes/*.png`. Los `.docx` entregables viven en `docs/tdg/word/`; para incrustar de nuevo todas las figuras haría falta restaurar desde git el pipeline del TDG (`generate_word_docs.py` y `.md` fuente), si aún se conservan en el historial.


||||||||||||||||||||||||||||||||||||||||||||

# Fuente: docs/README.md

# Documentación técnica

- **[technical-setup.md](./technical-setup.md)** — variables, API, flujos y **dos opciones** para preparar PostgreSQL.
- **[CODESTYLE-COMMENTS.md](./CODESTYLE-COMMENTS.md)** — comentarios en código (backend y frontend).


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

# Fuente: docs/tdg/00_Inventario_Fuentes_TDG_Escuela_Pass.md

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
| Entregables base | `docs/tdg/word/` (`anexos/*.docx`) y texto en [DOCUMENTACION_ESCUELA_PASS_CONSOLIDADO.md](./DOCUMENTACION_ESCUELA_PASS_CONSOLIDADO.md) | Anexos en Word; el consolidado conserva el equivalente en Markdown que antes vivía en `docs/tdg/`. |
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


||||||||||||||||||||||||||||||||||||||||||||

# Fuente: docs/tdg/01_Contexto_Tecnico_Proyecto_Escuela_Pass.md

# Contexto Técnico Del Proyecto Escuela Pass

**Proyecto:** Escuela Pass — Administración y Seguridad Escolar  
**Autor:** Jhon Kevin Murillo Martínez  
**Tipo de documento:** Base interna de comprensión técnica para TDG y anexos  
**Versión:** 1.0  
**Estado:** Documento de trabajo para trazabilidad y redacción académica

## 1. Propósito

Este documento sintetiza el conocimiento técnico del repositorio Escuela Pass antes de redactar
entregables, anexos o capítulos del trabajo de grado. Su función es mantener una base común de
arquitectura, módulos, flujos, decisiones técnicas y evidencias verificables, de manera que la
documentación académica no dependa de suposiciones ni de descripciones genéricas.

## 2. Arquitectura General

Escuela Pass está estructurado como una aplicación web cliente-servidor. El backend está en la raíz
del proyecto y utiliza NestJS, TypeORM y PostgreSQL. El frontend está en `frontend/` y utiliza React,
Vite, TypeScript y Tailwind. La comunicación principal se realiza mediante una API REST protegida
con JWT, roles y reglas de alcance institucional.

![Figura. Arquitectura general cliente-servicio e integraciones (exportada desde Mermaid)](docs/imagenes/01-arquitectura-contexto-lr.png)

## 3. Backend

El módulo raíz `src/app.module.ts` registra los bounded contexts de la API. La configuración global
incluye `ConfigModule`, TypeORM, `ScheduleModule`, rate limiting con `ThrottlerGuard`, validación
de entorno y módulos por dominio.

### 3.1 Contextos Principales

| Contexto | Módulos / rutas fuente | Responsabilidad documental |
| --- | --- | --- |
| Autenticación y seguridad | `auth`, `jwt.strategy`, guards, roles | Login, refresh, logout, estado de usuario, control por rol y protección de rutas. |
| Accesos | `access` | Escaneo QR/NFC, credenciales, registro de entrada/salida y sincronización con asistencia. |
| Circuito de recogida | `circuit`, `vehicles`, `departure-consent` | Solicitudes de recogida, GPS, estados, autorización de salida y confirmación de entrega. |
| Gestión escolar | `school`, `schools`, `settings` | Escuelas, usuarios, grupos, estudiantes, docentes, padres, asignaciones e institución. |
| Académico | `attendance`, `class-attendance`, `class-sessions`, `academic-periods`, `activities`, `report-cards`, `documents` | Asistencia general y por clase, actividades, notas, periodos, boletines y PDF. |
| Finanzas | `payments`, `uploads`, `files` | Conceptos, deudas, comprobantes, verificación, rechazos y acceso privado a archivos. |
| Comunicación | `notices`, `notifications`, `fcm`, `mail`, `meetings`, `external-visits`, `attention-notes` | Avisos, bandeja, push web, correo, reuniones, visitas y anotaciones. |
| Reportes y operación | `reports`, `exports`, `dashboard`, `dashboards`, schedulers | Indicadores, Excel, paneles, cierres automáticos y tareas programadas. |
| Cumplimiento | `privacy`, `audit`, `files` | Aceptación de políticas, auditoría, retención y archivos privados. |

### 3.2 Seguridad Transversal

La seguridad se apoya en varias capas:

- `ValidationPipe` global con `whitelist`, `forbidNonWhitelisted` y `transform`.
- `helmet` y CORS configurado por entorno.
- JWT con `JwtAuthGuard`, roles y `schoolId` para aislamiento multiinstitución.
- `RolesGuard` para controlar acceso por rol.
- Validación de `user.status` en `JwtStrategy`, lo que invalida cuentas inactivas aunque el token
  aún no haya expirado.
- Hash de contraseñas con bcrypt.
- Rate limiting global y throttling específico en endpoints sensibles de autenticación.
- Acceso a archivos privados por endpoint autenticado `/files/:bucket/:filename`.

## 4. Frontend

El frontend organiza navegación por rutas protegidas y roles. `frontend/src/App.tsx` define rutas
públicas de inicio, login y recuperación de contraseña, además de rutas autenticadas bajo `/app`.
`frontend/src/navigation/navConfig.ts` define el menú lateral por rol.

### 4.1 Pantallas Relevantes Para Manual Y UI/UX

| Área | Pantallas / componentes |
| --- | --- |
| Autenticación | `LoginPage`, `ForgotPasswordPage`, `ResetPasswordPage`, `ProtectedRoute`, `AuthProvider`. |
| Inicio y navegación | `AppHomePage`, `HomePage`, `AppShell`, `NotificationsBadge`, `PrivacyGate`. |
| Perfil | `PerfilPage`, QR del usuario, datos personales y acciones de cuenta. |
| Circuito | `CircuitPadrePage`, `CircuitTodayPage`, `CircuitDetailPage`, `ParentTrackingMap`, `CircuitArrivalMap`. |
| Acceso | `EscanerAccesoPage`, `QrScanResultModal`. |
| Académico | `CalificacionesDocentePage`, `MisCalificacionesPage`, `BoletinesPage`, `PeriodosAcademicosPage`, `ScheduleHubPage`. |
| Gestión escolar | `SchoolRosterPage`, `SchoolsAdminPage`, `ImportExportPage`, `InstitutionPage`. |
| Comunicación | `ReunionesPage`, `VisitasPage`, `AnotacionesDocentePage`. |
| Finanzas | `FinanzasPage`, `FinanzasStaffTools`. |

## 5. Base De Datos

La persistencia se modela con entidades TypeORM, migraciones y SQL de referencia. Existen entidades
para usuarios, roles, escuelas, grupos, estudiantes, padres, docentes, asistencias, sesiones de clase,
periodos académicos, actividades, notas, boletines, pagos, circuito, vehículos, visitas, reuniones,
notificaciones, privacidad, auditoría y archivos vinculados.

El repositorio documenta dos rutas de preparación:

- Esquema de referencia v4 para entornos greenfield.
- Cadena de migraciones TypeORM para ambientes controlados y despliegue.

## 6. Flujos Críticos

### 6.1 Autenticación Y Acceso Por Rol

1. El usuario ingresa credenciales en el frontend.
2. El backend valida contraseña, estado de cuenta y rol.
3. Se emiten `accessToken` y `refreshToken`.
4. Las rutas protegidas usan JWT y gates de rol en backend y frontend.
5. La privacidad se atiende mediante `PrivacyGate` y módulo `privacy`.

### 6.2 Control De Acceso QR/NFC

1. Un operador autorizado escanea QR/NFC.
2. `access` valida credencial activa, usuario y escuela del operador.
3. Se previenen duplicados recientes.
4. Se registra evento de acceso y, para alumnos, se puede sincronizar asistencia.

### 6.3 Circuito De Recogida

1. El padre o tutor crea la solicitud para un estudiante autorizado.
2. Se valida que el estudiante esté activo, que el circuito esté habilitado y que no exista una
   solicitud abierta para el mismo día.
3. El padre puede enviar GPS y avanzar el estado permitido.
4. Docentes o administración gestionan el avance operativo.
5. La entrega se confirma cuando el menor está en el estado operativo correspondiente.

RF3 debe documentarse como circuito conducido por padres/tutores, no como flota o conductor
institucional independiente.

### 6.4 Académico

El flujo académico integra asistencia general, asistencia por clase, periodos académicos, actividades,
calificaciones, boletines y documentos PDF. Las reglas de periodo cerrado impiden modificaciones
ordinarias, salvo operaciones autorizadas con `force` y auditoría donde aplica.

### 6.5 Pagos Y Archivos Privados

Administración crea conceptos y deudas; el padre sube comprobante; administración verifica o rechaza.
Los comprobantes se protegen con `/files/comprobantes/:filename`, validando relación padre-estudiante,
escuela o rol administrativo. Las evidencias y reportes usan buckets privados con validación de ruta,
extensión y permisos.

## 7. Pruebas Y Evidencia

Las pruebas E2E principales están en `test/app.e2e-spec.ts` y `test/phase7-closure.e2e-spec.ts`.
Validan autenticación, refresh/logout, asistencia, calendario, acceso QR, circuito, pagos, dashboards,
privacidad, archivos privados, lifecycle, boletines y flujos extendidos de Fase 7. El test de throttle
IP está separado en `test/auth-throttle-ip.e2e-spec.ts` y requiere configuración estricta.

## 8. Decisiones Técnicas Documentables

- Railway y Vercel/hosting estático sustituyen la expectativa inicial de cPanel por facilidad de
  despliegue, variables de entorno y PostgreSQL administrado.
- Mapbox se usa para mapas del circuito; Haversine actúa como fallback de distancia.
- `html5-qrcode` y `qrcode.react` reemplazan menciones genéricas a bibliotecas QR.
- El sistema se extendió más allá de la propuesta con privacidad, auditoría, archivos privados,
  boletines, visitas, reuniones, lifecycle, dashboards y pruebas E2E ampliadas.

## 9. Uso En Documentación

Este documento alimenta los anexos técnicos, la matriz de trazabilidad, el manual técnico, la
documentación API, el manual de usuario, el informe de pruebas y los capítulos de desarrollo del TDG.
Cada afirmación técnica debe mantenerse vinculada a rutas reales del repositorio y no convertirse en
una descripción inventada o meramente aspiracional.


||||||||||||||||||||||||||||||||||||||||||||

# Fuente: docs/tdg/02_Guia_Estilo_APA7_TDG_Escuela_Pass.md

# Guía De Estilo Y Normas APA 7 Para El TDG Escuela Pass

**Proyecto:** Escuela Pass — Administración y Seguridad Escolar  
**Autor:** Jhon Kevin Murillo Martínez  
**Tipo de documento:** Guía normativa interna para redacción del TDG y anexos  
**Fuentes base:** `TDG_Plantilla y Normas.docx`, `CLASE MANUAL DE ESTILO.pdf`  
**Versión:** 1.0

## 1. Propósito

Esta guía consolida las reglas de presentación, estructura, citación y redacción académica que deben
aplicarse en el trabajo de grado y sus anexos. Su objetivo es evitar documentos inconsistentes,
redacción superficial, uso inadecuado de fuentes y riesgos de similitud en Turnitin.

## 2. Formato General

| Elemento | Regla aplicable |
| --- | --- |
| Fuente del cuerpo | Times New Roman 12 pt. |
| Fuente en tablas y figuras | Times New Roman 10 pt. |
| Márgenes | 2.54 cm en todos los lados. |
| Espaciado | Sencillo en todo el documento. |
| Alineación | Texto justificado. |
| Sangría | Primera línea de párrafo: 1.27 cm. El resumen no lleva sangría. |
| Numeración | Esquina inferior derecha; inicia en la introducción; portada sin número. |
| Encabezado | Título abreviado en mayúsculas, máximo 50 caracteres, uniforme en todas las páginas. |

## 3. Orden Institucional Del Documento

El documento principal debe seguir el orden indicado por la plantilla y el manual:

1. Portada.
2. Contraportada.
3. Agradecimientos y dedicatoria, si aplica.
4. Resumen y Abstract.
5. Tabla de contenido, lista de figuras y lista de tablas.
6. Introducción.
7. Desarrollo por capítulos.
8. Conclusiones.
9. Recomendaciones y trabajos futuros.
10. Referencias.
11. Anexos.

La plantilla institucional exige portada y contraportada formales. Los entregables anexos también
deben incorporar portada propia, aunque sean documentos independientes en Markdown antes de su
maquetación final.

## 4. Estructura Académica Del TDG

| Capítulo | Contenido esperado |
| --- | --- |
| Capítulo 1. Presentación del trabajo | Planteamiento del problema, justificación y objetivos. |
| Capítulo 2. Diseño metodológico | Metodología de desarrollo, fuentes/técnicas, fases por objetivo y diagrama de Gantt. |
| Capítulo 3. Marco referencial | Marco conceptual, legal, antecedentes, limitaciones y alcance. Máximo recomendado: 10 a 15 hojas según guía. |
| Capítulos de desarrollo | Un capítulo por objetivo específico, con resultados de las actividades definidas en metodología. |
| Conclusiones | Párrafos académicos alineados con los objetivos específicos, no lista de viñetas. |
| Recomendaciones | Aplicación práctica, mejoras futuras y líneas de continuidad. |

La introducción no debe numerarse. Los capítulos de desarrollo deben evitar convertirse en manual de
código; el TDG explica arquitectura, decisiones, módulos y resultados, mientras que el detalle técnico
extenso queda en anexos.

## 5. Niveles De Títulos

| Nivel | Regla formal | Uso recomendado en Escuela Pass |
| --- | --- | --- |
| 1 | Centrado, mayúsculas, negrita, espaciado anterior/posterior 24. | Capítulos principales. |
| 2 | Alineado a la izquierda, negrita, Cada Palabra En Mayúscula. | Secciones como Marco Conceptual, Arquitectura, Resultados. |
| 3 | Alineado a la izquierda, negrita cursiva, Palabra Inicial En Mayúscula. | Subsecciones técnicas o metodológicas. |
| 4 | Sangría, negrita, termina en punto; texto en la misma línea. | Detalles internos puntuales. |
| 5 | Sangría, negrita cursiva, termina en punto; texto en la misma línea. | Usar solo si es necesario. |

En Markdown se usará una estructura equivalente con `#`, `##` y `###`, y la conversión final a Word
deberá respetar los estilos institucionales.

## 6. Tablas Y Figuras

### 6.1 Tablas

- Identificar como `Tabla 1`, `Tabla 2`, etc.
- Título breve, descriptivo y en cursiva en la versión maquetada.
- Mantener diseño simple con líneas horizontales mínimas.
- Incluir nota debajo cuando la tabla requiera fuente, aclaración o elaboración propia.
- Las tablas del planteamiento del problema deben relacionar causa y consecuencia de forma directa.

### 6.2 Figuras

- La figura debe ser visible antes de su nota.
- Nota: `Figura 1.` seguida de descripción breve.
- No exceder márgenes.
- Incluir referencia completa cuando la figura no sea de elaboración propia.
- Si la imagen se insertará manualmente, usar placeholder entre corchetes, por ejemplo:
  `[Imagen: captura del panel principal por rol administrativo]`.

## 7. Citación APA 7

El sistema de citación es autor-fecha:

- Paráfrasis: citar siempre la fuente usada.
- Cita directa menor de 40 palabras: entre comillas dentro del párrafo.
- Cita directa de 40 palabras o más: bloque independiente con sangría, sin comillas.
- Datos estadísticos, cifras, tablas adaptadas y figuras externas deben citarse.
- La lista de referencias debe estar en orden alfabético y con sangría colgante en el documento final.

Ejemplos de formatos:

- Artículo: Autor, A. A. (Año). Título. *Revista, volumen*(número), páginas. DOI
- Libro: Autor, A. A. (Año). *Título*. Editorial.
- Sitio web: Autor/Entidad. (Año, día mes). *Título*. URL
- Video: Canal. (Año, día mes). *Título* [Video]. YouTube. URL

## 8. Reglas Anti-Similitud Y Turnitin

- No copiar texto de la propuesta aceptada; se debe reescribir con voz propia y citar cuando se use
  información conceptual, cifras o fuentes externas.
- No copiar contenido del TDG externo; solo se extraen buenas prácticas abstractas de estructura.
- Diferenciar claramente entre evidencia del código, interpretación del autor y fuentes externas.
- Evitar frases genéricas de IA como “en el mundo actual” sin contexto concreto.
- Mantener redacción humana, técnica y verificable, con ejemplos propios del proyecto.
- Citar herramientas, tecnologías y estándares la primera vez que se mencionen cuando corresponda.

## 9. Términos Técnicos En Inglés Y Siglas

La primera mención debe incluir definición o traducción:

- API (Application Programming Interface o interfaz de programación de aplicaciones).
- JWT (JSON Web Token o token web JSON).
- NFC (Near Field Communication o comunicación de campo cercano).
- QR (Quick Response o respuesta rápida).
- GPS (Global Positioning System o sistema de posicionamiento global).
- REST (Representational State Transfer o transferencia de estado representacional).
- SPA (Single Page Application o aplicación de página única).
- ORM (Object-Relational Mapping o mapeo objeto-relacional).
- CRUD (Create, Read, Update, Delete o crear, leer, actualizar y eliminar).

## 10. Aplicación Específica A Escuela Pass

- RF3 debe explicarse como recogida operada por padres o tutores, no por conductor institucional.
- Las herramientas no previstas en la propuesta deben justificarse por problema resuelto, beneficio
  técnico y coherencia con el alcance inicial.
- La licencia debe dejarse como sección pendiente: `[Licencia pendiente por definir]`.
- El documento principal debe acercarse al máximo de 50 páginas sin excederlo; el detalle amplio debe
  trasladarse a anexos.
- Los anexos pueden ser extensos y deben contener manuales, diagramas, matrices, documentación API,
  pruebas, evidencias y capturas.

## 11. Checklist Antes De Cerrar Cada Documento

| Criterio | Verificación |
| --- | --- |
| Portada | Incluye proyecto, autor, programa, tipo de documento y versión. |
| Trazabilidad | Cada afirmación técnica se vincula con código, prueba, propuesta o documentación. |
| APA 7 | Citas y referencias con formato autor-fecha. |
| Figuras/tablas | Numeradas, descritas y con placeholders claros si faltan imágenes. |
| Originalidad | Sin copias del FTG ni del TDG externo. |
| Coherencia | No contradice el repositorio ni los entregables previos. |


||||||||||||||||||||||||||||||||||||||||||||

# Fuente: docs/tdg/03_Matriz_Propuesta_vs_Desarrollo_Escuela_Pass.md

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


||||||||||||||||||||||||||||||||||||||||||||

# Fuente: docs/tdg/04_Buenas_Practicas_TDG_Referencia_Sin_Plagio.md

# Buenas Prácticas Estructurales Observadas En TDG De Referencia

**Proyecto:** Escuela Pass — Administración y Seguridad Escolar  
**Autor:** Jhon Kevin Murillo Martínez  
**Tipo de documento:** Guía de buenas prácticas sin reutilización textual  
**Fuente observada:** `TDG_santiago_alvarez82192_20251020.docx`  
**Versión:** 1.0

## 1. Propósito

Este documento registra buenas prácticas estructurales observadas en un trabajo de grado externo,
sin copiar redacción, títulos particulares, párrafos, secuencias argumentativas ni contenido técnico
del proyecto de referencia. Su uso se limita a orientar la calidad formal, el nivel de detalle y la
organización documental del TDG Escuela Pass.

## 2. Restricciones Éticas

- No copiar fragmentos del documento externo.
- No parafrasear párrafos del documento externo como si fueran propios.
- No replicar títulos específicos cuando respondan al dominio del proyecto de referencia.
- No trasladar diagramas, listas o anexos de ese trabajo.
- Usar únicamente aprendizajes abstractos sobre organización, profundidad y evidencia.

## 3. Buenas Prácticas Identificadas

| Práctica estructural | Aplicación propuesta en Escuela Pass |
| --- | --- |
| Documento principal con capítulos claros y anexos extensos. | Mantener el TDG principal dentro de 50 páginas y mover manuales/API/diagramas a anexos. |
| Tabla de contenido, lista de figuras y lista de tablas. | Generar automáticamente en Word con los estilos de la plantilla institucional. |
| Desarrollo por objetivos específicos. | Crear capítulos de resultados alineados con análisis, diseño, implementación, frontend y validación. |
| Uso intensivo de anexos para requisitos, diseño, pruebas, API y manuales. | Usar los entregables `00` a `10` y `99` como anexos profesionales. |
| Evidencia visual de prototipos y pantallas. | Insertar capturas verificadas de Escuela Pass y placeholders donde falten imágenes. |
| Separación entre metodología, marco referencial, construcción y validación. | Evitar mezclar marco teórico con descripción de código. |
| Conclusiones cerca del cierre del documento. | Redactarlas en párrafos académicos alineados con objetivos, no como lista. |

## 4. Lecciones Para El TDG Escuela Pass

El documento principal debe ser sintético, argumentativo y académico, mientras los anexos deben
contener el detalle técnico. En Escuela Pass esto significa que el TDG debe explicar por qué se
construyó el sistema, cómo se organizó metodológicamente, qué arquitectura se adoptó, cómo se
cumplieron los requerimientos y qué resultados se obtuvieron. No debe convertirse en un manual
exhaustivo de endpoints, componentes o funciones.

Los anexos, en cambio, sí pueden contener:

- Matriz completa de trazabilidad.
- Requerimientos funcionales y no funcionales.
- Arquitectura detallada.
- Modelo entidad-relación.
- Diagramas UML y Mermaid.
- Prototipos y capturas UI/UX.
- Manual técnico.
- Documentación API.
- Manual de usuario.
- Informe de pruebas y métricas.

## 5. Reglas De Originalidad Para Redacción

Para evitar similitud indebida:

- Redactar desde la experiencia real del proyecto Escuela Pass.
- Sustituir ejemplos del trabajo externo por flujos propios: circuito de recogida, QR/NFC, pagos,
  asistencia, boletines, privacidad y dashboards.
- Usar citas académicas solo para conceptos, normativas, metodologías y tecnologías.
- Citar fuentes originales cuando se tomen ideas teóricas o datos externos.
- Mantener una voz técnica propia, sin imitar el orden textual del documento externo.

## 6. Aplicación En Entregables

| Entregable Escuela Pass | Buena práctica aplicable |
| --- | --- |
| Requerimientos | Trazabilidad clara entre necesidad, actor, módulo y criterio de aceptación. |
| Arquitectura | Diagramas y explicación por vistas, no solo listado de tecnologías. |
| Modelo ER | Identificar entidades críticas y reglas de relación. |
| UML | Priorizar casos de uso y secuencias de flujos reales. |
| Manual técnico | Separar instalación, configuración, despliegue y mantenimiento. |
| Manual de usuario | Organizar por rol, con pasos y capturas sugeridas. |
| Informe de pruebas | Vincular pruebas con RF/RNF y evidencias verificables. |

## 7. Conclusión Operativa

El TDG externo es útil como referencia de orden y profundidad, pero el contenido de Escuela Pass debe
ser completamente propio. La calidad se logrará mediante trazabilidad con el repositorio, lectura de
la propuesta aceptada, aplicación del manual de estilo y redacción académica contextualizada.


||||||||||||||||||||||||||||||||||||||||||||

# Fuente: docs/tdg/05_Revision_Calidad_APA7_TDG_Escuela_Pass.md

# Revisión De Calidad APA 7 Y Coherencia Documental

**Proyecto:** Escuela Pass — Administración y Seguridad Escolar  
**Autor:** Jhon Kevin Murillo Martínez  
**Tipo de documento:** Control de calidad académico y documental  
**Versión:** 1.0

## 1. Propósito

Este documento registra la revisión de calidad aplicada a los insumos, anexos y borrador principal
del TDG. Su objetivo es reducir contradicciones, mejorar cumplimiento APA 7, controlar placeholders
pendientes y disminuir riesgos de similitud.

## 2. Hallazgos De Coherencia

| Elemento revisado | Resultado |
| --- | --- |
| Ubicación de documentos normativos | Confirmada en `docs/tdg/`. |
| Inventario de fuentes | Actualizado; ya no indica documentos faltantes. |
| RF3 circuito | Alineado como recogida operada por padres/tutores. |
| Licencia | Marcada como pendiente, según instrucción del autor. |
| Imágenes | Marcadas entre corchetes para inserción manual verificable. |
| Trabajo externo | Referenciado solo como fuente de buenas prácticas estructurales. |
| Propuesta aceptada | Usada como fuente de objetivos, alcance, RF/RNF y entregables. |

## 3. Checklist APA 7

| Criterio | Estado | Observación |
| --- | --- | --- |
| Portada/contraportada | Pendiente de maquetación final | Debe usarse la plantilla Word con logos. |
| Márgenes/fuente/espaciado | Pendiente de Word | Markdown no controla formato final. |
| Títulos numerados | Parcial | Markdown usa estructura; Word debe aplicar estilos. |
| Tablas | Cumplido en borrador | Faltan títulos formales en versión final Word. |
| Figuras | Pendiente | Hay placeholders; deben reemplazarse por capturas o diagramas. |
| Citas autor-fecha | Parcial | El borrador requiere completar referencias exactas. |
| Referencias | Pendiente | Deben completarse en APA 7 con fuentes usadas. |

## 4. Control De Originalidad

La redacción generada se apoya en el código, la propuesta, la documentación técnica y las reglas
normativas, pero evita copiar el trabajo externo. Para la versión final se recomienda:

- Releer cada párrafo del TDG principal y añadir voz personal del autor donde describa decisiones reales.
- Citar fuentes externas de la propuesta cuando se mantengan cifras o datos.
- No conservar párrafos literales del FTG salvo citas debidamente marcadas.
- Usar el TDG externo únicamente para verificar nivel de detalle y ubicación de anexos.

## 5. Pendientes Antes De Entrega Final

| Pendiente | Responsable sugerido |
| --- | --- |
| Maquetar en `TDG_Plantilla y Normas.docx`. | Autor. |
| Insertar logos, portada y contraportada final. | Autor. |
| Completar Abstract. | Autor / revisión final. |
| Validar marco legal con normativa aplicable. | Autor / asesor. |
| Completar referencias APA 7. | Autor. |
| Insertar capturas reales y diagramas exportados. | Autor. |
| Definir licencia. | Autor / universidad / asesoría jurídica. |
| Ejecutar pruebas finales y adjuntar capturas. | Autor. |

## 6. Recomendación De Revisión Humana

Antes de exportar a PDF, se recomienda una lectura completa por parte del autor para incorporar
experiencias reales del proceso de desarrollo, decisiones tomadas durante la práctica y comentarios
del asesor. Esto mejora naturalidad, reduce apariencia de texto genérico y fortalece la defensa oral.


||||||||||||||||||||||||||||||||||||||||||||

# Fuente: docs/tdg/06_Validacion_Global_Trazabilidad_TDG_Escuela_Pass.md

# Validación Global De Trazabilidad TDG Escuela Pass

**Proyecto:** Escuela Pass — Administración y Seguridad Escolar  
**Autor:** Jhon Kevin Murillo Martínez  
**Tipo de documento:** Validación global de coherencia entre propuesta, código, entregables y TDG  
**Versión:** 1.0

## 1. Propósito

Este documento registra la validación global del paquete documental generado para Escuela Pass. Su
objetivo es confirmar que los documentos base, anexos y borrador principal mantienen coherencia con
la propuesta aceptada, el repositorio y las instrucciones académicas.

## 2. Documentos Validados

| Documento | Estado |
| --- | --- |
| `00_Inventario_Fuentes_TDG_Escuela_Pass.md` | Actualizado con documentos normativos reales. |
| `01_Contexto_Tecnico_Proyecto_Escuela_Pass.md` | Generado como base de comprensión técnica. |
| `02_Guia_Estilo_APA7_TDG_Escuela_Pass.md` | Generado con reglas APA 7/manual de estilo. |
| `03_Matriz_Propuesta_vs_Desarrollo_Escuela_Pass.md` | Generado con comparación propuesta-código. |
| `04_Buenas_Practicas_TDG_Referencia_Sin_Plagio.md` | Generado con restricciones anti-plagio. |
| `05_Revision_Calidad_APA7_TDG_Escuela_Pass.md` | Generado como checklist de calidad. |
| `TDG_Escuela_Pass_Documento_Principal.md` | Generado como borrador principal para maquetación. |
| Contenido anexos (histórico `.md`) | Integrado en este consolidado; entrega formal en `docs/tdg/word/anexos/`. |

## 3. Validación De Coherencia Clave

| Tema | Resultado |
| --- | --- |
| RF3 | Todos los documentos revisados mantienen la interpretación padre/tutor como conductor operativo. |
| RNF6 | Se justifica Railway/Vercel como ajuste técnico frente a hosting/cPanel propuesto. |
| Licencia | Se conserva como pendiente, sin inventar una licencia. |
| Imágenes | Se usan placeholders entre corchetes cuando falta evidencia visual real. |
| TDG externo | Se usa solo para buenas prácticas; no se incorporan textos ni dominio Cargoban. |
| Propuesta | RF/RNF, objetivos y alcance están cruzados contra implementación real. |
| Código | Los documentos citan módulos, rutas y pantallas reales del repositorio. |

## 4. Riesgos Residuales

| Riesgo | Estado | Acción antes de entrega |
| --- | --- | --- |
| Referencias APA incompletas | Mitigado parcialmente | El TDG principal ya incluye referencias base; se recomienda ampliar antecedentes académicos si el asesor lo exige. |
| Abstract pendiente | Cerrado | El documento principal ya incluye Abstract en inglés. |
| Capturas/figuras pendientes | Abierto | Insertar capturas reales o diagramas exportados. |
| Métricas de usabilidad | Abierto | Ejecutar piloto/encuesta o declararlo como recomendación. |
| Maquetación Word | Mitigado | Se generaron `.docx` desde la plantilla institucional; se recomienda revisión visual final en Microsoft Word. |
| Licencia | Abierto | Definir con universidad/asesoría antes de entrega final. |

## 5. Conclusión De Validación

El paquete documental queda alineado para continuar con maquetación, inserción de imágenes, referencias
APA 7 y revisión del asesor. La coherencia técnica principal se sostiene sobre el repositorio, la
propuesta aceptada y los anexos. No se detectan contradicciones graves en los puntos críticos: RF3,
alcance de pagos, despliegue cloud, privacidad, archivos privados, pruebas y uso del TDG externo.

## 6. Validación Word Generada

La producción Word quedó en:

- `docs/tdg/word/TDG_Escuela_Pass_Documento_Principal.docx`
- `docs/tdg/word/anexos/*.docx`

Se validó que los trece `.docx` generados son ZIP OpenXML legibles y contienen `word/document.xml`.
También se revisó que no permanezcan placeholders bloqueantes como referencias legales vacías,
Abstract sin completar o instrucciones internas del tipo “completar después”. Los placeholders que
permanecen corresponden a imágenes, UI/UX, evidencias de prueba y licencia pendiente, todos aceptados
como elementos que el autor debe sustituir o conservar según instrucción.

## 7. Correcciones Aplicadas Antes De Word

| Hallazgo | Corrección |
| --- | --- |
| RF3 no mencionaba auto-transición GPS. | Se aclaró que `NOTIFICADO_LLEGADA` puede activarse por proximidad GPS, mientras autorización y entrega siguen siendo explícitas. |
| Uploads se describían como públicos. | Se separaron logos públicos de comprobantes/evidencias privadas por `/files/:bucket/:filename`. |
| Referencias a diagramas inexistentes. | Se reemplazaron por Mermaid/prompts y fuente en código real. |
| Padre aparecía como creador de reuniones/visitas. | Se ajustó a consultar y responder invitaciones creadas por la institución. |
| Marco legal/Abstract/Referencias estaban como placeholder. | Se completaron con contenido base y referencias APA 7 iniciales. |


||||||||||||||||||||||||||||||||||||||||||||

# Fuente: docs/tdg/entregables/00_Matriz_Trazabilidad_TDG_Escuela_Pass.md

# 00. Matriz De Trazabilidad TDG Escuela Pass

**Proyecto:** Escuela Pass — Administración y Seguridad Escolar  
**Autor:** Jhon Kevin Murillo Martínez  
**Programa:** Ingeniería Informática — Área de Programas Informáticos y Telecomunicaciones  
**Tipo de documento:** Matriz de control  
**Versión:** 1.0 documental  


Fuentes normativas usadas para estos entregables:
- Manual de estilo APIT: Times New Roman 12 pt, márgenes de 2.54 cm, espaciado sencillo,
  títulos numerados, citación autor-fecha y referencias APA 7.
- Plantilla TDG: portada, contraportada, resumen, introducción, capítulos por objetivo,
  conclusiones, recomendaciones, referencias y anexos.
- Propuesta FTG aprobada: RF1-RF8, RNF1-RNF6, objetivos, alcance y entregables.

Nota de originalidad: la redacción fue reconstruida en estilo académico propio a partir de
la propuesta, el código fuente y la documentación técnica del repositorio. El trabajo externo
de referencia solo se usó para observar estructura documental y nivel de detalle.


## 1. Propósito

Esta matriz controla la relación entre la propuesta aprobada, el código implementado, las rutas
de API, las pantallas del frontend y los documentos entregables. Su función es evitar que el
trabajo de grado se convierta en una descripción improvisada del código y garantizar que cada
objetivo pueda evidenciarse con artefactos verificables.

## 2. Matriz RF/RNF ↔ Código ↔ Evidencia

| Código | Requerimiento | Módulos / evidencia | Rutas API | Pantallas | Estado |
| --- | --- | --- | --- | --- | --- |
| RF1 | Autenticación con roles JWT | auth, privacy, audit | /auth/login, /auth/me, /auth/refresh | LoginPage, AuthProvider, ProtectedRoute | Cumplido |
| RF2 | Control de accesos QR/NFC | access | /access-events/scan, /access-events/my-qr | EscanerAccesoPage, QrScanResultModal | Cumplido |
| RF3 | Circuito de recogida con GPS | circuit, vehicles, departure-consent, fcm | /circuit-requests, /circuit-requests/:id/gps, /circuit-requests/:id/status | CircuitPadrePage, CircuitTodayPage, CircuitDetailPage, ParentTrackingMap | Cumplido con ajuste: conductor = padre/tutor |
| RF4 | Gestión escolar | school, schools, uploads, settings | /school/*, /schools/*, /uploads/* | SchoolRosterPage, SchoolsAdminPage, InstitutionPage | Ampliado |
| RF5 | Asistencia y calificaciones | attendance, activities, academic-periods, report-cards, documents, exports | /attendance/*, /activities/:id/grades, /report-cards/* | CalificacionesDocentePage, MisCalificacionesPage, BoletinesPage | Ampliado |
| RF6 | Pagos y colegiaturas | payments, uploads, reports | /payments/concepts, /payments/debts, /payments/debts/:id/voucher/file | FinanzasStaffTools y vistas operativas | Cumplido sin pasarela automática |
| RF7 | Avisos y notificaciones | notices, fcm, mail | /notices, /notifications/me, /notifications/fcm/register | NotificationsBadge, FcmBootstrap | Cumplido |
| RF8 | Dashboard administrativo | dashboard, reports, exports | /dashboard/summary, /dashboard/panel, /reports/*, /exports/* | AdminDashboardPanel, AppHomePage | Ampliado |
| RNF1 | NestJS y PostgreSQL | AppModule, TypeORM config, migrations | N/A | N/A | Cumplido |
| RNF2 | Diseño responsive | frontend React/Vite | N/A | AppShell, páginas por rol | Cumplido |
| RNF3 | Seguridad: bcrypt, JWT, validación, SQL seguro | auth, guards, ValidationPipe, TypeORM | N/A | N/A | Cumplido; HTTPS depende del despliegue |
| RNF4 | Operaciones principales menores a 2 s | reports, dashboard, indexes | N/A | N/A | A validar con métricas |
| RNF5 | Interfaz intuitiva | frontend | N/A | navegación por rol, formularios | A validar con usuarios |
| RNF6 | Hosting proporcionado | Railway/Vercel | N/A | N/A | Ajustado frente a cPanel propuesto |

## 3. Mapa A Objetivos Específicos

| Objetivo específico | Evidencia principal | Entregables relacionados |
| --- | --- | --- |
| Analizar requerimientos | RF/RNF, actores, actas y reglas de negocio | 01, 02, 00 |
| Diseñar arquitectura, BD e interfaces | Diagramas, ER, prototipos UI/UX | 03, 04, 05, 06 |
| Implementar backend | Módulos NestJS, TypeORM, Swagger, migraciones | 03, 07, 08 |
| Desarrollar frontend | React/Vite, rutas por rol, flujos móviles | 06, 09 |
| Validar funcionamiento | E2E, smoke, pruebas manuales y métricas | 10 |

## 4. Inconsistencias Justificadas

- La propuesta menciona Google Maps o Mapbox; la implementación adopta Mapbox y fallback Haversine.
- La propuesta menciona qrcode.js; la implementación usa `html5-qrcode` para escaneo y `qrcode.react` para generación visual.
- La propuesta menciona cPanel; el repo evidencia Railway para API y Vercel/hosting estático para frontend.
- El circuito vial puede registrar automáticamente `NOTIFICADO_LLEGADA` por proximidad GPS; la autorización de salida, el avance operativo y la confirmación de entrega siguen siendo acciones explícitas.
- El alcance real incorporó módulos adicionales: multiinstitución, privacidad, auditoría, boletines, PDFs, visitas, reuniones, horarios y notas de atención.

## 5. Trazabilidad Por Flujo Operativo

| Flujo | Actores | Evidencia backend | Evidencia frontend | Prueba/documento |
| --- | --- | --- | --- | --- |
| Inicio de sesión y sesión | Todos | `auth`, `JwtStrategy`, `RolesGuard` | `LoginPage`, `AuthProvider`, `ProtectedRoute` | `test/app.e2e-spec.ts` |
| Escaneo de acceso | ADMIN, ADMINISTRATIVO, DOCENTE | `access`, `access_credentials`, `access_events` | `EscanerAccesoPage`, `QrScanResultModal` | E2E de QR y asistencia automática |
| Circuito de familia | PADRE, DOCENTE, ADMINISTRATIVO | `circuit`, `vehicles`, `departure-consent`, `notifications` | `CircuitPadrePage`, `CircuitTodayPage`, `CircuitDetailPage` | E2E circuito/GPS/confirmación |
| Gestión académica | DOCENTE, ADMIN, PADRE, ALUMNO | `attendance`, `class-attendance`, `activities`, `report-cards` | `CalificacionesDocentePage`, `MisCalificacionesPage`, `BoletinesPage` | E2E asistencia, notas y boletines |
| Pagos | PADRE, ADMINISTRATIVO | `payments`, `uploads`, `files` | `FinanzasPage`, `FinanzasStaffTools` | E2E comprobantes privados |
| Privacidad y auditoría | Todos / staff | `privacy`, `audit`, `files` | `PrivacyGate`, `AuthImage` | Phase7 privacidad/IDOR |

## 6. Validación Para El TDG

Esta matriz debe citarse como anexo de trazabilidad. En el documento principal no se recomienda
copiarla completa; allí debe resumirse que los requerimientos aprobados fueron contrastados contra
módulos, rutas, pantallas y pruebas reales. El detalle completo queda en este anexo para defender el
cumplimiento técnico ante jurados.


||||||||||||||||||||||||||||||||||||||||||||

# Fuente: docs/tdg/entregables/01_Documento_de_Requerimientos_Escuela_Pass.md

# 01. Documento De Requerimientos Escuela Pass

**Proyecto:** Escuela Pass — Administración y Seguridad Escolar  
**Autor:** Jhon Kevin Murillo Martínez  
**Programa:** Ingeniería Informática — Área de Programas Informáticos y Telecomunicaciones  
**Tipo de documento:** Especificación funcional y no funcional  
**Versión:** 1.0 documental  


Fuentes normativas usadas para estos entregables:
- Manual de estilo APIT: Times New Roman 12 pt, márgenes de 2.54 cm, espaciado sencillo,
  títulos numerados, citación autor-fecha y referencias APA 7.
- Plantilla TDG: portada, contraportada, resumen, introducción, capítulos por objetivo,
  conclusiones, recomendaciones, referencias y anexos.
- Propuesta FTG aprobada: RF1-RF8, RNF1-RNF6, objetivos, alcance y entregables.

Nota de originalidad: la redacción fue reconstruida en estilo académico propio a partir de
la propuesta, el código fuente y la documentación técnica del repositorio. El trabajo externo
de referencia solo se usó para observar estructura documental y nivel de detalle.


## 1. Introducción


Escuela Pass es una aplicación web institucional de AlfaNetworks orientada a la administración
y seguridad escolar. La solución combina una API NestJS con PostgreSQL, una SPA React/Vite,
control de acceso por QR/NFC, circuito de recogida iniciado por padres o tutores, comunicación
por avisos y notificaciones, gestión académica, pagos, reportes y despliegue cloud.

La interpretación oficial del RF3 es que los padres o tutores actúan como conductores del
circuito de recogida desde la aplicación web móvil; no se trata de una flota independiente de
vehículos escolares administrada por terceros. La geolocalización se usa como apoyo informativo
para el mapa y ETA, y puede registrar automáticamente la llegada al radio del plantel; las
autorizaciones institucionales y la confirmación final continúan siendo acciones explícitas.


## 2. Actores Del Sistema

| Actor | Rol técnico | Responsabilidades principales |
| --- | --- | --- |
| Administrador de plataforma | ADMIN | Configuración transversal, gestión de escuelas, usuarios administrativos y auditoría. |
| Personal administrativo | ADMINISTRATIVO | Gestión escolar, pagos, calendario, reportes, visitas y operación institucional. |
| Docente | DOCENTE | Registro de asistencia, actividades, calificaciones, anotaciones, horarios y apoyo al circuito. |
| Padre o tutor | PADRE | Circuito de recogida, consulta académica de hijos, pagos, reuniones, visitas y notificaciones. |
| Alumno | ALUMNO | Consulta de horario, boletines, actividades y credenciales de acceso cuando aplica. |

## 3. Requerimientos Funcionales

| Código | Descripción | Estado |
| --- | --- | --- |
| RF1 | Autenticación con roles JWT | Cumplido |
| RF2 | Control de accesos QR/NFC | Cumplido |
| RF3 | Circuito de recogida con GPS | Cumplido con ajuste: conductor = padre/tutor |
| RF4 | Gestión escolar | Ampliado |
| RF5 | Asistencia y calificaciones | Ampliado |
| RF6 | Pagos y colegiaturas | Cumplido sin pasarela automática |
| RF7 | Avisos y notificaciones | Cumplido |
| RF8 | Dashboard administrativo | Ampliado |

### 3.1 Reglas Transversales

- Todo flujo protegido requiere autenticación JWT, salvo login, refresh, logout, recuperación de contraseña y salud pública.
- Los permisos se definen por rol; `ADMIN` tiene alcance global y los demás roles se restringen por escuela, grupo, hijo o asignación docente.
- La información académica y financiera se consulta según pertenencia institucional y relaciones padre-estudiante.
- Las operaciones de archivo se limitan a tipos y tamaños permitidos; los uploads se almacenan en volumen persistente o carpeta local.

## 4. Requerimientos No Funcionales

| Código | Descripción | Estado |
| --- | --- | --- |
| RNF1 | NestJS y PostgreSQL | Cumplido |
| RNF2 | Diseño responsive | Cumplido |
| RNF3 | Seguridad: bcrypt, JWT, validación, SQL seguro | Cumplido; HTTPS depende del despliegue |
| RNF4 | Operaciones principales menores a 2 s | A validar con métricas |
| RNF5 | Interfaz intuitiva | A validar con usuarios |
| RNF6 | Hosting proporcionado | Ajustado frente a cPanel propuesto |

## 5. Criterios De Aceptación Por Requerimiento

| Código | Criterio de aceptación |
| --- | --- |
| RF1 | Un usuario válido inicia sesión, recibe tokens, accede a `/auth/me` y no puede entrar a rutas fuera de su rol. |
| RF2 | Un escaneo QR/NFC válido registra entrada o salida y deja traza; credenciales inválidas son rechazadas. |
| RF3 | Un padre crea solicitud, actualiza avance/GPS, el personal la visualiza y se confirma/cancela según estado. |
| RF4 | Administración crea y actualiza grupos, materias, estudiantes, docentes, padres y asignaciones. |
| RF5 | Docente o administración registra asistencia y calificaciones; padre/alumno consultan información autorizada. |
| RF6 | Administración crea deudas; padre sube comprobante; administración verifica o rechaza. |
| RF7 | Aviso creado genera bandeja y, si hay token FCM, push web. |
| RF8 | Dashboard y reportes entregan indicadores operativos y exportables. |

## 6. Fuera De Alcance Del MVP

- Aplicaciones móviles nativas Android/iOS.
- Pasarela de pagos automática.
- Reconocimiento facial.
- Soporte multiidioma.
- Analítica avanzada con inteligencia artificial.

## 7. Reglas De Negocio Prioritarias

| Área | Regla |
| --- | --- |
| Autenticación | Un usuario inactivo no debe operar el sistema aunque conserve un token emitido previamente. |
| Multiinstitución | Los usuarios no globales solo pueden operar datos de su escuela, grupo, hijo o asignación. |
| Circuito | Un estudiante solo puede tener una solicitud operacional abierta por día. |
| Circuito | El padre o tutor solicitante es quien opera el avance familiar; el personal escolar opera la salida institucional. |
| Asistencia | Los días no lectivos bloquean registros ordinarios según calendario institucional. |
| Académico | Un periodo cerrado restringe registros académicos, salvo acciones autorizadas y auditadas. |
| Pagos | Un padre solo puede cargar comprobantes de deudas asociadas a sus hijos. |
| Archivos | Comprobantes, excusas y evidencias sensibles se sirven por endpoint autenticado, no como públicos. |
| Privacidad | La aceptación de políticas debe registrarse y consultarse por usuario. |

## 8. Criterios De Priorización

La prioridad de implementación se define por impacto institucional, seguridad del estudiante,
dependencia entre módulos y relación con el alcance aprobado. Autenticación, control de acceso,
gestión escolar y circuito se consideran críticos porque soportan la operación básica del sistema.
Pagos, avisos, reportes y dashboards complementan la administración y generan valor operativo, pero
dependen de que los datos base y permisos estén correctamente configurados.

## 9. Criterios De No Ambigüedad

- RF3 se interpreta como recogida realizada por padres o tutores; no existe conductor institucional
  independiente ni flota administrada por la escuela.
- RF6 no incluye pasarela de pagos; el alcance se limita a deuda, comprobante y verificación manual.
- RNF6 se ajusta técnicamente a despliegue cloud con Railway/Vercel, por compatibilidad con Node,
  PostgreSQL y volumen persistente.
- Las métricas de rendimiento y usabilidad deben validarse con evidencia; si no hay prueba piloto,
  deben quedar como recomendación o plan de medición.


||||||||||||||||||||||||||||||||||||||||||||

# Fuente: docs/tdg/entregables/02_Actas_de_Reuniones_AlfaNetworks_Escuela_Pass.md

# 02. Actas De Reuniones AlfaNetworks Escuela Pass

**Proyecto:** Escuela Pass — Administración y Seguridad Escolar  
**Autor:** Jhon Kevin Murillo Martínez  
**Programa:** Ingeniería Informática — Área de Programas Informáticos y Telecomunicaciones  
**Tipo de documento:** Registro de acuerdos  
**Versión:** 1.0 documental  


Fuentes normativas usadas para estos entregables:
- Manual de estilo APIT: Times New Roman 12 pt, márgenes de 2.54 cm, espaciado sencillo,
  títulos numerados, citación autor-fecha y referencias APA 7.
- Plantilla TDG: portada, contraportada, resumen, introducción, capítulos por objetivo,
  conclusiones, recomendaciones, referencias y anexos.
- Propuesta FTG aprobada: RF1-RF8, RNF1-RNF6, objetivos, alcance y entregables.

Nota de originalidad: la redacción fue reconstruida en estilo académico propio a partir de
la propuesta, el código fuente y la documentación técnica del repositorio. El trabajo externo
de referencia solo se usó para observar estructura documental y nivel de detalle.


## 1. Nota Metodológica

Estas actas se redactan como reconstrucción documental de acuerdos derivados de la propuesta
FTG, del repositorio y de las decisiones técnicas evidenciadas. Cuando no existe soporte de fecha
externa en el repositorio, se marca como acta documental reconstruida para evitar atribuir hechos
no comprobados.

## 2. Acta 1 — Levantamiento Inicial De Necesidades

**Tipo:** acta reconstruida/documental.  
**Participantes:** estudiante desarrollador, asesor académico, representante funcional de AlfaNetworks.  
**Objetivo:** identificar problema, actores y alcance de Escuela Pass.

**Acuerdos:**
- Priorizar seguridad escolar, administración académica, comunicación y control de accesos.
- Implementar una solución web responsive para evitar aplicaciones móviles nativas en el MVP.
- Definir roles: administrador, administrativo, docente, padre/tutor y alumno.
- Documentar tratamiento de datos personales de menores y controles de acceso.

## 3. Acta 2 — Requerimientos Funcionales Y No Funcionales

**Tipo:** acta reconstruida/documental.  
**Objetivo:** validar RF1-RF8 y RNF1-RNF6 de la propuesta.

**Acuerdos:**
- RF3 se interpreta como circuito iniciado por padres/tutores conductores desde móvil web.
- Pagos no procesan dinero en línea; se maneja deuda y comprobante.
- Notificaciones se implementan como bandeja interna y push FCM opcional.
- El sistema debe conservar trazabilidad técnica por API, BD y roles.

## 4. Acta 3 — Diseño Arquitectónico

**Tipo:** acta reconstruida/documental.  
**Objetivo:** decidir stack y despliegue.

**Acuerdos:**
- Backend con NestJS y TypeORM; base de datos PostgreSQL.
- Frontend con React/Vite por compatibilidad web y despliegue estático.
- Railway se adopta para API y Postgres; Vercel o hosting estático equivalente para SPA.
- Mapbox se adopta para mapas y ETA del circuito, con fallback si no hay token.

## 5. Acta 4 — Validación Funcional

**Tipo:** acta reconstruida/documental.  
**Objetivo:** revisar módulos implementados contra propuesta.

**Acuerdos:**
- Mantener Swagger como fuente viva de API.
- Generar manual técnico, manual de usuario, documentación API, pruebas y matriz de trazabilidad.
- Registrar diferencias entre propuesta y código como evolución justificada, no como cambio total del proyecto.

## 6. Acta 5 — Preparación De Entrega

**Tipo:** acta reconstruida/documental.  
**Objetivo:** organizar entregables previos al TDG principal.

**Acuerdos:**
- Separar anexos extensos del cuerpo principal para respetar el máximo de 50 páginas del TDG.
- Usar APA 7, citas autor-fecha y redacción propia para reducir riesgos de similitud.
- Dejar placeholders de imágenes solo cuando no sea posible generar la figura de forma verificable.

## 7. Control De Trazabilidad De Actas

| Acta | Evidencia asociada | Uso en el TDG |
| --- | --- | --- |
| Levantamiento inicial | Propuesta aceptada, requerimientos RF/RNF, entregable 01. | Planteamiento del problema, justificación y objetivos. |
| Requerimientos | Matriz de trazabilidad y código por módulo. | Capítulo de análisis y anexos de requisitos. |
| Diseño arquitectónico | `src/app.module.ts`, `frontend/src/App.tsx`, entidades, despliegue. | Capítulo de diseño y arquitectura. |
| Validación funcional | E2E, smoke, Phase 7, informe de pruebas. | Capítulo de resultados y validación. |
| Preparación de entrega | Manual de estilo, APA 7, anexos. | Cierre documental y anexos. |

## 8. Nota De Transparencia

Estas actas no sustituyen registros firmados o evidencias externas. Funcionan como reconstrucción
documental para anexar decisiones técnicas y académicas cuando el repositorio no conserva minutas
formales. Si existen actas reales con fechas y firmas, deben reemplazar o complementar esta versión.


||||||||||||||||||||||||||||||||||||||||||||

# Fuente: docs/tdg/entregables/03_Documento_de_Arquitectura_Escuela_Pass.md

# 03. Documento De Arquitectura Escuela Pass

**Proyecto:** Escuela Pass — Administración y Seguridad Escolar  
**Autor:** Jhon Kevin Murillo Martínez  
**Programa:** Ingeniería Informática — Área de Programas Informáticos y Telecomunicaciones  
**Tipo de documento:** Arquitectura de software  
**Versión:** 1.0 documental  


Fuentes normativas usadas para estos entregables:
- Manual de estilo APIT: Times New Roman 12 pt, márgenes de 2.54 cm, espaciado sencillo,
  títulos numerados, citación autor-fecha y referencias APA 7.
- Plantilla TDG: portada, contraportada, resumen, introducción, capítulos por objetivo,
  conclusiones, recomendaciones, referencias y anexos.
- Propuesta FTG aprobada: RF1-RF8, RNF1-RNF6, objetivos, alcance y entregables.

Nota de originalidad: la redacción fue reconstruida en estilo académico propio a partir de
la propuesta, el código fuente y la documentación técnica del repositorio. El trabajo externo
de referencia solo se usó para observar estructura documental y nivel de detalle.


## 1. Visión Arquitectónica


Escuela Pass es una aplicación web institucional de AlfaNetworks orientada a la administración
y seguridad escolar. La solución combina una API NestJS con PostgreSQL, una SPA React/Vite,
control de acceso por QR/NFC, circuito de recogida iniciado por padres o tutores, comunicación
por avisos y notificaciones, gestión académica, pagos, reportes y despliegue cloud.

La interpretación oficial del RF3 es que los padres o tutores actúan como conductores del
circuito de recogida desde la aplicación web móvil; no se trata de una flota independiente de
vehículos escolares administrada por terceros. La geolocalización se usa como apoyo informativo
para el mapa y ETA, y puede registrar automáticamente la llegada al radio del plantel; las
autorizaciones institucionales y la confirmación final continúan siendo acciones explícitas.


La arquitectura sigue una separación cliente-servidor: una SPA React/Vite consume una API REST
NestJS protegida con JWT. PostgreSQL concentra la persistencia, mientras FCM, SMTP, Mapbox y
almacenamiento de archivos actúan como servicios complementarios.

## 2. Vista Lógica


El backend registra módulos de dominio en `src/app.module.ts`: HealthModule, MailModule,
AuthModule, AccessModule, CircuitModule, ClassSessionsModule, NoticesModule, PaymentsModule,
AttendanceModule, ActivitiesModule, AttentionNotesModule, AcademicPeriodsModule, ReportCardsModule,
AcademicSchedulerModule, ReportsModule, SchoolModule, ExportsModule, DashboardModule, SchedulesModule,
SchoolCalendarModule, SettingsModule, VehiclesModule, DocumentsModule, AuditModule, PrivacyModule,
SchoolsModule, UploadsModule, DepartureConsentModule, EventSchedulerModule y ExternalVisitsModule.

El frontend en `frontend/src` organiza páginas por rol y dominio: autenticación, inicio, escáner,
circuito, gestión escolar, visitas, reuniones, boletines, calificaciones, periodos académicos,
horarios, institución, perfil y panel administrativo.


[Figura 1. Arquitectura lógica Escuela Pass centrada]

## 3. Vista De Despliegue

| Componente | Tecnología | Evidencia |
| --- | --- | --- |
| Cliente web | React 18 + Vite + Tailwind | `frontend/package.json`, `frontend/src` |
| API | NestJS 10 + TypeORM | `package.json`, `src/main.ts`, `src/app.module.ts` |
| Base de datos | PostgreSQL | `src/database/entities`, migraciones, SQL v4 |
| Backend cloud | Railway | `railway.toml` |
| Frontend cloud | Vercel/hosting estático | `frontend/vercel.json` |
| Push | Firebase Cloud Messaging | `firebase-admin`, `notifications/fcm/register` |
| Correo | SMTP/Nodemailer | `src/modules/mail`, recuperación contraseña |
| Archivos | Volumen `UPLOADS_DIR` | `src/lib/uploads-path.ts`, `/uploads` |

[Figura 2. Despliegue Railway, Postgres y frontend estático centrado]

## 4. Seguridad

- `helmet` para cabeceras HTTP.
- CORS parametrizado por `CORS_ORIGIN`.
- `ValidationPipe` global con whitelist y bloqueo de propiedades no permitidas.
- `ThrottlerGuard` global para rate limiting.
- Hash de contraseñas con bcrypt.
- JWT con roles y `schoolId` para filtrado multiinstitución.
- TypeORM reduce riesgo de inyección SQL en consultas parametrizadas.

## 5. Persistencia

La persistencia se modela con entidades TypeORM y migraciones. La base incluye usuarios,
roles, escuelas, grupos, estudiantes, docentes, padres, asistencias, actividades, report cards,
pagos, circuito, visitas, reuniones, notificaciones, privacidad y auditoría.

## 6. Integraciones Externas

- FCM: envío de push web si hay token y credencial de cuenta de servicio.
- Mapbox: mapa/ETA del circuito; fallback por distancia Haversine si no hay token.
- SMTP: restablecimiento de contraseña y correos de agenda si se configura host.
- Uploads: comprobantes, avatares, logos, evidencias y excusas en volumen persistente.

## 7. Decisiones Y Justificación

La propuesta contemplaba cPanel y Google Maps como alternativas. El repositorio evidencia
Railway/Vercel y Mapbox. La decisión se justifica por despliegue cloud simple, variables de
entorno, Postgres administrado, volumen persistente y facilidad de integración con Vite.

## 8. Diagrama Mermaid De Arquitectura

![Figura. Vista lógica y servicios externos (exportada desde Mermaid)](docs/imagenes/02-arquitectura-despliegue-td.png)

## 9. Vista De Módulos Por Dominio

| Dominio | Módulos | Responsabilidad |
| --- | --- | --- |
| Identidad | `auth`, `privacy`, `audit` | Sesión, estado de cuenta, aceptación de políticas y trazabilidad. |
| Seguridad física | `access`, `circuit`, `vehicles`, `departure-consent` | Entrada/salida, QR/NFC, circuito de recogida y vehículos familiares. |
| Académico | `attendance`, `class-attendance`, `activities`, `academic-periods`, `report-cards`, `documents` | Asistencia, clases, notas, periodos, boletines y documentos PDF. |
| Gestión escolar | `school`, `schools`, `settings`, `class-sessions`, `schedules` | Escuelas, grupos, personas, horarios y configuración institucional. |
| Administración | `payments`, `reports`, `exports`, `dashboard` | Pagos, reportes, indicadores y exportables. |
| Comunicación | `notices`, rutas de `notifications`, `meetings`, `external-visits`, `attention-notes`, `mail`, `fcm` | Avisos, reuniones, visitas, anotaciones, correo y push. |

## 10. Riesgos Arquitectónicos Y Mitigaciones

| Riesgo | Mitigación implementada |
| --- | --- |
| Acceso indebido a archivos sensibles | Endpoint `/files` con autenticación, validación de bucket, nombre seguro y reglas por relación. |
| Operación multiinstitución incorrecta | Uso de `schoolId`, roles y consultas restringidas por escuela o relación. |
| Token válido de usuario inactivo | `JwtStrategy` consulta estado del usuario en cada request protegida. |
| Datos inválidos en DTO | `ValidationPipe` global y DTOs con `class-validator`. |
| Exposición de Swagger en producción | Swagger deshabilitado por defecto en producción salvo variable explícita. |
| Falta de persistencia de uploads en cloud | Uso de `UPLOADS_DIR` y volumen persistente documentado para Railway. |


||||||||||||||||||||||||||||||||||||||||||||

# Fuente: docs/tdg/entregables/04_Modelo_Entidad_Relacion_Escuela_Pass.md

# 04. Modelo Entidad Relación Escuela Pass

**Proyecto:** Escuela Pass — Administración y Seguridad Escolar  
**Autor:** Jhon Kevin Murillo Martínez  
**Programa:** Ingeniería Informática — Área de Programas Informáticos y Telecomunicaciones  
**Tipo de documento:** Modelo de datos  
**Versión:** 1.0 documental  


Fuentes normativas usadas para estos entregables:
- Manual de estilo APIT: Times New Roman 12 pt, márgenes de 2.54 cm, espaciado sencillo,
  títulos numerados, citación autor-fecha y referencias APA 7.
- Plantilla TDG: portada, contraportada, resumen, introducción, capítulos por objetivo,
  conclusiones, recomendaciones, referencias y anexos.
- Propuesta FTG aprobada: RF1-RF8, RNF1-RNF6, objetivos, alcance y entregables.

Nota de originalidad: la redacción fue reconstruida en estilo académico propio a partir de
la propuesta, el código fuente y la documentación técnica del repositorio. El trabajo externo
de referencia solo se usó para observar estructura documental y nivel de detalle.


## 1. Propósito

El modelo entidad-relación organiza la información crítica de Escuela Pass en dominios
institucionales, académicos, financieros, de seguridad y comunicación. La fuente primaria es
`src/database/entities/` y la cadena de migraciones TypeORM.

## 2. Agrupación De Entidades

| Dominio | Entidades principales | Finalidad |
| --- | --- | --- |
| Identidad | users, refresh_tokens, privacy_policies, user_privacy_acceptances, audit_logs | Autenticación, privacidad y trazabilidad |
| Institución | schools, institution_settings, administrative_staff | Multiinstitución y perfil |
| Académico núcleo | groups, subjects, students, teachers, student_parents, teacher_groups | Gestión escolar |
| Asistencia | attendance_records, school_non_instructional_days | Asistencia y calendario |
| Evaluación | academic_periods, activities, activity_grades, report_cards, report_card_subjects | Calificaciones y boletines |
| Circuito | circuit_requests, vehicles, student_departure_consents | Recogida y permisos |
| Finanzas | payment_concepts, debts, payment_records, debt_adjustments | Cartera y comprobantes |
| Comunicación | notices, notifications, user_fcm_tokens, admin_reports, admin_report_comments | Avisos, push e informes |
| Agenda | meetings, meeting_participants, external_visits, external_visit_students, external_visit_groups | Reuniones y visitas |
| Horarios | class_sessions, class_schedule_slots | Sesiones y horario por grupo |

## 3. Relaciones Clave

- Una escuela tiene usuarios, grupos, asignaturas, estudiantes, docentes, personal administrativo y configuraciones.
- Un estudiante pertenece a una escuela y grupo; puede vincularse a uno o más padres/tutores.
- Un docente se asigna a grupos y asignaturas por `teacher_groups`/especialidades.
- Las asistencias se registran por estudiante y fecha, considerando días no lectivos.
- Las actividades se vinculan a grupo, periodo y materia; las notas alimentan reportes académicos.
- Las deudas se asocian a estudiantes y conceptos; los pagos/comprobantes modifican su estado.
- Las solicitudes de circuito se asocian a estudiante, padre solicitante, estado y datos de ubicación.
- Las notificaciones se generan para usuarios específicos y pueden vincularse con FCM.

[Figura 1. Modelo ER núcleo multiinstitución centrado]

[Figura 2. Modelo ER extendido académico, finanzas, circuito y comunicación centrado]

## 4. Observaciones Técnicas

- `pickup_authorizations` aparece en SQL/seed históricos, mientras la cadena de migraciones actual reduce el alcance hacia relaciones padre-estudiante y consentimiento de salida. En el TDG se debe aclarar que el modelo vigente para autorización de recogida se documenta desde `student_parents`, `parents`, `students`, `vehicles` y `student_departure_consents`.
- El SQL v4 y las migraciones deben mantenerse alineados para que el modelo académico coincida con el despliegue real.
- El diagrama final debe generarse desde las entidades actuales del repositorio o desde el Mermaid incluido en este documento; no se debe depender de rutas de diagramas que no existan en el repositorio.

## 5. Diagrama ER Resumido En Mermaid

![Figura. Modelo entidad-relación núcleo (exportado desde Mermaid; detalle completo en anexo y entidades TypeORM)](docs/imagenes/03-modelo-er-nucleo.png)

## 6. Prompt Para Lucidchart

Crear un diagrama entidad-relación profesional para Escuela Pass con agrupación visual por dominios:
Identidad, Institución, Académico, Circuito, Finanzas, Comunicación, Agenda y Cumplimiento. Incluir
las entidades principales listadas en la sección 2, usar relaciones uno a muchos y muchos a muchos
mediante tablas puente (`student_parents`, `teacher_groups`, `meeting_participants`). Resaltar como
entidades críticas `users`, `schools`, `students`, `parents`, `teachers`, `groups`, `attendance_records`,
`activities`, `report_cards`, `debts`, `circuit_requests`, `notifications`, `privacy_policies` y
`audit_logs`. Mantener el diagrama legible, con colores suaves por dominio, sin cruzar excesivamente
líneas y con leyenda de dominios.

## 7. Reglas De Lectura Del Modelo

El modelo se debe interpretar como multiinstitución: la escuela define el alcance institucional y las
relaciones padre-estudiante, docente-grupo y usuario-escuela determinan permisos. Las entidades de
auditoría y privacidad no son accesorias; respaldan el tratamiento responsable de datos personales,
especialmente por la presencia de menores de edad.


||||||||||||||||||||||||||||||||||||||||||||

# Fuente: docs/tdg/entregables/05_Diagramas_UML_Escuela_Pass.md

# 05. Diagramas UML Escuela Pass

**Proyecto:** Escuela Pass — Administración y Seguridad Escolar  
**Autor:** Jhon Kevin Murillo Martínez  
**Programa:** Ingeniería Informática — Área de Programas Informáticos y Telecomunicaciones  
**Tipo de documento:** Casos de uso, secuencia y clases  
**Versión:** 1.0 documental  


Fuentes normativas usadas para estos entregables:
- Manual de estilo APIT: Times New Roman 12 pt, márgenes de 2.54 cm, espaciado sencillo,
  títulos numerados, citación autor-fecha y referencias APA 7.
- Plantilla TDG: portada, contraportada, resumen, introducción, capítulos por objetivo,
  conclusiones, recomendaciones, referencias y anexos.
- Propuesta FTG aprobada: RF1-RF8, RNF1-RNF6, objetivos, alcance y entregables.

Nota de originalidad: la redacción fue reconstruida en estilo académico propio a partir de
la propuesta, el código fuente y la documentación técnica del repositorio. El trabajo externo
de referencia solo se usó para observar estructura documental y nivel de detalle.


## 1. Propósito

Este documento agrupa los diagramas UML necesarios para explicar el comportamiento del sistema
sin convertir el trabajo de grado en documentación fuente del código.

## 2. Casos De Uso

Actores: administrador, personal administrativo, docente, padre/tutor y alumno. Los casos se
agrupan por RF1-RF8: autenticación, accesos, circuito, gestión escolar, académico, finanzas,
comunicación y dashboard/reportes.

[Figura 1. Diagrama UML de casos de uso Escuela Pass centrado]

## 3. Secuencia Del Circuito De Recogida

Flujo principal:
1. Padre/tutor inicia sesión.
2. Crea solicitud de circuito para un estudiante autorizado.
3. El backend valida relación padre-estudiante, estado de circuito y configuración institucional.
4. Se registra solicitud y se notifica al personal docente/administrativo.
5. El padre actualiza avance o GPS informativo.
6. El personal gestiona autorización, entrega, cancelación o confirmación.

[Figura 2. Diagrama de secuencia del circuito de recogida centrado]

## 4. Clases / Contexto

La vista de clases se presenta como contexto controlador-servicio-repositorio-entidad para evitar
un diagrama masivo de todas las entidades. El patrón se repite por dominio NestJS.

[Figura 3. Diagrama de clases de contexto NestJS y TypeORM centrado]

## 5. Fuentes

La base de estos diagramas es el código fuente del repositorio, especialmente `frontend/src/App.tsx`,
`frontend/src/navigation/navConfig.ts`, `src/app.module.ts`, controladores NestJS, servicios de dominio
y entidades TypeORM. Si se exportan diagramas en Lucidchart, deben crearse desde los prompts y Mermaid
incluidos en este documento.

## 6. Caso De Uso General (Figura Exportada)

![Figura. Casos de uso generales por actor (exportado desde Mermaid)](docs/imagenes/04-uml-casos-de-uso.png)

## 7. Secuencia Principal Del Circuito

![Figura. Secuencia del circuito de recogida (exportado desde Mermaid)](docs/imagenes/05-uml-secuencia-circuito.png)

## 8. Prompt Para Lucidchart

Crear tres diagramas UML para Escuela Pass:
1. Diagrama de casos de uso por actores: administrador, administrativo, docente, padre/tutor y alumno.
2. Diagrama de secuencia del circuito de recogida, desde solicitud del padre hasta confirmación de entrega.
3. Diagrama de componentes con frontend React/Vite, API NestJS, PostgreSQL, uploads privados, FCM, SMTP y Mapbox.
Usar nombres de módulos reales del proyecto, no nombres genéricos. Mantener los diagramas legibles,
centrados y con notas breves bajo cada figura para anexos del TDG.


||||||||||||||||||||||||||||||||||||||||||||

# Fuente: docs/tdg/entregables/06_Prototipos_UI_UX_Escuela_Pass.md

# 06. Prototipos UI UX Escuela Pass

**Proyecto:** Escuela Pass — Administración y Seguridad Escolar  
**Autor:** Jhon Kevin Murillo Martínez  
**Programa:** Ingeniería Informática — Área de Programas Informáticos y Telecomunicaciones  
**Tipo de documento:** Prototipos e inventario de pantallas  
**Versión:** 1.0 documental  


Fuentes normativas usadas para estos entregables:
- Manual de estilo APIT: Times New Roman 12 pt, márgenes de 2.54 cm, espaciado sencillo,
  títulos numerados, citación autor-fecha y referencias APA 7.
- Plantilla TDG: portada, contraportada, resumen, introducción, capítulos por objetivo,
  conclusiones, recomendaciones, referencias y anexos.
- Propuesta FTG aprobada: RF1-RF8, RNF1-RNF6, objetivos, alcance y entregables.

Nota de originalidad: la redacción fue reconstruida en estilo académico propio a partir de
la propuesta, el código fuente y la documentación técnica del repositorio. El trabajo externo
de referencia solo se usó para observar estructura documental y nivel de detalle.


## 1. Criterios De Diseño

La interfaz se diseña como SPA responsive, priorizando uso móvil para padres/tutores y escritorio
para administración. Se busca navegación por rol, formularios claros, retroalimentación inmediata
y consistencia visual.

## 2. Inventario De Pantallas

| Dominio | Pantallas / flujo | Evidencia frontend |
| --- | --- | --- |
| Autenticación | Login, recuperación y reset | LoginPage, ForgotPasswordPage, ResetPasswordPage |
| Inicio por rol | Dashboard y navegación adaptada | AppHomePage, HomePage, navConfig |
| Acceso | Escáner QR/NFC y resultado | EscanerAccesoPage, QrScanResultModal |
| Circuito padre | Crear solicitud, seguimiento, mapa | CircuitPadrePage, ParentTrackingMap |
| Circuito staff | Solicitudes de hoy, detalle, transiciones | CircuitTodayPage, CircuitDetailPage |
| Gestión escolar | Roster, escuelas, importación | SchoolRosterPage, SchoolsAdminPage, ImportExportPage |
| Académico | Periodos, calificaciones, boletines, horarios | PeriodosAcademicosPage, CalificacionesDocentePage, BoletinesPage, ScheduleHubPage |
| Finanzas | Conceptos, deudas, comprobantes | FinanzasStaffTools |
| Comunicación | Avisos, notificaciones, FCM | NotificationsBadge, FcmBootstrap |
| Agenda | Visitas y reuniones | VisitasPage, ReunionesPage |

## 3. Prototipos Principales

[Figura 1. Prototipo login Escuela Pass centrado]

[Figura 2. Prototipo dashboard administrativo centrado]

[Figura 3. Prototipo circuito padre móvil centrado]

[Figura 4. Prototipo escáner QR/NFC centrado]

[Figura 5. Prototipo gestión académica y boletines centrado]

## 4. Nota Sobre Figma

El entregable propone que las pantallas finales se documenten en Figma o en capturas verificables
del frontend. Si se requiere publicación en un archivo Figma institucional, debe generarse desde
las pantallas reales y validarse visualmente antes de anexarlo. Mientras no exista ese enlace
verificado, se conservan placeholders centrados para no simular evidencia gráfica inexistente.

## 5. Capturas Requeridas Para Anexo

| Pantalla | Placeholder sugerido | Propósito |
| --- | --- | --- |
| Login | `[UI/UX del inicio de sesión]` | Evidenciar acceso inicial y marca visual. |
| Inicio por rol | `[UI/UX del panel inicial por rol]` | Mostrar navegación contextual. |
| Perfil | `[UI/UX del perfil del usuario y QR]` | Evidenciar identidad y credencial QR. |
| Circuito padre móvil | `[UI/UX del circuito de recogida para padre]` | Mostrar enfoque móvil del RF3. |
| Circuito del día staff | `[UI/UX del circuito del día para personal escolar]` | Mostrar operación institucional. |
| Escáner QR/NFC | `[UI/UX del escáner de acceso]` | Evidenciar control de accesos. |
| Gestión escolar | `[UI/UX de grupos, estudiantes, docentes y padres]` | Evidenciar RF4. |
| Calificaciones docente | `[UI/UX de actividades y notas del docente]` | Evidenciar RF5. |
| Mis calificaciones | `[UI/UX de consulta académica padre/alumno]` | Evidenciar consulta autorizada. |
| Finanzas | `[UI/UX de pagos y comprobantes]` | Evidenciar RF6. |
| Boletines | `[UI/UX de boletines académicos]` | Evidenciar reportes académicos. |

## 6. Criterios De Evaluación UX

- Claridad: el usuario debe identificar fácilmente qué acción realizar.
- Consistencia: botones, tarjetas, formularios y modales deben mantener lenguaje visual uniforme.
- Accesibilidad básica: contraste suficiente, mensajes de error y estados de carga.
- Responsividad: pantallas críticas deben funcionar en escritorio y móvil.
- Seguridad percibida: operaciones sensibles deben confirmar acciones y mostrar mensajes claros.

## 7. Prompt Para Prototipo En Figma O Lucidchart

Diseñar un set de pantallas UI/UX para Escuela Pass con estilo institucional moderno, responsive y
sobrio. Incluir: login, dashboard por rol, perfil con QR, circuito de recogida móvil para padre,
circuito del día para staff, escáner QR/NFC, gestión escolar, calificaciones docente, consulta de
calificaciones padre/alumno, finanzas con comprobantes y boletines. Usar jerarquía clara, navegación
lateral en escritorio, navegación adaptada a móvil, tarjetas de resumen, formularios limpios y estados
de carga/error. No inventar funciones fuera del repositorio.


||||||||||||||||||||||||||||||||||||||||||||

# Fuente: docs/tdg/entregables/07_Manual_Tecnico_Escuela_Pass.md

# 07. Manual Técnico Escuela Pass

**Proyecto:** Escuela Pass — Administración y Seguridad Escolar  
**Autor:** Jhon Kevin Murillo Martínez  
**Programa:** Ingeniería Informática — Área de Programas Informáticos y Telecomunicaciones  
**Tipo de documento:** Instalación, configuración y mantenimiento  
**Versión:** 1.0 documental  


Fuentes normativas usadas para estos entregables:
- Manual de estilo APIT: Times New Roman 12 pt, márgenes de 2.54 cm, espaciado sencillo,
  títulos numerados, citación autor-fecha y referencias APA 7.
- Plantilla TDG: portada, contraportada, resumen, introducción, capítulos por objetivo,
  conclusiones, recomendaciones, referencias y anexos.
- Propuesta FTG aprobada: RF1-RF8, RNF1-RNF6, objetivos, alcance y entregables.

Nota de originalidad: la redacción fue reconstruida en estilo académico propio a partir de
la propuesta, el código fuente y la documentación técnica del repositorio. El trabajo externo
de referencia solo se usó para observar estructura documental y nivel de detalle.


## 1. Requisitos

- Node.js 20 o superior.
- PostgreSQL 13+; CI usa PostgreSQL 16.
- Variables `.env` para JWT, BD, CORS y servicios opcionales.
- Cuenta Firebase si se habilita push.
- Token Mapbox si se requiere ETA/rutas.

## 2. Instalación Backend

```bash
npm install
cp .env.example .env
npm run start:dev
```

Swagger queda disponible en `http://localhost:3000/docs` y health en
`http://localhost:3000/api/v1/health`.

## 3. Base De Datos

Opción A: SQL v4 para desarrollo greenfield.  
Opción B: migraciones TypeORM desde una base vacía o ya versionada.

En producción el arranque ejecuta migraciones pendientes antes de exponer el servidor. El helper
`ensureRuntimeSchema` actúa como red idempotente, no como sustituto de migraciones.

## 4. Instalación Frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Variables principales: `VITE_API_BASE`, `VITE_MAPBOX_ACCESS_TOKEN`, `VITE_FIREBASE_*` y
`VITE_FIREBASE_VAPID_KEY`.

## 5. Despliegue

- API: Railway con `DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `FRONTEND_URL` y volumen `/data` con `UPLOADS_DIR=/data`.
- Frontend: Vercel u hosting estático con build Vite.
- CI: workflow backend con build y E2E contra Postgres.

## 6. Mantenimiento

- Ejecutar smoke tests antes de release.
- Revisar logs de migraciones y `ensureRuntimeSchema`.
- Respaldar PostgreSQL antes de cambios de esquema.
- Revisar tokens FCM, SMTP y permisos del volumen de uploads.
- Actualizar documentación cuando cambien rutas o módulos.

## 7. Variables Críticas

| Variable | Uso |
| --- | --- |
| `DATABASE_URL` / `POSTGRES_URL` | Conexión principal PostgreSQL. |
| `JWT_SECRET`, `JWT_REFRESH_SECRET` | Firma de tokens de acceso y refresh. |
| `CORS_ORIGIN` | Orígenes permitidos para frontend. |
| `UPLOADS_DIR` | Carpeta persistente para comprobantes, avatares, evidencias y logos. |
| `FRONTEND_URL` | Enlaces de correo y navegación desde notificaciones. |
| `MAPBOX_ACCESS_TOKEN` | Mapas y cálculo informativo en circuito. |
| `FIREBASE_SERVICE_ACCOUNT_*` | Envío de notificaciones push desde backend. |
| `SMTP_*` | Recuperación de contraseña y correos institucionales. |

## 8. Procedimiento De Release Recomendado

1. Verificar `.env` y variables cloud.
2. Ejecutar `npm run build`.
3. Ejecutar `npm run test:e2e`.
4. Ejecutar `cd frontend && npm run build`.
5. Revisar migraciones pendientes.
6. Confirmar volumen `UPLOADS_DIR` y permisos de escritura.
7. Desplegar backend.
8. Desplegar frontend.
9. Ejecutar smoke manual: login, health, circuito, pagos, asistencia y archivos privados.

## 9. Manejo De Incidentes

| Incidente | Revisión inicial |
| --- | --- |
| API no inicia | Variables de BD, migraciones, `JWT_SECRET`, logs Railway. |
| Frontend no conecta | `VITE_API_BASE`, CORS, URL del backend. |
| Archivos no abren | `UPLOADS_DIR`, ruta `/files`, permisos por rol y existencia física. |
| Push no llega | Token FCM web, cuenta de servicio, permisos del navegador. |
| Circuito falla | Estado del estudiante, asistencia del día, `circuit_enabled`, solicitud abierta previa. |
| Login falla tras lifecycle | Verificar `user.status`; el JWT se invalida si la cuenta queda inactiva. |

## 10. Consideraciones De Seguridad Operativa

No se deben versionar archivos `.env` reales, credenciales de Firebase, contraseñas, tokens SMTP ni
respaldos de base de datos. Los comprobantes, excusas y evidencias se consideran sensibles y deben
servirse mediante rutas autenticadas. Swagger debe quedar deshabilitado o protegido en producción.

## 11. Documentación Complementaria En El Repositorio

Para detalle adicional sin duplicar todo el contenido en este anexo, el repositorio incluye:

| Documento | Contenido principal |
| --- | --- |
| `docs/technical-setup.md` | Visión del monorepo, módulos registrados en `app.module.ts`, variables de entorno, arranque de `main.ts`, Swagger, prefijos de API (p. ej. `/api/v1/calendar/...`). |
| `docs/releases/runbook-railway-v1.3.md` | Runbook de despliegue Railway y comprobaciones post-release. |
| `docs/releases/checklist-operativo-post-release-v1.3.md` | Lista de verificación operativa tras publicar versión. |
| `docs/releases/archive/acta-*.md`, `parte-semanal-*.md` | Actas y seguimiento de estabilización (contexto histórico del proyecto). |

Regeneración de diagramas exportados para anexos y TDG: desde `docs/imagenes/`, usar `npx -y @mermaid-js/mermaid-cli@10` con `-i` / `-o` sobre cada `.mmd` (ver [docs/README.md](./README.md)).


||||||||||||||||||||||||||||||||||||||||||||

# Fuente: docs/tdg/entregables/08_Documentacion_API_Escuela_Pass.md

# 08. Documentación API Escuela Pass

**Proyecto:** Escuela Pass — Administración y Seguridad Escolar  
**Autor:** Jhon Kevin Murillo Martínez  
**Programa:** Ingeniería Informática — Área de Programas Informáticos y Telecomunicaciones  
**Tipo de documento:** Resumen académico de endpoints REST  
**Versión:** 1.0 documental  


Fuentes normativas usadas para estos entregables:
- Manual de estilo APIT: Times New Roman 12 pt, márgenes de 2.54 cm, espaciado sencillo,
  títulos numerados, citación autor-fecha y referencias APA 7.
- Plantilla TDG: portada, contraportada, resumen, introducción, capítulos por objetivo,
  conclusiones, recomendaciones, referencias y anexos.
- Propuesta FTG aprobada: RF1-RF8, RNF1-RNF6, objetivos, alcance y entregables.

Nota de originalidad: la redacción fue reconstruida en estilo académico propio a partir de
la propuesta, el código fuente y la documentación técnica del repositorio. El trabajo externo
de referencia solo se usó para observar estructura documental y nivel de detalle.


## 1. Criterio De Documentación

Swagger en `/docs` es la especificación viva. Este documento resume la API para el trabajo de
grado, agrupando endpoints por dominio y describiendo responsabilidad, roles y propósito.

## 2. Endpoints Por Dominio

| Dominio | Base path | Operaciones principales |
| --- | --- | --- |
| Auth | /auth | login, me, refresh, logout, forgot/reset password |
| Access | /access-events | credencial QR/NFC, escaneo y asignación |
| Circuit | /circuit-requests | solicitudes, GPS, avance, estados, mapa, confirmación |
| School | /school | grupos, materias, alumnos, docentes, padres, importaciones |
| Schools | /schools | multiinstitución, admins escolares |
| Attendance | /attendance | registro individual/bulk, consulta grupo/padre, excusas |
| Activities | /activities | actividades, tablero, cierre, reapertura, calificaciones |
| Academic | /academic-periods, /report-cards, /documents | periodos, boletines, PDFs |
| Payments | /payments | conceptos, deudas, comprobantes, verificación, arreglos |
| Notices | /notices, /notifications | avisos, bandeja, FCM, reportes administrativos |
| Schedule | /schedules, /class-sessions, /calendar | horarios, sesiones, días no lectivos |
| Reports | /reports, /exports, /dashboard | KPIs, Excel, reportes operativos |
| Agenda | /external-visits, /meetings | visitas, reuniones, RSVP y recordatorios |
| Support | /uploads, /audit, /privacy, /settings, /health | archivos, auditoría, privacidad, configuración, salud |

## 3. Seguridad API

- Bearer JWT para rutas protegidas.
- Roles por endpoint con `@Roles` y `RolesGuard`.
- `ADMIN` tiene bypass global; otros roles se restringen por relación institucional.
- Validación DTO por `ValidationPipe`.
- Rate limit global por `ThrottlerGuard`.

## 4. Formatos De Respuesta

La API responde principalmente JSON. Exportaciones y documentos usan:
- Excel: `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`.
- PDF: `application/pdf`.
- Archivos: los logos institucionales pueden servirse de forma pública; comprobantes, excusas,
  evidencias y reportes sensibles se leen mediante `/files/:bucket/:filename` con autenticación y
  validación de permisos.

## 5. Recomendación De Anexo

Para anexos extensos, exportar Swagger/OpenAPI o capturas de `/docs`; no incluir todos los DTOs
en el cuerpo principal para evitar exceder el límite académico.

## 6. Rutas Críticas Para Trazabilidad

| RF | Rutas principales | Roles |
| --- | --- | --- |
| RF1 | `/auth/login`, `/auth/me`, `/auth/refresh`, `/auth/logout` | Todos según autenticación |
| RF2 | `/access-events/scan`, `/access-events/my-qr` | Staff / usuario autenticado |
| RF3 | `/circuit-requests`, `/circuit-requests/today`, `/circuit-requests/:id/gps`, `/circuit-requests/:id/status`, `/circuit-requests/:id/confirm-delivered` | PADRE, DOCENTE, ADMINISTRATIVO, ADMIN |
| RF4 | `/school/*`, `/schools/*` | ADMIN, ADMINISTRATIVO |
| RF5 | `/attendance/*`, `/class-attendance/*`, `/activities/*`, `/report-cards/*`, `/documents/*` | Según rol académico |
| RF6 | `/payments/*`, `/uploads/*`, `/files/comprobantes/:filename` | PADRE, ADMINISTRATIVO, ADMIN |
| RF7 | `/notices`, `/notifications/me`, `/notifications/fcm/register`, `/notifications/admin-reports/*` | Según comunicación |
| RF8 | `/dashboard/*`, `/reports/*`, `/exports/*` | Staff y administración |

## 7. Contratos Generales De Error

| Código HTTP | Uso típico |
| --- | --- |
| 400 | Datos inválidos, regla de negocio incumplida o estado no permitido. |
| 401 | Falta de autenticación, token inválido o cuenta inactiva. |
| 403 | Rol o relación insuficiente para acceder al recurso. |
| 404 | Recurso inexistente o no localizable. |
| 429 | Límite de intentos o rate limit. |
| 500 | Error no controlado; debe investigarse en logs. |

## 8. Evidencia Para El Anexo API

En la entrega final se recomienda incluir:

- Captura de Swagger con autenticación Bearer configurada.
- Captura de dominios principales agrupados.
- Ejemplo de request de login.
- Ejemplo de request de circuito.
- Ejemplo de respuesta de dashboard.
- Ejemplo de descarga PDF/Excel con cabeceras.

Usar placeholders hasta contar con capturas verificadas:
`[Imagen: Swagger Escuela Pass con módulos principales]`.


||||||||||||||||||||||||||||||||||||||||||||

# Fuente: docs/tdg/entregables/09_Manual_de_Usuario_Escuela_Pass.md

# 09. Manual De Usuario Escuela Pass

**Proyecto:** Escuela Pass — Administración y Seguridad Escolar  
**Autor:** Jhon Kevin Murillo Martínez  
**Programa:** Ingeniería Informática — Área de Programas Informáticos y Telecomunicaciones  
**Tipo de documento:** Guía de operación por perfil  
**Versión:** 1.0 documental  


Fuentes normativas usadas para estos entregables:
- Manual de estilo APIT: Times New Roman 12 pt, márgenes de 2.54 cm, espaciado sencillo,
  títulos numerados, citación autor-fecha y referencias APA 7.
- Plantilla TDG: portada, contraportada, resumen, introducción, capítulos por objetivo,
  conclusiones, recomendaciones, referencias y anexos.
- Propuesta FTG aprobada: RF1-RF8, RNF1-RNF6, objetivos, alcance y entregables.

Nota de originalidad: la redacción fue reconstruida en estilo académico propio a partir de
la propuesta, el código fuente y la documentación técnica del repositorio. El trabajo externo
de referencia solo se usó para observar estructura documental y nivel de detalle.


## 1. Acceso Al Sistema

El usuario entra desde navegador web, inicia sesión con correo y contraseña y accede a módulos
según su rol. Si olvida la contraseña, usa recuperación por correo cuando SMTP esté configurado.

## 2. Administrador

- Gestionar escuelas y usuarios administrativos.
- Revisar configuración institucional y auditoría.
- Supervisar módulos transversales y reportes.
- Validar que las variables del despliegue estén completas.

## 3. Personal Administrativo

- Crear grupos, materias, estudiantes, docentes y padres.
- Importar datos por Excel y revisar historial de importaciones.
- Administrar conceptos, deudas y comprobantes de pago.
- Configurar calendario, visitas, reuniones y reportes.

## 4. Docente

- Consultar grupos asignados.
- Registrar asistencia.
- Crear actividades y cargar calificaciones.
- Consultar horarios y apoyar flujo del circuito de recogida cuando corresponda.
- Registrar anotaciones de atención al estudiante.

## 5. Padre O Tutor

- Consultar datos académicos de sus hijos.
- Crear y seguir solicitud de circuito de recogida.
- Subir comprobantes de pago.
- Revisar avisos y notificaciones.
- Consultar y responder invitaciones de reuniones o visitas creadas por la institución.

## 6. Alumno

- Consultar horario, actividades, calificaciones y boletines.
- Usar credencial QR si la institución habilita control de acceso para estudiantes.

## 7. Buenas Prácticas De Uso

- Cerrar sesión en equipos compartidos.
- No compartir credenciales.
- Mantener actualizado el navegador.
- Permitir notificaciones solo en dispositivos propios.
- Reportar inconsistencias de datos a la institución.

## 8. Flujo Del Padre O Tutor

1. Iniciar sesión.
2. Revisar avisos y notificaciones.
3. Consultar información académica de los hijos.
4. Crear solicitud de circuito cuando vaya a recoger al estudiante.
5. Actualizar avance o ubicación cuando corresponda.
6. Confirmar entrega solo cuando el plantel indique que el menor está en camino.
7. Consultar deudas y cargar comprobantes si existe pago pendiente.

## 9. Flujo Del Docente

1. Iniciar sesión y revisar panel inicial.
2. Consultar horario o grupos asignados.
3. Registrar asistencia general o por clase según módulo.
4. Crear actividades y cargar notas.
5. Consultar solicitudes de circuito de estudiantes bajo su responsabilidad.
6. Registrar anotaciones de atención cuando aplique.

## 10. Flujo Administrativo

1. Configurar institución, calendario y datos escolares.
2. Crear grupos, materias, estudiantes, docentes y padres.
3. Vincular estudiantes con padres y docentes con grupos.
4. Gestionar pagos, deudas y comprobantes.
5. Supervisar circuito, asistencia y reportes.
6. Exportar informes y revisar dashboards.

## 11. Mensajes Y Errores Frecuentes

| Situación | Acción recomendada |
| --- | --- |
| Credenciales inválidas | Verificar correo/contraseña o usar recuperación. |
| Cuenta inactiva | Contactar administración institucional. |
| No autorizado | Confirmar rol, escuela o relación con estudiante. |
| Circuito deshabilitado | Esperar habilitación institucional o contactar administración. |
| Comprobante rechazado | Revisar observación y cargar nuevo archivo si aún hay intentos disponibles. |
| Archivo no disponible | Confirmar permisos y existencia del documento. |

## 12. Capturas Para Manual

Insertar manualmente:

- `[Imagen: login de Escuela Pass]`
- `[Imagen: menú lateral por rol]`
- `[Imagen: circuito padre móvil]`
- `[Imagen: escáner QR/NFC]`
- `[Imagen: calificaciones docente]`
- `[Imagen: comprobantes de pago]`
- `[Imagen: dashboard administrativo]`


||||||||||||||||||||||||||||||||||||||||||||

# Fuente: docs/tdg/entregables/10_Informe_de_Pruebas_Metricas_Escuela_Pass.md

# 10. Informe De Pruebas Y Métricas Escuela Pass

**Proyecto:** Escuela Pass — Administración y Seguridad Escolar  
**Autor:** Jhon Kevin Murillo Martínez  
**Programa:** Ingeniería Informática — Área de Programas Informáticos y Telecomunicaciones  
**Tipo de documento:** Validación funcional y operativa  
**Versión:** 1.0 documental  


Fuentes normativas usadas para estos entregables:
- Manual de estilo APIT: Times New Roman 12 pt, márgenes de 2.54 cm, espaciado sencillo,
  títulos numerados, citación autor-fecha y referencias APA 7.
- Plantilla TDG: portada, contraportada, resumen, introducción, capítulos por objetivo,
  conclusiones, recomendaciones, referencias y anexos.
- Propuesta FTG aprobada: RF1-RF8, RNF1-RNF6, objetivos, alcance y entregables.

Nota de originalidad: la redacción fue reconstruida en estilo académico propio a partir de
la propuesta, el código fuente y la documentación técnica del repositorio. El trabajo externo
de referencia solo se usó para observar estructura documental y nivel de detalle.


## 1. Objetivo

Validar que Escuela Pass cumple los requerimientos funcionales, no funcionales y de seguridad
definidos en la propuesta y en la matriz de trazabilidad.

## 2. Estrategia De Pruebas

| Tipo | Evidencia | Propósito |
| --- | --- | --- |
| Build backend | npm run build / smoke:build | Compila NestJS |
| E2E backend | npm run test:e2e / smoke:e2e | Valida flujos principales con Postgres |
| CI | .github/workflows/backend-ci.yml | Build + e2e en PR/push a main |
| Frontend build | npm run build en frontend | Recomendado para release; no está en CI actual |
| Pruebas manuales | Swagger + UI | Login, acceso, circuito, pagos, asistencia, boletines |
| Métricas | Dashboard/reports/observación | Tiempo de respuesta, éxito de operación, satisfacción |

## 3. Casos Críticos

| Caso | Resultado esperado |
| --- | --- |
| Login por rol | Token válido, redirección y menú según rol. |
| Escaneo QR/NFC | Registro de acceso o rechazo con mensaje controlado. |
| Circuito padre | Solicitud creada, notificación, mapa/avance y confirmación. |
| Asistencia | Registro por docente/admin y consulta por padre. |
| Calificaciones | Actividad con notas, boletín y PDF/exportación. |
| Pago | Deuda creada, comprobante subido, verificación o rechazo. |
| Aviso | Bandeja y push FCM si el dispositivo está registrado. |

## 4. Métricas Propuestas

- Tiempo de respuesta menor a 2 segundos en operaciones comunes.
- Porcentaje de flujos críticos exitosos en prueba funcional.
- Número de incidencias por rol durante prueba piloto.
- Satisfacción percibida de usuarios piloto.
- Disponibilidad de API medida por `GET /health`.

## 5. Riesgos Detectados

- CI actual no ejecuta frontend build/lint.
- La suite unitaria es limitada; el valor principal actual está en E2E y smoke.
- Las métricas de satisfacción requieren usuarios piloto reales o encuesta institucional.

## 6. Cobertura E2E Documentada

| Suite | Cobertura principal |
| --- | --- |
| `test/app.e2e-spec.ts` | Salud, autenticación, asistencia, QR, clase, notas, circuito, reportes, exportaciones, settings, dashboard, importaciones, visitas, reuniones, lifecycle y módulos restaurados. |
| `test/phase7-closure.e2e-spec.ts` | Seguridad cruzada, circuito duplicado, circuito deshabilitado, periodo cerrado, doble escaneo, comprobantes, revocación JWT, calificaciones con force, archivos privados, privacidad y class-attendance padre. |
| `test/auth-throttle-ip.e2e-spec.ts` | Throttle estricto por IP para login fallido; se ejecuta con script dedicado y variable de límite bajo. |

## 7. Matriz Pruebas Vs Requerimientos

| Requerimiento | Evidencia de prueba |
| --- | --- |
| RF1 | Login, refresh, logout, JWT inactivo, throttle. |
| RF2 | QR/NFC, duplicados, asistencia automática. |
| RF3 | Crear solicitud, bloquear duplicado, GPS, estados, confirmación, circuito deshabilitado. |
| RF4 | Listado escolar, importaciones, lifecycle. |
| RF5 | Asistencia, asistencia por clase, actividades, notas, boletines, periodo cerrado. |
| RF6 | Comprobantes, rechazos, archivos privados. |
| RF7 | Admin reports, SLA, recordatorios, FCM opcional. |
| RF8 | Dashboard summary, actionable KPIs, reportes y exportaciones. |

## 8. Métricas A Registrar En Entrega Final

| Métrica | Fuente sugerida | Estado |
| --- | --- | --- |
| Resultado `npm run test:e2e` | Consola/CI | Adjuntar captura. |
| Tiempo total E2E | Jest | Adjuntar captura del run final. |
| Build backend | `npm run build` | Ejecutar antes de entrega. |
| Build frontend | `cd frontend && npm run build` | Ejecutar antes de entrega. |
| Disponibilidad | `GET /health` | Captura o evidencia de smoke. |
| Usabilidad | Encuesta/piloto | Pendiente si no hay usuarios reales. |

## 9. Evidencias Recomendadas

- `[Imagen: resultado final npm run test:e2e]`
- `[Imagen: build backend exitoso]`
- `[Imagen: build frontend exitoso]`
- `[Imagen: Swagger health y auth]`
- `[Imagen: prueba de circuito padre]`
- `[Imagen: comprobante privado autorizado/no autorizado]`

## 10. Comandos Y Artefactos De Prueba En El Repositorio

| Comando / artefacto | Ubicación o uso |
| --- | --- |
| `npm run test:e2e` | Ejecuta `test/app.e2e-spec.ts`, `test/phase7-closure.e2e-spec.ts` (vía Jest e2e). Pre-script: `node ./test/setup-e2e-db.js`. |
| `npm run test:e2e:auth-throttle-ip` | Ejecuta throttle IP documentado en `test/auth-throttle-ip.e2e-spec.ts` mediante `test/run-auth-throttle-e2e.cjs`. |
| `npm run smoke:ci-local` | Secuencia local: build backend + E2E (útil antes de entrega). |
| `.github/workflows/backend-ci.yml` | Pipeline que valida build y pruebas E2E contra PostgreSQL en contenedor. |

PDF de prueba E2E: la suite `phase7-closure` puede generar PDF mínimos válidos con `pdfkit` bajo `uploads/`; la variable `E2E_KEEP_UPLOAD_FIXTURES=1` conserva artefactos para inspección.


||||||||||||||||||||||||||||||||||||||||||||

# Fuente: docs/tdg/entregables/99_Nota_Verificacion_Entregables_TDG.md

# 99. Nota De Verificación Entregables TDG Escuela Pass

**Proyecto:** Escuela Pass — Administración y Seguridad Escolar  
**Autor:** Jhon Kevin Murillo Martínez  
**Programa:** Ingeniería Informática — Área de Programas Informáticos y Telecomunicaciones  
**Tipo de documento:** Verificación de entrega documental  
**Versión:** 1.0 documental  


Fuentes normativas usadas para estos entregables:
- Manual de estilo APIT: Times New Roman 12 pt, márgenes de 2.54 cm, espaciado sencillo,
  títulos numerados, citación autor-fecha y referencias APA 7.
- Plantilla TDG: portada, contraportada, resumen, introducción, capítulos por objetivo,
  conclusiones, recomendaciones, referencias y anexos.
- Propuesta FTG aprobada: RF1-RF8, RNF1-RNF6, objetivos, alcance y entregables.

Nota de originalidad: la redacción fue reconstruida en estilo académico propio a partir de
la propuesta, el código fuente y la documentación técnica del repositorio. El trabajo externo
de referencia solo se usó para observar estructura documental y nivel de detalle.


## 1. Fuentes Consultadas

- Propuesta FTG de Escuela Pass.
- Manual de estilo APIT y plantilla TDG.
- Trabajo de grado externo de referencia, usado solo como guía estructural.
- Repositorio: backend, frontend, entidades, migraciones, scripts, docs, Railway, Vercel y CI.

## 2. Evidencias Del Repositorio

- Backend NestJS en `src/` con módulos por dominio.
- Frontend React/Vite en `frontend/src`.
- Base de datos por entidades TypeORM, migraciones y SQL de referencia.
- Despliegue Railway (`railway.toml`) y hosting estático frontend (`frontend/vercel.json`).
- CI backend en `.github/workflows/backend-ci.yml`.

## 3. Figuras

Los documentos incluyen placeholders centrados para figuras que deben exportarse desde Lucidchart,
Figma o capturas reales. No se inventaron capturas visuales no verificadas.

## 4. Riesgos De Similitud

- Evitar copiar texto literal de la propuesta y fuentes externas.
- Mantener citas autor-fecha y referencias APA.
- Usar el trabajo externo solo como referencia de organización, no como fuente de redacción.

## 5. Pendientes Recomendados Antes De Entrega

- Exportar diagramas finales desde Lucidchart o Mermaid a imagen.
- Generar o validar prototipos visuales en Figma si la institución lo exige.
- Confirmar fechas reales de actas si se desea reemplazar las actas reconstruidas.
- Ejecutar build frontend y smoke backend antes de adjuntar evidencias finales.

## 6. Checklist De Calidad Por Entregable

| Documento | Estado esperado antes de anexar |
| --- | --- |
| 00 Matriz de trazabilidad | RF/RNF cruzados con código, rutas, pantallas y pruebas. |
| 01 Requerimientos | Actores, reglas, RF/RNF, criterios y fuera de alcance sin ambigüedad. |
| 02 Actas | Aclaración de reconstrucción documental o reemplazo por actas reales. |
| 03 Arquitectura | Vistas lógica/despliegue, seguridad, persistencia, integraciones y decisiones. |
| 04 Modelo ER | Entidades agrupadas, relaciones clave y diagrama exportado. |
| 05 UML | Casos de uso, secuencia del circuito y componentes. |
| 06 UI/UX | Inventario de pantallas y capturas/prototipos verificables. |
| 07 Manual técnico | Instalación, configuración, despliegue, mantenimiento y seguridad. |
| 08 API | Endpoints agrupados, roles, errores y Swagger como evidencia. |
| 09 Manual usuario | Guía por rol, flujos y capturas. |
| 10 Pruebas | E2E, smoke, métricas y evidencias de validación. |

## 7. Checklist APA 7

- Portada y contraportada según plantilla.
- Tablas y figuras numeradas.
- Notas de figuras y tablas cuando aplique.
- Citas autor-fecha para fuentes externas.
- Referencias alfabéticas con sangría colgante en Word.
- Términos en inglés explicados en primera aparición.
- Sin copia literal de propuesta ni TDG externo.

## 8. Riesgos Pendientes

| Riesgo | Acción |
| --- | --- |
| Falta de capturas reales | Insertar capturas verificadas antes de exportar a PDF/Word. |
| Falta de encuesta de usabilidad | Marcar como recomendación o ejecutar piloto breve. |
| Límite de 50 páginas | Mantener detalle técnico en anexos. |
| Licencia no definida | Dejar sección `[Licencia pendiente por definir]`. |


||||||||||||||||||||||||||||||||||||||||||||

# Fuente: docs/tdg/MEJORAS_SUGERIDAS_DOCX_Escuela_Pass.md

# Mejoras sugeridas para los documentos Word (`docs/tdg/word/` y `anexos/`)

Documento de trabajo posterior a la regeneración de los `.docx` del TDG e incrustación de diagramas PNG. Sirve como checklist para revisión humana, jurados y ajuste fino a la plantilla institucional.

## TDG principal (`TDG_Escuela_Pass_Documento_Principal.docx`)

1. **Plantilla APA / APIT:** Abrir el `.docx` junto a `TDG_Plantilla y Normas.docx` y copiar manualmente encabezado, pie, numeración de páginas y estilos de cita si el generador no los igualó al 100 %.
2. **Límite de 50 páginas:** Contar páginas desde portada hasta referencias; si se excede, mover tablas extensas o detalle técnico a anexos ya listados.
3. **Figura E2E:** Sustituir el párrafo placeholder de pruebas por una captura real de `npm run test:e2e` o del job de GitHub Actions.
4. **Referencias APA 7:** Completar referencias para toda tecnología citada de forma sustantiva (p. ej. Mapbox, TypeORM, Firebase, Jest, NestJS escasamente usado en texto narrativo).
5. **Capítulo de resultados:** Añadir 1–2 párrafos cuantitativos (tiempo de suite E2E, número de módulos, líneas no obligatorio) solo si aportan sin inventar datos.
6. **Trazabilidad explícita:** Una tabla corta “Objetivo específico → conclusión” puede ayudar al asesor antes de entrega (sin sustituir párrafos de conclusiones).

## Anexos (carpeta `anexos/`)

| Anexo | Mejora prioritaria |
| --- | --- |
| Matriz de trazabilidad | Añadir columnas con rutas HTTP o nombres de archivo de prueba por cada RF. |
| Requerimientos | Criterios de aceptación medibles (# estado HTTP, regla de negocio citada del servicio). |
| Actas | Si hay actas reales, sustituir actas reconstruidas; si no, mantener nota de transparencia. |
| Arquitectura | Figura de despliegue manual (captura Railway + Vercel) además del Mermaid. |
| ER / UML | Revisar legibilidad en Word; si el PNG es denso, dividir en dos figuras en Lucidchart. |
| UI/UX | Insertar capturas de pantalla por ruta (`/app/...`) listadas en el anexo. |
| Manual técnico | Copiar tablas extensas desde `docs/technical-setup.md` solo donde falte detalle. |
| API | Captura de Swagger con módulos expandidos; listado de errores comunes del backend. |
| Manual de usuario | Mensajes de error reales del frontend (texto exacto) y capturas por rol. |
| Pruebas | Capturas de CI, tiempo de ejecución, y nota sobre `auth-throttle-ip` opcional. |
| Nota verificación | Usar como checklist de entrega final y firmar/fechar si la institución lo pide. |

## Calidad general

- **Turnitin / originalidad:** Releer introducción y conclusiones; citar normativa y fuentes técnicas; evitar copiar párrafos de guías sin comillas y referencia.
- **Cohéencia código–documento:** Tras cada release, revalidar nombres de módulos (`app.module.ts`) y prefijos de API.
- **Diagramas:** Regenerar PNG tras cambiar Mermaid con `npx @mermaid-js/mermaid-cli` sobre los archivos en `docs/imagenes/`; actualizar manualmente los `.docx` en `docs/tdg/word/` o restaurar desde git el generador del TDG si aplica.
- **Consolidado Markdown:** `docs/DOCUMENTACION_ESCUELA_PASS_CONSOLIDADO.md` crece rápido; para entregas Git considerar regenerarlo solo antes de revisiones o ignorarlo si el diff molesta.

## Base de datos Railway

Sin auditoría directa del esquema productivo: el ER debe alinearse con migraciones y entidades versionadas; si el jurado exige evidencia de prod, adjuntar volcado de esquema (`\d` o migraciones aplicadas) como anexo separado bajo confidencialidad.


||||||||||||||||||||||||||||||||||||||||||||

# Fuente: docs/tdg/TDG_Escuela_Pass_Documento_Principal.md

# Desarrollo De Aplicación Web De AlfaNetworks Con NestJS, PostgreSQL, Tecnologías NFC Y QR Para La Administración Y Seguridad Escolar: Escuela Pass

**Autor:** Jhon Kevin Murillo Martínez  
**Programa:** Ingeniería Informática  
**Facultad:** Ingenierías  
**Institución:** Politécnico Colombiano Jaime Isaza Cadavid  
**Asesor:** Alirio Antonio Gutiérrez Quintero  
**Tipo:** Documento principal del Trabajo de Grado  
**Nota:** Documento preparado para maquetación y revisión final sobre la plantilla institucional, con límite máximo de 50 páginas.

## Resumen

Escuela Pass es una aplicación web orientada a la administración y seguridad escolar en instituciones
educativas privadas. El proyecto responde a necesidades asociadas con control de accesos, gestión de
recogida de estudiantes, comunicación con familias, asistencia, calificaciones, pagos, reportes y
protección de datos personales. La solución se implementó con un backend NestJS, base de datos
PostgreSQL y frontend React/Vite, integrando tecnologías QR (Quick Response o respuesta rápida), NFC
(Near Field Communication o comunicación de campo cercano), JWT (JSON Web Token o token web JSON),
mapas, notificaciones y archivos privados.

El desarrollo conserva el alcance aprobado en la propuesta y lo amplía con controles de privacidad,
auditoría, multiinstitución, boletines académicos, pruebas E2E y mecanismos de seguridad para archivos
sensibles. La validación se apoya en pruebas funcionales automatizadas, revisión técnica de módulos y
matrices de trazabilidad. Como resultado, se obtuvo una plataforma web modular, responsive y preparada
para anexar documentación técnica, manuales y evidencias de funcionamiento.

**Palabras clave:** gestión escolar, seguridad escolar, aplicación web, NestJS, PostgreSQL, QR, NFC,
protección de datos.

## Abstract

Escuela Pass is a web application focused on school administration and safety in private educational
institutions. The project addresses needs related to access control, student pickup management,
family-school communication, attendance, grades, payments, reporting, and personal data protection.
The solution was implemented with a NestJS backend, PostgreSQL database, and React/Vite frontend,
integrating QR (Quick Response), NFC (Near Field Communication), JWT (JSON Web Token), maps,
notifications, and private file access.

The implementation preserves the approved proposal scope and extends it with privacy controls, audit
logging, multi-institution support, academic report cards, end-to-end tests, and security mechanisms
for sensitive documents. Validation is supported by automated functional tests, technical review of
modules, and traceability matrices. As a result, the project produced a modular and responsive web
platform supported by technical documentation, user manuals, API documentation, and testing evidence.

**Keywords:** school management, school safety, web application, NestJS, PostgreSQL, QR, NFC, data
protection.

## Introducción

Las instituciones educativas requieren herramientas que integren administración, seguridad y
comunicación en una sola plataforma. En muchos contextos, los procesos escolares se apoyan en registros
manuales, sistemas fragmentados o canales informales, lo que dificulta el control de accesos, la
comunicación con familias y el seguimiento académico. Esta situación resulta especialmente sensible
cuando se administran datos de menores de edad, información de ubicación, registros de asistencia,
calificaciones y comprobantes de pago.

Escuela Pass surge como una solución web para AlfaNetworks con el propósito de centralizar procesos
operativos y fortalecer la seguridad escolar. El sistema permite administrar usuarios y roles,
registrar accesos mediante QR/NFC, gestionar el circuito de recogida operado por padres o tutores,
registrar asistencia y calificaciones, emitir boletines, administrar pagos y presentar reportes
institucionales.

El documento se organiza en capítulos alineados con los objetivos específicos: presentación del
problema, diseño metodológico, marco referencial, análisis y diseño, construcción del sistema,
validación y cierre. Los detalles extensos, como requerimientos, diagramas, manuales, documentación API
y pruebas, se incluyen como anexos para respetar el límite máximo de 50 páginas del cuerpo principal.

# 1. PRESENTACIÓN DEL TRABAJO

## 1.1 Planteamiento Del Problema

La gestión escolar tradicional basada en procesos manuales y sistemas no integrados limita la capacidad
de las instituciones para responder a necesidades de seguridad, eficiencia y trazabilidad. El control
de entradas y salidas, la entrega de estudiantes, la comunicación con padres, la administración de
pagos y el seguimiento académico suelen depender de documentos físicos, hojas de cálculo o canales
separados. Esto produce duplicidad de información, retrasos y mayor exposición de datos sensibles.

En el contexto de Escuela Pass, el problema central se expresa como la insuficiencia de procesos
manuales y herramientas fragmentadas para administrar de forma segura y eficiente la operación escolar,
especialmente en escenarios que involucran menores de edad, control de accesos, recogida de estudiantes
y protección de información personal.

### 1.1.1 Causas Y Consecuencias

| Causa | Consecuencia directa |
| --- | --- |
| Uso de sistemas separados para administración, comunicación y seguridad. | Duplicidad de información, pérdida de trazabilidad y mayor esfuerzo operativo. |
| Registro manual de asistencia, accesos y pagos. | Mayor probabilidad de errores, demoras y dificultad para generar reportes confiables. |
| Falta de integración de QR, NFC y geolocalización. | Control de acceso y recogida menos eficiente, con menor visibilidad para familias e institución. |
| Circuito de recogida no digitalizado. | Congestión, incertidumbre de padres y tiempos de espera prolongados. |
| Ausencia de controles técnicos sobre archivos y datos sensibles. | Riesgo de acceso indebido a comprobantes, reportes, información académica o datos de menores. |
| Comunicación institucional dispersa. | Retrasos en avisos, notificaciones y seguimiento de solicitudes. |

## 1.2 Justificación

El desarrollo de Escuela Pass se justifica por su aporte tecnológico, social, académico y operativo.
Desde el punto de vista tecnológico, la plataforma aplica una arquitectura web moderna basada en
NestJS, PostgreSQL y React, con separación cliente-servidor, roles, validación de datos y servicios
complementarios. Desde el punto de vista social, fortalece la seguridad de estudiantes y la tranquilidad
de las familias al integrar control de accesos, circuito de recogida y notificaciones. Desde el punto
de vista académico, permite aplicar competencias de ingeniería informática en un proyecto real con
requerimientos funcionales, no funcionales, pruebas y documentación.

El proyecto también aporta a la protección de datos personales al incorporar autenticación, autorización
por rol, privacidad, auditoría y control de archivos sensibles. Estas decisiones son relevantes porque
el sistema trata información de menores, familias, docentes y personal administrativo.

## 1.3 Objetivos

### 1.3.1 Objetivo General

Desarrollar una aplicación web integral para AlfaNetworks orientada a la administración y seguridad
escolar en instituciones educativas privadas, mediante NestJS, PostgreSQL, tecnologías QR/NFC y una
interfaz web responsive, con el fin de optimizar procesos operativos, fortalecer la seguridad
estudiantil y proteger datos personales.

### 1.3.2 Objetivos Específicos

1. Analizar los requerimientos funcionales y no funcionales del sistema con base en la propuesta
   aceptada, las necesidades de AlfaNetworks y la evidencia técnica del repositorio.
2. Diseñar la arquitectura del sistema, el modelo de base de datos relacional y las interfaces de
   usuario aplicando principios de modularidad, seguridad y diseño responsive.
3. Implementar el backend con NestJS y PostgreSQL para autenticación, accesos QR/NFC, gestión escolar,
   circuito de recogida, pagos, reportes y módulos complementarios.
4. Desarrollar el frontend web con React/Vite para los perfiles administrador, administrativo, docente,
   padre/tutor y alumno.
5. Validar el funcionamiento mediante pruebas funcionales, E2E, smoke tests, revisión de seguridad y
   documentación de métricas.

## 1.4 Alcance

El alcance incluye una aplicación web responsive con autenticación por roles, control de acceso QR/NFC,
circuito de recogida operado por padres o tutores, gestión escolar, asistencia, calificaciones,
boletines, pagos con comprobante manual, avisos, notificaciones, dashboards, reportes, privacidad y
auditoría. No incluye aplicaciones móviles nativas, pasarela automática de pagos, reconocimiento facial,
soporte multiidioma ni analítica avanzada con inteligencia artificial.

# 2. DISEÑO METODOLÓGICO

El proyecto se desarrolló bajo un enfoque aplicado, con fases asociadas a los objetivos específicos.
Se adoptó una organización incremental, donde el análisis alimentó el diseño, el diseño guio la
implementación y las pruebas permitieron ajustar reglas de negocio, seguridad y documentación.
La metodología combinó revisión documental, análisis del repositorio, levantamiento de requerimientos
desde la propuesta aceptada, construcción incremental de módulos, pruebas funcionales automatizadas y
elaboración de anexos técnicos. Este enfoque permitió mantener trazabilidad entre lo propuesto, lo
implementado y lo documentado.

| Fase | Objetivo asociado | Actividades principales | Resultado |
| --- | --- | --- | --- |
| Análisis | Objetivo 1 | Revisión de propuesta, actores, RF/RNF y alcance. | Documento de requerimientos y matriz de trazabilidad. |
| Diseño | Objetivo 2 | Arquitectura, base de datos, rutas y prototipos. | Documentos de arquitectura, ER, UML y UI/UX. |
| Backend | Objetivo 3 | Módulos NestJS, entidades, servicios, controladores y pruebas. | API funcional y documentada. |
| Frontend | Objetivo 4 | Rutas, páginas por rol, componentes y flujos. | SPA responsive integrada con API. |
| Validación | Objetivo 5 | E2E, smoke, revisión de seguridad y documentación. | Informe de pruebas y métricas. |

![Figura. Cronograma tipo Gantt reconstruido para el TDG (exportado desde Mermaid)](docs/imagenes/06-cronograma-gantt.png)

Tabla 2  
*Cronograma general del proyecto*

| Fase | Semana 1 | Semana 2 | Semana 3 | Semana 4 | Semana 5 | Semana 6 | Semana 7 | Semana 8 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Análisis | X | X |  |  |  |  |  |  |
| Diseño |  | X | X |  |  |  |  |  |
| Backend |  |  | X | X | X |  |  |  |
| Frontend |  |  |  | X | X | X |  |  |
| Pruebas |  |  |  |  | X | X | X |  |
| Documentación |  |  |  |  |  | X | X | X |

Nota. Cronograma reconstruido para el documento académico a partir de las fases de desarrollo y
validación del proyecto.

# 3. MARCO REFERENCIAL

## 3.1 Marco Conceptual

Una aplicación web es un sistema accesible desde navegador que permite centralizar lógica de negocio,
interacción de usuario y comunicación con servicios backend. En Escuela Pass, esta aproximación evita
instalar aplicaciones nativas y permite acceso desde dispositivos móviles o de escritorio.

NestJS es un framework backend para Node.js basado en TypeScript y arquitectura modular, orientado a
construir aplicaciones del lado servidor mantenibles y escalables (NestJS, s. f.). PostgreSQL es un
sistema de gestión de bases de datos relacional que permite integridad referencial, transacciones y
consultas estructuradas (PostgreSQL Global Development Group, s. f.). React permite construir interfaces
dinámicas mediante componentes reutilizables (Meta Open Source, s. f.), mientras Vite optimiza el
desarrollo y compilación frontend (Vite, s. f.). Estas herramientas se articulan para construir una
solución escalable, mantenible y documentable.

QR y NFC se utilizan para identificar usuarios o credenciales de acceso. GPS se emplea como apoyo al
circuito de recogida, entendiendo que la aplicación web móvil es usada por el padre o tutor que recoge
al estudiante. JWT permite proteger rutas mediante tokens estandarizados (Jones et al., 2015), y los
roles restringen operaciones según responsabilidad institucional.

## 3.2 Marco Legal

El sistema maneja datos personales de estudiantes, padres, docentes y personal institucional, por lo
que el TDG considera principios de finalidad, consentimiento, confidencialidad, seguridad y acceso
restringido. Dado que la propuesta aceptada ubica la solución inicialmente en instituciones privadas
de México, el marco legal de protección de datos debe contemplar la Ley Federal de Protección de Datos
Personales en Posesión de los Particulares (LFPDPPP) y su Reglamento, los cuales establecen obligaciones
para responsables privados en el tratamiento de datos personales (Cámara de Diputados del H. Congreso de
la Unión, 2010, 2011). Además, por tratarse de información relacionada con menores de edad, debe
considerarse la Ley General de los Derechos de Niñas, Niños y Adolescentes, especialmente en lo relativo
al interés superior de la niñez y la protección de su intimidad (Cámara de Diputados del H. Congreso de
la Unión, 2014).

En términos técnicos, estas exigencias se reflejan en autenticación, autorización por rol, aceptación de
políticas de privacidad, auditoría, control de archivos privados y minimización de exposición de datos.
Para una entrega institucional definitiva, esta sección debe ser revisada por el asesor o por una
persona competente en derecho aplicable, especialmente si el despliegue operativo se extiende a
Colombia u otros países.

## 3.3 Antecedentes

Los antecedentes del proyecto se ubican en tres líneas: transformación digital educativa, sistemas de
gestión escolar y seguridad/privacidad en aplicaciones web. La transformación digital en educación exige
que las soluciones no se limiten a reemplazar formularios físicos, sino que integren procesos, datos y
comunicación para apoyar decisiones institucionales. En esa línea, la UNESCO ha señalado la necesidad
de que la tecnología educativa se implemente con sentido pedagógico, protección de derechos y atención
a brechas digitales (UNESCO, 2023).

En gestión escolar, las plataformas integrales permiten reunir asistencia, comunicación, reportes y
administración en un solo entorno. La propuesta aceptada identifica este valor al comparar necesidades
de instituciones educativas con herramientas existentes de comunicación y control escolar. Escuela Pass
recoge esa orientación, pero la aterriza en una arquitectura propia que combina módulos académicos,
seguridad física y operación administrativa.

En seguridad de aplicaciones web, OWASP (2021) resalta riesgos como control de acceso roto,
fallos criptográficos, inyección y errores de configuración. Estos antecedentes técnicos justifican
decisiones como validación global de DTO, uso de JWT, roles, aislamiento por escuela, archivos privados
y auditoría. En consecuencia, la implementación no se limita a cumplir funciones visibles, sino que
incorpora controles necesarios para proteger información sensible.

## 3.4 Limitaciones

El proyecto se mantiene como una aplicación web responsive, sin aplicaciones móviles nativas. Tampoco
incluye pasarela automática de pagos, reconocimiento facial, soporte multiidioma ni analítica avanzada
con inteligencia artificial. La medición de usabilidad con usuarios piloto y los tiempos de respuesta
en ambiente productivo deben completarse como validación adicional si la institución lo requiere.

## 3.5 Alcance Del Marco Referencial

El marco referencial se enfoca en los conceptos y normas que explican la solución implementada:
aplicaciones web, arquitectura modular, bases de datos relacionales, autenticación, autorización,
QR/NFC, geolocalización, protección de datos y seguridad de aplicaciones. El detalle de módulos,
endpoints y manuales se ubica en anexos para no sobrecargar el documento principal.

# 4. ANÁLISIS Y DISEÑO DEL SISTEMA

El análisis identificó cinco actores principales: administrador de plataforma, personal administrativo,
docente, padre/tutor y alumno. Cada actor posee permisos diferenciados y acceso a módulos específicos.
El diseño técnico separa responsabilidades entre frontend, API, base de datos e integraciones externas.

La arquitectura sigue una estructura modular en NestJS. Cada dominio agrupa controladores, servicios,
DTOs, entidades y reglas de autorización. El frontend organiza rutas protegidas bajo `/app`, con menú
por rol, componentes reutilizables, manejo de notificaciones, mapas, formularios y pantallas
responsive.

![Figura. Arquitectura lógica cliente-servicio e integraciones](docs/imagenes/02-arquitectura-despliegue-td.png)

El modelo de datos se organiza alrededor de escuelas, usuarios, grupos, estudiantes, padres, docentes,
asistencias, actividades, pagos, circuito, notificaciones, privacidad y auditoría. Esta organización
permite sostener el alcance multiinstitución y controlar acceso por relaciones institucionales.

# 5. CONSTRUCCIÓN DEL SISTEMA

## 5.1 Backend

El backend implementa módulos de autenticación, accesos, circuito, gestión escolar, asistencia,
actividades, boletines, pagos, reportes, archivos, privacidad y auditoría. La API utiliza DTOs y
validación global para controlar datos de entrada. Los servicios aplican reglas de negocio y TypeORM
gestiona la persistencia en PostgreSQL.

En autenticación se implementan login, refresh, logout, recuperación de contraseña y consulta de
perfil. El control por roles se complementa con validaciones de escuela, relación padre-estudiante,
asignación docente y estado de ciclo de vida. Esto permite que los permisos no dependan solo del rol,
sino también del contexto institucional.

## 5.2 Frontend

El frontend se construyó como SPA con React/Vite. La navegación se adapta a roles y las rutas críticas
están protegidas. Las pantallas principales cubren login, perfil, dashboard, escáner QR/NFC, circuito,
gestión escolar, finanzas, calificaciones, boletines, horarios, visitas, reuniones y administración.

La interfaz prioriza uso móvil para padres o tutores, especialmente en el circuito de recogida, y uso
de escritorio para administración y docentes. Se incorporan componentes de carga, error boundary,
confirmaciones, modales, selectores y soporte visual para modo oscuro.

## 5.3 Circuito De Recogida

El circuito permite que un padre o tutor autorizado cree una solicitud de recogida para un estudiante.
El sistema valida relación familiar, estado del estudiante, asistencia del día y configuración
institucional. El personal escolar visualiza solicitudes y actualiza estados operativos. La ubicación
GPS se usa como apoyo informativo y también puede activar la transición a `NOTIFICADO_LLEGADA` cuando
el padre entra al radio configurado; aun así, las autorizaciones institucionales, la salida del menor
y la confirmación de entrega se conservan como acciones explícitas y trazables.

## 5.4 Pagos Y Archivos Sensibles

El sistema administra conceptos, deudas y comprobantes. Los padres cargan comprobantes manualmente y
el personal administrativo verifica o rechaza. Los archivos sensibles se sirven por endpoints
autenticados, con validación de permisos, relación padre-estudiante o escuela, evitando exposición
pública indiscriminada.

# 6. VALIDACIÓN Y RESULTADOS

La validación se apoya en pruebas E2E que cubren flujos críticos: autenticación, asistencia, acceso
QR/NFC, circuito, pagos, reportes, exportaciones, privacidad, archivos privados y lifecycle. La suite
`test/app.e2e-spec.ts` cubre operación general, mientras `test/phase7-closure.e2e-spec.ts` valida
escenarios cruzados de seguridad y cierre. El test de throttle IP se ejecuta de forma separada por
requerir configuración estricta.

Los resultados muestran que el proyecto cumple los requerimientos principales y amplía el alcance con
funcionalidades que fortalecen seguridad, trazabilidad y operación institucional. Las métricas de
usabilidad y satisfacción deben levantarse con usuarios piloto si la institución lo requiere.

[Imagen: Resultado final de pruebas E2E — insertar captura de consola de npm run test:e2e o reporte CI]

# 7. CONCLUSIONES

El desarrollo de Escuela Pass permitió consolidar una solución web modular para procesos escolares que
tradicionalmente se gestionan de forma fragmentada. El análisis de requerimientos permitió ordenar el
alcance aprobado y precisar aspectos relevantes, como la interpretación del circuito de recogida como
un flujo operado por padres o tutores desde su propio dispositivo móvil.

El diseño de arquitectura y base de datos permitió estructurar el sistema por dominios, separar
responsabilidades y sostener reglas de seguridad multiinstitución. La decisión de usar NestJS,
PostgreSQL y React/Vite facilitó una implementación mantenible y alineada con prácticas modernas de
desarrollo web.

La implementación del backend y frontend logró cubrir los módulos centrales de autenticación, accesos,
circuito, gestión escolar, académico, pagos, comunicación y reportes. Además, se incorporaron mejoras
no previstas inicialmente, como privacidad, auditoría, archivos privados, lifecycle y pruebas E2E,
que fortalecen la calidad del producto sin alterar el propósito original de la propuesta.

La validación mediante pruebas automatizadas y documentación de anexos permite defender el cumplimiento
del proyecto con evidencia trazable. No obstante, se recomienda complementar el cierre con pruebas de
usabilidad o satisfacción en usuarios piloto para respaldar con datos la experiencia de uso.

# 8. RECOMENDACIONES Y TRABAJOS FUTUROS

Se recomienda ejecutar una prueba piloto institucional con usuarios reales, medir tiempos de respuesta
en ambiente productivo, levantar encuesta de satisfacción, fortalecer CI con build/lint frontend y
definir formalmente la licencia del proyecto.

Como trabajos futuros se propone evaluar una aplicación móvil nativa si la operación institucional lo
exige, integrar pasarelas de pago, ampliar analítica operativa, fortalecer observabilidad y formalizar
políticas de retención de datos según asesoría legal.

# 9. LICENCIA

## 9.1 Estado

[Licencia pendiente por definir]

## 9.2 Nota Para Revisión

La licencia debe definirse considerando los derechos de la universidad, AlfaNetworks y el interés del
autor en conservar capacidad de modificación y comercialización. Esta sección debe revisarse con
asesoría jurídica antes de entrega final.

# Referencias

Cámara de Diputados del H. Congreso de la Unión. (2010). *Ley Federal de Protección de Datos Personales en Posesión de los Particulares*. https://www.diputados.gob.mx/

Cámara de Diputados del H. Congreso de la Unión. (2011). *Reglamento de la Ley Federal de Protección de Datos Personales en Posesión de los Particulares*. https://www.diputados.gob.mx/

Cámara de Diputados del H. Congreso de la Unión. (2014). *Ley General de los Derechos de Niñas, Niños y Adolescentes*. https://www.diputados.gob.mx/

Jones, M., Bradley, J., & Sakimura, N. (2015). *JSON Web Token (JWT)* (RFC 7519). Internet Engineering Task Force. https://www.rfc-editor.org/rfc/rfc7519

Meta Open Source. (s. f.). *React*. https://react.dev/

NestJS. (s. f.). *Documentation*. https://docs.nestjs.com/

OWASP Foundation. (2021). *OWASP Top 10: The ten most critical web application security risks*. https://owasp.org/www-project-top-ten/

PostgreSQL Global Development Group. (s. f.). *PostgreSQL documentation*. https://www.postgresql.org/docs/

UNESCO. (2023). *Global education monitoring report 2023: Technology in education*. https://www.unesco.org/gem-report/

Vite. (s. f.). *Vite documentation*. https://vite.dev/

# Anexos

- Anexo 1. Matriz de trazabilidad.
- Anexo 2. Documento de requerimientos.
- Anexo 3. Actas de reuniones.
- Anexo 4. Documento de arquitectura.
- Anexo 5. Modelo entidad-relación.
- Anexo 6. Diagramas UML.
- Anexo 7. Prototipos UI/UX.
- Anexo 8. Manual técnico.
- Anexo 9. Documentación API.
- Anexo 10. Manual de usuario.
- Anexo 11. Informe de pruebas y métricas.
- Anexo 12. Nota de verificación documental.


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

