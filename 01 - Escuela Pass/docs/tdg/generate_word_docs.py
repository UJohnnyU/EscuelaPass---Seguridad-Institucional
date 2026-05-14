from __future__ import annotations

import html
import re
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parents[2]
TDG_DIR = ROOT / "docs" / "tdg"
TEMPLATE = TDG_DIR / "TDG_Plantilla y Normas.docx"
OUT_DIR = TDG_DIR / "word"
ANNEX_OUT_DIR = OUT_DIR / "anexos"


MAIN_DOC = TDG_DIR / "TDG_Escuela_Pass_Documento_Principal.md"
ANNEX_DOCS = [
    TDG_DIR / "entregables" / "00_Matriz_Trazabilidad_TDG_Escuela_Pass.md",
    TDG_DIR / "entregables" / "01_Documento_de_Requerimientos_Escuela_Pass.md",
    TDG_DIR / "entregables" / "02_Actas_de_Reuniones_AlfaNetworks_Escuela_Pass.md",
    TDG_DIR / "entregables" / "03_Documento_de_Arquitectura_Escuela_Pass.md",
    TDG_DIR / "entregables" / "04_Modelo_Entidad_Relacion_Escuela_Pass.md",
    TDG_DIR / "entregables" / "05_Diagramas_UML_Escuela_Pass.md",
    TDG_DIR / "entregables" / "06_Prototipos_UI_UX_Escuela_Pass.md",
    TDG_DIR / "entregables" / "07_Manual_Tecnico_Escuela_Pass.md",
    TDG_DIR / "entregables" / "08_Documentacion_API_Escuela_Pass.md",
    TDG_DIR / "entregables" / "09_Manual_de_Usuario_Escuela_Pass.md",
    TDG_DIR / "entregables" / "10_Informe_de_Pruebas_Metricas_Escuela_Pass.md",
    TDG_DIR / "entregables" / "99_Nota_Verificacion_Entregables_TDG.md",
]

REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships"
IMAGE_TYPE = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/image"

MD_IMAGE = re.compile(r"^\s*!\[([^\]]*)\]\(([^)]+)\)\s*$")

NS = {
    "w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
}


def q(name: str) -> str:
    prefix, tag = name.split(":")
    return f"{{{NS[prefix]}}}{tag}"


def xml_escape(text: str) -> str:
    return html.escape(text, quote=False)


def clean_inline(text: str) -> str:
    text = re.sub(r"`([^`]+)`", r"\1", text)
    text = text.replace("**", "")
    text = text.replace("*", "")
    return text.strip()


def paragraph(text: str = "", style: str | None = None, bold: bool = False, italic: bool = False) -> str:
    text = clean_inline(text)
    ppr = ""
    if style:
        ppr = f'<w:pPr><w:pStyle w:val="{style}"/></w:pPr>'
    rpr_parts = []
    if bold:
        rpr_parts.append("<w:b/>")
    if italic:
        rpr_parts.append("<w:i/>")
    rpr = f"<w:rPr>{''.join(rpr_parts)}</w:rPr>" if rpr_parts else ""
    if not text:
        return f"<w:p>{ppr}</w:p>"
    return (
        f"<w:p>{ppr}<w:r>{rpr}<w:t xml:space=\"preserve\">"
        f"{xml_escape(text)}</w:t></w:r></w:p>"
    )


def page_break() -> str:
    return '<w:p><w:r><w:br w:type="page"/></w:r></w:p>'


def logo_paragraph(rel_id: str = "rId6") -> str:
    return f"""
<w:p>
  <w:pPr><w:jc w:val="center"/></w:pPr>
  <w:r>
    <w:drawing>
      <wp:inline distT="0" distB="0" distL="0" distR="0">
        <wp:extent cx="1800000" cy="900000"/>
        <wp:effectExtent l="0" t="0" r="0" b="0"/>
        <wp:docPr id="1" name="Logo institucional"/>
        <wp:cNvGraphicFramePr>
          <a:graphicFrameLocks noChangeAspect="1"/>
        </wp:cNvGraphicFramePr>
        <a:graphic>
          <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
            <pic:pic>
              <pic:nvPicPr>
                <pic:cNvPr id="0" name="Logo institucional"/>
                <pic:cNvPicPr/>
              </pic:nvPicPr>
              <pic:blipFill>
                <a:blip r:embed="{rel_id}"/>
                <a:stretch><a:fillRect/></a:stretch>
              </pic:blipFill>
              <pic:spPr>
                <a:xfrm>
                  <a:off x="0" y="0"/>
                  <a:ext cx="1800000" cy="900000"/>
                </a:xfrm>
                <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
              </pic:spPr>
            </pic:pic>
          </a:graphicData>
        </a:graphic>
      </wp:inline>
    </w:drawing>
  </w:r>
</w:p>
"""


def diagram_paragraph(rel_id: str, doc_pr_id: int, cx: str = "5486000", cy: str = "3086000") -> str:
    return f"""
<w:p>
  <w:pPr><w:jc w:val="center"/></w:pPr>
  <w:r>
    <w:drawing>
      <wp:inline distT="0" distB="0" distL="0" distR="0">
        <wp:extent cx="{cx}" cy="{cy}"/>
        <wp:effectExtent l="0" t="0" r="0" b="0"/>
        <wp:docPr id="{doc_pr_id}" name="Diagrama"/>
        <wp:cNvGraphicFramePr>
          <a:graphicFrameLocks noChangeAspect="1"/>
        </wp:cNvGraphicFramePr>
        <a:graphic>
          <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
            <pic:pic>
              <pic:nvPicPr>
                <pic:cNvPr id="0" name="Diagrama"/>
                <pic:cNvPicPr/>
              </pic:nvPicPr>
              <pic:blipFill>
                <a:blip r:embed="{rel_id}"/>
                <a:stretch><a:fillRect/></a:stretch>
              </pic:blipFill>
              <pic:spPr>
                <a:xfrm>
                  <a:off x="0" y="0"/>
                  <a:ext cx="{cx}" cy="{cy}"/>
                </a:xfrm>
                <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
              </pic:spPr>
            </pic:pic>
          </a:graphicData>
        </a:graphic>
      </wp:inline>
    </w:drawing>
  </w:r>
</w:p>
"""


def table(rows: list[list[str]]) -> str:
    if not rows:
        return ""
    grid = "".join("<w:gridCol w:w=\"2400\"/>" for _ in rows[0])
    out = [
        '<w:tbl>',
        '<w:tblPr><w:tblStyle w:val="TableGrid"/><w:tblW w:w="0" w:type="auto"/></w:tblPr>',
        f"<w:tblGrid>{grid}</w:tblGrid>",
    ]
    for idx, row in enumerate(rows):
        out.append("<w:tr>")
        for cell in row:
            out.append("<w:tc>")
            out.append('<w:tcPr><w:tcW w:w="2400" w:type="dxa"/></w:tcPr>')
            out.append(paragraph(cell, bold=idx == 0))
            out.append("</w:tc>")
        out.append("</w:tr>")
    out.append("</w:tbl>")
    return "".join(out)


def parse_table(lines: list[str], start: int) -> tuple[str, int]:
    table_lines: list[str] = []
    i = start
    while i < len(lines) and lines[i].strip().startswith("|"):
        table_lines.append(lines[i].strip())
        i += 1
    rows: list[list[str]] = []
    for line in table_lines:
        cells = [clean_inline(c) for c in line.strip("|").split("|")]
        if all(re.fullmatch(r"\s*:?-{3,}:?\s*", c) for c in cells):
            continue
        rows.append(cells)
    return table(rows), i


def cover(title: str, doc_type: str) -> str:
    return "".join(
        [
            paragraph("ESCUELA PASS", "Title", bold=True),
            paragraph("Administración y Seguridad Escolar", "Subtitle"),
            logo_paragraph(),
            paragraph(title, "Title", bold=True),
            paragraph("Jhon Kevin Murillo Martínez"),
            paragraph("Ingeniería Informática"),
            paragraph("Área de Programas Informáticos y Telecomunicaciones (APIT)"),
            paragraph("Facultad de Ingenierías"),
            paragraph("Politécnico Colombiano Jaime Isaza Cadavid"),
            paragraph(doc_type),
            paragraph("2026"),
            page_break(),
        ]
    )


def max_rid_number(rels_xml: bytes) -> int:
    text = rels_xml.decode("utf-8")
    ids = [int(x) for x in re.findall(r'Id="rId(\d+)"', text)]
    return max(ids) if ids else 0


def merge_document_rels(existing: bytes, media_targets: list[str]) -> bytes:
    """Añade relaciones de imagen para word/media/… antes de </Relationships>."""
    text = existing.decode("utf-8")
    base = max_rid_number(existing)
    inserts = []
    for i, target in enumerate(media_targets):
        rid = base + 1 + i
        inserts.append(
            f'<Relationship Id="rId{rid}" Type="{IMAGE_TYPE}" Target="{target}"/>'
        )
    marker = "</Relationships>"
    if marker not in text:
        raise ValueError("document.xml.rels sin Relationships")
    return text.replace(marker, "".join(inserts) + marker).encode("utf-8")


def resolve_image_path(raw: str, md_path: Path) -> Path | None:
    raw = raw.strip()
    candidates = [
        (ROOT / raw).resolve(),
        (md_path.parent / raw).resolve(),
        (TDG_DIR / raw).resolve(),
    ]
    for p in candidates:
        if p.is_file():
            return p
    return None


def markdown_to_body(md_path: Path, title: str, doc_type: str, first_new_rid: int) -> tuple[str, list[Path]]:
    lines = md_path.read_text(encoding="utf-8").splitlines()
    out: list[str] = [cover(title, doc_type)]
    images: list[Path] = []
    in_code = False
    code_buffer: list[str] = []
    i = 0
    while i < len(lines):
        raw = lines[i]
        line = raw.rstrip()
        m_img = MD_IMAGE.match(line)
        if m_img and not in_code:
            alt = m_img.group(1).strip()
            resolved = resolve_image_path(m_img.group(2), md_path)
            if alt:
                out.append(paragraph(alt, italic=True))
            if resolved is None:
                out.append(
                    paragraph(
                        f"[Figura no encontrada: {m_img.group(2)} — ver docs/diagramas-mermaid-png/png/]",
                        italic=True,
                    )
                )
            else:
                idx = len(images)
                images.append(resolved)
                rid_num = first_new_rid + idx
                out.append(diagram_paragraph(f"rId{rid_num}", 20000 + idx))
            i += 1
            continue
        if line.strip().startswith("```"):
            if not in_code:
                in_code = True
                code_buffer = []
            else:
                in_code = False
                if code_buffer:
                    lang = code_buffer[0].strip().lower() if code_buffer else ""
                    if lang == "mermaid":
                        out.append(
                            paragraph(
                                "[Diagrama Mermaid: exportar con docs/tdg/export_mermaid_png.py o ver PNG en docs/diagramas-mermaid-png/png/]",
                                italic=True,
                            )
                        )
                    else:
                        out.append(paragraph("[Bloque de código / técnico]", italic=True))
                    for c in code_buffer[:40]:
                        out.append(paragraph(c, style="NoSpacing"))
                code_buffer = []
            i += 1
            continue
        if in_code:
            code_buffer.append(line)
            i += 1
            continue
        if not line.strip():
            out.append(paragraph())
            i += 1
            continue
        if line.strip().startswith("|"):
            tbl, i = parse_table(lines, i)
            out.append(tbl)
            continue
        if line.startswith("# "):
            out.append(paragraph(line[2:], "Title", bold=True))
        elif line.startswith("## "):
            out.append(paragraph(line[3:], "Heading1", bold=True))
        elif line.startswith("### "):
            out.append(paragraph(line[4:], "Heading2", bold=True))
        elif line.startswith("#### "):
            out.append(paragraph(line[5:], "Heading3", bold=True))
        elif line.lstrip().startswith("- "):
            out.append(paragraph("• " + line.lstrip()[2:]))
        elif re.match(r"^\d+\.\s+", line.strip()):
            out.append(paragraph(line.strip()))
        else:
            out.append(paragraph(line))
        i += 1
    return "".join(out), images


def get_template_sectpr() -> str:
    with zipfile.ZipFile(TEMPLATE) as zf:
        root = ET.fromstring(zf.read("word/document.xml"))
    body = root.find(q("w:body"))
    if body is None:
        return (
            '<w:sectPr><w:pgSz w:w="12240" w:h="15840"/>'
            '<w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr>'
        )
    sect = body.find(q("w:sectPr"))
    if sect is None:
        return (
            '<w:sectPr><w:pgSz w:w="12240" w:h="15840"/>'
            '<w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr>'
        )
    return ET.tostring(sect, encoding="unicode")


def write_docx_from_template(md_path: Path, out_path: Path, title: str, doc_type: str) -> None:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    rels_path = "word/_rels/document.xml.rels"
    with zipfile.ZipFile(TEMPLATE, "r") as zin:
        rels_bytes = zin.read(rels_path)
    max_rid = max_rid_number(rels_bytes)
    first_new_rid = max_rid + 1

    body, images = markdown_to_body(md_path, title, doc_type, first_new_rid)
    media_targets = [f"media/tdg_diagram_{i + 1}.png" for i in range(len(images))]
    new_rels = merge_document_rels(rels_bytes, media_targets) if images else rels_bytes

    sectpr = get_template_sectpr()
    document_xml = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" '
        'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" '
        'xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" '
        'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" '
        'xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">'
        f"<w:body>{body}{sectpr}</w:body></w:document>"
    )
    temp_path = out_path.with_suffix(".tmp.docx")
    with zipfile.ZipFile(TEMPLATE, "r") as zin, zipfile.ZipFile(temp_path, "w", zipfile.ZIP_DEFLATED) as zout:
        for item in zin.infolist():
            name = item.filename
            if name == "word/document.xml":
                continue
            if name == rels_path and images:
                zout.writestr(item, new_rels)
                continue
            zout.writestr(item, zin.read(name))
        for idx, img_path in enumerate(images):
            zout.write(img_path, f"word/media/tdg_diagram_{idx + 1}.png")
        zout.writestr("word/document.xml", document_xml.encode("utf-8"))
    if out_path.exists():
        out_path.unlink()
    temp_path.rename(out_path)


def title_from_md(md_path: Path) -> str:
    for line in md_path.read_text(encoding="utf-8").splitlines():
        if line.startswith("# "):
            return clean_inline(line[2:])
    return md_path.stem.replace("_", " ")


def main() -> None:
    if not TEMPLATE.exists():
        raise SystemExit(f"No existe plantilla: {TEMPLATE}")
    write_docx_from_template(
        MAIN_DOC,
        OUT_DIR / "TDG_Escuela_Pass_Documento_Principal.docx",
        "Trabajo De Grado Escuela Pass",
        "Documento principal del Trabajo de Grado",
    )
    for md in ANNEX_DOCS:
        write_docx_from_template(
            md,
            ANNEX_OUT_DIR / f"{md.stem}.docx",
            title_from_md(md),
            "Anexo documental del Trabajo de Grado",
        )
    print(f"Generados: {OUT_DIR}")


if __name__ == "__main__":
    main()
