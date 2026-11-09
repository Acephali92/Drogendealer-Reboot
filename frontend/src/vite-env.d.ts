/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_USE_MOCKS?: 'all' | 'hybrid' | 'off';
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** Aus docs/game-design/parameters.toml beim Build erzeugt (vite/gameParams.ts, ADR-020). */
declare module 'virtual:game-images' {
  export const imageFallbacks: Record<
    'goods' | 'vehicles' | 'weapons' | 'armor' | 'crew' | 'ships',
    string | null
  >;
}
declare module 'virtual:game-params' {
  const params: Record<string, unknown>;
  export default params;
}
