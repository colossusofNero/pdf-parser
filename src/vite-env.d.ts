/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CASPIO_ACCESS_TOKEN: string
  readonly VITE_CASPIO_API_URL: string
  readonly VITE_CASPIO_FILE_UPLOAD_URL: string
  readonly DEV: boolean
  readonly PROD: boolean
  readonly MODE: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
