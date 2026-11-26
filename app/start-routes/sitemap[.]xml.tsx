import { createFileRoute } from '@tanstack/react-router';
import { serveResource } from '~/framework/handlers.server';

export const Route = createFileRoute("/sitemap.xml")({
  server: { handlers: { ANY: ({ request, context, params }) => serveResource("/sitemap.xml", request, params, context) } }
});
