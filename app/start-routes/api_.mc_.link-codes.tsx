import { createFileRoute } from '@tanstack/react-router';
import { serveResource } from '~/framework/handlers.server';

export const Route = createFileRoute("/api_/mc_/link-codes")({
  server: { handlers: { ANY: ({ request, context, params }) => serveResource("/api/mc/link-codes", request, params, context) } }
});
