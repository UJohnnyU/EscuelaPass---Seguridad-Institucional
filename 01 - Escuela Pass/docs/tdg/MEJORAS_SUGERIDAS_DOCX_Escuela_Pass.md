# Mejoras sugeridas para los documentos Word (`docs/tdg/word/` y `anexos/`)

Documento de trabajo posterior a la regeneración con `generate_word_docs.py` e incrustación de diagramas PNG. Sirve como checklist para revisión humana, jurados y ajuste fino a la plantilla institucional.

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
- **Diagramas:** Regenerar PNG tras cambiar Mermaid: `python docs/tdg/export_mermaid_png.py`, luego `python docs/tdg/generate_word_docs.py`.
- **Consolidado Markdown:** `docs/DOCUMENTACION_ESCUELA_PASS_CONSOLIDADO.md` crece rápido; para entregas Git considerar regenerarlo solo antes de revisiones o ignorarlo si el diff molesta.

## Base de datos Railway

Sin auditoría directa del esquema productivo: el ER debe alinearse con migraciones y entidades versionadas; si el jurado exige evidencia de prod, adjuntar volcado de esquema (`\d` o migraciones aplicadas) como anexo separado bajo confidencialidad.
