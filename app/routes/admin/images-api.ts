import type { ActionFunctionArgs } from "~/framework/http";
import { requireArticlesAdmin } from "~/utils/articles/auth.server";
import { ARTICLE_IMAGE_URL_PREFIX } from "~/utils/articles/content";
import { getArticlesEnv } from "~/utils/articles/env.server";
import { requireSameOriginRequest } from "~/utils/request-origin.server";
import { readLimitedBytes } from "~/utils/request-body.server";
import { jsonError, jsonNoStore } from "~/utils/umigame/http.server";

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

// 拡張子やContent-Typeは偽れるので、ファイル先頭のバイト列で形式を決める。
// 基本はWebP。iOSのSafariはcanvasからWebPを書き出せないので、JPEGも受け付ける。
function detectImageType(bytes: Uint8Array) {
  const ascii = (start: number, end: number) => String.fromCharCode(...bytes.subarray(start, end));
  if (bytes.byteLength >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return { extension: "webp", contentType: "image/webp" };
  if (bytes.byteLength >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { extension: "jpg", contentType: "image/jpeg" };
  return null;
}

export async function action({ request, context }: ActionFunctionArgs) {
  requireSameOriginRequest(request);
  await requireArticlesAdmin(request, context);
  const bucket = getArticlesEnv(context).ARTICLE_ASSETS;
  if (!bucket) return jsonError(500, "NOT_CONFIGURED", "画像の保存先が設定されていません。");

  let bytes: Uint8Array;
  try {
    bytes = await readLimitedBytes(request, MAX_IMAGE_BYTES);
  } catch (error) {
    if (error instanceof Response && error.status === 413) return jsonError(413, "TOO_LARGE", "画像は2MBまでです。");
    throw error;
  }
  const type = detectImageType(bytes);
  if (!type) return jsonError(415, "UNSUPPORTED_IMAGE", "WebPかJPEGの画像だけを受け付けます。");

  const key = `articles/${new Date().getUTCFullYear()}/${crypto.randomUUID()}.${type.extension}`;
  // 画像を消したときに、見た人のブラウザに残る期間を1日までにする（既定の.webpは1年）。
  await bucket.put(key, bytes, { httpMetadata: { contentType: type.contentType, cacheControl: "public, max-age=86400" } });
  return jsonNoStore({ url: `${ARTICLE_IMAGE_URL_PREFIX}${key.slice("articles/".length)}` }, 201);
}
