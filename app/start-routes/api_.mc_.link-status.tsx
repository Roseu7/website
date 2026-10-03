import { createFileRoute } from '@tanstack/react-router';
import { serveResource } from '~/framework/handlers.server';

export const Route = createFileRoute("/api_/mc_/link-status")({
  server: { handlers: { ANY: ({ request, context, params }) => serveResource("/api/mc/link-status", request, params, context) } }
});
