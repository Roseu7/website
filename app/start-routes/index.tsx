import { createFileRoute } from '@tanstack/react-router';
import Page, { meta } from "~/routes/home/index";
import { loadPage, resolvePage, PageState, pageHead } from '~/framework/page';
import { servePageAction } from '~/framework/handlers.server';

export const Route = createFileRoute("/")({
  loaderDeps: ({ search }) => search,
  loader: ({ location }) => loadPage({ data: { route: "/", href: location.href } }).then(resolvePage),
  component: () => <PageState route="/"><Page /></PageState>,
  head: ({ loaderData }) => pageHead(meta, loaderData),
  server: { handlers: { POST: ({ request, context, params }) => servePageAction("/", request, params, context) } }
});
