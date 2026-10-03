import { createFileRoute } from '@tanstack/react-router';
import Page, { meta } from "~/routes/umigame/recommend";
import { loadPage, resolvePage, PageState, pageHead } from '~/framework/page';
import { servePageAction } from '~/framework/handlers.server';

export const Route = createFileRoute("/games_/umigame_/recommend")({
  loaderDeps: ({ search }) => search,
  loader: ({ location }) => loadPage({ data: { route: "/games/umigame/recommend", href: location.href } }).then(resolvePage),
  component: () => <PageState route="/games/umigame/recommend"><Page /></PageState>,
  head: ({ loaderData }) => pageHead(meta, loaderData),
  server: { handlers: { POST: ({ request, context, params }) => servePageAction("/games/umigame/recommend", request, params, context) } }
});
