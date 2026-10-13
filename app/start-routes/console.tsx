import { createFileRoute } from '@tanstack/react-router';
import Page, { meta } from "~/routes/pages/console";
import { loadPage, resolvePage, PageState, pageHead } from '~/framework/page';

export const Route = createFileRoute("/console")({
  loader: ({ location }) => loadPage({ data: { route: "/console", href: location.href } }).then(resolvePage),
  component: () => <PageState route="/console"><Page /></PageState>,
  head: ({ loaderData }) => pageHead(meta, loaderData)
});
