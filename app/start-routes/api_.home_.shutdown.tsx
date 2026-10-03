import { createFileRoute } from '@tanstack/react-router';
import { serveResource } from '~/framework/handlers.server';

export const Route = createFileRoute("/api_/home_/shutdown")({
  server: { handlers: { ANY: ({ request, context, params }) => serveResource("/api/home/shutdown", request, params, context) } }
});
