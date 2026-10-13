import { createFileRoute } from '@tanstack/react-router';
import Page, { meta } from "~/routes/pages/settings";
import { loadPage, resolvePage, PageState, pageHead } from '~/framework/page';

export const Route = createFileRoute("/settings")({
  loader: ({ location }) => loadPage({ data: { route: "/settings", href: location.href } }).then(resolvePage),
  component: () => <PageState route="/settings"><Page /></PageState>,
  head: ({ loaderData }) => pageHead(meta, loaderData)
});
