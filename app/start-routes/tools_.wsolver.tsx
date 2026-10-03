import { createFileRoute } from '@tanstack/react-router';
import Page, { meta } from "~/routes/pages/tools/wsolver";
import { loadPage, resolvePage, PageState, pageHead } from '~/framework/page';

export const Route = createFileRoute("/tools_/wsolver")({
  loaderDeps: ({ search }) => search,
  loader: ({ location }) => loadPage({ data: { route: "/tools/wsolver", href: location.href } }).then(resolvePage),
  component: () => <PageState route="/tools/wsolver"><Page /></PageState>,
  head: ({ loaderData }) => pageHead(meta, loaderData)
});
