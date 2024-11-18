/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CASPIO_API_KEY: string
  readonly VITE_CASPIO_API_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}