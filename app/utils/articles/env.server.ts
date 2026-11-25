import type { AppLoadContext } from "~/framework/http";

export interface ArticlesEnv {
  ARTICLES_DB?: D1Database;
  ARTICLE_ASSETS?: R2Bucket;
  CF_ACCESS_TEAM_DOMAIN?: string;
  ARTICLES_ACCESS_AUD?: string;
  ARTICLES_ADMIN_EMAILS?: string;
}

export function getArticlesEnv(context: AppLoadContext): ArticlesEnv {
  return (context.cloudflare?.env ?? {}) as ArticlesEnv;
}

export function requireArticlesDb(env: ArticlesEnv) {
  if (!env.ARTICLES_DB) {
    throw new Response("Articles database is not configured.", { status: 500 });
  }
  return env.ARTICLES_DB;
}
