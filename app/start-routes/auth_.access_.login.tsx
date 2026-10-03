import { createFileRoute } from '@tanstack/react-router';
import { serveResource } from '~/framework/handlers.server';

export const Route = createFileRoute("/auth_/access_/login")({
  server: { handlers: { ANY: ({ request, context, params }) => serveResource("/auth/access/login", request, params, context) } }
});
