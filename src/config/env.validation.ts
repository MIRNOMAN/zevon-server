import { z } from 'zod';

/**
 * Zod schema for validating environment variables at startup.
 * The app will fail fast if required variables are missing or malformed.
 */
export const envSchema = z.object({
  // Application
  NODE_ENV: z
    .enum(['development', 'production', 'test', 'staging'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(3000),

  // Database
  DATABASE_URL: z.string().url(),

  // JWT & Security
  JWT_SECRET: z.string().min(8).optional(),
  JWT_ACCESS_SECRET: z.string().min(8).optional(),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_SECRET: z.string().min(8).optional(),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  ADMIN_SECRET_KEY: z.string().optional().default('zevon-admin-secret-2026'),

  // CORS
  CORS_ORIGIN: z.string().default('*'),

  // Throttle
  THROTTLE_TTL: z.coerce.number().int().positive().default(60),
  THROTTLE_LIMIT: z.coerce.number().int().positive().default(100),

  // Stripe Payment Gateway
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  STRIPE_CURRENCY: z.string().default('bdt'),
  STRIPE_SUCCESS_URL: z.string().optional(),
  STRIPE_CANCEL_URL: z.string().optional(),

  // SMTP Email Delivery
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().optional().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_SECURE: z.coerce.boolean().optional().default(false),
  EMAIL_FROM: z.string().optional().default('ZEVON Store <no-reply@zevon.com>'),
});

export type EnvConfig = z.infer<typeof envSchema>;

/**
 * Validate function for @nestjs/config's `validate` option.
 * Parses and returns typed env, or throws on invalid config.
 */
export function validateEnv(config: Record<string, unknown>): EnvConfig {
  const result = envSchema.safeParse(config);

  if (!result.success) {
    const formatted = result.error.issues
      .map((issue) => `  → ${String(issue.path.join('.'))}: ${issue.message}`)
      .join('\n');

    throw new Error(`❌ Environment validation failed:\n${formatted}`);
  }

  return result.data;
}
