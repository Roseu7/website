import { createFileRoute } from '@tanstack/react-router';
import Page, { meta } from "~/routes/pages/settings";
import { loadPage, resolvePage, PageState, pageHead } from '~/framework/page';

export const Route = createFileRoute("/settings_/history")({
  loader: ({ location }) => loadPage({ data: { route: "/settings/history", href: location.href } }).then(resolvePage),
  component: () => <PageState route="/settings/history"><Page view="history" /></PageState>,
  head: ({ loaderData }) => pageHead(meta, loaderData)
});
