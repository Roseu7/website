import { createFileRoute } from '@tanstack/react-router';
import { serveResource } from '~/framework/handlers.server';

export const Route = createFileRoute("/admin_/api_/images")({
  server: { handlers: { ANY: ({ request, context, params }) => serveResource("/admin/api/images", request, params, context) } }
});
