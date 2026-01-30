export default () => ({
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  database: {
    url: process.env.DATABASE_URL,
  },

  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET || 'default-access-secret-change-me',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'default-refresh-secret-change-me',
    accessExpiration: process.env.JWT_ACCESS_EXPIRATION || '15m',
    refreshExpiration: process.env.JWT_REFRESH_EXPIRATION || '7d',
  },

  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY,
  },

  buybox: {
    // Base URL for BUYBOX API - endpoint format: {baseUrl}/{widgetId}/buybox.json
    baseUrl: 'https://buybox.click',
    // Widget ID from publisher panel - MUST be provided via environment variable
    widgetId: process.env.BUYBOX_WIDGET_ID,
    // Request timeout in milliseconds
    timeout: parseInt(process.env.BUYBOX_TIMEOUT || '5000', 10),
    // Cache TTL in seconds
    cacheTtl: parseInt(process.env.BUYBOX_CACHE_TTL || '3600', 10),
  },

  cors: {
    origins: (process.env.CORS_ORIGINS || 'http://localhost:8081').split(','),
  },
});
