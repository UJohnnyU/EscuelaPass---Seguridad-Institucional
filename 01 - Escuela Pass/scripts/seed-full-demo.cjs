'use strict';
/**
 * ESCUELA PASS — Seed completo de demostración
 *
 * Crea datos realistas de producción:
 *   • 2 administradores globales
 *   • 3 colegios (Bogotá, Medellín, Cali)
 *   • Por colegio: 10 docentes, 10 estudiantes, ~18 padres, 2 administrativos,
 *     3 grupos, 5 materias, periodos académicos, asistencia 30 días,
 *     actividades, calificaciones, deudas, pagos, avisos, reuniones,
 *     visitas, anotaciones, reportes admin, circuitos.
 *
 * Contraseña de todos los usuarios: Escuela2026!
 *
 * Uso:
 *   railway run --service "EscuelaPass---Seguridad-Institucional" node scripts/seed-full-demo.cjs
 */

const bcrypt = require('bcrypt');
const { Client } = require('pg');

// ──────────────────────────────────────────────
// DATOS BASE
// ──────────────────────────────────────────────
const PASS = 'Escuela2026!';
const YEAR = '2026';

const SCHOOLS_DEF = [
  {
    name: 'Institución Educativa San José',
    code: 'IESJ',
    city: 'Bogotá',
    address: 'Cra 7 # 45-23, Barrio La Candelaria',
    phone: '6012345678',
    email: 'rectoria@iesanjose.edu.co',
    director: 'Mg. Ramón Pizarro Ávila',
    lat: '4.60971000',
    lon: '-74.08175000',
    prefix: 'IESJ',
    motto: 'Educamos para la vida, formamos para la excelencia'
  },
  {
    name: 'Colegio Técnico Nacional',
    code: 'CTN',
    city: 'Medellín',
    address: 'Av. El Poblado # 12-45, Laureles',
    phone: '6047654321',
    email: 'contacto@colegiотечnico.edu.co',
    director: 'Ph.D. Esperanza Ríos Montoya',
    lat: '6.25184000',
    lon: '-75.56359000',
    prefix: 'CTN',
    motto: 'Tecnología, innovación y desarrollo humano'
  },
  {
    name: 'Institución Bilingüe del Valle',
    code: 'IBV',
    city: 'Cali',
    address: 'Cl 5N # 38-45, Ciudad Jardín',
    phone: '6023456789',
    email: 'info@ibvalle.edu.co',
    director: 'Dr. Mauricio Sandoval Córdoba',
    lat: '3.45165000',
    lon: '-76.53198000',
    prefix: 'IBV',
    motto: 'Bilingüismo, cultura y excelencia académica'
  }
];

// Teachers por colegio (10 por colegio)
const TEACHERS_BY_SCHOOL = [
  [ // IESJ
    { fn: 'Carlos', ln: 'Rodríguez Peña',    email: 'c.rodriguez', phone: '3101234501' },
    { fn: 'María',  ln: 'García Suárez',      email: 'm.garcia',    phone: '3101234502' },
    { fn: 'Juan',   ln: 'Martínez Fonseca',   email: 'j.martinez',  phone: '3101234503' },
    { fn: 'Ana',    ln: 'López Castillo',      email: 'a.lopez',     phone: '3101234504' },
    { fn: 'Pedro',  ln: 'Hernández Quiroga',   email: 'p.hernandez', phone: '3101234505' },
    { fn: 'Laura',  ln: 'Gómez Varela',        email: 'l.gomez',     phone: '3101234506' },
    { fn: 'Roberto',ln: 'Díaz Montoya',        email: 'r.diaz',      phone: '3101234507' },
    { fn: 'Isabel', ln: 'Torres Acosta',       email: 'i.torres',    phone: '3101234508' },
    { fn: 'Miguel', ln: 'Vargas Ospina',       email: 'm.vargas',    phone: '3101234509' },
    { fn: 'Sofía',  ln: 'Reyes Buenaventura',  email: 's.reyes',     phone: '3101234510' }
  ],
  [ // CTN
    { fn: 'Andrés',  ln: 'Patiño Londoño',    email: 'a.patino',    phone: '3152345601' },
    { fn: 'Paola',   ln: 'Cardona Mejía',      email: 'p.cardona',   phone: '3152345602' },
    { fn: 'Diego',   ln: 'Arango Betancur',    email: 'd.arango',    phone: '3152345603' },
    { fn: 'Natalia', ln: 'Salazar Restrepo',   email: 'n.salazar',   phone: '3152345604' },
    { fn: 'Hernán',  ln: 'Cano Valencia',      email: 'h.cano',      phone: '3152345605' },
    { fn: 'Claudia', ln: 'Vélez Giraldo',      email: 'c.velez',     phone: '3152345606' },
    { fn: 'Gabriel', ln: 'Muñoz Álvarez',      email: 'g.munoz',     phone: '3152345607' },
    { fn: 'Patricia',ln: 'Ríos Estrada',       email: 'p.rios',      phone: '3152345608' },
    { fn: 'Sergio',  ln: 'Bedoya Zapata',      email: 's.bedoya',    phone: '3152345609' },
    { fn: 'Gloria',  ln: 'Hoyos Castaño',      email: 'g.hoyos',     phone: '3152345610' }
  ],
  [ // IBV
    { fn: 'Mauricio', ln: 'Sandoval Mina',      email: 'm.sandoval',  phone: '3183456701' },
    { fn: 'Sandra',   ln: 'Lozano Caicedo',     email: 's.lozano',    phone: '3183456702' },
    { fn: 'Oscar',    ln: 'Mosquera Prado',      email: 'o.mosquera',  phone: '3183456703' },
    { fn: 'Diana',    ln: 'Cabrera Ordóñez',     email: 'd.cabrera',   phone: '3183456704' },
    { fn: 'Ricardo',  ln: 'Pinto Vásquez',       email: 'r.pinto',     phone: '3183456705' },
    { fn: 'Martha',   ln: 'Useche Gallego',      email: 'm.useche',    phone: '3183456706' },
    { fn: 'Álvaro',   ln: 'Sinisterra Cruz',     email: 'a.sinisterra', phone: '3183456707' },
    { fn: 'Beatriz',  ln: 'Rengifo Castillo',    email: 'b.rengifo',   phone: '3183456708' },
    { fn: 'Fernando', ln: 'Orozco Zapata',       email: 'f.orozco',    phone: '3183456709' },
    { fn: 'Catalina', ln: 'Gutiérrez Borrero',   email: 'c.gutierrez', phone: '3183456710' }
  ]
];

// Estudiantes por colegio (10 por colegio, distribuidos en 3 grupos: 4-3-3)
const STUDENTS_BY_SCHOOL = [
  [ // IESJ
    { fn: 'Santiago',   ln: 'Castro Molina',    email: 'st.castro',   group: 0 },
    { fn: 'Valentina',  ln: 'Ruiz Serrano',      email: 'v.ruiz',      group: 0 },
    { fn: 'Andrés',     ln: 'Moreno Bernal',     email: 'an.moreno',   group: 0 },
    { fn: 'María',      ln: 'Jiménez Rondón',    email: 'ma.jimenez',  group: 0 },
    { fn: 'Daniel',     ln: 'Ramírez Cruz',       email: 'd.ramirez',   group: 1 },
    { fn: 'Camila',     ln: 'Torres Barrera',     email: 'ca.torres',   group: 1 },
    { fn: 'Felipe',     ln: 'Gutiérrez Niño',     email: 'f.gutierrez', group: 1 },
    { fn: 'Laura',      ln: 'Herrera Pedraza',    email: 'la.herrera',  group: 2 },
    { fn: 'Nicolás',    ln: 'Vargas Pinzón',      email: 'ni.vargas',   group: 2 },
    { fn: 'Alejandra',  ln: 'Ramos Téllez',       email: 'al.ramos',    group: 2 }
  ],
  [ // CTN
    { fn: 'Sebastián',  ln: 'Agudelo Ríos',      email: 'se.agudelo',  group: 0 },
    { fn: 'Isabella',   ln: 'Zapata Duque',       email: 'is.zapata',   group: 0 },
    { fn: 'Mateo',      ln: 'Giraldo Montoya',    email: 'ma.giraldo',  group: 0 },
    { fn: 'Sofía',      ln: 'Herrera Restrepo',   email: 'so.herrera',  group: 0 },
    { fn: 'Samuel',     ln: 'López Palomino',     email: 'sa.lopez',    group: 1 },
    { fn: 'Emma',       ln: 'Vargas Cano',        email: 'em.vargas',   group: 1 },
    { fn: 'Nicolás',    ln: 'Múnera Vélez',       email: 'ni.munera',   group: 1 },
    { fn: 'David',      ln: 'Pérez Bedoya',       email: 'da.perez',    group: 2 },
    { fn: 'Lucía',      ln: 'Estrada Álvarez',    email: 'lu.estrada',  group: 2 },
    { fn: 'Tomás',      ln: 'Hoyos Valencia',     email: 'to.hoyos',    group: 2 }
  ],
  [ // IBV
    { fn: 'Martín',     ln: 'Lozano Prado',       email: 'mr.lozano',   group: 0 },
    { fn: 'Valeria',    ln: 'Mosquera Caicedo',   email: 'va.mosquera', group: 0 },
    { fn: 'Miguel',     ln: 'Cabrera Sinisterra',  email: 'mi.cabrera',  group: 0 },
    { fn: 'Juliana',    ln: 'Pinto Rengifo',       email: 'ju.pinto',    group: 0 },
    { fn: 'Pablo',      ln: 'Orozco Mina',         email: 'pa.orozco',   group: 1 },
    { fn: 'Manuela',    ln: 'Gutiérrez Gallego',   email: 'ma.gutierrez', group: 1 },
    { fn: 'Carlos',     ln: 'Useche Borrero',      email: 'ca.useche',   group: 1 },
    { fn: 'Sara',       ln: 'Sandoval Vásquez',    email: 'sa.sandoval', group: 2 },
    { fn: 'Esteban',    ln: 'Cruz Ordóñez',        email: 'es.cruz',     group: 2 },
    { fn: 'Paula',      ln: 'Castillo Zapata',     email: 'pa.castillo', group: 2 }
  ]
];

// Padres por colegio — 2 por estudiantes 0-7, 1 por estudiantes 8-9
const PARENTS_BY_SCHOOL = [
  [ // IESJ — para los 10 estudiantes
    { fn: 'Pedro',    ln: 'Castro Lara',      email: 'pe.castro',   phone: '3201234001', student: 0, rel: 'Padre', primary: true },
    { fn: 'Ana',      ln: 'Molina de Castro', email: 'an.molina',   phone: '3201234002', student: 0, rel: 'Madre', primary: false },
    { fn: 'Carlos',   ln: 'Ruiz Blanco',      email: 'ca.ruiz',     phone: '3201234003', student: 1, rel: 'Padre', primary: true },
    { fn: 'Ingrid',   ln: 'Serrano de Ruiz',  email: 'in.serrano',  phone: '3201234004', student: 1, rel: 'Madre', primary: false },
    { fn: 'Pablo',    ln: 'Moreno Vega',       email: 'pa.moreno',   phone: '3201234005', student: 2, rel: 'Padre', primary: true },
    { fn: 'Martha',   ln: 'Bernal de Moreno', email: 'ma.bernal',   phone: '3201234006', student: 2, rel: 'Madre', primary: false },
    { fn: 'José',     ln: 'Jiménez Arenas',   email: 'jo.jimenez',  phone: '3201234007', student: 3, rel: 'Padre', primary: true },
    { fn: 'Carmen',   ln: 'Rondón de Jiménez',email: 'ca.rondon',   phone: '3201234008', student: 3, rel: 'Madre', primary: false },
    { fn: 'Fernando', ln: 'Ramírez Ávila',    email: 'fe.ramirez',  phone: '3201234009', student: 4, rel: 'Padre', primary: true },
    { fn: 'Beatriz',  ln: 'Cruz de Ramírez',  email: 'be.cruz',     phone: '3201234010', student: 4, rel: 'Madre', primary: false },
    { fn: 'Juan',     ln: 'Torres Rojas',      email: 'ju.torres',   phone: '3201234011', student: 5, rel: 'Padre', primary: true },
    { fn: 'Beatriz',  ln: 'Barrera de Torres', email: 'be.barrera',  phone: '3201234012', student: 5, rel: 'Madre', primary: false },
    { fn: 'Álvaro',   ln: 'Gutiérrez Parra',  email: 'al.gutierrez',phone: '3201234013', student: 6, rel: 'Padre', primary: true },
    { fn: 'Piedad',   ln: 'Niño de Gutiérrez',email: 'pi.nino',     phone: '3201234014', student: 6, rel: 'Madre', primary: false },
    { fn: 'Ricardo',  ln: 'Herrera Mejía',    email: 'ri.herrera',  phone: '3201234015', student: 7, rel: 'Padre', primary: true },
    { fn: 'María',    ln: 'Pedraza de Herrera',email: 'ma.pedraza', phone: '3201234016', student: 7, rel: 'Madre', primary: false },
    { fn: 'Ernesto',  ln: 'Vargas Cárdenas',  email: 'er.vargas',   phone: '3201234017', student: 8, rel: 'Padre', primary: true },
    { fn: 'Jorge',    ln: 'Ramos Baquero',    email: 'jo.ramos',    phone: '3201234018', student: 9, rel: 'Padre', primary: true }
  ],
  [ // CTN
    { fn: 'Javier',   ln: 'Agudelo Reyes',    email: 'ja.agudelo',  phone: '3152345701', student: 0, rel: 'Padre', primary: true },
    { fn: 'Lina',     ln: 'Ríos de Agudelo',  email: 'li.rios',     phone: '3152345702', student: 0, rel: 'Madre', primary: false },
    { fn: 'Oscar',    ln: 'Zapata Salinas',   email: 'os.zapata',   phone: '3152345703', student: 1, rel: 'Padre', primary: true },
    { fn: 'Claudia',  ln: 'Duque de Zapata',  email: 'cl.duque',    phone: '3152345704', student: 1, rel: 'Madre', primary: false },
    { fn: 'William',  ln: 'Giraldo Pardo',    email: 'wi.giraldo',  phone: '3152345705', student: 2, rel: 'Padre', primary: true },
    { fn: 'Sandra',   ln: 'Montoya de Giraldo',email: 'sa.montoya', phone: '3152345706', student: 2, rel: 'Madre', primary: false },
    { fn: 'Rodrigo',  ln: 'Herrera Cardona',  email: 'ro.herrera',  phone: '3152345707', student: 3, rel: 'Padre', primary: true },
    { fn: 'Ana',      ln: 'Restrepo de Herrera',email: 'an.restrepo',phone: '3152345708', student: 3, rel: 'Madre', primary: false },
    { fn: 'Efraín',   ln: 'López Ríos',       email: 'ef.lopez',    phone: '3152345709', student: 4, rel: 'Padre', primary: true },
    { fn: 'Marcela',  ln: 'Palomino de López',email: 'ma.palomino', phone: '3152345710', student: 4, rel: 'Madre', primary: false },
    { fn: 'Luis',     ln: 'Vargas Ospina',    email: 'lu.vargas',   phone: '3152345711', student: 5, rel: 'Padre', primary: true },
    { fn: 'Norela',   ln: 'Cano de Vargas',   email: 'no.cano',     phone: '3152345712', student: 5, rel: 'Madre', primary: false },
    { fn: 'Rubén',    ln: 'Múnera Arango',    email: 'ru.munera',   phone: '3152345713', student: 6, rel: 'Padre', primary: true },
    { fn: 'Patricia', ln: 'Vélez de Múnera',  email: 'pa.velez',    phone: '3152345714', student: 6, rel: 'Madre', primary: false },
    { fn: 'Fabio',    ln: 'Pérez Cárdenas',   email: 'fa.perez',    phone: '3152345715', student: 7, rel: 'Padre', primary: true },
    { fn: 'Olga',     ln: 'Bedoya de Pérez',  email: 'ol.bedoya',   phone: '3152345716', student: 7, rel: 'Madre', primary: false },
    { fn: 'Iván',     ln: 'Estrada Muñoz',    email: 'iv.estrada',  phone: '3152345717', student: 8, rel: 'Padre', primary: true },
    { fn: 'Gloria',   ln: 'Hoyos de Estrada', email: 'gl.hoyos',    phone: '3152345718', student: 9, rel: 'Madre', primary: true }
  ],
  [ // IBV
    { fn: 'Nelson',   ln: 'Lozano Angulo',    email: 'ne.lozano',   phone: '3183456801', student: 0, rel: 'Padre', primary: true },
    { fn: 'Yadira',   ln: 'Prado de Lozano',  email: 'ya.prado',    phone: '3183456802', student: 0, rel: 'Madre', primary: false },
    { fn: 'Harold',   ln: 'Mosquera Hurtado', email: 'ha.mosquera', phone: '3183456803', student: 1, rel: 'Padre', primary: true },
    { fn: 'Amparo',   ln: 'Caicedo de Mosquera',email: 'am.caicedo',phone: '3183456804', student: 1, rel: 'Madre', primary: false },
    { fn: 'Cristóbal',ln: 'Cabrera Riascos',  email: 'cr.cabrera',  phone: '3183456805', student: 2, rel: 'Padre', primary: true },
    { fn: 'Soledad',  ln: 'Sinisterra de Cabrera',email: 'so.sinisterra',phone: '3183456806', student: 2, rel: 'Madre', primary: false },
    { fn: 'Ramiro',   ln: 'Pinto Castaño',    email: 'ra.pinto',    phone: '3183456807', student: 3, rel: 'Padre', primary: true },
    { fn: 'Nubia',    ln: 'Rengifo de Pinto',  email: 'nu.rengifo',  phone: '3183456808', student: 3, rel: 'Madre', primary: false },
    { fn: 'Álvaro',   ln: 'Orozco Copete',    email: 'al.orozco',   phone: '3183456809', student: 4, rel: 'Padre', primary: true },
    { fn: 'Fabiola',  ln: 'Mina de Orozco',   email: 'fa.mina',     phone: '3183456810', student: 4, rel: 'Madre', primary: false },
    { fn: 'Germán',   ln: 'Gutiérrez Quiñones',email: 'ge.gutierrez',phone: '3183456811', student: 5, rel: 'Padre', primary: true },
    { fn: 'Patricia', ln: 'Gallego de Gutiérrez',email: 'pa.gallego',phone: '3183456812', student: 5, rel: 'Madre', primary: false },
    { fn: 'Rodrigo',  ln: 'Useche Paz',       email: 'ro.useche',   phone: '3183456813', student: 6, rel: 'Padre', primary: true },
    { fn: 'Carmen',   ln: 'Borrero de Useche',email: 'ca.borrero',  phone: '3183456814', student: 6, rel: 'Madre', primary: false },
    { fn: 'Iván',     ln: 'Sandoval Riascos', email: 'iv.sandoval', phone: '3183456815', student: 7, rel: 'Padre', primary: true },
    { fn: 'Adriana',  ln: 'Vásquez de Sandoval',email: 'ad.vasquez',phone: '3183456816', student: 7, rel: 'Madre', primary: false },
    { fn: 'Eduardo',  ln: 'Cruz Angulo',      email: 'ed.cruz',     phone: '3183456817', student: 8, rel: 'Padre', primary: true },
    { fn: 'Liliana',  ln: 'Zapata de Castillo',email: 'li.zapata',  phone: '3183456818', student: 9, rel: 'Madre', primary: true }
  ]
];

// Administrativos por colegio (2 por colegio)
const ADMINS_BY_SCHOOL = [
  [
    { fn: 'Sofía',   ln: 'Ruiz Montaño',   email: 'admin1.iesj', phone: '3211100001' },
    { fn: 'Diego',   ln: 'Mora Castañeda', email: 'admin2.iesj', phone: '3211100002' }
  ],
  [
    { fn: 'Viviana', ln: 'Arenas Urrego',  email: 'admin1.ctn',  phone: '3211100003' },
    { fn: 'Camilo',  ln: 'Jaramillo Toro', email: 'admin2.ctn',  phone: '3211100004' }
  ],
  [
    { fn: 'Patricia',ln: 'Ospina Daza',    email: 'admin1.ibv',  phone: '3211100005' },
    { fn: 'Gonzalo', ln: 'Zamora Mera',    email: 'admin2.ibv',  phone: '3211100006' }
  ]
];

const SUBJECTS_DEF = [
  { name: 'Matemáticas',        code: 'MAT', area: 'Ciencias Exactas',   level: 'Básica Secundaria' },
  { name: 'Español y Literatura',code: 'ESP', area: 'Humanidades',       level: 'Básica Secundaria' },
  { name: 'Ciencias Naturales', code: 'CN',  area: 'Ciencias Naturales', level: 'Básica Secundaria' },
  { name: 'Inglés',             code: 'ING', area: 'Idiomas',            level: 'Básica Secundaria' },
  { name: 'Educación Física',   code: 'EF',  area: 'Educación Física',   level: 'Básica Secundaria' }
];

const GROUPS_DEF = [
  { name: '6° A', grade: '6', shift: 'MATUTINO', classroom: 'Aula 101', capacity: 35 },
  { name: '7° A', grade: '7', shift: 'MATUTINO', classroom: 'Aula 201', capacity: 35 },
  { name: '8° A', grade: '8', shift: 'MATUTINO', classroom: 'Aula 301', capacity: 35 }
];

// Materias por docente (índice 0-4: MAT,ESP,CN,ING,EF; docentes 5-9 repiten ciclo)
const TEACHER_SUBJECT_IDX = [0, 1, 2, 3, 4, 0, 1, 2, 3, 4];

// ──────────────────────────────────────────────
// HELPERS
// ──────────────────────────────────────────────
function schoolDomain(code) {
  return `${code.toLowerCase()}.edu.co`;
}

/** Devuelve los últimos N días de semana (lunes-viernes) hacia atrás desde hoy */
function lastSchoolDays(n) {
  const days = [];
  const d = new Date();
  while (days.length < n) {
    d.setDate(d.getDate() - 1);
    const dow = d.getDay();
    if (dow >= 1 && dow <= 5) {
      days.push(new Date(d));
    }
  }
  return days.reverse();
}

function fmtDate(d) {
  return d.toISOString().slice(0, 10);
}

function rnd(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function rndInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function q(client, sql, params) {
  const r = await client.query(sql, params);
  return r;
}

// ──────────────────────────────────────────────
// TRUNCATE
// ──────────────────────────────────────────────
async function truncateAll(client) {
  console.log('[seed] Vaciando tablas…');
  // TRUNCATE con CASCADE: PostgreSQL elimina los registros en todas las tablas dependientes.
  // Se listan las tablas raíz más las que no tienen FK hacia otras que se truncan.
  await client.query(`
    TRUNCATE TABLE
      schools,
      users,
      payment_concepts,
      privacy_policies,
      institution_settings,
      import_jobs
    CASCADE
  `);
  // Restaurar la configuración de circuit.enabled que la app espera
  await client.query(`
    INSERT INTO institution_settings (setting_key, value)
    VALUES ('circuit.enabled', 'true')
    ON CONFLICT (setting_key) DO NOTHING
  `);
  console.log('[seed] Tablas vaciadas OK.');
}

// ──────────────────────────────────────────────
// POLÍTICA DE PRIVACIDAD
// ──────────────────────────────────────────────
async function createPrivacyPolicy(client) {
  const r = await q(client, `
    INSERT INTO privacy_policies (version, title, content, effective_at)
    VALUES ($1, $2, $3, NOW())
    RETURNING id
  `, [
    'v2.0.2026',
    'Política de Privacidad y Tratamiento de Datos Personales',
    `Escuela Pass cumple con la Ley 1581 de 2012 (Habeas Data) y el Decreto 1377 de 2013.
Los datos personales recolectados son utilizados exclusivamente para la gestión académica,
control de acceso y comunicación institucional. Los datos no son compartidos con terceros
sin consentimiento expreso. El titular puede ejercer sus derechos de acceso, rectificación,
supresión y portabilidad escribiendo a privacidad@escuelapass.com.
Versión 2.0 — Vigente desde enero 2026.`
  ]);
  return r.rows[0].id;
}

// ──────────────────────────────────────────────
// ADMINS GLOBALES
// ──────────────────────────────────────────────
async function createGlobalAdmins(client, hash, policyId) {
  const admins = [
    { fn: 'Administrador',  ln: 'Principal',     email: 'admin@escuelapass.com',    phone: '3000000001' },
    { fn: 'Administrador',  ln: 'del Sistema',   email: 'sistema@escuelapass.com',  phone: '3000000002' }
  ];
  const ids = [];
  for (const a of admins) {
    const ur = await q(client, `
      INSERT INTO users (email, password_hash, role, full_name, phone, can_access_campus, status)
      VALUES ($1, $2, 'ADMIN', $3, $4, TRUE, TRUE)
      RETURNING id
    `, [a.email, hash, `${a.fn} ${a.ln}`, a.phone]);
    const uid = ur.rows[0].id;
    ids.push(uid);
    await q(client, `
      INSERT INTO user_privacy_acceptances (user_id, policy_version, accepted_at, ip_address)
      VALUES ($1, $2, NOW(), '127.0.0.1')
    `, [uid, 'v2.0.2026']);
    await q(client, `
      INSERT INTO access_credentials (user_id, credential_type, credential_value, status)
      VALUES ($1, 'QR', $2, 'ACTIVE')
    `, [uid, `QR-ADMIN-${uid.slice(0, 8).toUpperCase()}`]);
  }
  console.log(`[seed] ${ids.length} administradores globales creados.`);
  return ids;
}

// ──────────────────────────────────────────────
// SEED POR COLEGIO
// ──────────────────────────────────────────────
async function populateSchool(client, schoolDef, si, hash, policyId, globalAdminIds) {
  const domain = schoolDomain(schoolDef.code);

  // 1. School
  const sr = await q(client, `
    INSERT INTO schools
      (name, code, city, address, phone, email, director_name, motto,
       max_grade_scale, passing_grade, min_failed_subjects_to_repeat,
       latitude, longitude, circuit_enabled, student_matricula_prefix, status,
       shift_matutino_start, shift_matutino_end,
       shift_vespertino_start, shift_vespertino_end,
       shift_nocturno_start, shift_nocturno_end)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,100,60,3,$9,$10,TRUE,$11,TRUE,
       '07:00:00', '13:00:00', '14:00:00', '19:00:00', '19:00:00', '22:00:00')
    RETURNING id
  `, [
    schoolDef.name, schoolDef.code, schoolDef.city, schoolDef.address,
    schoolDef.phone, schoolDef.email, schoolDef.director, schoolDef.motto,
    schoolDef.lat, schoolDef.lon, schoolDef.prefix
  ]);
  const schoolId = sr.rows[0].id;
  console.log(`[seed] Colegio "${schoolDef.name}" id=${schoolId}`);

  // 2. Grupos
  const groups = [];
  for (const gd of GROUPS_DEF) {
    const gr = await q(client, `
      INSERT INTO groups (name, grade, shift, school_year, classroom, capacity, status, school_id)
      VALUES ($1,$2,$3,$4,$5,$6,TRUE,$7)
      RETURNING id
    `, [gd.name, gd.grade, gd.shift, YEAR, gd.classroom, gd.capacity, schoolId]);
    groups.push({ id: gr.rows[0].id, ...gd });
  }

  // 3. Materias
  const subjects = [];
  for (const sd of SUBJECTS_DEF) {
    const subr = await q(client, `
      INSERT INTO subjects (name, code, school_id, area, education_level)
      VALUES ($1,$2,$3,$4,$5)
      RETURNING id
    `, [sd.name, `${sd.code}-${schoolDef.code}`, schoolId, sd.area, sd.level]);
    subjects.push({ id: subr.rows[0].id, ...sd });
  }

  // 4. Periodo académico activo
  const periodR = await q(client, `
    INSERT INTO academic_periods
      (school_id, school_year, name, order_index, start_date, end_date, weight, status)
    VALUES ($1,$2,'Primer Período',1,'2026-02-03','2026-04-25',25,'ACTIVE')
    RETURNING id
  `, [schoolId, YEAR]);
  const periodId = periodR.rows[0].id;

  // Periodos cerrados anteriores (para historial)
  const p2r = await q(client, `
    INSERT INTO academic_periods
      (school_id, school_year, name, order_index, start_date, end_date, weight, status, closed_at)
    VALUES ($1,$2,'Segundo Período',2,'2026-04-28','2026-07-11',25,'PLANNED',NULL)
    RETURNING id
  `, [schoolId, YEAR]);

  // 5. Administrativos
  const adminStaff = [];
  const adminDefs = ADMINS_BY_SCHOOL[si];
  for (let i = 0; i < adminDefs.length; i++) {
    const a = adminDefs[i];
    const ur = await q(client, `
      INSERT INTO users (email, password_hash, role, full_name, phone, can_access_campus, school_id, status)
      VALUES ($1,$2,'ADMINISTRATIVO',$3,$4,TRUE,$5,TRUE)
      RETURNING id
    `, [`${a.email}@${domain}`, hash, `${a.fn} ${a.ln}`, a.phone, schoolId]);
    const uid = ur.rows[0].id;
    const ar = await q(client, `
      INSERT INTO administrative_staff (user_id, employee_number)
      VALUES ($1,$2) RETURNING id
    `, [uid, `ADM-${schoolDef.code}-${String(i + 1).padStart(2, '0')}`]);
    const aid = ar.rows[0].id;
    adminStaff.push({ id: aid, userId: uid, fullName: `${a.fn} ${a.ln}` });
    await q(client, `
      INSERT INTO user_privacy_acceptances (user_id, policy_version, accepted_at, ip_address)
      VALUES ($1,'v2.0.2026',NOW(),'127.0.0.1')
    `, [uid]);
    await q(client, `
      INSERT INTO access_credentials (user_id, credential_type, credential_value, status)
      VALUES ($1,'QR',$2,'ACTIVE')
    `, [uid, `QR-${schoolDef.code}-ADM-${uid.slice(0, 8).toUpperCase()}`]);
  }

  // 6. Docentes
  const teachers = [];
  const teacherDefs = TEACHERS_BY_SCHOOL[si];
  for (let i = 0; i < teacherDefs.length; i++) {
    const t = teacherDefs[i];
    const ur = await q(client, `
      INSERT INTO users (email, password_hash, role, full_name, phone, can_access_campus, school_id, status)
      VALUES ($1,$2,'DOCENTE',$3,$4,TRUE,$5,TRUE)
      RETURNING id
    `, [`${t.email}@${domain}`, hash, `${t.fn} ${t.ln}`, t.phone, schoolId]);
    const uid = ur.rows[0].id;
    const tr = await q(client, `
      INSERT INTO teachers (user_id, employee_number, lifecycle_status)
      VALUES ($1,$2,'ACTIVO') RETURNING id
    `, [uid, `EMP-${schoolDef.code}-${String(i + 1).padStart(2, '0')}`]);
    const tid = tr.rows[0].id;
    teachers.push({ id: tid, userId: uid, fullName: `${t.fn} ${t.ln}`, subjectIdx: TEACHER_SUBJECT_IDX[i] });
    await q(client, `
      INSERT INTO user_privacy_acceptances (user_id, policy_version, accepted_at, ip_address)
      VALUES ($1,'v2.0.2026',NOW(),'127.0.0.1')
    `, [uid]);
    await q(client, `
      INSERT INTO access_credentials (user_id, credential_type, credential_value, status)
      VALUES ($1,'QR',$2,'ACTIVE')
    `, [uid, `QR-${schoolDef.code}-DOC-${uid.slice(0, 8).toUpperCase()}`]);
    // Credencial NFC para los primeros 5 docentes
    if (i < 5) {
      await q(client, `
        INSERT INTO access_credentials (user_id, credential_type, credential_value, status)
        VALUES ($1,'NFC',$2,'ACTIVE')
      `, [uid, `NFC-${schoolDef.code}-DOC-${uid.slice(0, 8).toUpperCase()}`]);
    }
    // teacher_subjects
    const subj = subjects[TEACHER_SUBJECT_IDX[i]];
    await q(client, `
      INSERT INTO teacher_subjects (teacher_id, subject_id) VALUES ($1,$2)
      ON CONFLICT DO NOTHING
    `, [tid, subj.id]);
    // Si el docente 5-9 también enseña otra materia
    if (i >= 5) {
      const extraSubj = subjects[(TEACHER_SUBJECT_IDX[i] + 1) % 5];
      await q(client, `
        INSERT INTO teacher_subjects (teacher_id, subject_id) VALUES ($1,$2)
        ON CONFLICT DO NOTHING
      `, [tid, extraSubj.id]);
    }
  }

  // 7. Asignación docente-grupo (teacher_groups)
  // Docentes 0-4: enseñan su materia en los 3 grupos (is_main_teacher en grupo asignado)
  // Docentes 5-9: enseñan en 1 grupo cada uno
  for (let i = 0; i < 5; i++) {
    const t = teachers[i];
    const subj = subjects[t.subjectIdx];
    for (let gi = 0; gi < groups.length; gi++) {
      await q(client, `
        INSERT INTO teacher_groups (teacher_id, group_id, subject_id, is_main_teacher, can_authorize_departures)
        VALUES ($1,$2,$3,$4,$5)
        ON CONFLICT DO NOTHING
      `, [t.id, groups[gi].id, subj.id, gi === i % 3, i < 2]);
    }
  }
  for (let i = 5; i < 10; i++) {
    const t = teachers[i];
    const subj = subjects[t.subjectIdx];
    const gi = (i - 5) % 3;
    await q(client, `
      INSERT INTO teacher_groups (teacher_id, group_id, subject_id, is_main_teacher, can_authorize_departures)
      VALUES ($1,$2,$3,FALSE,FALSE)
      ON CONFLICT DO NOTHING
    `, [t.id, groups[gi].id, subj.id]);
  }

  // 8. Padres
  const parents = [];
  const parentDefs = PARENTS_BY_SCHOOL[si];
  for (const p of parentDefs) {
    const ur = await q(client, `
      INSERT INTO users (email, password_hash, role, full_name, phone, school_id, status)
      VALUES ($1,$2,'PADRE',$3,$4,$5,TRUE)
      RETURNING id
    `, [`${p.email}@${domain}`, hash, `${p.fn} ${p.ln}`, p.phone, schoolId]);
    const uid = ur.rows[0].id;
    const pr = await q(client, `
      INSERT INTO parents (user_id, is_primary_contact)
      VALUES ($1,$2) RETURNING id
    `, [uid, p.primary]);
    const pid = pr.rows[0].id;
    parents.push({ id: pid, userId: uid, fullName: `${p.fn} ${p.ln}`, studentIdx: p.student, rel: p.rel, primary: p.primary });
    await q(client, `
      INSERT INTO user_privacy_acceptances (user_id, policy_version, accepted_at, ip_address)
      VALUES ($1,'v2.0.2026',NOW(),'127.0.0.1')
    `, [uid]);
    await q(client, `
      INSERT INTO access_credentials (user_id, credential_type, credential_value, status)
      VALUES ($1,'QR',$2,'ACTIVE')
    `, [uid, `QR-${schoolDef.code}-PAD-${uid.slice(0, 8).toUpperCase()}`]);
  }

  // 9. Estudiantes
  const students = [];
  const studentDefs = STUDENTS_BY_SCHOOL[si];
  for (let i = 0; i < studentDefs.length; i++) {
    const s = studentDefs[i];
    const gid = groups[s.group].id;
    const matricula = `${schoolDef.prefix}-${YEAR}-${String(i + 1).padStart(3, '0')}`;
    const ur = await q(client, `
      INSERT INTO users (email, password_hash, role, full_name, school_id, status)
      VALUES ($1,$2,'ALUMNO',$3,$4,TRUE)
      RETURNING id
    `, [`${s.email}@${domain}`, hash, `${s.fn} ${s.ln}`, schoolId]);
    const uid = ur.rows[0].id;
    const str = await q(client, `
      INSERT INTO students (user_id, matricula, school_id, group_id, lifecycle_status, can_leave_alone)
      VALUES ($1,$2,$3,$4,'ACTIVO',$5) RETURNING id
    `, [uid, matricula, schoolId, gid, i >= 8]);
    const stid = str.rows[0].id;
    students.push({ id: stid, userId: uid, fullName: `${s.fn} ${s.ln}`, groupIdx: s.group, groupId: gid });
    await q(client, `
      INSERT INTO user_privacy_acceptances (user_id, policy_version, accepted_at, ip_address)
      VALUES ($1,'v2.0.2026',NOW(),'127.0.0.1')
    `, [uid]);
    await q(client, `
      INSERT INTO access_credentials (user_id, credential_type, credential_value, status)
      VALUES ($1,'QR',$2,'ACTIVE')
    `, [uid, `QR-${schoolDef.code}-STU-${uid.slice(0, 8).toUpperCase()}`]);
  }

  // 10. Vincular estudiantes con padres (student_parents)
  for (const p of parents) {
    const st = students[p.studentIdx];
    if (!st) continue;
    await q(client, `
      INSERT INTO student_parents (student_id, parent_id, relationship, is_primary, can_pickup)
      VALUES ($1,$2,$3,$4,TRUE)
      ON CONFLICT DO NOTHING
    `, [st.id, p.id, p.rel, p.primary]);
  }

  // 11. Vehículos (primeros 6 padres, one vehicle each)
  const VEHICLES = [
    { plate: 'ABC123', brand: 'Toyota', model: 'Corolla', color: 'Blanco', year: 2020 },
    { plate: 'DEF456', brand: 'Chevrolet', model: 'Spark', color: 'Rojo', year: 2019 },
    { plate: 'GHI789', brand: 'Renault', model: 'Sandero', color: 'Gris', year: 2021 },
    { plate: 'JKL012', brand: 'Kia', model: 'Picanto', color: 'Negro', year: 2022 },
    { plate: 'MNO345', brand: 'Mazda', model: 'CX-3', color: 'Azul', year: 2021 },
    { plate: 'PQR678', brand: 'Hyundai', model: 'i10', color: 'Plateado', year: 2023 }
  ];
  const vehicles = [];
  for (let i = 0; i < Math.min(6, parents.length); i++) {
    if (!parents[i].primary) continue; // solo padres primarios
    const v = VEHICLES[vehicles.length % VEHICLES.length];
    const plate = `${v.plate.slice(0, 3)}-${schoolDef.code.slice(0, 1)}${String(i + 1).padStart(2, '0')}`;
    const vr = await q(client, `
      INSERT INTO vehicles (parent_id, plate, brand, model, color, year, is_active)
      VALUES ($1,$2,$3,$4,$5,$6,TRUE) RETURNING id
    `, [parents[i].id, plate, v.brand, v.model, v.color, v.year]);
    vehicles.push({ id: vr.rows[0].id, parentId: parents[i].id, parentIdx: i });
  }

  // pickup_authorizations
  for (const v of vehicles) {
    const pDef = parents[v.parentIdx];
    const st = students[pDef.studentIdx];
    if (!st) continue;
    await q(client, `
      INSERT INTO pickup_authorizations (student_id, parent_id, vehicle_id, is_default, is_active, notes)
      VALUES ($1,$2,$3,TRUE,TRUE,'Autorizado por el padre registrado')
    `, [st.id, pDef.id, v.id]);
  }

  // 12. Conceptos de pago
  const concepts = [];
  const conceptsDef = [
    { name: `Matrícula Anual ${YEAR}`, desc: 'Pago de matrícula del año escolar', amount: 450000, base: true, recur: false, period: null },
    { name: 'Pensión Mensual', desc: 'Cuota mensual de pensión académica', amount: 120000, base: false, recur: true, period: 'MONTHLY' },
    { name: 'Material Educativo', desc: 'Libros, cuadernos y útiles escolares', amount: 85000, base: false, recur: false, period: null },
    { name: 'Seguro Estudiantil', desc: 'Póliza de seguro escolar anual', amount: 35000, base: false, recur: true, period: 'YEARLY' }
  ];
  for (const cd of conceptsDef) {
    const cr = await q(client, `
      INSERT INTO payment_concepts (name, school_id, description, is_base, default_amount, is_recurring, recurrence_period, is_active)
      VALUES ($1,$2,$3,$4,$5,$6,$7,TRUE) RETURNING id
    `, [cd.name, schoolId, cd.desc, cd.base, cd.amount, cd.recur, cd.period]);
    concepts.push({ id: cr.rows[0].id, ...cd });
  }

  // 13. Deudas y pagos
  for (const st of students) {
    // Deuda 1: Matrícula PAGADA
    const d1 = await q(client, `
      INSERT INTO debts (student_id, concept_id, amount, due_date, status, description, verified_at)
      VALUES ($1,$2,$3,'2026-02-03','PAGADO','Matrícula año lectivo 2026',NOW()) RETURNING id
    `, [st.id, concepts[0].id, concepts[0].amount]);
    await q(client, `
      INSERT INTO payments (debt_id, payment_date, amount_paid, payment_method, reference_number, verified_at, notes)
      VALUES ($1,'2026-02-01',$2,'Transferencia bancaria',$3,NOW(),'Pago verificado por administración')
    `, [d1.rows[0].id, concepts[0].amount, `REF-${schoolDef.code}-${Math.floor(Math.random() * 9000000 + 1000000)}`]);

    // Deuda 2: Pensión corriente PENDIENTE
    await q(client, `
      INSERT INTO debts (student_id, concept_id, amount, due_date, status, description)
      VALUES ($1,$2,$3,'2026-05-05','PENDIENTE','Pensión mes de mayo 2026')
    `, [st.id, concepts[1].id, concepts[1].amount]);

    // Deuda 3: Material VENCIDO para los primeros 4 estudiantes, PENDIENTE para el resto
    const statusD3 = students.indexOf(st) < 4 ? 'VENCIDO' : 'PENDIENTE';
    await q(client, `
      INSERT INTO debts (student_id, concept_id, amount, due_date, status, description)
      VALUES ($1,$2,$3,'2026-03-15',$4,'Kit de materiales primer semestre')
    `, [st.id, concepts[2].id, concepts[2].amount, statusD3]);

    // Deuda 4: Seguro PENDIENTE
    await q(client, `
      INSERT INTO debts (student_id, concept_id, amount, due_date, status, description)
      VALUES ($1,$2,$3,'2026-02-28','PENDIENTE','Seguro estudiantil anual')
    `, [st.id, concepts[3].id, concepts[3].amount]);
  }

  // 14. Eventos de acceso (últimos 20 días)
  const accessUsers = [
    ...teachers.map(t => ({ uid: t.userId, role: 'DOCENTE' })),
    ...students.map(s => ({ uid: s.userId, role: 'ALUMNO' })),
    ...adminStaff.map(a => ({ uid: a.userId, role: 'ADMINISTRATIVO' }))
  ];
  const schoolDays = lastSchoolDays(20);
  for (const day of schoolDays) {
    const dateStr = fmtDate(day);
    for (const u of accessUsers) {
      // Entrada ~7:00
      const entryH = 7, entryM = rndInt(0, 30);
      const entryTime = new Date(day);
      entryTime.setHours(entryH, entryM, 0, 0);
      await q(client, `
        INSERT INTO access_events (user_id, role_snapshot, event_type, method, event_time, event_date)
        VALUES ($1,$2,'ENTRY','QR',$3,$4)
      `, [u.uid, u.role, entryTime.toISOString(), dateStr]);
      // Salida ~13:00-14:00
      const exitH = rndInt(13, 14), exitM = rndInt(0, 59);
      const exitTime = new Date(day);
      exitTime.setHours(exitH, exitM, 0, 0);
      await q(client, `
        INSERT INTO access_events (user_id, role_snapshot, event_type, method, event_time, event_date)
        VALUES ($1,$2,'EXIT','QR',$3,$4)
      `, [u.uid, u.role, exitTime.toISOString(), dateStr]);
    }
  }

  // 15. Asistencia (últimos 20 días lectivos)
  const attendanceStatuses = ['PRESENTE', 'PRESENTE', 'PRESENTE', 'PRESENTE', 'AUSENTE', 'RETARDO'];
  const teacherUser = teachers[0]; // docente registrador
  for (const st of students) {
    for (const day of schoolDays) {
      const dateStr = fmtDate(day);
      const status = rnd(attendanceStatuses);
      await q(client, `
        INSERT INTO attendance_records (student_id, group_id, attendance_date, status, is_justified, notes, registered_by)
        VALUES ($1,$2,$3,$4,$5,$6,$7)
        ON CONFLICT (student_id, attendance_date) DO NOTHING
      `, [
        st.id, st.groupId, dateStr, status,
        status === 'AUSENTE' ? rnd([true, false]) : null,
        status === 'AUSENTE' ? 'Falta justificada por el padre' : null,
        teacherUser.userId
      ]);
    }
  }

  // 16. Horario de clases (class_schedule_slots)
  const slots = [
    { wd: 1, st: '07:00', et: '08:00' }, { wd: 1, st: '08:00', et: '09:00' },
    { wd: 2, st: '07:00', et: '08:00' }, { wd: 2, st: '08:00', et: '09:00' },
    { wd: 3, st: '07:00', et: '08:00' }, { wd: 3, st: '08:00', et: '09:00' },
    { wd: 4, st: '07:00', et: '08:00' }, { wd: 4, st: '08:00', et: '09:00' },
    { wd: 5, st: '07:00', et: '08:00' }, { wd: 5, st: '08:00', et: '09:00' }
  ];
  for (let gi = 0; gi < groups.length; gi++) {
    for (let si2 = 0; si2 < Math.min(slots.length, subjects.length * 2); si2++) {
      const slot = slots[si2];
      const subIdx = si2 % subjects.length;
      // El docente que enseña esta materia a este grupo
      const teacherForSlot = teachers[subIdx]; // docentes 0-4 enseñan las 5 materias
      await q(client, `
        INSERT INTO class_schedule_slots (group_id, weekday, start_time, end_time, subject_id, teacher_id, room)
        VALUES ($1,$2,$3,$4,$5,$6,$7)
      `, [groups[gi].id, slot.wd, slot.st, slot.et, subjects[subIdx].id, teacherForSlot.id, groups[gi].classroom]);
      // class_sessions enlazadas al periodo
      await q(client, `
        INSERT INTO class_sessions
          (school_id, academic_period_id, group_id, subject_id, teacher_id, weekday,
           start_time, end_time, room, is_active, created_by_user_id, updated_by_user_id)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,TRUE,$10,$10)
        ON CONFLICT DO NOTHING
      `, [
        schoolId, periodId, groups[gi].id, subjects[subIdx].id, teacherForSlot.id,
        slot.wd, slot.st, slot.et, groups[gi].classroom, teacherForSlot.userId
      ]);
    }
  }

  // 17. Actividades y calificaciones
  const actTitles = [
    ['Taller: Operaciones con fracciones', 'Evaluación: Álgebra básica', 'Quiz: Geometría plana', 'Proyecto: Estadística descriptiva'],
    ['Ensayo: El Quijote y la modernidad', 'Lectura comprensiva: Textos expositivos', 'Producción textual: Crónica', 'Debate: Oralidad y argumentación'],
    ['Laboratorio: Ecosistemas locales', 'Mapa conceptual: El cuerpo humano', 'Experimento: Propiedades del agua', 'Investigación: Cambio climático'],
    ['Listening: Daily routines', 'Speaking: Describing your school', 'Writing: My favorite hobby', 'Grammar test: Present simple'],
    ['Carrera de observación', 'Test teórico: Reglas deportivas', 'Prueba práctica: Atletismo', 'Evaluación postural']
  ];
  const activities = [];
  for (let gi = 0; gi < groups.length; gi++) {
    const groupStudents = students.filter(s => s.groupIdx === gi);
    for (let subIdx = 0; subIdx < subjects.length; subIdx++) {
      const teacher = teachers[subIdx];
      const subj = subjects[subIdx];
      const titles = actTitles[subIdx];
      for (let ai = 0; ai < titles.length; ai++) {
        const isClosed = ai < 2;
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() - (isClosed ? (ai + 1) * 7 : -(ai * 7)));
        const ar = await q(client, `
          INSERT INTO activities
            (teacher_id, group_id, subject_id, subject_name, period_id, title, description,
             period, max_score, due_date, status, closed_at, published_at)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,100,$9,$10,$11,$12) RETURNING id
        `, [
          teacher.id, groups[gi].id, subj.id, subj.name, periodId,
          `${titles[ai]} — ${YEAR}`,
          `Actividad evaluativa de ${subj.name} para el ${groups[gi].name}`,
          'Primer Período', fmtDate(dueDate),
          isClosed ? 'CLOSED' : 'OPEN',
          isClosed ? new Date().toISOString() : null,
          isClosed ? new Date().toISOString() : null
        ]);
        const actId = ar.rows[0].id;
        activities.push({ id: actId, subjectIdx: subIdx, groupIdx: gi });
        // Calificaciones para cada estudiante del grupo
        for (const st of groupStudents) {
          const score = rndInt(55, 100);
          await q(client, `
            INSERT INTO activity_grades (activity_id, student_id, score, notes, graded_by, graded_at)
            VALUES ($1,$2,$3,$4,$5,NOW())
            ON CONFLICT DO NOTHING
          `, [actId, st.id, score, score < 65 ? 'Debe recuperar la actividad' : null, teacher.userId]);
        }
      }
    }
  }

  // 18. Boletines del primer periodo (para 5 estudiantes, los demás en proceso)
  for (let stIdx = 0; stIdx < 5; stIdx++) {
    const st = students[stIdx];
    const rcr = await q(client, `
      INSERT INTO report_cards (student_id, school_id, school_year, type, period_id, overall_average,
        failed_subjects_count, promotion_status, published_at, status)
      VALUES ($1,$2,$3,'PERIOD',$4,$5,$6,$7,NOW(),'PUBLISHED') RETURNING id
    `, [
      st.id, schoolId, YEAR, periodId,
      rndInt(70, 95), 0, 'APROBADO'
    ]);
    const rcId = rcr.rows[0].id;
    for (const subj of subjects) {
      const avg = rndInt(68, 98);
      await q(client, `
        INSERT INTO report_card_subjects
          (report_card_id, subject_id, subject_name, average, activity_count, graded_count, is_passing)
        VALUES ($1,$2,$3,$4,4,4,$5)
        ON CONFLICT DO NOTHING
      `, [rcId, subj.id, subj.name, avg, avg >= 60]);
    }
  }

  // 19. Avisos (notices) y notificaciones
  const noticesDef = [
    {
      title: 'Reunión de padres de familia — Primer período',
      content: `Se convoca a todos los padres de familia a la reunión de entrega de boletines del Primer Período académico ${YEAR}. La reunión se realizará el próximo sábado de 8:00 a.m. a 12:00 m. en el auditorio principal. Es indispensable su asistencia.`,
      important: true, target: 'ALL'
    },
    {
      title: 'Izada de bandera — Celebración Día del Idioma',
      content: `El próximo 23 de abril celebramos el Día del Idioma con una izada de bandera y acto cultural. Los estudiantes deben presentarse con uniforme de gala. Se invita a toda la comunidad educativa a participar.`,
      important: false, target: 'ALL'
    },
    {
      title: 'Recordatorio: Paz y salvo financiero',
      content: `Se recuerda a los padres de familia que para la entrega de boletines se requiere estar al día con los compromisos financieros de la institución. Comuníquese con la oficina de tesorería si tiene alguna duda.`,
      important: true, target: 'ALL'
    },
    {
      title: 'Suspensión de clases por capacitación docente',
      content: `Se informa que el próximo viernes no habrá clases ya que el cuerpo docente asistirá a una jornada de formación pedagógica. Las actividades escolares se retomarán normalmente el lunes siguiente.`,
      important: false, target: 'ALL'
    }
  ];
  const adminUserId = adminStaff[0].userId;
  const noticeIds = [];
  for (const nd of noticesDef) {
    const nr = await q(client, `
      INSERT INTO notices (title, content, target_type, created_by, is_important)
      VALUES ($1,$2,$3,$4,$5) RETURNING id
    `, [nd.title, nd.content, nd.target, adminUserId, nd.important]);
    noticeIds.push(nr.rows[0].id);
  }
  // Notificaciones a padres
  for (const p of parents) {
    for (const nid of noticeIds) {
      await q(client, `
        INSERT INTO notifications (user_id, notice_id, title, message, delivery_status, read_at)
        VALUES ($1,$2,$3,$4,'SENT',$5)
      `, [p.userId, nid, 'Nuevo aviso institucional',
         'Tiene un nuevo aviso en EscuelaPass. Inicie sesión para verlo.',
         Math.random() > 0.4 ? new Date().toISOString() : null]);
    }
  }

  // 20. Reuniones
  const meetingsDef = [
    {
      title: `Consejo Académico — ${YEAR}`,
      purpose: 'Revisión de resultados del primer período y ajuste del plan de mejoramiento institucional.',
      modality: 'PRESENCIAL', location: 'Sala de juntas',
      startAt: '2026-04-26 09:00:00',
      participants: [
        { user: adminStaff[0], role: 'ADMINISTRATIVO' },
        { user: teachers[0], role: 'DOCENTE' },
        { user: teachers[1], role: 'DOCENTE' }
      ]
    },
    {
      title: 'Comité de Convivencia Escolar',
      purpose: 'Revisión de casos disciplinarios del período y establecimiento de planes de acción.',
      modality: 'PRESENCIAL', location: 'Rectoría',
      startAt: '2026-05-03 10:00:00',
      participants: [
        { user: adminStaff[1], role: 'ADMINISTRATIVO' },
        { user: teachers[2], role: 'DOCENTE' }
      ]
    },
    {
      title: 'Entrega de boletines — Primer Período',
      purpose: 'Entrega de boletines de calificaciones a padres de familia y diálogo sobre el desempeño académico.',
      modality: 'PRESENCIAL', location: 'Aulas de clase',
      startAt: '2026-05-10 08:00:00',
      participants: [
        { user: adminStaff[0], role: 'ADMINISTRATIVO' },
        { user: teachers[0], role: 'DOCENTE' },
        { user: teachers[1], role: 'DOCENTE' }
      ]
    }
  ];
  for (const md of meetingsDef) {
    const mr = await q(client, `
      INSERT INTO meetings (school_id, organizer_user_id, organizer_role, title, purpose, modality, location,
        start_at, duration_minutes, status)
      VALUES ($1,$2,'ADMINISTRATIVO',$3,$4,$5,$6,$7,60,'PROGRAMADA') RETURNING id
    `, [schoolId, adminUserId, md.title, md.purpose, md.modality, md.location, md.startAt]);
    const mid = mr.rows[0].id;
    for (const mp of md.participants) {
      await q(client, `
        INSERT INTO meeting_participants (meeting_id, user_id, participant_role, rsvp)
        VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING
      `, [mid, mp.user.userId, mp.role, rnd(['ACEPTADA', 'PENDIENTE'])]);
    }
    // Agregar padres a la reunión de entrega de boletines
    if (md.title.includes('boletines')) {
      for (let i = 0; i < Math.min(5, parents.length); i++) {
        await q(client, `
          INSERT INTO meeting_participants (meeting_id, user_id, participant_role, rsvp)
          VALUES ($1,$2,'PADRE',$3) ON CONFLICT DO NOTHING
        `, [mid, parents[i].userId, rnd(['ACEPTADA', 'PENDIENTE', 'DECLINADA'])]);
      }
    }
  }

  // 21. Visitas externas
  const visitsDef = [
    {
      title: 'Visita de la Secretaría de Educación',
      purpose: 'Revisión del proyecto educativo institucional y verificación de estándares de calidad.',
      visitor: 'Inspectora Sandra Mosquera', org: 'Secretaría de Educación Municipal',
      location: 'Rectoría y aulas', datetime: '2026-05-15 09:00:00',
      scope: 'SCHOOL', status: 'PROGRAMADA'
    },
    {
      title: 'Taller de Orientación Vocacional',
      purpose: 'Charla interactiva sobre opciones universitarias y técnicas para estudiantes de octavo grado.',
      visitor: 'Prof. Antonio Ríos', org: 'Universidad Nacional de Colombia',
      location: 'Auditorio', datetime: '2026-04-22 10:00:00',
      scope: 'GROUPS', status: 'REALIZADA'
    },
    {
      title: 'Jornada de Salud y Bienestar',
      purpose: 'Brigada de salud con vacunación y control de crecimiento para toda la comunidad.',
      visitor: 'Dra. Claudia Vélez', org: 'Secretaría de Salud',
      location: 'Cancha principal', datetime: '2026-03-20 08:00:00',
      scope: 'SCHOOL', status: 'REALIZADA'
    }
  ];
  for (const vd of visitsDef) {
    const vr = await q(client, `
      INSERT INTO external_visits (school_id, created_by_user_id, creator_role, title, purpose,
        visitor_name, visitor_organization, location, visit_datetime, duration_minutes, audience_scope, status)
      VALUES ($1,$2,'ADMINISTRATIVO',$3,$4,$5,$6,$7,$8,120,$9,$10) RETURNING id
    `, [schoolId, adminUserId, vd.title, vd.purpose, vd.visitor, vd.org, vd.location, vd.datetime, vd.scope, vd.status]);
    const vid = vr.rows[0].id;
    if (vd.scope === 'GROUPS') {
      await q(client, `INSERT INTO external_visit_groups (visit_id, group_id) VALUES ($1,$2)`, [vid, groups[2].id]);
    }
  }

  // 23. Anotaciones de atención al estudiante
  const notesDef = [
    { sev: 'LEVE',     title: 'Comportamiento disruptivo en clase',   desc: 'El estudiante interrumpió la clase en reiteradas ocasiones con comentarios inapropiados. Se realizó llamado de atención verbal. Se notificó al acudiente.' },
    { sev: 'MODERADA', title: 'Pelea en el recreo',                   desc: 'El estudiante tuvo un altercado físico con un compañero durante el descanso. Se aplicó el debido proceso según el manual de convivencia.' },
    { sev: 'LEVE',     title: 'Incumplimiento de tareas',             desc: 'Presenta el segundo incumplimiento consecutivo en la entrega de trabajos escritos de Matemáticas. Se citó al padre de familia.' },
    { sev: 'GRAVE',    title: 'Daño a propiedad institucional',       desc: 'El estudiante causó daño a un computador del aula de informática. Se inició proceso disciplinario y se notificó a los padres para la reparación del daño.' },
    { sev: 'LEVE',     title: 'Atraso reiterado al inicio de clases', desc: 'Cuarto atraso del periodo. Se realizó acta de compromiso con el estudiante y el acudiente.' }
  ];
  for (let i = 0; i < notesDef.length; i++) {
    const nd = notesDef[i];
    const st = students[i % students.length];
    const occurred = new Date();
    occurred.setDate(occurred.getDate() - rndInt(2, 15));
    await q(client, `
      INSERT INTO student_attention_notes
        (student_id, created_by_user_id, severity, title, description, occurred_at, notified_parent)
      VALUES ($1,$2,$3,$4,$5,$6,TRUE)
    `, [st.id, teachers[0].userId, nd.sev, nd.title, nd.desc, occurred.toISOString()]);
  }

  // 24. Circuitos históricos (circuit_requests)
  const circuitHistory = [
    { status: 'ENTREGADO',    method: 'VEHICULO_REGISTRADO', daysAgo: 3 },
    { status: 'ENTREGADO',    method: 'A_PIE',               daysAgo: 5 },
    { status: 'CANCELADO',    method: 'VEHICULO_REGISTRADO', daysAgo: 7 },
    { status: 'ENTREGADO',    method: 'OTRO_VEHICULO',       daysAgo: 10 },
    { status: 'PENDIENTE',    method: 'A_PIE',               daysAgo: 0 },
    { status: 'PADRE_EN_CAMINO', method: 'VEHICULO_REGISTRADO', daysAgo: 0 }
  ];
  for (let i = 0; i < Math.min(circuitHistory.length, parents.length); i++) {
    const ch = circuitHistory[i];
    const p = parents[i];
    const st = students[p.studentIdx];
    if (!st) continue;
    const reqTime = new Date();
    reqTime.setDate(reqTime.getDate() - ch.daysAgo);
    reqTime.setHours(14, rndInt(0, 45), 0, 0);
    const veh = ch.method === 'VEHICULO_REGISTRADO' && vehicles.length > 0 ? vehicles[0].id : null;
    await q(client, `
      INSERT INTO circuit_requests
        (student_id, requested_by_parent_id, pickup_method, status, request_time,
         parent_gps_latitude, parent_gps_longitude, vehicle_id, pickup_notes)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
    `, [
      st.id, p.id, ch.method, ch.status, reqTime.toISOString(),
      schoolDef.lat, schoolDef.lon, veh,
      ch.method === 'A_PIE' ? 'El estudiante saldrá caminando a una cuadra del colegio' : null
    ]);
  }

  // 25. Consentimientos de salida autónoma
  for (let i = 8; i < students.length; i++) {
    const st = students[i];
    const parentForStudent = parents.find(p => p.studentIdx === i && p.primary);
    if (!parentForStudent) continue;
    await q(client, `
      INSERT INTO student_departure_consents
        (student_id, parent_id, consent_type, valid_from, valid_until)
      VALUES ($1,$2,'SALIDA_SOLO','2026-02-01','2026-11-30')
    `, [st.id, parentForStudent.id]);
  }

  // 26. Días no lectivos
  const nonInstrDays = [
    { date: '2026-05-01', reason: 'Día del Trabajo — festivo nacional' },
    { date: '2026-06-05', reason: 'Jornada pedagógica institucional' },
    { date: '2026-06-19', reason: 'Sagrado Corazón — festivo nacional' }
  ];
  for (const nid of nonInstrDays) {
    await q(client, `
      INSERT INTO school_non_instructional_days (exception_date, school_id, reason, created_by)
      VALUES ($1,$2,$3,$4)
      ON CONFLICT DO NOTHING
    `, [nid.date, schoolId, nid.reason, adminUserId]);
  }

  // 27. Reportes administrativos (admin_reports)
  const reportsDef = [
    {
      type: 'ERROR',     subject: 'Falla en módulo de asistencia',
      msg: 'Al registrar la asistencia del grupo 7A el sistema arroja un error 500. Se intenta desde Chrome y Edge.',
      status: 'EN_PROCESO'
    },
    {
      type: 'SUGERENCIA', subject: 'Incorporar filtro por grupo en reportes de asistencia',
      msg: 'Sería muy útil poder filtrar los reportes de asistencia por grupo escolar para facilitar el seguimiento de cada salón.',
      status: 'PENDIENTE'
    },
    {
      type: 'PETICION',  subject: 'Habilitar descarga masiva de boletines en PDF',
      msg: 'Solicitamos que el sistema permita descargar todos los boletines del grupo en un solo archivo PDF comprimido.',
      status: 'RESUELTO'
    },
    {
      type: 'OTRO',      subject: 'Actualizar datos del director institucional',
      msg: 'El nombre del rector en el sistema está desactualizado. Favor cambiar al nuevo rector según resolución del 15 de enero.',
      status: 'RESUELTO'
    }
  ];
  for (let i = 0; i < reportsDef.length; i++) {
    const rd = reportsDef[i];
    const reporter = i < 2 ? teachers[0].userId : parents[0].userId;
    const rr = await q(client, `
      INSERT INTO admin_reports (school_id, created_by_user_id, assigned_admin_user_id, type, subject, message, status, resolved_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id
    `, [
      schoolId, reporter, adminUserId, rd.type, rd.subject, rd.msg, rd.status,
      rd.status === 'RESUELTO' ? new Date().toISOString() : null
    ]);
    const repId = rr.rows[0].id;
    // Comentarios
    await q(client, `
      INSERT INTO admin_report_comments (report_id, user_id, message)
      VALUES ($1,$2,$3)
    `, [repId, adminUserId,
       rd.status === 'RESUELTO'
         ? 'El inconveniente ha sido atendido y resuelto satisfactoriamente. Queda cerrado el reporte.'
         : 'Gracias por el reporte. Lo revisaremos y le daremos respuesta a la brevedad posible.'
    ]);
    if (rd.status === 'EN_PROCESO') {
      await q(client, `
        INSERT INTO admin_report_comments (report_id, user_id, message)
        VALUES ($1,$2,$3)
      `, [repId, reporter, 'El problema persiste. Hoy intenté nuevamente y continúa el error.']);
    }
  }

  // 28. Ajuste de deuda (debt_adjustments)
  const firstDebt = await q(client, `SELECT id FROM debts WHERE student_id = $1 AND status = 'VENCIDO' LIMIT 1`, [students[0].id]);
  if (firstDebt.rows.length > 0) {
    await q(client, `
      INSERT INTO debt_adjustments
        (debt_id, school_id, action_type, previous_amount, delta_amount, next_amount,
         reason, policy_cycle_date, changed_by_user_id)
      VALUES ($1,$2,'LATE_FEE',$3,5000,$4,'Recargo por mora — política vencidos',CURRENT_DATE,$5)
    `, [firstDebt.rows[0].id, schoolId, concepts[2].amount, concepts[2].amount + 5000, adminUserId]);
  }

  // 29. Logs de auditoría
  const auditActions = [
    { action: 'USER_LOGIN',          entity: 'User',    meta: { method: 'email' } },
    { action: 'STUDENT_CREATED',     entity: 'Student', meta: { by: 'admin' } },
    { action: 'DEBT_CREATED',        entity: 'Debt',    meta: { concept: 'Matrícula' } },
    { action: 'ATTENDANCE_REGISTERED', entity: 'Attendance', meta: { group: '6° A' } },
    { action: 'REPORT_GENERATED',    entity: 'ReportCard', meta: { period: 1 } }
  ];
  for (const aa of auditActions) {
    await q(client, `
      INSERT INTO audit_logs (user_id, action, entity_type, metadata, ip_address)
      VALUES ($1,$2,$3,$4,'192.168.1.100')
    `, [adminUserId, aa.action, aa.entity, JSON.stringify(aa.meta)]);
  }

  console.log(`[seed] Colegio "${schoolDef.name}" — datos completos OK.`);
  return schoolId;
}

// ──────────────────────────────────────────────
// MAIN
// ──────────────────────────────────────────────
async function main() {
  console.log('[seed] Iniciando seed completo de EscuelaPass…');
  const hash = await bcrypt.hash(PASS, 10);

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();
  console.log('[seed] Conexión a la BD establecida.');

  try {
    await truncateAll(client);
    const policyId = await createPrivacyPolicy(client);
    const globalAdminIds = await createGlobalAdmins(client, hash, policyId);

    for (let si = 0; si < SCHOOLS_DEF.length; si++) {
      await populateSchool(client, SCHOOLS_DEF[si], si, hash, policyId, globalAdminIds);
    }

    // Resumen
    const counts = await client.query(`
      SELECT
        (SELECT count(*) FROM schools)               AS schools,
        (SELECT count(*) FROM users)                 AS users,
        (SELECT count(*) FROM teachers)              AS teachers,
        (SELECT count(*) FROM students)              AS students,
        (SELECT count(*) FROM parents)               AS parents,
        (SELECT count(*) FROM administrative_staff)  AS admin_staff,
        (SELECT count(*) FROM groups)                AS groups,
        (SELECT count(*) FROM subjects)              AS subjects,
        (SELECT count(*) FROM academic_periods)      AS periods,
        (SELECT count(*) FROM activities)            AS activities,
        (SELECT count(*) FROM activity_grades)       AS grades,
        (SELECT count(*) FROM attendance_records)    AS attendance,
        (SELECT count(*) FROM debts)                 AS debts,
        (SELECT count(*) FROM payments)              AS payments,
        (SELECT count(*) FROM access_events)         AS access_events,
        (SELECT count(*) FROM meetings)              AS meetings,
        (SELECT count(*) FROM external_visits)       AS visits,
        (SELECT count(*) FROM admin_reports)         AS admin_reports,
        (SELECT count(*) FROM circuit_requests)      AS circuits,
        (SELECT count(*) FROM notices)               AS notices
    `);
    console.log('\n[seed] ══════════════ RESUMEN ══════════════');
    const c = counts.rows[0];
    for (const [k, v] of Object.entries(c)) {
      console.log(`[seed]   ${k.padEnd(20)}: ${v}`);
    }
    console.log('[seed] ════════════════════════════════════');
    console.log(`[seed] Contraseña de todos los usuarios: ${PASS}`);
    console.log('[seed] Seed completado exitosamente.');
  } catch (e) {
    console.error('[seed] ERROR:', e.message);
    console.error(e.stack);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
