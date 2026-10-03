import { createFileRoute } from '@tanstack/react-router';
import { serveResource } from '~/framework/handlers.server';

export const Route = createFileRoute("/map")({
  server: { handlers: { ANY: ({ request, context, params }) => serveResource("/map", request, params, context) } }
});
