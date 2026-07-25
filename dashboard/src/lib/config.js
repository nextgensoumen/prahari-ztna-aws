// Prahari Dashboard — Auth & API configuration
// Values are injected at build time via environment variables (Vite: import.meta.env)
// For local dev, create dashboard/.env.local with these values.

export const config = {
  cognito: {
    region:      import.meta.env.VITE_AWS_REGION      || 'us-east-1',
    userPoolId:  import.meta.env.VITE_COGNITO_USER_POOL_ID || '',
    clientId:    import.meta.env.VITE_COGNITO_CLIENT_ID    || '',
    domain:      import.meta.env.VITE_COGNITO_DOMAIN       || '', // e.g. prahari-auth-123456789012.auth.us-east-1.amazoncognito.com
    redirectUri: import.meta.env.VITE_REDIRECT_URI || 'http://localhost:5173/callback',
    logoutUri:   import.meta.env.VITE_LOGOUT_URI   || 'http://localhost:5173',
  },
  apiUrl: import.meta.env.VITE_API_URL || 'http://localhost:3001',
}
