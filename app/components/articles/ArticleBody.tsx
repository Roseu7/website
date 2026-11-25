import type { JSONContent } from "@tiptap/core";
import { renderToReactElement } from "@tiptap/static-renderer/pm/react";
import { articleExtensions } from "~/utils/articles/content";

// 公開ページ（サーバー側）とプレビュー（ブラウザ側）で同じ描画を使う。
// 描画はスキーマの renderHTML から作るので、スキーマに無い要素は出力されない。
export function ArticleBody({ body }: { body: JSONContent }) {
  return <div className="article-body">{renderToReactElement({ extensions: articleExtensions, content: body })}</div>;
}
