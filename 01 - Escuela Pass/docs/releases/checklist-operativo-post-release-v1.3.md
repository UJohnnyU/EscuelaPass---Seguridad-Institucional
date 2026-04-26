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
