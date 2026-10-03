import { createFileRoute } from '@tanstack/react-router';
import { serveResource } from '~/framework/handlers.server';

export const Route = createFileRoute("/api_/umigame_/puzzles_/$id_/sessions")({
  server: { handlers: { ANY: ({ request, context, params }) => serveResource("/api/umigame/puzzles/:id/sessions", request, params, context) } }
});
