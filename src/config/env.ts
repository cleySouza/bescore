function readEnv(name: string): string | undefined {
  const value = import.meta.env[name]
  if (typeof value !== 'string') return undefined

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

export function getRequiredEnv(name: string): string {
  const value = readEnv(name)
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

export function getOptionalEnv(name: string): string | undefined {
  return readEnv(name)
}

function readBooleanEnv(name: string, defaultValue = false): boolean {
  const value = readEnv(name)
  if (!value) return defaultValue

  const normalized = value.toLowerCase()
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on'
}

export const env = {
  supabaseUrl: getRequiredEnv('VITE_SUPABASE_URL'),
  supabaseAnonKey: getRequiredEnv('VITE_SUPABASE_ANON_KEY'),
  strapiUrl: getOptionalEnv('VITE_STRAPI_URL') ?? '',
  strapiApiToken: getOptionalEnv('VITE_STRAPI_API_TOKEN'),
  appVersion: __APP_VERSION__,
  features: {
    enableMockSeed: readBooleanEnv('VITE_FEATURE_ENABLE_MOCK_SEED', false),
  },
}
