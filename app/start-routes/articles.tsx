import { createFileRoute } from '@tanstack/react-router';
import Page, { meta } from "~/routes/articles/index";
import { loadPage, resolvePage, PageState, pageHead } from '~/framework/page';

export const Route = createFileRoute("/articles")({
  loaderDeps: ({ search }) => search,
  loader: ({ location }) => loadPage({ data: { route: "/articles", href: location.href } }).then(resolvePage),
  component: () => <PageState route="/articles"><Page /></PageState>,
  head: ({ loaderData }) => pageHead(meta, loaderData)
});
