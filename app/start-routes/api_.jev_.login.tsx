import { createFileRoute } from '@tanstack/react-router';
import { serveResource } from '~/framework/handlers.server';

export const Route = createFileRoute("/api_/jev_/login")({
  server: { handlers: { ANY: ({ request, context, params }) => serveResource("/api/jev/login", request, params, context) } }
});
