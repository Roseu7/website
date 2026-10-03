import { createFileRoute } from '@tanstack/react-router';
import Page from "~/routes/auth/access/logout";
import { loadPage, resolvePage, PageState } from '~/framework/page';
import { servePageAction } from '~/framework/handlers.server';

export const Route = createFileRoute("/auth_/access_/logout")({
  loaderDeps: ({ search }) => search,
  loader: ({ location }) => loadPage({ data: { route: "/auth/access/logout", href: location.href } }).then(resolvePage),
  component: () => <PageState route="/auth/access/logout"><Page /></PageState>,
  server: { handlers: { POST: ({ request, context, params }) => servePageAction("/auth/access/logout", request, params, context) } }
});
