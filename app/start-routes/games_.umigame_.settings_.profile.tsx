import { createFileRoute } from '@tanstack/react-router';
import Page, { meta } from "~/routes/umigame/settings-profile";
import { loadPage, resolvePage, PageState, pageHead } from '~/framework/page';
import { servePageAction } from '~/framework/handlers.server';

export const Route = createFileRoute("/games_/umigame_/settings_/profile")({
  loaderDeps: ({ search }) => search,
  loader: ({ location }) => loadPage({ data: { route: "/games/umigame/settings/profile", href: location.href } }).then(resolvePage),
  component: () => <PageState route="/games/umigame/settings/profile"><Page /></PageState>,
  head: ({ loaderData }) => pageHead(meta, loaderData),
  server: { handlers: { POST: ({ request, context, params }) => servePageAction("/games/umigame/settings/profile", request, params, context) } }
});
