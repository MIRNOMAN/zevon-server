import { registerAs } from '@nestjs/config';

export default registerAs('jwt', () => ({
  accessSecret:
    process.env.JWT_ACCESS_SECRET ||
    process.env.JWT_SECRET ||
    'access-secret-key-default-12345',
  accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
  refreshSecret:
    process.env.JWT_REFRESH_SECRET || 'refresh-secret-key-default-12345',
  refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  adminSecretKey: process.env.ADMIN_SECRET_KEY || 'zevon-admin-secret-2026',
}));
