/// <reference types="vite/client" />
/// <reference path="./types/image.d.ts" />

interface ImportMetaEnv {
  readonly VITE_EMAIL_USERNAME: string
  readonly VITE_EMAIL_PASSWORD: string
  readonly VITE_RECIPIENT_EMAIL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
} 