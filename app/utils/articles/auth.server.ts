import type { AppLoadContext } from "~/framework/http";
import { getAccessIdentity } from "~/utils/access.server";
import { getArticlesEnv } from "./env.server";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1"]);

function parseAdminEmails(value: string | undefined) {
  return new Set(
    (value ?? "")
      .split(",")
      .map(email => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

// Accessのポリシーを誤って広げても、ここで本人以外を止める。
// 管理画面の存在を知らせないため、拒否はうみがめの管理画面と同じく404にする。
export async function requireArticlesAdmin(request: Request, context: AppLoadContext) {
  // 本番ではホスト名がlocalhostのリクエストは届かない想定だが、念のため開発ビルドに限る。
  if (import.meta.env.DEV && LOCAL_HOSTS.has(new URL(request.url).hostname)) {
    return { email: "local" };
  }

  const env = getArticlesEnv(context);
  const audience = env.ARTICLES_ACCESS_AUD?.trim();
  const adminEmails = parseAdminEmails(env.ARTICLES_ADMIN_EMAILS);
  if (!audience || adminEmails.size === 0) {
    console.error("Articles admin access is not configured.", {
      hasAudience: Boolean(audience),
      adminEmailCount: adminEmails.size,
    });
    throw new Response("Not Found", { status: 404 });
  }

  const identity = await getAccessIdentity(request, context, audience);
  if (!identity || !adminEmails.has(identity.email)) {
    throw new Response("Not Found", { status: 404 });
  }
  return { email: identity.email };
}
