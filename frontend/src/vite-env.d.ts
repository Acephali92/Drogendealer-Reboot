/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_USE_MOCKS?: 'true' | 'false' | 'all';
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
