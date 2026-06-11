/**
 * Typed configuration loaded from environment. Centralizes the knobs used by
 * the verification and fraud engines so they're tenant-overridable later via
 * organizations.settings.
 */
export interface AppConfig {
  env: string;
  port: number;
  apiPrefix: string;
  apiVersion: string;
  jwt: {
    accessSecret: string;
    refreshSecret: string;
    accessTtl: number;
    refreshTtl: number;
  };
  identity: {
    provider: string;
    matchThreshold: number;
    livenessThreshold: number;
  };
  fraud: {
    impossibleTravelKmh: number;
    duplicateWindowMin: number;
    autoFlagScore: number;
  };
}

export default (): AppConfig => ({
  env: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '4000', 10),
  apiPrefix: process.env.API_PREFIX ?? 'api',
  apiVersion: process.env.API_VERSION ?? 'v1',
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET ?? 'dev-access',
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? 'dev-refresh',
    accessTtl: parseInt(process.env.JWT_ACCESS_TTL ?? '900', 10),
    refreshTtl: parseInt(process.env.JWT_REFRESH_TTL ?? '2592000', 10),
  },
  identity: {
    provider: process.env.IDENTITY_PROVIDER ?? 'stub',
    matchThreshold: parseFloat(process.env.IDENTITY_MATCH_THRESHOLD ?? '0.82'),
    livenessThreshold: parseFloat(process.env.LIVENESS_THRESHOLD ?? '0.90'),
  },
  fraud: {
    impossibleTravelKmh: parseFloat(
      process.env.FRAUD_IMPOSSIBLE_TRAVEL_KMH ?? '900',
    ),
    duplicateWindowMin: parseInt(
      process.env.FRAUD_DUPLICATE_WINDOW_MIN ?? '10',
      10,
    ),
    autoFlagScore: parseInt(process.env.FRAUD_AUTOFLAG_SCORE ?? '61', 10),
  },
});
