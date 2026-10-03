import { createFileRoute } from '@tanstack/react-router';
import { serveResource } from '~/framework/handlers.server';

export const Route = createFileRoute("/auth_/logout")({
  server: { handlers: { ANY: ({ request, context, params }) => serveResource("/auth/logout", request, params, context) } }
});
