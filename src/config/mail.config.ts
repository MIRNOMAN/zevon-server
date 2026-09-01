import { registerAs } from '@nestjs/config';

export default registerAs('mail', () => ({
  host: process.env.SMTP_HOST || '',
  port: parseInt(process.env.SMTP_PORT || '587', 10),
  user: process.env.SMTP_USER || '',
  pass: process.env.SMTP_PASS || '',
  secure: process.env.SMTP_SECURE === 'true',
  from: process.env.EMAIL_FROM || 'ZEVON Store <no-reply@zevon.com>',
}));
