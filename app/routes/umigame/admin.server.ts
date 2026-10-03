import { redirect, type ActionFunctionArgs, type LoaderFunctionArgs } from "~/framework/http";

import { requireSameOriginRequest } from "~/utils/request-origin.server";

import { MAX_FORM_BODY_BYTES, readLimitedFormData } from "~/utils/request-body.server";

import { applyAdminCommentAction, applyAdminPuzzleAction, getAdminJevSummary, listAdminFlaggedComments, listAdminPuzzleReviews, requireUmigameAdmin } from "~/utils/umigame/admin.server";

import { getUmigameEnv, requireUmigameDb } from "~/utils/umigame/env.server";

export async function loader({ request, context }: LoaderFunctionArgs) {
  await requireUmigameAdmin(request, context);
  const db = requireUmigameDb(getUmigameEnv(context));  const [puzzles, comments, jev] = await Promise.all([
    listAdminPuzzleReviews(db),
    listAdminFlaggedComments(db),
    getAdminJevSummary(db),
  ]);
  return { puzzles, comments, jev };
}

export async function action({ request, context }: ActionFunctionArgs) {
  requireSameOriginRequest(request);
  const admin = await requireUmigameAdmin(request, context);
  const env = getUmigameEnv(context);
  const form = await readLimitedFormData(request, MAX_FORM_BODY_BYTES);
  const target = String(form.get("target") ?? "");
  const id = String(form.get("id") ?? "");
  const actionName = String(form.get("action") ?? "");

  if (target === "puzzle" && ["publish", "hide", "reject", "restore", "rerun"].includes(actionName)) {
    await applyAdminPuzzleAction(env, admin.id, id, actionName as "publish" | "hide" | "reject" | "restore" | "rerun");
    return redirect("/games/umigame/admin");
  }
  if (target === "comment" && ["show", "spoiler", "hide", "rerun"].includes(actionName)) {
    await applyAdminCommentAction(env, admin.id, id, actionName as "show" | "spoiler" | "hide" | "rerun");
    return redirect("/games/umigame/admin");
  }
  throw new Response("Invalid admin action.", { status: 400 });
}
