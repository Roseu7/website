import { createFileRoute } from '@tanstack/react-router';
import { serveResource } from '~/framework/handlers.server';

export const Route = createFileRoute("/admin_/api_/articles_/$id")({
  server: { handlers: { ANY: ({ request, context, params }) => serveResource("/admin/api/articles/:id", request, params, context) } }
});
