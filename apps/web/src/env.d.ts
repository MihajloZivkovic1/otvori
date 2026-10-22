/// <reference types="astro/client" />

interface ImportMetaEnv {
  /** Analytics script URL, e.g. https://plausible.io/js/script.js. Empty = no analytics. */
  readonly PUBLIC_ANALYTICS_SRC?: string;
  /** The data-domain the analytics script reports to, e.g. otvori.menu. */
  readonly PUBLIC_ANALYTICS_DOMAIN?: string;
}
