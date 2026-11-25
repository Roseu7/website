import { redirect, type ActionFunctionArgs, type LoaderFunctionArgs } from "~/framework/http";
import { requireArticlesAdmin } from "~/utils/articles/auth.server";
import { getArticlesEnv, requireArticlesDb } from "~/utils/articles/env.server";
import { createArticle, listArticles } from "~/utils/articles/store.server";

export async function loader({ request, context }: LoaderFunctionArgs) {
  await requireArticlesAdmin(request, context);
  return { articles: await listArticles(requireArticlesDb(getArticlesEnv(context))) };
}

// 同じオリジンの確認は runPageAction が行う。
export async function action({ request, context }: ActionFunctionArgs) {
  await requireArticlesAdmin(request, context);
  const id = await createArticle(requireArticlesDb(getArticlesEnv(context)));
  return redirect(`/admin/articles/${id}`, 303);
}
