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
