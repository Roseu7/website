import { createFileRoute } from '@tanstack/react-router';
import Page, { meta } from "~/routes/pages/settings";
import { loadPage, resolvePage, PageState, pageHead } from '~/framework/page';

export const Route = createFileRoute("/settings_/about")({
  loader: ({ location }) => loadPage({ data: { route: "/settings/about", href: location.href } }).then(resolvePage),
  component: () => <PageState route="/settings/about"><Page view="about" /></PageState>,
  head: ({ loaderData }) => pageHead(meta, loaderData)
});
