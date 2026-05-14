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
