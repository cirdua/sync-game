/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the deployed Functions app (empty in local dev -> proxy). */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
