// lib/sentry.ts
import * as Sentry from 'sentry-expo';

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN ?? '';

if (dsn) {
  Sentry.init({
    dsn,
    enableInExpoDevelopment: true,
    debug: __DEV__,
    tracesSampleRate: 0.2,
    enableAutoPerformanceTracing: true,
  });
} else {
  // Fine to run without Sentry while you focus on uploads
  console.log('Sentry is disabled (no DSN).');
}
