import { createFileRoute } from '@tanstack/react-router';
import Page, { meta } from "~/routes/home/control";
import { loadPage, resolvePage, PageState, pageHead } from '~/framework/page';

export const Route = createFileRoute("/home-control")({
  loaderDeps: ({ search }) => search,
  loader: ({ location }) => loadPage({ data: { route: "/home-control", href: location.href } }).then(resolvePage),
  component: () => <PageState route="/home-control"><Page /></PageState>,
  head: ({ loaderData }) => pageHead(meta, loaderData)
});
