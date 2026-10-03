import { createFileRoute } from '@tanstack/react-router';
import { serveResource } from '~/framework/handlers.server';

export const Route = createFileRoute("/api_/umigame_/sessions_/$id_/guess")({
  server: { handlers: { ANY: ({ request, context, params }) => serveResource("/api/umigame/sessions/:id/guess", request, params, context) } }
});
