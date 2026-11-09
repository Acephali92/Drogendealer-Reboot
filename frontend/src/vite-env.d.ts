/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_USE_MOCKS?: 'all' | 'hybrid' | 'off';
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
