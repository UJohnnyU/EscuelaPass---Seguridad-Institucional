/**
 * Genera public/firebase-messaging-sw.js a partir de VITE_FIREBASE_* en frontend/.env y/o process.env
 * (Vercel/Railway en build) para que el service worker coincida con el cliente (compat API en el SW).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(__dirname, '..');
const envPath = path.join(frontendRoot, '.env');
const outPath = path.join(frontendRoot, 'public', 'firebase-messaging-sw.js');

function readFirebaseCdnVersion() {
  try {
    const pkgPath = path.join(frontendRoot, 'node_modules', 'firebase', 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    return String(pkg.version || '11.10.0').trim() || '11.10.0';
  } catch {
    return '11.10.0';
  }
}

const FIREBASE_CDN = readFirebaseCdnVersion();

const FCM_SW_ENV_KEYS = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID'
];

/**
 * Variables desde frontend/.env (local) y process.env (Vercel/Railway en build).
 * Lo definido en el entorno de CI sobrescribe el archivo para un deploy correcto sin commitear .env.
 */
function loadMergedEnv() {
  const map = new Map();
  if (fs.existsSync(envPath)) {
    for (const [k, v] of parseEnvFile(fs.readFileSync(envPath, 'utf8'))) {
      map.set(k, v);
    }
  }
  for (const key of [...FCM_SW_ENV_KEYS, 'VITE_FIREBASE_MEASUREMENT_ID']) {
    const v = process.env[key];
    if (v != null && String(v).trim() !== '') {
      map.set(key, String(v).trim());
    }
  }
  return map;
}

function parseEnvFile(text) {
  const map = new Map();
  for (const line of text.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    map.set(k, v);
  }
  return map;
}

function escapeForJsString(s) {
  return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

const stub = `// Stub FCM: defina VITE_FIREBASE_* en .env y ejecute npm run sync:fcm-sw
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
`;

function main() {
  const env = loadMergedEnv();
  const missing = FCM_SW_ENV_KEYS.filter((k) => !env.get(k)?.trim());
  if (missing.length > 0) {
    fs.writeFileSync(outPath, stub, 'utf8');
    console.warn(
      `[sync-fcm-sw] Faltan variables (${missing.join(', ')}). Stub escrito. En Vercel defínalas en el proyecto y redeploy (no hace falta .env en el repo).`
    );
    return;
  }

  const apiKey = env.get('VITE_FIREBASE_API_KEY');
  const authDomain = env.get('VITE_FIREBASE_AUTH_DOMAIN');
  const projectId = env.get('VITE_FIREBASE_PROJECT_ID');
  const storageBucket = env.get('VITE_FIREBASE_STORAGE_BUCKET');
  const messagingSenderId = env.get('VITE_FIREBASE_MESSAGING_SENDER_ID');
  const appId = env.get('VITE_FIREBASE_APP_ID');
  const measurementId = env.get('VITE_FIREBASE_MEASUREMENT_ID')?.trim();

  const initFields = [
    `  apiKey: '${escapeForJsString(apiKey)}'`,
    `  authDomain: '${escapeForJsString(authDomain)}'`,
    `  projectId: '${escapeForJsString(projectId)}'`,
    `  storageBucket: '${escapeForJsString(storageBucket)}'`,
    `  messagingSenderId: '${escapeForJsString(messagingSenderId)}'`,
    `  appId: '${escapeForJsString(appId)}'`
  ];
  if (measurementId) {
    initFields.push(`  measurementId: '${escapeForJsString(measurementId)}'`);
  }

  const body = `/* Auto-generado por scripts/sync-fcm-sw.mjs — no editar a mano */
/* Firebase compat JS v${FIREBASE_CDN} */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
importScripts('https://www.gstatic.com/firebasejs/${FIREBASE_CDN}/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/${FIREBASE_CDN}/firebase-messaging-compat.js');
firebase.initializeApp({
${initFields.join(',\n')}
});
function epAbsoluteUrlFromNotification(raw) {
  if (!raw) return self.location.origin + '/app';
  var u = raw.openUrl;
  if (u && /^https?:\\/\\//i.test(String(u))) return String(u);
  var p = raw.openPath || raw.route || '';
  p = String(p);
  if (!p.startsWith('/')) p = '/' + p;
  return self.location.origin + p;
}
function epPathFromAbsolute(url) {
  try {
    var o = new URL(url);
    return o.pathname + o.search + o.hash;
  } catch (e) {
    return '/app';
  }
}
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  var url = epAbsoluteUrlFromNotification(event.notification.data || {});
  var path = epPathFromAbsolute(url);
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      for (var i = 0; i < clientList.length; i++) {
        var c = clientList[i];
        if (c.url.indexOf(self.location.origin) === 0 && 'focus' in c) {
          return c.focus().then(function () {
            function postNav() {
              try {
                var ch = new BroadcastChannel('ep-fcm-nav');
                ch.postMessage({ type: 'navigate', path: path });
                ch.close();
              } catch (e2) {}
            }
            postNav();
            setTimeout(postNav, 200);
          });
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
const messaging = firebase.messaging();
messaging.onBackgroundMessage((payload) => {
  const title =
    (payload.notification && payload.notification.title) ||
    (payload.data && payload.data.title) ||
    'Escuela Pass';
  const bodyText =
    (payload.notification && payload.notification.body) ||
    (payload.data && payload.data.body) ||
    '';
  const tag = (payload.data && payload.data.notifTag) || undefined;
  const options = {
    body: bodyText,
    icon: '/favicon.svg',
    tag: tag,
    data: payload.data || {}
  };
  return self.registration.showNotification(title, options);
});
`;

  fs.writeFileSync(outPath, body, 'utf8');
  console.log('[sync-fcm-sw] public/firebase-messaging-sw.js actualizado (CDN ' + FIREBASE_CDN + ').');
}

main();
