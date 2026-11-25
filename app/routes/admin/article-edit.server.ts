import type { LoaderFunctionArgs } from "~/framework/http";
import { requireArticlesAdmin } from "~/utils/articles/auth.server";
import { isArticleId } from "~/utils/articles/content";
import { getArticlesEnv, requireArticlesDb } from "~/utils/articles/env.server";
import { getEditableArticle, listArticleTags } from "~/utils/articles/store.server";

export async function loader({ request, params, context }: LoaderFunctionArgs) {
  await requireArticlesAdmin(request, context);
  const id = params.id ?? "";
  const article = isArticleId(id) ? await getEditableArticle(requireArticlesDb(getArticlesEnv(context)), id) : null;
  if (!article) throw new Response("Not Found", { status: 404 });
  return { article, tagSuggestions: await listArticleTags(requireArticlesDb(getArticlesEnv(context))) };
}
