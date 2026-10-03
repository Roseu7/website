
import { data, redirect, type ActionFunctionArgs, type LoaderFunctionArgs } from "~/framework/http";

import { type UmigameAvatarType } from "~/utils/umigame/avatar";

import { safeReturnTo } from "~/utils/return-to";

import { requireSameOriginRequest } from "~/utils/request-origin.server";

import { MAX_FORM_BODY_BYTES, readLimitedFormData } from "~/utils/request-body.server";

import { logoutUmigame, requireUmigameUser } from "~/utils/umigame/auth.server";

import { getUmigameEnv, requireUmigameDb } from "~/utils/umigame/env.server";

import { evaluateDisplayName } from "~/utils/umigame/profile-moderation.server";

import { checkDisplayNameRateLimit } from "~/utils/umigame/rate-limit.server";

import { deleteUmigameAccount, updateUmigameProfile } from "~/utils/umigame/user.server";

export async function loader({ request, context }: LoaderFunctionArgs) {
  return { user: await requireUmigameUser(request, context) };
}

export async function action({ request, context }: ActionFunctionArgs) {
  requireSameOriginRequest(request);
  const user = await requireUmigameUser(request, context);
  const form = await readLimitedFormData(request, MAX_FORM_BODY_BYTES);
  const intent = String(form.get("intent") ?? "");

  if (intent === "delete-account") {
    const confirmations = [
      "confirmIrreversible",
      "confirmContentRemains",
      "confirmSeparateContact",
    ];
    if (confirmations.some((name) => form.get(name) !== "yes")) {
      return data(
        { error: "退会内容をすべて確認してからチェックを入れてください。" },
        { status: 400 },
      );
    }

    const env = getUmigameEnv(context);
    const db = requireUmigameDb(env);
    await deleteUmigameAccount(db, user.id);
    return logoutUmigame(request, context);
  }

  const displayName = String(form.get("displayName") ?? "").trim();
  if (displayName.length < 1 || displayName.length > 40) {
    return data(
      { error: "表示名は1〜40文字で入力してください。" },
      { status: 400 },
    );
  }
  const env = getUmigameEnv(context);

  if (displayName !== user.displayName) {
    if (!(await checkDisplayNameRateLimit(env, user.id))) {
      return data(
        { error: "表示名の変更回数が多すぎます。少し時間を空けてから試してください。" },
        { status: 429 },
      );
    }

    try {
      const moderation = await evaluateDisplayName(env, user.id, displayName);
      if (!moderation.allowed) {
        return data(
          { error: "この表示名は使用できません。別の名前を入力してください。" },
          { status: 400 },
        );
      }
    } catch (error) {
      console.error("Display-name moderation failed.", error);
      return data(
        { error: "表示名を確認できませんでした。もう一度試してください。" },
        { status: 503 },
      );
    }
  }

  const rawType = String(form.get("avatarType") ?? "lucide");
  const avatarType: UmigameAvatarType =
    rawType === "oauth" || rawType === "generated" ? rawType : "lucide";
  const db = requireUmigameDb(env);
  await updateUmigameProfile(db, user.id, {
    displayName,
    avatarType,
    avatarIcon: form.get("avatarIcon"),
    avatarColor: form.get("avatarColor"),
  });

  const returnTo = safeReturnTo(String(form.get("returnTo") ?? ""));
  return redirect(
    returnTo === "/" ? "/games/umigame/settings/profile" : returnTo,
  );
}
