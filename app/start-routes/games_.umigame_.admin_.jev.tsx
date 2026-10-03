import { createFileRoute } from '@tanstack/react-router';
import Page, { meta } from "~/routes/umigame/admin-jev";
import { loadPage, resolvePage, PageState, pageHead } from '~/framework/page';
import { servePageAction } from '~/framework/handlers.server';

export const Route = createFileRoute("/games_/umigame_/admin_/jev")({
  loaderDeps: ({ search }) => search,
  loader: ({ location }) => loadPage({ data: { route: "/games/umigame/admin/jev", href: location.href } }).then(resolvePage),
  component: () => <PageState route="/games/umigame/admin/jev"><Page /></PageState>,
  head: ({ loaderData }) => pageHead(meta, loaderData),
  server: { handlers: { POST: ({ request, context, params }) => servePageAction("/games/umigame/admin/jev", request, params, context) } }
});
