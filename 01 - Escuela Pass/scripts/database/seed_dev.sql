-- =============================================================
-- ESCUELA PASS - SEED DEV
-- Datos mínimos para pruebas funcionales en Swagger/Postman
-- =============================================================

BEGIN;

-- 1) Usuarios base (idempotente)
INSERT INTO users (email, password_hash, role, full_name, can_access_campus)
VALUES
  ('admin@escuelapass.local', crypt('Admin123*', gen_salt('bf')), 'ADMIN', 'Administrador General', true),
  ('docente1@escuelapass.local', crypt('Docente123*', gen_salt('bf')), 'DOCENTE', 'Docente Uno', true),
  ('padre1@escuelapass.local', crypt('Padre123*', gen_salt('bf')), 'PADRE', 'Padre Uno', true),
  ('alumno1@escuelapass.local', crypt('Alumno123*', gen_salt('bf')), 'ALUMNO', 'Alumno Uno', true)
ON CONFLICT (email) DO NOTHING;

-- 2) Grupo base
INSERT INTO groups (name, grade, shift, school_year, classroom, capacity, status)
VALUES ('1A', '1RO', 'MATUTINO', '2026-2027', 'A-101', 30, true)
ON CONFLICT (name, school_year) DO NOTHING;

-- 3) Perfiles con IDs resueltos dinámicamente
INSERT INTO teachers (user_id, employee_number)
SELECT u.id, 'DOC-0001'
FROM users u
WHERE u.email = 'docente1@escuelapass.local'
ON CONFLICT (employee_number) DO NOTHING;

INSERT INTO parents (user_id, is_primary_contact)
SELECT u.id, true
FROM users u
WHERE u.email = 'padre1@escuelapass.local'
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO students (user_id, matricula, group_id, can_leave_alone)
SELECT u.id, 'A-0001', g.id, false
FROM users u
LEFT JOIN groups g ON g.name = '1A' AND g.school_year = '2026-2027'
WHERE u.email = 'alumno1@escuelapass.local'
ON CONFLICT (matricula) DO NOTHING;

-- 4) Relación alumno-padre (sin IDs hardcodeados)
INSERT INTO student_parents (student_id, parent_id, relationship, is_primary, can_pickup)
SELECT s.id, p.id, 'PADRE', true, true
FROM students s
JOIN users su ON su.id = s.user_id
JOIN parents p ON TRUE
JOIN users pu ON pu.id = p.user_id
WHERE su.email = 'alumno1@escuelapass.local'
  AND pu.email = 'padre1@escuelapass.local'
ON CONFLICT (student_id, parent_id) DO NOTHING;

-- 5) Vehículo del padre
INSERT INTO vehicles (parent_id, plate, description, brand, model, color, year, is_active)
SELECT p.id, 'ABC123', 'Vehículo familiar', 'Toyota', 'Corolla', 'Blanco', 2020, true
FROM parents p
JOIN users pu ON pu.id = p.user_id
WHERE pu.email = 'padre1@escuelapass.local'
ON CONFLICT (parent_id, plate) DO NOTHING;

-- 6) Autorización de recogida
INSERT INTO pickup_authorizations (student_id, parent_id, vehicle_id, is_default, is_active, notes)
SELECT s.id, p.id, v.id, true, true, 'Autorización principal'
FROM students s
JOIN users su ON su.id = s.user_id
JOIN parents p ON TRUE
JOIN users pu ON pu.id = p.user_id
LEFT JOIN vehicles v ON v.parent_id = p.id AND v.plate = 'ABC123'
WHERE su.email = 'alumno1@escuelapass.local'
  AND pu.email = 'padre1@escuelapass.local'
  AND NOT EXISTS (
    SELECT 1 FROM pickup_authorizations pa
    WHERE pa.student_id = s.id AND pa.parent_id = p.id
  );

-- 7) Credenciales QR/NFC por email
INSERT INTO access_credentials (user_id, credential_type, credential_value, status)
SELECT u.id, 'QR', 'QR_ALUMNO_0001', 'ACTIVE'
FROM users u
WHERE u.email = 'alumno1@escuelapass.local'
ON CONFLICT (credential_type, credential_value) DO NOTHING;

INSERT INTO access_credentials (user_id, credential_type, credential_value, status)
SELECT u.id, 'NFC', 'NFC_ALUMNO_0001', 'ACTIVE'
FROM users u
WHERE u.email = 'alumno1@escuelapass.local'
ON CONFLICT (credential_type, credential_value) DO NOTHING;

INSERT INTO access_credentials (user_id, credential_type, credential_value, status)
SELECT u.id, 'QR', 'QR_DOCENTE_0001', 'ACTIVE'
FROM users u
WHERE u.email = 'docente1@escuelapass.local'
ON CONFLICT (credential_type, credential_value) DO NOTHING;

INSERT INTO access_credentials (user_id, credential_type, credential_value, status)
SELECT u.id, 'NFC', 'NFC_DOCENTE_0001', 'ACTIVE'
FROM users u
WHERE u.email = 'docente1@escuelapass.local'
ON CONFLICT (credential_type, credential_value) DO NOTHING;

INSERT INTO privacy_policies (version, title, content, effective_at)
SELECT
  '1.0',
  'Política de tratamiento de datos personales',
  'El tratamiento de datos personales en Escuela Pass se realiza conforme a la normativa aplicable en materia de protección de datos. Los datos se utilizan para la gestión académica y administrativa, seguridad del campus, comunicaciones institucionales y cumplimiento de obligaciones legales. El titular puede ejercer derechos de consulta, rectificación o supresión ante la institución, salvo excepciones legales.',
  CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM privacy_policies WHERE version = '1.0');

COMMIT;

-- =============================================================
-- USUARIOS DE PRUEBA
-- admin@escuelapass.local  / Admin123*
-- docente1@escuelapass.local / Docente123*
-- padre1@escuelapass.local   / Padre123*
-- alumno1@escuelapass.local  / Alumno123*
-- =============================================================
-- Para asignar docente al grupo 1A (asistencia / avisos GROUP), ver docs/technical-setup.md
-- =============================================================
