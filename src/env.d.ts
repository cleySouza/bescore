/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

declare const __APP_VERSION__: string

/**
 * Variáveis expostas pelo Vite ao cliente (`import.meta.env`).
 * Defina-as no host de build (ex.: Vercel → Environment Variables); só entram no bundle após `vite build`.
 */
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_STRAPI_URL?: string
  readonly VITE_STRAPI_API_TOKEN?: string
  /** `true` | `1` | `yes` — mock seed UI em dev; em `vite build` ver também `VITE_MOCK_SEED_ALLOW_PRODUCTION`. */
  readonly VITE_FEATURE_ENABLE_MOCK_SEED?: string
  /** Só relevante em builds de produção: permite o botão de mock seed quando a flag acima está ligada. */
  readonly VITE_MOCK_SEED_ALLOW_PRODUCTION?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
