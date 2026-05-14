"""Concatena todos los .md bajo docs/ en un único archivo (sin comprimir ni omitir texto)."""
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DOCS = ROOT / "docs"
OUT = DOCS / "DOCUMENTACION_ESCUELA_PASS_CONSOLIDADO.md"
SEP = "|" * 44


def main() -> None:
    paths = sorted(DOCS.rglob("*.md"), key=lambda p: str(p).lower())
    out_resolved = OUT.resolve()
    chunks: list[str] = []
    for p in paths:
        if p.resolve() == out_resolved:
            continue
        rel = p.relative_to(ROOT).as_posix()
        body = p.read_text(encoding="utf-8")
        chunks.append(f"# Fuente: {rel}\n\n{body}\n\n{SEP}\n\n")
    OUT.parent.mkdir(parents=True, exist_ok=True)
    header = (
        "# Documentación Markdown consolidada — Escuela Pass\n\n"
        "Generado automáticamente. Cada bloque conserva el contenido íntegro del archivo indicado.\n\n"
        f"{SEP}\n\n"
    )
    OUT.write_text(header + "".join(chunks), encoding="utf-8")
    print(f"Escrito: {OUT} ({len(paths) - 1} archivos)")


if __name__ == "__main__":
    main()
