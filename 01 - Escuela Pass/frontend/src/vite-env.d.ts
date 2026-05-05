/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Token público de Mapbox (sk. no debe usarse en el navegador; usar pk.). Valor en .env, no aquí. */
  readonly VITE_MAPBOX_ACCESS_TOKEN?: string;
  /** Opcional: URL o URI de estilo Mapbox Studio. Valor en .env, no aquí. */
  readonly VITE_MAPBOX_STYLE_URL?: string;
  /** Firebase Web SDK (Consola → Configuración del proyecto → Tus apps). */
  readonly VITE_FIREBASE_API_KEY?: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string;
  readonly VITE_FIREBASE_PROJECT_ID?: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET?: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID?: string;
  readonly VITE_FIREBASE_APP_ID?: string;
  /** Opcional: Google Analytics / Firebase (misma app web). */
  readonly VITE_FIREBASE_MEASUREMENT_ID?: string;
  /** Clave VAPID / pair: Consola → Cloud Messaging → Certificados push web. */
  readonly VITE_FIREBASE_VAPID_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
