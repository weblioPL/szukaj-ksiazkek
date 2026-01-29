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
    apiUrl: process.env.BUYBOX_API_URL || 'https://api.buybox.pl',
    apiKey: process.env.BUYBOX_API_KEY,
  },

  cors: {
    origins: (process.env.CORS_ORIGINS || 'http://localhost:8081').split(','),
  },
});
