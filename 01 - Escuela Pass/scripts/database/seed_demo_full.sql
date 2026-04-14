-- =============================================================
-- ESCUELA PASS — SEED DEMO COMPLETO
-- Ejecutar DESPUÉS de escuela_pass_schema_v3.sql y seed_dev.sql
-- Objetivo: poblar tablas con variedad de enums, estados y relaciones
-- para probar cada rol y pantalla. Contraseña unificada demo: Pass123*
-- =============================================================

BEGIN;

-- ---------- Usuarios adicionales (idempotente por email) ----------
INSERT INTO users (email, password_hash, role, full_name, can_access_campus, status)
VALUES
  ('staff@escuelapass.local', crypt('Pass123*', gen_salt('bf')), 'ADMINISTRATIVO', 'María López — Secretaría', true, true),
  ('docente2@escuelapass.local', crypt('Pass123*', gen_salt('bf')), 'DOCENTE', 'Carlos Ruiz — Matemáticas', true, true),
  ('padre2@escuelapass.local', crypt('Pass123*', gen_salt('bf')), 'PADRE', 'Ana Martínez — Tutora', true, true),
  ('alumno2@escuelapass.local', crypt('Pass123*', gen_salt('bf')), 'ALUMNO', 'Luis Martínez', true, true)
ON CONFLICT (email) DO NOTHING;

UPDATE users SET phone = v.phone
FROM (VALUES
  ('staff@escuelapass.local', '+52 55 5000 0011'),
  ('docente2@escuelapass.local', '+52 55 5000 0012'),
  ('padre2@escuelapass.local', '+52 55 5000 0013'),
  ('alumno2@escuelapass.local', '+52 55 5000 0014')
) AS v(email, phone)
WHERE users.email = v.email;

-- ---------- Grupos extra ----------
INSERT INTO groups (name, grade, shift, school_year, classroom, capacity, status)
VALUES
  ('2B', '2DO', 'VESPERTINO', '2026-2027', 'B-205', 28, true),
  ('3C', '3RO', 'MATUTINO', '2026-2027', 'C-310', 25, true)
ON CONFLICT (name, school_year) DO NOTHING;

-- ---------- Perfiles ----------
INSERT INTO administrative_staff (user_id, employee_number)
SELECT u.id, 'ADM-0001'
FROM users u WHERE u.email = 'staff@escuelapass.local'
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO teachers (user_id, employee_number)
SELECT u.id, 'DOC-0002'
FROM users u WHERE u.email = 'docente2@escuelapass.local'
ON CONFLICT (employee_number) DO NOTHING;

INSERT INTO parents (user_id, is_primary_contact)
SELECT u.id, true
FROM users u WHERE u.email = 'padre2@escuelapass.local'
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO students (user_id, matricula, group_id, can_leave_alone)
SELECT u.id, 'A-0002', g.id, true
FROM users u
JOIN groups g ON g.name = '2B' AND g.school_year = '2026-2027'
WHERE u.email = 'alumno2@escuelapass.local'
ON CONFLICT (matricula) DO NOTHING;

-- Relación padre2–alumno2 y vínculo secundario padre1–alumno2 (otro tutor)
INSERT INTO student_parents (student_id, parent_id, relationship, is_primary, can_pickup)
SELECT s.id, p.id, 'MADRE', true, true
FROM students s
JOIN users su ON su.id = s.user_id
JOIN parents p ON TRUE
JOIN users pu ON pu.id = p.user_id
WHERE su.email = 'alumno2@escuelapass.local' AND pu.email = 'padre2@escuelapass.local'
ON CONFLICT (student_id, parent_id) DO NOTHING;

INSERT INTO student_parents (student_id, parent_id, relationship, is_primary, can_pickup)
SELECT s.id, p.id, 'TUTOR', false, true
FROM students s
JOIN users su ON su.id = s.user_id
JOIN parents p ON TRUE
JOIN users pu ON pu.id = p.user_id
WHERE su.email = 'alumno2@escuelapass.local' AND pu.email = 'padre1@escuelapass.local'
ON CONFLICT (student_id, parent_id) DO NOTHING;

-- ---------- Materias ----------
INSERT INTO subjects (name, description)
VALUES
  ('Matemáticas', 'Álgebra y geometría'),
  ('Lengua', 'Comunicación y literatura'),
  ('Ciencias Naturales', 'Biología y química básica'),
  ('Educación Física', 'Deporte y salud')
ON CONFLICT (name) DO NOTHING;

-- ---------- Docentes ↔ grupos ↔ materias ----------
INSERT INTO teacher_groups (teacher_id, group_id, subject_id, is_main_teacher, can_authorize_departures)
SELECT t.id, g.id, sub.id, true, true
FROM teachers t
JOIN users u ON u.id = t.user_id
JOIN groups g ON g.name = '1A' AND g.school_year = '2026-2027'
JOIN subjects sub ON sub.name = 'Matemáticas'
WHERE u.email = 'docente1@escuelapass.local'
  AND NOT EXISTS (
    SELECT 1 FROM teacher_groups x WHERE x.teacher_id = t.id AND x.group_id = g.id AND x.subject_id = sub.id
  );

INSERT INTO teacher_groups (teacher_id, group_id, subject_id, is_main_teacher, can_authorize_departures)
SELECT t.id, g.id, sub.id, false, true
FROM teachers t
JOIN users u ON u.id = t.user_id
JOIN groups g ON g.name = '2B' AND g.school_year = '2026-2027'
JOIN subjects sub ON sub.name = 'Matemáticas'
WHERE u.email = 'docente2@escuelapass.local'
  AND NOT EXISTS (
    SELECT 1 FROM teacher_groups x WHERE x.teacher_id = t.id AND x.group_id = g.id AND x.subject_id = sub.id
  );

INSERT INTO teacher_groups (teacher_id, group_id, subject_id, is_main_teacher, can_authorize_departures)
SELECT t.id, g.id, sub.id, false, false
FROM teachers t
JOIN users u ON u.id = t.user_id
JOIN groups g ON g.name = '1A' AND g.school_year = '2026-2027'
JOIN subjects sub ON sub.name = 'Lengua'
WHERE u.email = 'docente2@escuelapass.local'
  AND NOT EXISTS (
    SELECT 1 FROM teacher_groups x WHERE x.teacher_id = t.id AND x.group_id = g.id AND x.subject_id = sub.id
  );

-- ---------- Vehículos extra (padre2) ----------
INSERT INTO vehicles (parent_id, plate, description, brand, model, color, year, is_active)
SELECT p.id, 'XYZ789', 'Camioneta familiar', 'Nissan', 'Frontier', 'Gris', 2019, true
FROM parents p
JOIN users u ON u.id = p.user_id
WHERE u.email = 'padre2@escuelapass.local'
ON CONFLICT (parent_id, plate) DO NOTHING;

INSERT INTO vehicles (parent_id, plate, description, brand, model, color, year, is_active)
SELECT p.id, 'OLD001', 'Respaldo (inactivo)', 'VW', 'Jetta', 'Azul', 2015, false
FROM parents p
JOIN users u ON u.id = p.user_id
WHERE u.email = 'padre2@escuelapass.local'
ON CONFLICT (parent_id, plate) DO NOTHING;

-- Autorización de recogida alumno2
INSERT INTO pickup_authorizations (student_id, parent_id, vehicle_id, is_default, is_active, notes)
SELECT s.id, p.id, v.id, true, true, 'Recogida habitual padre2'
FROM students s
JOIN users su ON su.id = s.user_id
JOIN parents p ON p.user_id = (SELECT id FROM users WHERE email = 'padre2@escuelapass.local' LIMIT 1)
JOIN vehicles v ON v.parent_id = p.id AND v.plate = 'XYZ789'
WHERE su.email = 'alumno2@escuelapass.local'
  AND NOT EXISTS (
    SELECT 1 FROM pickup_authorizations pa WHERE pa.student_id = s.id AND pa.parent_id = p.id AND pa.is_active
  );

-- ---------- Credenciales adicionales ----------
INSERT INTO access_credentials (user_id, credential_type, credential_value, status)
SELECT u.id, 'QR', 'QR_STAFF_0001', 'ACTIVE' FROM users u WHERE u.email = 'staff@escuelapass.local'
ON CONFLICT (credential_type, credential_value) DO NOTHING;

INSERT INTO access_credentials (user_id, credential_type, credential_value, status)
SELECT u.id, 'QR', 'QR_ALUMNO_0002', 'ACTIVE' FROM users u WHERE u.email = 'alumno2@escuelapass.local'
ON CONFLICT (credential_type, credential_value) DO NOTHING;

INSERT INTO access_credentials (user_id, credential_type, credential_value, status)
SELECT u.id, 'NFC', 'NFC_ALUMNO_0002', 'REVOKED' FROM users u WHERE u.email = 'alumno2@escuelapass.local'
ON CONFLICT (credential_type, credential_value) DO NOTHING;

-- ---------- Eventos de acceso (métodos y tipos variados) ----------
INSERT INTO access_events (user_id, role_snapshot, event_type, method, event_time, event_date, access_credential_id, registered_by)
SELECT u.id, u.role::user_role, 'ENTRY', 'QR', NOW() - INTERVAL '2 hours', CURRENT_DATE,
       (SELECT id FROM access_credentials c WHERE c.credential_value = 'QR_ALUMNO_0001' LIMIT 1),
       (SELECT id FROM users WHERE email = 'admin@escuelapass.local' LIMIT 1)
FROM users u WHERE u.email = 'alumno1@escuelapass.local';

INSERT INTO access_events (user_id, role_snapshot, event_type, method, event_time, event_date, registered_by)
SELECT u.id, u.role::user_role, 'EXIT', 'MANUAL', NOW() - INTERVAL '1 hour', CURRENT_DATE,
       (SELECT id FROM users WHERE email = 'staff@escuelapass.local' LIMIT 1)
FROM users u WHERE u.email = 'alumno1@escuelapass.local';

INSERT INTO access_events (user_id, role_snapshot, event_type, method, event_time, event_date)
SELECT u.id, u.role::user_role, 'ENTRY', 'NFC', NOW() - INTERVAL '30 minutes', CURRENT_DATE
FROM users u WHERE u.email = 'docente2@escuelapass.local';

-- ---------- Consentimientos de salida ----------
INSERT INTO student_departure_consents (student_id, parent_id, consent_type, valid_from, valid_until)
SELECT s.id, p.id, 'SALIDA_SOLO', CURRENT_DATE - 30, CURRENT_DATE + 180
FROM students s
JOIN users su ON su.id = s.user_id
JOIN parents p ON TRUE
JOIN users pu ON pu.id = p.user_id
WHERE su.email = 'alumno1@escuelapass.local' AND pu.email = 'padre1@escuelapass.local'
  AND NOT EXISTS (SELECT 1 FROM student_departure_consents c WHERE c.student_id = s.id AND c.parent_id = p.id AND c.consent_type = 'SALIDA_SOLO');

INSERT INTO student_departure_consents (student_id, parent_id, consent_type, valid_from, valid_until)
SELECT s.id, p.id, 'SALIDA_CON_OTRA_PERSONA', CURRENT_DATE - 7, CURRENT_DATE + 90
FROM students s
JOIN users su ON su.id = s.user_id
JOIN parents p ON TRUE
JOIN users pu ON pu.id = p.user_id
WHERE su.email = 'alumno2@escuelapass.local' AND pu.email = 'padre2@escuelapass.local'
  AND NOT EXISTS (SELECT 1 FROM student_departure_consents c WHERE c.student_id = s.id AND c.consent_type = 'SALIDA_CON_OTRA_PERSONA');

-- ---------- Circuitos (varios estados y métodos) ----------
INSERT INTO circuit_requests (
  student_id, requested_by_parent_id, pickup_method, status, request_time,
  parent_gps_latitude, parent_gps_longitude, vehicle_id, teacher_signal,
  parent_confirm_deadline_at, parent_receipt_confirmed_at
)
SELECT s.id, p.id, 'VEHICULO_REGISTRADO', 'ENTREGADO', NOW() - INTERVAL '1 day',
       4.60971000::NUMERIC, -74.08175000::NUMERIC, v.id, 'PREPARA_SALIDA',
       NULL, NOW() - INTERVAL '23 hours'
FROM students s
JOIN users su ON su.id = s.user_id
JOIN parents p ON TRUE
JOIN users pu ON pu.id = p.user_id
JOIN vehicles v ON v.plate = 'ABC123' AND v.parent_id = p.id
WHERE su.email = 'alumno1@escuelapass.local' AND pu.email = 'padre1@escuelapass.local'
  AND NOT EXISTS (SELECT 1 FROM circuit_requests cr WHERE cr.student_id = s.id AND cr.status = 'ENTREGADO' LIMIT 1);

INSERT INTO circuit_requests (student_id, requested_by_parent_id, pickup_method, status, request_time, vehicle_id, teacher_signal)
SELECT s.id, p.id, 'A_PIE', 'PENDIENTE', NOW() - INTERVAL '10 minutes', NULL, NULL
FROM students s
JOIN users su ON su.id = s.user_id
JOIN parents p ON TRUE
JOIN users pu ON pu.id = p.user_id
WHERE su.email = 'alumno2@escuelapass.local' AND pu.email = 'padre2@escuelapass.local'
  AND NOT EXISTS (SELECT 1 FROM circuit_requests cr WHERE cr.student_id = s.id AND cr.status = 'PENDIENTE');

INSERT INTO circuit_requests (student_id, requested_by_parent_id, pickup_method, status, request_time, vehicle_id, teacher_signal, parent_confirm_deadline_at)
SELECT s.id, p.id, 'OTRO_VEHICULO', 'PADRE_EN_CAMINO', NOW() - INTERVAL '5 minutes', NULL, NULL, NOW() + INTERVAL '15 minutes'
FROM students s
JOIN users su ON su.id = s.user_id
JOIN parents p ON TRUE
JOIN users pu ON pu.id = p.user_id
WHERE su.email = 'alumno1@escuelapass.local' AND pu.email = 'padre1@escuelapass.local'
  AND NOT EXISTS (SELECT 1 FROM circuit_requests cr WHERE cr.student_id = s.id AND cr.status = 'PADRE_EN_CAMINO');

INSERT INTO circuit_requests (student_id, requested_by_parent_id, pickup_method, status, request_time)
SELECT s.id, p.id, 'SOLO_CONSENTIMIENTO', 'CONSENTIDO_SOLO', NOW() - INTERVAL '3 hours'
FROM students s
JOIN users su ON su.id = s.user_id
JOIN parents p ON TRUE
JOIN users pu ON pu.id = p.user_id
WHERE su.email = 'alumno2@escuelapass.local' AND pu.email = 'padre2@escuelapass.local'
  AND NOT EXISTS (SELECT 1 FROM circuit_requests cr WHERE cr.student_id = s.id AND cr.status = 'CONSENTIDO_SOLO');

INSERT INTO circuit_requests (student_id, requested_by_parent_id, pickup_method, status, request_time, vehicle_id, teacher_signal, parent_confirm_deadline_at)
SELECT s.id, p.id, 'VEHICULO_REGISTRADO', 'CERRADO_SIN_CONFIRMACION_PADRE', NOW() - INTERVAL '2 days', v.id, 'ALUMNO_CAMINO_A_SALIDA', NOW() - INTERVAL '1 day'
FROM students s
JOIN users su ON su.id = s.user_id
JOIN parents p ON TRUE
JOIN users pu ON pu.id = p.user_id
JOIN vehicles v ON v.plate = 'ABC123' AND v.parent_id = p.id
WHERE su.email = 'alumno1@escuelapass.local' AND pu.email = 'padre1@escuelapass.local'
  AND NOT EXISTS (SELECT 1 FROM circuit_requests cr WHERE cr.status = 'CERRADO_SIN_CONFIRMACION_PADRE' AND cr.student_id = s.id);

INSERT INTO circuit_requests (student_id, requested_by_parent_id, pickup_method, status, request_time)
SELECT s.id, p.id, 'VEHICULO_REGISTRADO', 'CANCELADO', NOW() - INTERVAL '4 days'
FROM students s
JOIN users su ON su.id = s.user_id
JOIN parents p ON TRUE
JOIN users pu ON pu.id = p.user_id
WHERE su.email = 'alumno2@escuelapass.local' AND pu.email = 'padre2@escuelapass.local'
  AND NOT EXISTS (SELECT 1 FROM circuit_requests cr WHERE cr.student_id = s.id AND cr.status = 'CANCELADO');

-- ---------- Comunicados y notificaciones ----------
INSERT INTO notices (title, content, target_type, target_user_id, target_group_id, created_by, is_important, expires_at)
SELECT
  'Inicio de ciclo escolar',
  'Bienvenida a familias y personal. Horarios de secretaría: lunes a viernes 8:00–14:00.',
  'ALL', NULL, NULL, u.id, true, NOW() + INTERVAL '60 days'
FROM users u WHERE u.email = 'admin@escuelapass.local'
  AND NOT EXISTS (SELECT 1 FROM notices n WHERE n.title = 'Inicio de ciclo escolar');

INSERT INTO notices (title, content, target_type, target_user_id, target_group_id, created_by, is_important)
SELECT
  'Reunión grupo 1A',
  'Recordatorio: junta de padres del grupo 1A.',
  'GROUP', NULL, g.id, u.id, false
FROM users u
JOIN groups g ON g.name = '1A' AND g.school_year = '2026-2027'
WHERE u.email = 'docente1@escuelapass.local'
  AND NOT EXISTS (SELECT 1 FROM notices n WHERE n.title = 'Reunión grupo 1A');

INSERT INTO notices (title, content, target_type, target_user_id, target_group_id, created_by, is_important)
SELECT
  'Mensaje personal demo',
  'Notificación dirigida a un solo usuario para pruebas.',
  'USER', pu.id, NULL, (SELECT id FROM users WHERE email = 'admin@escuelapass.local' LIMIT 1), false
FROM users pu WHERE pu.email = 'padre1@escuelapass.local'
  AND NOT EXISTS (SELECT 1 FROM notices n WHERE n.title = 'Mensaje personal demo');

INSERT INTO notifications (user_id, notice_id, title, message, read_at, sent_at, delivery_status)
SELECT u.id, n.id, n.title, LEFT(n.content, 200), NULL, NOW() - INTERVAL '1 hour', 'SENT'
FROM users u
JOIN notices n ON n.title = 'Inicio de ciclo escolar'
WHERE u.email = 'padre1@escuelapass.local'
  AND NOT EXISTS (SELECT 1 FROM notifications x WHERE x.user_id = u.id AND x.notice_id = n.id);

INSERT INTO notifications (user_id, notice_id, title, message, read_at, sent_at, delivery_status)
SELECT u.id, n.id, n.title, LEFT(n.content, 200), NOW() - INTERVAL '30 minutes', NOW() - INTERVAL '2 hours', 'SENT'
FROM users u
JOIN notices n ON n.title = 'Reunión grupo 1A'
WHERE u.email = 'padre1@escuelapass.local'
  AND NOT EXISTS (SELECT 1 FROM notifications x WHERE x.user_id = u.id AND x.notice_id = n.id);

-- ---------- Pagos ----------
INSERT INTO payment_concepts (name, description, is_base, default_amount, is_recurring, recurrence_period, is_active)
VALUES
  ('Colegiatura mensual', 'Cuota ordinaria', true, 3500.00, true, 'MONTHLY', true),
  ('Material didáctico', 'Único por ciclo', false, 450.00, false, NULL, true),
  ('Evento cultural', 'Opcional', false, 200.00, false, NULL, true)
ON CONFLICT (name) DO NOTHING;

INSERT INTO debts (student_id, concept_id, amount, due_date, status, description, notes)
SELECT s.id, c.id, 3500.00, CURRENT_DATE + 10, 'PENDIENTE', 'Mes en curso', NULL
FROM students s
JOIN users u ON u.id = s.user_id
JOIN payment_concepts c ON c.name = 'Colegiatura mensual'
WHERE u.email = 'alumno1@escuelapass.local'
  AND NOT EXISTS (
    SELECT 1 FROM debts d JOIN payment_concepts pc ON pc.id = d.concept_id
    WHERE d.student_id = s.id AND pc.name = 'Colegiatura mensual' AND d.status = 'PENDIENTE'
  );

INSERT INTO debts (student_id, concept_id, amount, due_date, status, description, voucher_path, uploaded_by_parent_id, uploaded_at, verified_by_admin_id, verified_at, notes)
SELECT s.id, c.id, 450.00, CURRENT_DATE - 5, 'PAGADO', 'Material pagado', '/uploads/comprobantes/demo1.pdf',
       p.id, NOW() - INTERVAL '3 days', ast.id, NOW() - INTERVAL '2 days', 'Verificado en oficina'
FROM students s
JOIN users u ON u.id = s.user_id
JOIN payment_concepts c ON c.name = 'Material didáctico'
JOIN parents p ON p.user_id = (SELECT id FROM users WHERE email = 'padre2@escuelapass.local' LIMIT 1)
JOIN administrative_staff ast
  ON ast.user_id = (SELECT id FROM users WHERE email = 'staff@escuelapass.local' LIMIT 1)
WHERE u.email = 'alumno2@escuelapass.local'
  AND NOT EXISTS (SELECT 1 FROM debts d WHERE d.student_id = s.id AND d.description = 'Material pagado');

-- Pago asociado al adeudo pagado (último debt PAGADO de alumno2 material)
INSERT INTO payments (debt_id, payment_date, amount_paid, payment_method, reference_number, verified_by_admin_id, verified_at, notes)
SELECT d.id, CURRENT_DATE - 4, 450.00, 'TRANSFERENCIA', 'TRF-DEMO-001', ast.id, NOW() - INTERVAL '2 days', 'Pago demo'
FROM debts d
JOIN students s ON s.id = d.student_id
JOIN users u ON u.id = s.user_id
JOIN administrative_staff ast
  ON ast.user_id = (SELECT id FROM users WHERE email = 'staff@escuelapass.local' LIMIT 1)
WHERE u.email = 'alumno2@escuelapass.local' AND d.status = 'PAGADO' AND d.description = 'Material pagado'
  AND NOT EXISTS (SELECT 1 FROM payments p WHERE p.debt_id = d.id);

INSERT INTO debts (student_id, concept_id, amount, due_date, status, description)
SELECT s.id, c.id, 200.00, CURRENT_DATE - 40, 'VENCIDO', 'Evento no pagado a tiempo'
FROM students s
JOIN users u ON u.id = s.user_id
JOIN payment_concepts c ON c.name = 'Evento cultural'
WHERE u.email = 'alumno1@escuelapass.local'
  AND NOT EXISTS (SELECT 1 FROM debts d WHERE d.student_id = s.id AND d.status = 'VENCIDO');

-- ---------- Asistencia ----------
INSERT INTO attendance_records (student_id, group_id, attendance_date, status, notes, registered_by)
SELECT s.id, s.group_id, CURRENT_DATE, 'PRESENTE', 'Lista matutina', (SELECT id FROM users WHERE email = 'docente1@escuelapass.local')
FROM students s
JOIN users u ON u.id = s.user_id
WHERE u.email = 'alumno1@escuelapass.local'
ON CONFLICT (student_id, attendance_date) DO NOTHING;

INSERT INTO attendance_records (student_id, group_id, attendance_date, status, notes, registered_by)
SELECT s.id, s.group_id, CURRENT_DATE - 1, 'RETARDO', 'Llegó 15 min tarde', (SELECT id FROM users WHERE email = 'docente1@escuelapass.local')
FROM students s
JOIN users u ON u.id = s.user_id
WHERE u.email = 'alumno2@escuelapass.local'
ON CONFLICT (student_id, attendance_date) DO NOTHING;

INSERT INTO attendance_records (student_id, group_id, attendance_date, status, notes, registered_by)
SELECT s.id, s.group_id, CURRENT_DATE - 2, 'AUSENTE', 'Justificado por cita médica', (SELECT id FROM users WHERE email = 'docente2@escuelapass.local')
FROM students s
JOIN users u ON u.id = s.user_id
WHERE u.email = 'alumno2@escuelapass.local'
ON CONFLICT (student_id, attendance_date) DO NOTHING;

-- ---------- Calendario: día no lectivo global y por grupo ----------
INSERT INTO school_non_instructional_days (exception_date, group_id, reason, created_by)
SELECT '2026-12-25'::DATE, NULL, 'Navidad — suspensión general', u.id
FROM users u WHERE u.email = 'admin@escuelapass.local'
  AND NOT EXISTS (
    SELECT 1 FROM school_non_instructional_days x WHERE x.exception_date = '2026-12-25'::DATE AND x.group_id IS NULL
  );

INSERT INTO school_non_instructional_days (exception_date, group_id, reason, created_by)
SELECT '2026-11-02'::DATE, g.id, 'Día de muertos — solo 1A', u.id
FROM users u
JOIN groups g ON g.name = '1A' AND g.school_year = '2026-2027'
WHERE u.email = 'admin@escuelapass.local'
  AND NOT EXISTS (
    SELECT 1 FROM school_non_instructional_days x WHERE x.exception_date = '2026-11-02'::DATE AND x.group_id = g.id
  );

-- ---------- Ajustes institución ----------
INSERT INTO institution_settings (setting_key, value)
VALUES
  ('institution.name', 'Colegio Demo Escuela Pass'),
  ('institution.phone', '+52 55 1234 5678'),
  ('circuit.enabled', 'true')
ON CONFLICT (setting_key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP;

-- ---------- Calificaciones ----------
INSERT INTO grades (student_id, group_id, subject, period, assessment_name, score, max_score, notes, graded_by)
SELECT s.id, s.group_id, 'Matemáticas', 'P1', 'Examen parcial', 8.50, 10.0, 'Buen desempeño', u.id
FROM students s
JOIN users u ON u.id = (SELECT id FROM users WHERE email = 'docente1@escuelapass.local')
JOIN users su ON su.id = s.user_id
WHERE su.email = 'alumno1@escuelapass.local'
ON CONFLICT (student_id, subject, period, assessment_name) DO NOTHING;

INSERT INTO grades (student_id, group_id, subject, period, assessment_name, score, max_score, notes, graded_by)
SELECT s.id, s.group_id, 'Lengua', 'P1', 'Examen parcial', 9.00, 10.0, NULL, u.id
FROM students s
JOIN users u ON u.id = (SELECT id FROM users WHERE email = 'docente2@escuelapass.local')
JOIN users su ON su.id = s.user_id
WHERE su.email = 'alumno2@escuelapass.local'
ON CONFLICT (student_id, subject, period, assessment_name) DO NOTHING;

-- ---------- Importación demo ----------
INSERT INTO import_jobs (kind, total_rows, created_count, error_count, dry_run, errors_json)
SELECT 'students', 120, 118, 2, false, '{"row":[45,88],"msg":["email duplicado","grupo inválido"]}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM import_jobs WHERE kind = 'students' AND total_rows = 120);

-- ---------- Visitas (estados variados) ----------
INSERT INTO visit_requests (parent_id, student_id, visit_datetime, reason, status)
SELECT p.id, s.id, NOW() + INTERVAL '3 days', 'Entrega de documentos', 'PENDIENTE'
FROM parents p
JOIN users pu ON pu.id = p.user_id
JOIN students s ON TRUE
JOIN users su ON su.id = s.user_id
WHERE pu.email = 'padre1@escuelapass.local' AND su.email = 'alumno1@escuelapass.local'
  AND NOT EXISTS (SELECT 1 FROM visit_requests v WHERE v.parent_id = p.id AND v.status = 'PENDIENTE' AND v.reason = 'Entrega de documentos');

INSERT INTO visit_requests (parent_id, student_id, visit_datetime, reason, status)
SELECT p.id, s.id, NOW() - INTERVAL '1 day', 'Entrevista', 'APROBADA'
FROM parents p
JOIN users pu ON pu.id = p.user_id
JOIN students s ON TRUE
JOIN users su ON su.id = s.user_id
WHERE pu.email = 'padre2@escuelapass.local' AND su.email = 'alumno2@escuelapass.local'
  AND NOT EXISTS (SELECT 1 FROM visit_requests v WHERE v.status = 'APROBADA' AND v.parent_id = p.id);

INSERT INTO visit_requests (parent_id, student_id, visit_datetime, reason, status)
SELECT p.id, s.id, NOW() - INTERVAL '10 days', 'Seguimiento', 'REALIZADA'
FROM parents p
JOIN users pu ON pu.id = p.user_id
JOIN students s ON TRUE
JOIN users su ON su.id = s.user_id
WHERE pu.email = 'padre1@escuelapass.local' AND su.email = 'alumno1@escuelapass.local'
  AND NOT EXISTS (SELECT 1 FROM visit_requests v WHERE v.status = 'REALIZADA');

INSERT INTO visit_requests (parent_id, student_id, visit_datetime, reason, status)
SELECT p.id, s.id, NOW() + INTERVAL '1 day', 'Cancelada por usuario', 'CANCELADA'
FROM parents p
JOIN users pu ON pu.id = p.user_id
JOIN students s ON TRUE
JOIN users su ON su.id = s.user_id
WHERE pu.email = 'padre2@escuelapass.local' AND su.email = 'alumno2@escuelapass.local'
  AND NOT EXISTS (SELECT 1 FROM visit_requests v WHERE v.status = 'CANCELADA');

INSERT INTO visit_requests (parent_id, student_id, visit_datetime, reason, status)
SELECT p.id, s.id, NOW() - INTERVAL '2 days', 'Sin cupo', 'RECHAZADA'
FROM parents p
JOIN users pu ON pu.id = p.user_id
JOIN students s ON TRUE
JOIN users su ON su.id = s.user_id
WHERE pu.email = 'padre1@escuelapass.local' AND su.email = 'alumno1@escuelapass.local'
  AND NOT EXISTS (SELECT 1 FROM visit_requests v WHERE v.status = 'RECHAZADA');

-- ---------- Reuniones padre–docente ----------
INSERT INTO parent_teacher_meetings (parent_id, teacher_id, student_id, meeting_datetime, duration_minutes, topic, notes, status)
SELECT pr.id, t.id, s.id, NOW() + INTERVAL '5 days', 45, 'Rendimiento académico', NULL, 'PENDIENTE'
FROM parents pr
JOIN users pu ON pu.id = pr.user_id AND pu.email = 'padre1@escuelapass.local'
JOIN students s ON TRUE
JOIN users su ON su.id = s.user_id AND su.email = 'alumno1@escuelapass.local'
JOIN teachers t ON t.employee_number = 'DOC-0001'
WHERE NOT EXISTS (
    SELECT 1 FROM parent_teacher_meetings m
    WHERE m.parent_id = pr.id AND m.student_id = s.id AND m.topic = 'Rendimiento académico'
  );

INSERT INTO parent_teacher_meetings (parent_id, teacher_id, student_id, meeting_datetime, duration_minutes, topic, notes, status)
SELECT pr.id, t.id, s.id, NOW() - INTERVAL '2 days', 30, 'Seguimiento', 'Acuerdos de lectura', 'REALIZADA'
FROM parents pr
JOIN users pu ON pu.id = pr.user_id
JOIN teachers t ON t.employee_number = 'DOC-0002'
JOIN students s ON TRUE
JOIN users su ON su.id = s.user_id
WHERE pu.email = 'padre2@escuelapass.local' AND su.email = 'alumno2@escuelapass.local'
  AND NOT EXISTS (SELECT 1 FROM parent_teacher_meetings m WHERE m.status = 'REALIZADA' AND m.topic = 'Seguimiento');

-- ---------- Horarios de clase ----------
INSERT INTO class_schedule_slots (group_id, weekday, start_time, end_time, subject_id, teacher_id, room)
SELECT g.id, 1, '08:00'::TIME, '09:30'::TIME, sub.id, t.id, 'A-101'
FROM groups g
JOIN subjects sub ON sub.name = 'Matemáticas'
JOIN teachers t ON t.employee_number = 'DOC-0001'
WHERE g.name = '1A' AND g.school_year = '2026-2027'
  AND NOT EXISTS (
    SELECT 1 FROM class_schedule_slots cs WHERE cs.group_id = g.id AND cs.weekday = 1 AND cs.start_time = '08:00'::TIME
  );

INSERT INTO class_schedule_slots (group_id, weekday, start_time, end_time, subject_id, teacher_id, room)
SELECT g.id, 3, '10:00'::TIME, '11:00'::TIME, sub.id, t.id, 'B-205'
FROM groups g
JOIN subjects sub ON sub.name = 'Lengua'
JOIN teachers t ON t.employee_number = 'DOC-0002'
WHERE g.name = '2B' AND g.school_year = '2026-2027'
  AND NOT EXISTS (
    SELECT 1 FROM class_schedule_slots cs WHERE cs.group_id = g.id AND cs.weekday = 3 AND cs.start_time = '10:00'::TIME
  );

-- ---------- FCM (tokens ficticios) ----------
INSERT INTO user_fcm_tokens (user_id, token, platform)
SELECT u.id, 'fcm-demo-token-' || u.id::TEXT, 'web'
FROM users u WHERE u.email IN ('admin@escuelapass.local', 'padre1@escuelapass.local', 'docente1@escuelapass.local')
ON CONFLICT (token) DO NOTHING;

-- ---------- Auditoría ----------
INSERT INTO audit_logs (user_id, action, entity_type, entity_id, metadata, ip_address)
SELECT u.id, 'settings.updated', 'institution', NULL, '{"key":"institution.name"}'::jsonb, '192.168.1.10'::INET
FROM users u WHERE u.email = 'admin@escuelapass.local';

-- ---------- Política v2 y aceptaciones ----------
INSERT INTO privacy_policies (version, title, content, effective_at)
SELECT '2.0', 'Política de privacidad v2 (demo)', 'Texto ampliado para pruebas: tratamiento de datos, conservación, derechos ARCO y contacto del responsable.', NOW() - INTERVAL '2 days'
WHERE NOT EXISTS (SELECT 1 FROM privacy_policies WHERE version = '2.0');

INSERT INTO user_privacy_acceptances (user_id, policy_version, accepted_at, ip_address)
SELECT u.id, '1.0', NOW() - INTERVAL '30 days', '127.0.0.1'::INET
FROM users u WHERE u.email = 'admin@escuelapass.local'
ON CONFLICT DO NOTHING;

INSERT INTO user_privacy_acceptances (user_id, policy_version, accepted_at, ip_address)
SELECT u.id, '2.0', NOW() - INTERVAL '1 day', '10.0.0.1'::INET
FROM users u WHERE u.email IN ('padre1@escuelapass.local', 'docente1@escuelapass.local', 'staff@escuelapass.local')
ON CONFLICT DO NOTHING;

-- Celulares para cualquier usuario demo aún sin número
UPDATE users u
SET phone = sub.gen_phone
FROM (
  SELECT
    id,
    '+52 55 5100 ' || LPAD(ROW_NUMBER() OVER (ORDER BY email)::text, 4, '0') AS gen_phone
  FROM users
  WHERE phone IS NULL OR TRIM(phone) = ''
) sub
WHERE u.id = sub.id;

COMMIT;

-- =============================================================
-- RESUMEN DE ACCESO (además de seed_dev.sql)
-- staff@escuelapass.local     / Pass123*
-- docente2@escuelapass.local  / Pass123*
-- padre2@escuelapass.local    / Pass123*
-- alumno2@escuelapass.local   / Pass123*
-- (Los usuarios seed_dev siguen: Admin123*, Docente123*, etc.)
-- =============================================================
