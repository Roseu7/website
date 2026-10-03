import { createFileRoute } from '@tanstack/react-router';
import Page from "~/routes/redirects/wsolver";
import { loadPage, resolvePage, PageState } from '~/framework/page';

export const Route = createFileRoute("/wsolver")({
  loaderDeps: ({ search }) => search,
  loader: ({ location }) => loadPage({ data: { route: "/wsolver", href: location.href } }).then(resolvePage),
  component: () => <PageState route="/wsolver"><Page /></PageState>
});
