import { registerAs } from '@nestjs/config';

export default registerAs('stripe', () => ({
  secretKey: process.env.STRIPE_SECRET_KEY || '',
  webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
  publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || '',
  currency: (process.env.STRIPE_CURRENCY || 'bdt').toLowerCase(),
  successUrl:
    process.env.STRIPE_SUCCESS_URL ||
    'https://web.mirnoman.com/order/success?session_id={CHECKOUT_SESSION_ID}',
  cancelUrl:
    process.env.STRIPE_CANCEL_URL || 'https://web.mirnoman.com/order/cancel',
}));
