import { createFileRoute } from '@tanstack/react-router';
import Page, { meta } from "~/routes/pages/games/index";
import { loadPage, resolvePage, PageState, pageHead } from '~/framework/page';

export const Route = createFileRoute("/games")({
  loaderDeps: ({ search }) => search,
  loader: ({ location }) => loadPage({ data: { route: "/games", href: location.href } }).then(resolvePage),
  component: () => <PageState route="/games"><Page /></PageState>,
  head: ({ loaderData }) => pageHead(meta, loaderData)
});
