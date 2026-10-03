import { createFileRoute } from '@tanstack/react-router';
import Page, { meta } from "~/routes/umigame/author-quality";
import { loadPage, resolvePage, PageState, pageHead } from '~/framework/page';

export const Route = createFileRoute("/games_/umigame_/author_/quality")({
  loaderDeps: ({ search }) => search,
  loader: ({ location }) => loadPage({ data: { route: "/games/umigame/author/quality", href: location.href } }).then(resolvePage),
  component: () => <PageState route="/games/umigame/author/quality"><Page /></PageState>,
  head: ({ loaderData }) => pageHead(meta, loaderData)
});
