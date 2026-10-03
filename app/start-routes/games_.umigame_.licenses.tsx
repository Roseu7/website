import { createFileRoute } from '@tanstack/react-router';
import Page, { meta } from "~/routes/umigame/licenses";
import { loadPage, resolvePage, PageState, pageHead } from '~/framework/page';

export const Route = createFileRoute("/games_/umigame_/licenses")({
  loaderDeps: ({ search }) => search,
  loader: ({ location }) => loadPage({ data: { route: "/games/umigame/licenses", href: location.href } }).then(resolvePage),
  component: () => <PageState route="/games/umigame/licenses"><Page /></PageState>,
  head: ({ loaderData }) => pageHead(meta, loaderData)
});
