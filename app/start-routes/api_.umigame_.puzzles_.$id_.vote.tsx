import { createFileRoute } from '@tanstack/react-router';
import { serveResource } from '~/framework/handlers.server';

export const Route = createFileRoute("/api_/umigame_/puzzles_/$id_/vote")({
  server: { handlers: { ANY: ({ request, context, params }) => serveResource("/api/umigame/puzzles/:id/vote", request, params, context) } }
});
