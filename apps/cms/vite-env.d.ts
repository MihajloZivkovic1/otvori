/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** API origin for production builds; empty = same origin (reverse proxy). Dev always proxies /api. */
  readonly VITE_API_URL?: string;
  /** Public menu URL template, e.g. "https://{slug}.otvori.menu"; used only before the restaurant has loaded. */
  readonly VITE_PUBLIC_MENU_BASE_URL?: string;
}

/** Injected by vite.config.ts from package.json. */
declare const __APP_VERSION__: string;
