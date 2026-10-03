import { createFileRoute } from '@tanstack/react-router';
import Page, { meta } from "~/routes/$";
import { loadPage, resolvePage, PageState, pageHead } from '~/framework/page';

export const Route = createFileRoute("/$")({
  loaderDeps: ({ search }) => search,
  loader: ({ location }) => loadPage({ data: { route: "/*", href: location.href } }).then(resolvePage),
  component: () => <PageState route="/*"><Page /></PageState>,
  head: ({ loaderData }) => pageHead(meta, loaderData)
});
