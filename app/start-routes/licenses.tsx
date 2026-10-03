import { createFileRoute } from '@tanstack/react-router';
import Page, { meta } from "~/routes/pages/licenses";
import { loadPage, resolvePage, PageState, pageHead } from '~/framework/page';

export const Route = createFileRoute("/licenses")({
  loaderDeps: ({ search }) => search,
  loader: ({ location }) => loadPage({ data: { route: "/licenses", href: location.href } }).then(resolvePage),
  component: () => <PageState route="/licenses"><Page /></PageState>,
  head: ({ loaderData }) => pageHead(meta, loaderData)
});
