import { createFileRoute } from '@tanstack/react-router';
import Page, { meta } from "~/routes/umigame/puzzle";
import { loadPage, resolvePage, PageState, pageHead } from '~/framework/page';

export const Route = createFileRoute("/games_/umigame_/p_/$id")({
  loaderDeps: ({ search }) => search,
  loader: ({ location }) => loadPage({ data: { route: "/games/umigame/p/:id", href: location.href } }).then(resolvePage),
  component: () => <PageState route="/games/umigame/p/:id"><Page /></PageState>,
  head: ({ loaderData }) => pageHead(meta, loaderData)
});
