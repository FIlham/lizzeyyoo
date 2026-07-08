// src/routes/api/auth.$.tsx — Better Auth handler mount point with rate-limiting.
import { createFileRoute } from '@tanstack/react-router';
import { authHandlerWithRateLimit } from '../../../server/auth';

export const Route = createFileRoute('/api/auth/$')({
  server: {
    handlers: {
      // Uses wrapper that enforces Redis rate-limit before delegating to auth.handler
      ANY: ({ request }) => authHandlerWithRateLimit(request),
    },
  },
});