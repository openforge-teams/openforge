/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BRIDGE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare global {
  interface Window {
    __TAURI__?: unknown;
  }
}

export {};
