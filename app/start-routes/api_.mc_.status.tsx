import { createFileRoute } from '@tanstack/react-router';
import { serveResource } from '~/framework/handlers.server';

export const Route = createFileRoute("/api_/mc_/status")({
  server: { handlers: { ANY: ({ request, context, params }) => serveResource("/api/mc/status", request, params, context) } }
});
