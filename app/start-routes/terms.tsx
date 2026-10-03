import { createFileRoute } from '@tanstack/react-router';
import Page, { meta } from "~/routes/pages/terms";
import { loadPage, resolvePage, PageState, pageHead } from '~/framework/page';

export const Route = createFileRoute("/terms")({
  loaderDeps: ({ search }) => search,
  loader: ({ location }) => loadPage({ data: { route: "/terms", href: location.href } }).then(resolvePage),
  component: () => <PageState route="/terms"><Page /></PageState>,
  head: ({ loaderData }) => pageHead(meta, loaderData)
});
