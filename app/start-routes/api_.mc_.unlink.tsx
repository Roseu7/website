import { createFileRoute } from '@tanstack/react-router';
import { serveResource } from '~/framework/handlers.server';

export const Route = createFileRoute("/api_/mc_/unlink")({
  server: { handlers: { ANY: ({ request, context, params }) => serveResource("/api/mc/unlink", request, params, context) } }
});
