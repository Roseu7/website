import { createFileRoute } from '@tanstack/react-router';
import Page, { meta } from "~/routes/pages/privacy";
import { loadPage, resolvePage, PageState, pageHead } from '~/framework/page';

export const Route = createFileRoute("/privacy")({
  loaderDeps: ({ search }) => search,
  loader: ({ location }) => loadPage({ data: { route: "/privacy", href: location.href } }).then(resolvePage),
  component: () => <PageState route="/privacy"><Page /></PageState>,
  head: ({ loaderData }) => pageHead(meta, loaderData)
});
