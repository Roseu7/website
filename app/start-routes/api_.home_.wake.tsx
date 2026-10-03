import { createFileRoute } from '@tanstack/react-router';
import { serveResource } from '~/framework/handlers.server';

export const Route = createFileRoute("/api_/home_/wake")({
  server: { handlers: { ANY: ({ request, context, params }) => serveResource("/api/home/wake", request, params, context) } }
});
