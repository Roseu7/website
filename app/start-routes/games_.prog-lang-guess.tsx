import { createFileRoute } from '@tanstack/react-router';
import Page, { meta } from "~/routes/pages/games/prog-lang-guess";
import { loadPage, resolvePage, PageState, pageHead } from '~/framework/page';

export const Route = createFileRoute("/games_/prog-lang-guess")({
  loaderDeps: ({ search }) => search,
  loader: ({ location }) => loadPage({ data: { route: "/games/prog-lang-guess", href: location.href } }).then(resolvePage),
  component: () => <PageState route="/games/prog-lang-guess"><Page /></PageState>,
  head: ({ loaderData }) => pageHead(meta, loaderData)
});
