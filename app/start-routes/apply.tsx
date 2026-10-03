import { createFileRoute } from '@tanstack/react-router';
import Page, { meta } from "~/routes/apply";
import { loadPage, resolvePage, PageState, pageHead } from '~/framework/page';
import { servePageAction } from '~/framework/handlers.server';

export const Route = createFileRoute("/apply")({
  loaderDeps: ({ search }) => search,
  loader: ({ location }) => loadPage({ data: { route: "/apply", href: location.href } }).then(resolvePage),
  component: () => <PageState route="/apply"><Page /></PageState>,
  head: ({ loaderData }) => pageHead(meta, loaderData),
  server: { handlers: { POST: ({ request, context, params }) => servePageAction("/apply", request, params, context) } }
});
