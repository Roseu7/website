import { createFileRoute } from '@tanstack/react-router';
import { serveResource } from '~/framework/handlers.server';

export const Route = createFileRoute("/api_/umigame_/sessions_/$id_/hint")({
  server: { handlers: { ANY: ({ request, context, params }) => serveResource("/api/umigame/sessions/:id/hint", request, params, context) } }
});
