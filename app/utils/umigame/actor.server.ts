import type { AppLoadContext } from "react-router";
import { createAnonymousActor, ensureAnonymousActor, requireAnonymousActor } from "./anon.server";
import { getOptionalUmigameUser } from "./auth.server";
import { getUmigameEnv, requireUmigameDb } from "./env.server";
import { isExistingUmigameUserId } from "./user.server";

export async function resolveUmigameActor(
  request: Request,
  context: AppLoadContext,
  createAnonymous: boolean,
) {
  const user = await getOptionalUmigameUser(request, context);
  if (user) {
    return { actorId: user.id, user, setCookie: null as string | null };
  }

  const anonymous = createAnonymous
    ? ensureAnonymousActor(request)
    : { actorId: requireAnonymousActor(request), setCookie: null };
  const env = getUmigameEnv(context);
  const db = requireUmigameDb(env);
  if (!(await isExistingUmigameUserId(db, anonymous.actorId))) {
    return { ...anonymous, user: null };
  }

  if (!createAnonymous) {
    throw Response.json(
      { error: { code: "SESSION_COOKIE_INVALID", message: "プレイセッションを確認できません。" } },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  return { ...createAnonymousActor(request), user: null };
}
