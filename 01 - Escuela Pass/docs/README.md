# Documentación

## TDG y anexos (un solo Markdown)

- **[DOCUMENTACION_ESCUELA_PASS_CONSOLIDADO.md](./DOCUMENTACION_ESCUELA_PASS_CONSOLIDADO.md)** — texto íntegro del trabajo de grado y entregables que antes estaban en `docs/tdg/`.
- **Word:** **`docs/tdg/word/`** (documento principal + carpeta **`anexos/`**). Para regenerar la ampliación automática (tabla de rutas API, ER, UI, E2E, Railway) y fusionarla en `DOCUMENTACION_ESCUELA_PASS_CONSOLIDADO.md`, desde la raíz del backend: `npm run tdg:enrich` (requiere Python con `python-docx` y proyecto Railway enlazado si se quieren tablas de producción). Cada ejecución **añade** una sección al final de cada `.docx`; si hace falta estado previo, restaurar con git antes de volver a ejecutar.
- **Diagramas:** **`docs/imagenes/`** — cada figura tiene la fuente `.mmd` y el `.png` exportado en la misma carpeta. Para regenerar un PNG: desde la raíz del repo, con Node.js, ejecutar por ejemplo  
  `npx -y @mermaid-js/mermaid-cli@10 -i docs/imagenes/01-arquitectura-contexto-lr.mmd -o docs/imagenes/01-arquitectura-contexto-lr.png` (cambiar el nombre base según corresponda).

## Operación del proyecto

- **[technical-setup.md](./technical-setup.md)** — variables, API, flujos y opciones para PostgreSQL.
- **[CODESTYLE-COMMENTS.md](./CODESTYLE-COMMENTS.md)** — comentarios en código (backend y frontend).
- **`releases/`** — runbooks, checklists y actas de release.

## Documentación operativa consolidada (opcional)

El archivo **[DOCUMENTACION_OPERATIVA_ESCUELA_PASS_CONSOLIDADO.md](./DOCUMENTACION_OPERATIVA_ESCUELA_PASS_CONSOLIDADO.md)** reúne en un solo Markdown la documentación operativa dispersa (`technical-setup`, `releases`, este README, etc.). No sustituye al consolidado del TDG. Si lo actualiza, puede reconstruirlo a mano o dejar la copia que ya está en el repositorio.

**Nota:** Los archivos `DOCUMENTACION_*CONSOLIDADO*.md` son instantáneas: conservan marcas `# Fuente: docs/tdg/...` y texto de pipeline histórico (scripts `.py` retirados en la entrega final). Las rutas de figuras actualizadas en texto enlazable son **`docs/imagenes/*.png`**.
