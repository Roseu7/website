import { createFileRoute } from '@tanstack/react-router';
import Page, { meta } from "~/routes/pages/contact";
import { loadPage, resolvePage, PageState, pageHead } from '~/framework/page';
import { servePageAction } from '~/framework/handlers.server';

export const Route = createFileRoute("/contact")({
  loaderDeps: ({ search }) => search,
  loader: ({ location }) => loadPage({ data: { route: "/contact", href: location.href } }).then(resolvePage),
  component: () => <PageState route="/contact"><Page /></PageState>,
  head: ({ loaderData }) => pageHead(meta, loaderData),
  server: { handlers: { POST: ({ request, context, params }) => servePageAction("/contact", request, params, context) } }
});
