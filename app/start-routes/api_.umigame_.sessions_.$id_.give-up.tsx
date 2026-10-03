import { createFileRoute } from '@tanstack/react-router';
import { serveResource } from '~/framework/handlers.server';

export const Route = createFileRoute("/api_/umigame_/sessions_/$id_/give-up")({
  server: { handlers: { ANY: ({ request, context, params }) => serveResource("/api/umigame/sessions/:id/give-up", request, params, context) } }
});
