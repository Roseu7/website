import { createFileRoute } from '@tanstack/react-router';
import Page, { meta } from "~/routes/pages/tools/jev";
import { loadPage, resolvePage, PageState, pageHead } from '~/framework/page';

export const Route = createFileRoute("/tools_/jev")({
  loaderDeps: ({ search }) => search,
  loader: ({ location }) => loadPage({ data: { route: "/tools/jev", href: location.href } }).then(resolvePage),
  component: () => <PageState route="/tools/jev"><Page /></PageState>,
  head: ({ loaderData }) => pageHead(meta, loaderData)
});
