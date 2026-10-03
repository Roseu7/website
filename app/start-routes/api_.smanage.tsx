import { createFileRoute } from '@tanstack/react-router';
import { serveResource } from '~/framework/handlers.server';

export const Route = createFileRoute("/api_/smanage")({
  server: { handlers: { ANY: ({ request, context, params }) => serveResource("/api/smanage", request, params, context) } }
});
