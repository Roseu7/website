import { createFileRoute } from '@tanstack/react-router';
import Page, { meta } from "~/routes/pages/tools/index";
import { loadPage, resolvePage, PageState, pageHead } from '~/framework/page';

export const Route = createFileRoute("/tools")({
  loaderDeps: ({ search }) => search,
  loader: ({ location }) => loadPage({ data: { route: "/tools", href: location.href } }).then(resolvePage),
  component: () => <PageState route="/tools"><Page /></PageState>,
  head: ({ loaderData }) => pageHead(meta, loaderData)
});
