import { createFileRoute } from '@tanstack/react-router';
import Page, { meta } from "~/routes/umigame/new";
import { loadPage, resolvePage, PageState, pageHead } from '~/framework/page';
import { servePageAction } from '~/framework/handlers.server';

export const Route = createFileRoute("/games_/umigame_/new")({
  loaderDeps: ({ search }) => search,
  loader: ({ location }) => loadPage({ data: { route: "/games/umigame/new", href: location.href } }).then(resolvePage),
  component: () => <PageState route="/games/umigame/new"><Page /></PageState>,
  head: ({ loaderData }) => pageHead(meta, loaderData),
  server: { handlers: { POST: ({ request, context, params }) => servePageAction("/games/umigame/new", request, params, context) } }
});
