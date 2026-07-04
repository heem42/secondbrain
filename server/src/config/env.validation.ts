/**
 * Fail fast at boot if required config is missing (ARCHITECTURE.md §11: secrets
 * come from the environment, never committed). Wired into ConfigModule.forRoot.
 */
const REQUIRED = [
  'DATABASE_URL',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
] as const;

export function validateEnv(
  config: Record<string, unknown>,
): Record<string, unknown> {
  const missing = REQUIRED.filter((key) => !config[key]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}. ` +
        `Copy server/.env.example to server/.env and fill them in.`,
    );
  }
  return config;
}
