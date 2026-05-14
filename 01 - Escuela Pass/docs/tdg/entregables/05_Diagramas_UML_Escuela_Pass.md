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

![Figura. Casos de uso generales por actor (exportado desde Mermaid)](docs/diagramas-mermaid-png/png/04-uml-casos-de-uso.png)

## 7. Secuencia Principal Del Circuito

![Figura. Secuencia del circuito de recogida (exportado desde Mermaid)](docs/diagramas-mermaid-png/png/05-uml-secuencia-circuito.png)

## 8. Prompt Para Lucidchart

Crear tres diagramas UML para Escuela Pass:
1. Diagrama de casos de uso por actores: administrador, administrativo, docente, padre/tutor y alumno.
2. Diagrama de secuencia del circuito de recogida, desde solicitud del padre hasta confirmación de entrega.
3. Diagrama de componentes con frontend React/Vite, API NestJS, PostgreSQL, uploads privados, FCM, SMTP y Mapbox.
Usar nombres de módulos reales del proyecto, no nombres genéricos. Mantener los diagramas legibles,
centrados y con notas breves bajo cada figura para anexos del TDG.
