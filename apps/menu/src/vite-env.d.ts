/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** API origin: dev/preview proxy target; called directly by production builds (empty = same origin). */
  readonly VITE_API_URL?: string;
  /** Restaurant slug used when the host has no subdomain (dev convenience). */
  readonly VITE_DEFAULT_SLUG?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
