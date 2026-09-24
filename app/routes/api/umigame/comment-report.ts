import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { getOptionalUmigameUser } from "~/utils/umigame/auth.server";
import { reportCommentNotSpoiler } from "~/utils/umigame/comments.server";
import { getUmigameEnv, requireUmigameDb } from "~/utils/umigame/env.server";
import { jsonError, jsonNoStore, requirePost } from "~/utils/umigame/http.server";

export async function loader({}: LoaderFunctionArgs) {
  return jsonError(405, "METHOD_NOT_ALLOWED", "POSTのみ利用できます。");
}

export async function action({ request, params, context }: ActionFunctionArgs) {
  requirePost(request);
  const commentId = params.id?.trim();
  if (!commentId) {
    return jsonError(400, "INVALID_COMMENT", "コメントIDが不正です。");
  }

  const user = await getOptionalUmigameUser(request, context);
  if (!user) {
    return jsonError(401, "LOGIN_REQUIRED", "報告にはログインが必要です。");
  }

  try {
    await reportCommentNotSpoiler(
      requireUmigameDb(getUmigameEnv(context)),
      commentId,
      user.id,
    );
    return jsonNoStore({ reported: true });
  } catch (error) {
    if (error instanceof Response) {
      return jsonError(error.status, "REPORT_REJECTED", await error.text());
    }
    console.error("Umigame comment report failed.", error);
    return jsonError(500, "REPORT_FAILED", "報告を送信できませんでした。", true);
  }
}
