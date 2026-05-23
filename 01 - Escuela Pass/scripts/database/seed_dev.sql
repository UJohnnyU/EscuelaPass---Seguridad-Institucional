/*
Escuela Pass — Proprietary Software License
Copyright (c) 2026 Murillo Martínez Jhon Kevin. All Rights Reserved.

NOTICE: This software and associated documentation files (the "Software")
constitute proprietary intellectual property. Unauthorized use is prohibited.

1. GRANT OF RIGHTS
   No license is granted to any person or entity except as expressly set
   forth in a separate written agreement signed by the copyright holder.

2. RESTRICTIONS
   Without prior written permission from the copyright holder, you may NOT:
   (a) copy, modify, adapt, translate, or create derivative works of the Software;
   (b) reverse engineer, decompile, or disassemble the Software, except as
       permitted by applicable law;
   (c) distribute, sublicense, lease, rent, sell, or otherwise transfer the
       Software or any portion thereof;
   (d) use the Software for commercial purposes, including offering it as a
       hosted service to third parties;
   (e) remove or alter any proprietary notices, labels, or marks.

3. THIRD-PARTY COMPONENTS
   The Software may include or depend on third-party open-source components
   licensed under their own terms (see package manifests and NOTICE files).
   Those components remain governed by their respective licenses. This license
   applies only to the original work of the copyright holder.

4. ACADEMIC REPOSITORY (POLI JIC)
   A non-exclusive, royalty-free, limited license is granted to Politécnico
   Colombiano Jaime Isaza Cadavid solely to archive, reproduce, and make
   available the version of the Software submitted as part of the author's
   degree thesis for academic, educational, and non-commercial public
   consultation purposes, in accordance with institutional publication
   authorization. This does not grant commercial exploitation rights to
   the institution or to third parties.

5. NO WARRANTY
   THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
   IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY,
   FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. IN NO EVENT SHALL
   THE COPYRIGHT HOLDER BE LIABLE FOR ANY CLAIM, DAMAGES, OR OTHER LIABILITY.

6. GOVERNING LAW
   This license shall be governed by the laws of the Republic of Colombia,
   without regard to conflict-of-law principles.

7. CONTACT
   For licensing inquiries: jhonkevinmurillom@gmail.com

---

Resumen en español:
Software propietario de Murillo Martínez Jhon Kevin (2026). Queda prohibida la
copia, modificación, distribución o explotación comercial sin autorización
escrita. El POLI JIC cuenta con autorización limitada, no exclusiva y sin
fines de lucro, para archivo y consulta académica de la versión entregada
como Trabajo de Grado. Los componentes de terceros se rigen por sus propias
licencias.
*/

-- =============================================================
-- ESCUELA PASS - SEED DEV (solo desarrollo / staging)
-- Datos mínimos para pruebas funcionales en Swagger/Postman.
-- Prerrequisito: esquema vía `npm run db:apply` o migraciones TypeORM.
-- =============================================================

BEGIN;

-- 0) Escuelas base multi-tenant
INSERT INTO schools (name, code, status)
VALUES
  ('Escuela principal', 'ESCUELA-PRINCIPAL', true),
  ('Escuela Sur', 'ESCUELA-SUR', true)
ON CONFLICT (code) DO NOTHING;

-- 1) Usuarios base (idempotente)
INSERT INTO users (email, password_hash, role, full_name, can_access_campus)
VALUES
  ('admin@escuelapass.local', crypt('Admin123*', gen_salt('bf')), 'ADMIN', 'Administrador General', true),
  ('docente1@escuelapass.local', crypt('Docente123*', gen_salt('bf')), 'DOCENTE', 'Docente Uno', true),
  ('padre1@escuelapass.local', crypt('Padre123*', gen_salt('bf')), 'PADRE', 'Padre Uno', true),
  ('alumno1@escuelapass.local', crypt('Alumno123*', gen_salt('bf')), 'ALUMNO', 'Alumno Uno', true)
ON CONFLICT (email) DO NOTHING;

-- Asignar escuela principal a usuarios base
UPDATE users u
SET school_id = s.id
FROM schools s
WHERE s.code = 'ESCUELA-PRINCIPAL'
  AND u.email IN ('admin@escuelapass.local', 'docente1@escuelapass.local', 'padre1@escuelapass.local', 'alumno1@escuelapass.local');

-- 2) Grupo base
INSERT INTO groups (name, grade, shift, school_year, classroom, capacity, status, school_id)
SELECT '1A', '1RO', 'MATUTINO', '2026-2027', 'A-101', 30, true, s.id
FROM schools s
WHERE s.code = 'ESCUELA-PRINCIPAL'
  AND NOT EXISTS (
    SELECT 1 FROM groups g WHERE g.name = '1A' AND g.school_year = '2026-2027' AND g.school_id = s.id
  );

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

-- Celulares demo (perfil / contactos)
UPDATE users SET phone = v.phone
FROM (VALUES
  ('admin@escuelapass.local', '+52 55 5000 0001'),
  ('docente1@escuelapass.local', '+52 55 5000 0002'),
  ('padre1@escuelapass.local', '+52 55 5000 0003'),
  ('alumno1@escuelapass.local', '+52 55 5000 0004')
) AS v(email, phone)
WHERE users.email = v.email;

-- Anotación demo para notificación a familia (alumno1)
INSERT INTO student_attention_notes (student_id, created_by_user_id, severity, title, description, occurred_at, notified_parent)
SELECT s.id, t.user_id, 'MODERADA', 'Incumplimiento de tarea', 'No entregó actividad de matemáticas en la fecha indicada.', NOW() - INTERVAL '2 days', true
FROM students s
JOIN users su ON su.id = s.user_id
JOIN teachers t ON TRUE
JOIN users tu ON tu.id = t.user_id
WHERE su.email = 'alumno1@escuelapass.local' AND tu.email = 'docente1@escuelapass.local'
  AND NOT EXISTS (
    SELECT 1 FROM student_attention_notes n
    WHERE n.student_id = s.id AND n.title = 'Incumplimiento de tarea'
  );

INSERT INTO notifications (user_id, notice_id, title, message, delivery_status)
SELECT pu.id, NULL, 'Llamado de atención (moderada)', 'Incumplimiento de tarea: No entregó actividad de matemáticas en la fecha indicada.', 'SENT'
FROM users pu
WHERE pu.email = 'padre1@escuelapass.local'
  AND NOT EXISTS (
    SELECT 1 FROM notifications n
    WHERE n.user_id = pu.id AND n.title = 'Llamado de atención (moderada)'
  );

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
