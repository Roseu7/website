import { createFileRoute } from '@tanstack/react-router';
import Page, { meta } from "~/routes/umigame/about";
import { loadPage, resolvePage, PageState, pageHead } from '~/framework/page';

export const Route = createFileRoute("/games_/umigame_/about")({
  loaderDeps: ({ search }) => search,
  loader: ({ location }) => loadPage({ data: { route: "/games/umigame/about", href: location.href } }).then(resolvePage),
  component: () => <PageState route="/games/umigame/about"><Page /></PageState>,
  head: ({ loaderData }) => pageHead(meta, loaderData)
});
