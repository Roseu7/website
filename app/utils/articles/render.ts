import type { JSONContent } from "@tiptap/core";
import { renderToHTMLString } from "@tiptap/static-renderer/pm/html-string";
import { YOUTUBE_ID_PATTERN, articleExtensions, isArticleImageUrl } from "./content";

const HEADING_ID_PATTERN = /^[0-9abcdefghjkmnpqrstvwxyz]{8}$/;

// 保存時の検証が今より緩かった時期のJSONが残っていても、外部の画像や不正な動画IDは出さない。
// 合わないものだけを省き、本文のほかの部分は読めるようにする。
function withoutUnsafeEmbeds(node: JSONContent): JSONContent {
  if (!node.content) return node;
  const content = node.content
    .filter(child => {
      if (child.type === "figure") return isArticleImageUrl(child.attrs?.src);
      if (child.type === "youtube") return typeof child.attrs?.videoId === "string" && YOUTUBE_ID_PATTERN.test(child.attrs.videoId);
      return true;
    })
    .map(withoutUnsafeEmbeds);
  return { ...node, content };
}

// 本文をHTMLの文字列にする。公開ページ（サーバー）と管理画面のプレビュー（ブラウザ）で同じ関数を使う。
// 文字列にするのは、読者のブラウザにTiptapやProseMirrorを配らずに済ませるため。
// 出力はスキーマの renderHTML から作られ、テキストと属性はレンダラーがエスケープする。
// 保存時の検証（第8節）と合わせて、スキーマに無い要素や危ないURLは出ない。
export function renderArticleHtml(body: JSONContent) {
  return renderToHTMLString({
    extensions: articleExtensions,
    content: withoutUnsafeEmbeds(body),
    options: {
      nodeMapping: {
        // 見出しの横に、その節へのリンクをコピーするボタンを置く。ボタンを見出しの中に入れると、
        // 見出しを読み上げたときにボタンの名前まで読まれるので、見出しの外に並べる。
        heading: ({ node, children }) => {
          const level = node.attrs.level === 3 ? 3 : 2;
          const id = typeof node.attrs.id === "string" && HEADING_ID_PATTERN.test(node.attrs.id) ? node.attrs.id : null;
          const inner = Array.isArray(children) ? children.join("") : (children ?? "");
          if (!id) return `<h${level}>${inner}</h${level}>`;
          const tip = `anchor-tip-${id}`;
          return `<div class="article-heading" data-level="${level}"><h${level} id="${id}">${inner}</h${level}>`
            + `<span class="article-anchor-wrap"><button type="button" class="article-anchor" data-anchor="${id}" aria-label="この節へのリンクをコピー" aria-describedby="${tip}"><span aria-hidden="true">#</span></button>`
            + `<span class="article-anchor-tip" id="${tip}" role="tooltip">この節へのリンクをコピー</span></span></div>`;
        },
      },
    },
  });
}
