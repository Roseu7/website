import { createFileRoute } from '@tanstack/react-router';
import Page from "~/routes/admin/article-edit";
import { meta } from "~/routes/admin/article-edit.meta";
import { loadPage, resolvePage, PageState, pageHead } from '~/framework/page';

export const Route = createFileRoute("/admin_/articles_/$id")({
  loaderDeps: ({ search }) => search,
  loader: ({ location }) => loadPage({ data: { route: "/admin/articles/:id", href: location.href } }).then(resolvePage),
  component: () => <PageState route="/admin/articles/:id"><Page /></PageState>,
  head: ({ loaderData }) => pageHead(meta, loaderData),
});
