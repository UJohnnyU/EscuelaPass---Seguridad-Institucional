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
| `docs/tdg/entregables/*.md` | Ampliados con trazabilidad, criterios, placeholders y evidencias. |

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
