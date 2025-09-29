import * as Sentry from '@sentry/react';

export const initMonitoring = () => {
  if (import.meta.env.PROD) {
    Sentry.init({
      dsn: import.meta.env.VITE_SENTRY_DSN,
      environment: import.meta.env.VITE_ENV,
      tracesSampleRate: 0.1,
      beforeSend(event, hint) {
        // Filter out sensitive data
        if (event.request) {
          delete event.request.cookies;
          delete event.request.headers;
        }
        return event;
      },
    });
  }
};

export const logError = (error: Error, context?: any) => {
  console.error('Error:', error, context);
  if (import.meta.env.PROD) {
    Sentry.captureException(error, { extra: context });
  }
};

export const logPerformance = (metric: string, value: number) => {
  console.log(`Performance: ${metric}:`, value);
  // Send to analytics service
};
