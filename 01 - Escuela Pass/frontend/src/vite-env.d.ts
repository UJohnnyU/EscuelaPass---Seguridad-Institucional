/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Token público de Mapbox (sk. no debe usarse en el navegador; usar pk.). */
  readonly VITE_MAPBOX_ACCESS_TOKEN?: string;
  /** Opcional: URL o URI de estilo Mapbox Studio, p. ej. mapbox://styles/… */
  readonly VITE_MAPBOX_STYLE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
