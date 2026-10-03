import { createFileRoute } from '@tanstack/react-router';
import Page, { meta } from "~/routes/umigame/rankings";
import { loadPage, resolvePage, PageState, pageHead } from '~/framework/page';

export const Route = createFileRoute("/games_/umigame_/rankings")({
  loaderDeps: ({ search }) => search,
  loader: ({ location }) => loadPage({ data: { route: "/games/umigame/rankings", href: location.href } }).then(resolvePage),
  component: () => <PageState route="/games/umigame/rankings"><Page /></PageState>,
  head: ({ loaderData }) => pageHead(meta, loaderData)
});
