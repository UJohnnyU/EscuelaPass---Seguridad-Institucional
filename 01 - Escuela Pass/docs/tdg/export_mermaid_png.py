"""Exporta fuentes .mmd en docs/diagramas-mermaid-png/fuente/ a PNG en png/."""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
FUENTE = ROOT / "docs" / "diagramas-mermaid-png" / "fuente"
PNG_DIR = ROOT / "docs" / "diagramas-mermaid-png" / "png"


DIAGRAMS: dict[str, str] = {
    "01-arquitectura-contexto-lr.mmd": r"""
flowchart LR
    userBrowser["Usuario en navegador"] --> frontend["Frontend React o Vite"]
    frontend -->|"API REST JWT"| backend["Backend NestJS"]
    backend --> postgres["PostgreSQL"]
    backend --> uploads["Archivos privados UPLOADS_DIR"]
    backend --> fcm["Firebase Cloud Messaging"]
    backend --> smtp["SMTP Nodemailer"]
    frontend --> mapbox["Mapbox"]
""".strip(),
    "02-arquitectura-despliegue-td.mmd": r"""
flowchart TD
    browser["Navegador web"] --> spa["SPA React y Vite"]
    spa -->|"Bearer JWT"| api["API NestJS"]
    api --> db["PostgreSQL"]
    api --> uploads["UPLOADS_DIR"]
    api --> fcm["Firebase Cloud Messaging"]
    api --> smtp["SMTP Nodemailer"]
    spa --> mapbox["Mapbox GL"]
""".strip(),
    "03-modelo-er-nucleo.mmd": r"""
erDiagram
    schools ||--o{ users : agrupa
    schools ||--o{ groups : contiene
    groups ||--o{ students : asigna
    users ||--o| students : perfilAlumno
    users ||--o| teachers : perfilDocente
    users ||--o| parents : perfilPadre
    students ||--o{ student_parents : vincula
    parents ||--o{ student_parents : autoriza
    teachers ||--o{ teacher_groups : asigna
    groups ||--o{ teacher_groups : recibe
    groups ||--o{ class_sessions : programa
    students ||--o{ attendance_records : registra
    students ||--o{ class_attendance_records : registraClase
    academic_periods ||--o{ activities : organiza
    activities ||--o{ activity_grades : califica
    students ||--o{ report_cards : genera
    report_cards ||--o{ report_card_subjects : resume
    students ||--o{ debts : adeuda
    debts ||--o{ payment_records : paga
    students ||--o{ circuit_requests : solicita
    parents ||--o{ circuit_requests : pide
""".strip(),
    "04-uml-casos-de-uso.mmd": r"""
flowchart TD
    admin["Administrador plataforma"] --> auth["Autenticarse"]
    administrativo["Personal administrativo"] --> auth
    docente["Docente"] --> auth
    padre["Padre o tutor"] --> auth
    alumno["Alumno"] --> auth
    administrativo --> gestion["Gestionar escuela y personas"]
    docente --> asistencia["Registrar asistencia y notas"]
    padre --> circuito["Solicitar circuito de recogida"]
    padre --> pagos["Cargar comprobante"]
    alumno --> consulta["Consultar horario y boletines"]
    admin --> reportes["Consultar auditoria y escuelas"]
    administrativo --> reportes
""".strip(),
    "05-uml-secuencia-circuito.mmd": r"""
sequenceDiagram
    participant Padre
    participant Web as Frontend
    participant API as API NestJS
    participant DB as PostgreSQL
    participant Staff as Vista_staff
    Padre->>Web: Crear solicitud de recogida
    Web->>API: POST circuit-requests
    API->>DB: Validar estudiante padre asistencia circuito
    DB-->>API: Datos validos
    API-->>Web: Solicitud creada
    API-->>Staff: Notificacion o consulta circuito
    Padre->>Web: Enviar GPS o avance
    Web->>API: PATCH gps o parent-progress
    Staff->>API: Autorizar salida o cambiar estado
    Padre->>API: Confirmar entrega
""".strip(),
    "06-cronograma-gantt.mmd": r"""
gantt
    title Cronograma reconstruido Escuela Pass
    dateFormat  YYYY-MM-DD
    section Analisis
    Revision propuesta y RF     :a1, 2026-01-06, 14d
    section Diseno
    Arquitectura y ER          :a2, after a1, 14d
    section Backend
    API NestJS modulos         :a3, after a2, 21d
    section Frontend
    SPA React                  :a4, 2026-02-03, 21d
    section Pruebas
    E2E y seguridad            :a5, 2026-03-01, 21d
    section Documentacion
    Anexos y TDG               :a6, 2026-03-15, 14d
""".strip(),
}


def write_sources() -> None:
    FUENTE.mkdir(parents=True, exist_ok=True)
    PNG_DIR.mkdir(parents=True, exist_ok=True)
    for name, body in DIAGRAMS.items():
        (FUENTE / name).write_text(body + "\n", encoding="utf-8")


def run_mmdc() -> None:
    for mmd in sorted(FUENTE.glob("*.mmd")):
        out = PNG_DIR / (mmd.stem + ".png")
        cmd = [
            "npx",
            "--yes",
            "@mermaid-js/mermaid-cli@10",
            "-i",
            str(mmd),
            "-o",
            str(out),
            "-b",
            "white",
            "-w",
            "1600",
            "-H",
            "900",
        ]
        line = subprocess.list2cmdline(cmd)
        print(line)
        subprocess.run(line, cwd=str(ROOT), check=True, shell=True)


def main() -> None:
    write_sources()
    run_mmdc()


if __name__ == "__main__":
    if "--write-only" in sys.argv:
        write_sources()
    else:
        main()
