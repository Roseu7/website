import { createFileRoute } from '@tanstack/react-router';
import { serveResource } from '~/framework/handlers.server';

export const Route = createFileRoute("/auth_/discord_/callback")({
  server: { handlers: { ANY: ({ request, context, params }) => serveResource("/auth/discord/callback", request, params, context) } }
});
