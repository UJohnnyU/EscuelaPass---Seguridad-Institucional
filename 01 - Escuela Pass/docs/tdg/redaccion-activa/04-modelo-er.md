# ESCUELA PASS — Administración y seguridad escolar

## 04. Modelo entidad-relación Escuela Pass

**Jhon Kevin Murillo Martínez**  
Ingeniería Informática — Área de Programas Informáticos y Telecomunicaciones (APIT)  
Facultad de Ingenierías — Politécnico Colombiano Jaime Isaza Cadavid  

**Tipo de documento:** Anexo documental del trabajo de grado  
**Versión:** 1.0 documental  
**Año:** 2026  

---

**Proyecto:** Escuela Pass — Administración y seguridad escolar  
**Autor:** Jhon Kevin Murillo Martínez  
**Programa:** Ingeniería Informática — Área de Programas Informáticos y Telecomunicaciones  
**Tipo de documento:** Modelo de datos  
**Versión:** 1.0 documental  

---

## 1. Propósito

El modelo entidad-relación organiza la información crítica de Escuela Pass en dominios institucionales, académicos, financieros, de seguridad física y comunicación. La fuente primaria de nombres de tabla y relaciones son las **cuarenta y nueve** entidades TypeORM registradas en `buildTypeOrmConfig()` (`src/config/typeorm.config.ts`), con definición en archivos bajo `src/database/entities/`, aplicadas mediante la cadena de migraciones en `src/database/migrations/` y la política de alineación descrita en el **Anexo 03** (persistencia y §12.1).

---

## 2. Agrupación de entidades

| Dominio | Entidades principales (tabla PostgreSQL) | Finalidad |
| --- | --- | --- |
| Identidad | `users`, `refresh_tokens`, `privacy_policies`, `user_privacy_acceptances`, `audit_logs` | Autenticación, privacidad y trazabilidad |
| Institución | `schools`, `institution_settings`, `administrative_staff`, `import_jobs` | Multiinstitución, perfil y operación de importación |
| Acceso físico (QR/NFC) | `access_credentials`, `access_events` | Credenciales y eventos de entrada o salida |
| Académico núcleo | `groups`, `subjects`, `students`, `teachers`, `student_parents`, `teacher_groups`, `teacher_subjects` | Gestión escolar; en `student_parents`, el atributo `can_pickup` autoriza recogida para RF3 |
| Asistencia | `attendance_records`, `class_attendance_records`, `school_non_instructional_days` | Asistencia diaria, por clase y calendario |
| Evaluación | `academic_periods`, `activities`, `activity_grades`, `report_cards`, `report_card_subjects` | Calificaciones y boletines |
| Seguimiento | `student_attention_notes`, `student_lifecycle_events`, `teacher_lifecycle_events` | Anotaciones de atención e hitos de ciclo de vida |
| Circuito | `circuit_requests`, `vehicles`, `student_departure_consents` | Recogida familiar, vehículos y consentimientos de salida (autorización padre–estudiante: §3 y `can_pickup`) |
| Finanzas | `payment_concepts`, `debts`, `payments`, `debt_adjustments` | Cartera, comprobantes y ajustes |
| Comunicación | `notices`, `notifications`, `user_fcm_tokens`, `admin_reports`, `admin_report_comments` | Avisos, *push* e informes administrativos |
| Agenda | `meetings`, `meeting_participants`, `external_visits`, `external_visit_students`, `external_visit_groups` | Reuniones y visitas |
| Horarios | `class_sessions`, `class_schedule_slots` | Sesiones y franjas por grupo |

El inventario tabla–archivo de esas entidades se consigna en la **sección 8** y está alineado con la **matriz (Anexo 00)** y los **requerimientos (Anexo 01)**.

---

## 3. Relaciones clave

- Una **escuela** concentra usuarios, grupos, asignaturas, estudiantes, docentes, personal administrativo y configuraciones asociadas.
- Un **estudiante** pertenece a una escuela y a un grupo; se vincula a uno o más padres o tutores mediante `student_parents`, relación que incluye **`can_pickup`** para indicar si ese vínculo padre–estudiante habilita la recogida en el circuito (RF3).
- Un **docente** se relaciona con grupos (`teacher_groups`) y con materias (`teacher_subjects`) según la implementación del dominio.
- Las **asistencias** se registran por estudiante y contexto temporal; operan en conjunto con **días no lectivos** institucionales.
- Las **actividades** se vinculan a grupo, periodo académico y materia; las calificaciones en `activity_grades` alimentan la consolidación en **report cards**.
- Las **deudas** se asocian a estudiantes y conceptos; los movimientos de pago en la tabla **`payments`** y los **ajustes** en `debt_adjustments` actualizan el estado de cartera.
- Las **solicitudes de circuito** relacionan estudiante, padre solicitante, estados operativos y datos de ubicación o consentimiento según el flujo documentado en el **Anexo 01** (RF3).
- Las **notificaciones** tienen destinatario en `users` y pueden asociarse a *tokens* FCM en `user_fcm_tokens`.

[Figura 1. Modelo ER núcleo multiinstitución centrado]

[Figura 2. Modelo ER extendido: académico, finanzas, circuito y comunicación centrado]

---

## 4. Observaciones técnicas

- **`payments`:** el registro de pagos en base de datos usa el nombre de tabla **`payments`** (`payment-record.entity.ts`), no el término genérico “payment_records”.
- **`typeorm_migrations`:** tabla de control generada por TypeORM para versionar el esquema; no constituye entidad de dominio de aplicación. Su presencia en el esquema **public** es esperable en entornos donde se ejecuta la herramienta de migraciones.
- La coherencia entre scripts históricos, migraciones y el saneo de arranque (`ensureRuntimeSchema`, **Anexo 03**) condiciona que el modelo académico reproduzca fielmente el esquema en producción; el detalle procedimental se cruza con el **Anexo 08** solo en la medida en que los contratos HTTP materializan operaciones sobre estas tablas.

---

## 5. Representación gráfica del modelo

Las **figuras 1 y 2** visualizan, respectivamente, el núcleo multiinstitución y el modelo extendido en los dominios académico, financiero, de circuito y comunicación, en correspondencia con la agrupación de la sección 2 y las relaciones de la sección 3.

---

## 6. Reglas de lectura del modelo

El modelo se interpreta como **multiinstitución**: la escuela define el alcance institucional y las relaciones usuario–escuela, padre–estudiante y docente–grupo condicionan los permisos expuestos en la API (**Anexo 08**) y en la interfaz (**Anexo 06**). Las entidades de **auditoría** y **privacidad** no son accesorias: respaldan el tratamiento responsable de datos personales, en particular por la presencia de menores de edad, en articulación con el **Anexo 01** (reglas de negocio) y el **Anexo 03** (§4 y §12.5).

---

## 7. Relación con otros anexos del TDG

| Anexo | Contenido vinculado a este documento |
| --- | --- |
| 00 | Matriz RF/RNF—implementación—evidencia; **cuarenta y nueve** entidades TypeORM y trazabilidad a tablas. |
| 01 | Requerimientos y reglas de negocio que el modelo materializa (RF4–RF8 y alcance ampliado). |
| 02 | Actas con AlfaNetworks que fijan interpretación funcional que el modelo de datos respalda (p. ej. circuito familiar). |
| 03 | Arquitectura de persistencia, migraciones, `ensureRuntimeSchema` y limitaciones §12.1. |
| 05 | Diagramas de secuencia y casos de uso que referencian entidades y relaciones descritas en este anexo. |
| 06 | Rutas, prototipos y criterios UX que presentan los datos descritos en este anexo. |
| 07 | Manual técnico, despliegue y **gobernanza de esquema** (`docs/technical-setup.md`, *Política de cambios de esquema*; Anexo 07 §13.1). |
| 08 | Contratos REST: dominios (**Anexo 08**, §3), RF (**§7**), catálogo (**§10**); operaciones sobre las tablas inventariadas. |
| 09 | Manual de usuario: formularios y flujos que presentan datos de este modelo (**Anexo 09**). |
| 10 | Informe de pruebas y métricas: validación sobre el esquema persistido (**Anexo 10**). |

---

## 8. Inventario tabla PostgreSQL — entidad TypeORM

Las **cuarenta y nueve** entidades del servicio están registradas en el arreglo `entities` de `buildTypeOrmConfig()` en `src/config/typeorm.config.ts` y conforman el mapa objeto–relacional de la API NestJS. A continuación, la correspondencia `tabla ↔ archivo` en orden alfabético por nombre de tabla.

Mapeo `@Entity({ name: '…' })` — archivo fuente.

| Tabla PostgreSQL | Archivo entidad |
| --- | --- |
| academic_periods | `src/database/entities/academic-period.entity.ts` |
| access_credentials | `src/database/entities/access-credential.entity.ts` |
| access_events | `src/database/entities/access-event.entity.ts` |
| activities | `src/database/entities/activity.entity.ts` |
| activity_grades | `src/database/entities/activity-grade.entity.ts` |
| admin_report_comments | `src/database/entities/admin-report-comment.entity.ts` |
| admin_reports | `src/database/entities/admin-report.entity.ts` |
| administrative_staff | `src/database/entities/administrative-staff.entity.ts` |
| attendance_records | `src/database/entities/attendance-record.entity.ts` |
| audit_logs | `src/database/entities/audit-log.entity.ts` |
| circuit_requests | `src/database/entities/circuit-request.entity.ts` |
| class_attendance_records | `src/database/entities/class-attendance-record.entity.ts` |
| class_schedule_slots | `src/database/entities/class-schedule-slot.entity.ts` |
| class_sessions | `src/database/entities/class-session.entity.ts` |
| debt_adjustments | `src/database/entities/debt-adjustment.entity.ts` |
| debts | `src/database/entities/debt.entity.ts` |
| external_visit_groups | `src/database/entities/external-visit-group.entity.ts` |
| external_visit_students | `src/database/entities/external-visit-student.entity.ts` |
| external_visits | `src/database/entities/external-visit.entity.ts` |
| groups | `src/database/entities/group.entity.ts` |
| import_jobs | `src/database/entities/import-job.entity.ts` |
| institution_settings | `src/database/entities/institution-setting.entity.ts` |
| meeting_participants | `src/database/entities/meeting-participant.entity.ts` |
| meetings | `src/database/entities/meeting.entity.ts` |
| notices | `src/database/entities/notice.entity.ts` |
| notifications | `src/database/entities/notification.entity.ts` |
| parents | `src/database/entities/parent.entity.ts` |
| payment_concepts | `src/database/entities/payment-concept.entity.ts` |
| payments | `src/database/entities/payment-record.entity.ts` |
| privacy_policies | `src/database/entities/privacy-policy.entity.ts` |
| refresh_tokens | `src/database/entities/refresh-token.entity.ts` |
| report_card_subjects | `src/database/entities/report-card-subject.entity.ts` |
| report_cards | `src/database/entities/report-card.entity.ts` |
| school_non_instructional_days | `src/database/entities/school-non-instructional-day.entity.ts` |
| schools | `src/database/entities/school.entity.ts` |
| student_attention_notes | `src/database/entities/student-attention-note.entity.ts` |
| student_departure_consents | `src/database/entities/student-departure-consent.entity.ts` |
| student_lifecycle_events | `src/database/entities/student-lifecycle-event.entity.ts` |
| student_parents | `src/database/entities/student-parent.entity.ts` |
| students | `src/database/entities/student.entity.ts` |
| subjects | `src/database/entities/subject.entity.ts` |
| teacher_groups | `src/database/entities/teacher-group.entity.ts` |
| teacher_lifecycle_events | `src/database/entities/teacher-lifecycle-event.entity.ts` |
| teacher_subjects | `src/database/entities/teacher-subject.entity.ts` |
| teachers | `src/database/entities/teacher.entity.ts` |
| user_fcm_tokens | `src/database/entities/user-fcm-token.entity.ts` |
| user_privacy_acceptances | `src/database/entities/user-privacy-acceptance.entity.ts` |
| users | `src/database/entities/user.entity.ts` |
| vehicles | `src/database/entities/vehicle.entity.ts` |

---

## 9. Esquema de referencia en despliegue (PostgreSQL)

A continuación se lista el conjunto de tablas de dominio observadas en un despliegue de referencia sobre PostgreSQL, más la tabla de control de migraciones.

| Tabla |
| --- |
| academic_periods |
| access_credentials |
| access_events |
| activities |
| activity_grades |
| admin_report_comments |
| admin_reports |
| administrative_staff |
| attendance_records |
| audit_logs |
| circuit_requests |
| class_attendance_records |
| class_schedule_slots |
| class_sessions |
| debt_adjustments |
| debts |
| external_visit_groups |
| external_visit_students |
| external_visits |
| groups |
| import_jobs |
| institution_settings |
| meeting_participants |
| meetings |
| notices |
| notifications |
| parents |
| payment_concepts |
| payments |
| privacy_policies |
| refresh_tokens |
| report_card_subjects |
| report_cards |
| school_non_instructional_days |
| schools |
| student_attention_notes |
| student_departure_consents |
| student_lifecycle_events |
| student_parents |
| students |
| subjects |
| teacher_groups |
| teacher_lifecycle_events |
| teacher_subjects |
| teachers |
| typeorm_migrations |
| user_fcm_tokens |
| user_privacy_acceptances |
| users |
| vehicles |

---

*Fin del anexo 04 — Modelo entidad-relación.*
