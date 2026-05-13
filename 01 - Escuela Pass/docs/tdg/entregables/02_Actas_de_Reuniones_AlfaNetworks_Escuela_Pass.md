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
