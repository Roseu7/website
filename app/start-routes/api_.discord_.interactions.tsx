import { createFileRoute } from '@tanstack/react-router';
import { serveResource } from '~/framework/handlers.server';

export const Route = createFileRoute("/api_/discord_/interactions")({
  server: { handlers: { ANY: ({ request, context, params }) => serveResource("/api/discord/interactions", request, params, context) } }
});
