import { createFileRoute } from '@tanstack/react-router';
import Page, { meta } from "~/routes/umigame/profile";
import { loadPage, resolvePage, PageState, pageHead } from '~/framework/page';

export const Route = createFileRoute("/games_/umigame_/u_/$username")({
  loaderDeps: ({ search }) => search,
  loader: ({ location }) => loadPage({ data: { route: "/games/umigame/u/:username", href: location.href } }).then(resolvePage),
  component: () => <PageState route="/games/umigame/u/:username"><Page /></PageState>,
  head: ({ loaderData }) => pageHead(meta, loaderData)
});
