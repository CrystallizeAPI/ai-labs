/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CRYSTALLIZE_TENANT_IDENTIFIER: string;
  readonly VITE_CRYSTALLIZE_ACCESS_TOKEN_ID: string;
  readonly VITE_CRYSTALLIZE_ACCESS_TOKEN_SECRET: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
