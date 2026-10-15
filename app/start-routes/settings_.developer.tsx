import { createFileRoute } from '@tanstack/react-router';
import Page, { meta } from "~/routes/pages/settings";
import { loadPage, resolvePage, PageState, pageHead } from '~/framework/page';

export const Route = createFileRoute("/settings_/developer")({
  loader: ({ location }) => loadPage({ data: { route: "/settings/developer", href: location.href } }).then(resolvePage),
  component: () => <PageState route="/settings/developer"><Page view="developer" /></PageState>,
  head: ({ loaderData }) => pageHead(meta, loaderData)
});
