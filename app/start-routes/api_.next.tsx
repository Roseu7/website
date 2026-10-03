import { createFileRoute } from '@tanstack/react-router';
import { serveResource } from '~/framework/handlers.server';

export const Route = createFileRoute("/api_/next")({
  server: { handlers: { ANY: ({ request, context, params }) => serveResource("/api/next", request, params, context) } }
});
