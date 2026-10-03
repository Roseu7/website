import { createFileRoute } from '@tanstack/react-router';
import Page, { meta } from "~/routes/umigame/index";
import { loadPage, resolvePage, PageState, pageHead } from '~/framework/page';

export const Route = createFileRoute("/games_/umigame")({
  loaderDeps: ({ search }) => search,
  loader: ({ location }) => loadPage({ data: { route: "/games/umigame", href: location.href } }).then(resolvePage),
  component: () => <PageState route="/games/umigame"><Page /></PageState>,
  head: ({ loaderData }) => pageHead(meta, loaderData)
});
