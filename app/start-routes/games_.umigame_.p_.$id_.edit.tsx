import { createFileRoute } from '@tanstack/react-router';
import Page, { meta } from "~/routes/umigame/edit";
import { loadPage, resolvePage, PageState, pageHead } from '~/framework/page';
import { servePageAction } from '~/framework/handlers.server';

export const Route = createFileRoute("/games_/umigame_/p_/$id_/edit")({
  loaderDeps: ({ search }) => search,
  loader: ({ location }) => loadPage({ data: { route: "/games/umigame/p/:id/edit", href: location.href } }).then(resolvePage),
  component: () => <PageState route="/games/umigame/p/:id/edit"><Page /></PageState>,
  head: ({ loaderData }) => pageHead(meta, loaderData),
  server: { handlers: { POST: ({ request, context, params }) => servePageAction("/games/umigame/p/:id/edit", request, params, context) } }
});
