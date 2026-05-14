# Diagramas Mermaid exportados (PNG)

- **Fuentes:** `docs/diagramas-mermaid-png/fuente/*.mmd`
- **PNG generados:** `docs/diagramas-mermaid-png/png/*.png`

## Regenerar

Desde la raíz del repositorio (Node.js instalado):

```bash
python docs/tdg/export_mermaid_png.py
```

El script invoca `npx @mermaid-js/mermaid-cli@10` (descarga Chromium en la primera ejecución; puede tardar varios minutos).

Solo reescribir los `.mmd` incrustados en el script:

```bash
python docs/tdg/export_mermaid_png.py --write-only
```

## Uso en Word

Los Markdown referencian las figuras con rutas relativas a la raíz del repo, p. ej.
`docs/diagramas-mermaid-png/png/01-arquitectura-contexto-lr.png`. El generador
`docs/tdg/generate_word_docs.py` incrusta esas imágenes en los `.docx`.
