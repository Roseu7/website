import { Extension, Node, getSchema, markInputRule, nodePasteRule, type Extensions, type JSONContent } from "@tiptap/core";
import Heading from "@tiptap/extension-heading";
import Highlight from "@tiptap/extension-highlight";
import Link from "@tiptap/extension-link";
import { ListItem } from "@tiptap/extension-list";
import StarterKit from "@tiptap/starter-kit";
import { Plugin } from "@tiptap/pm/state";
import { canJoin } from "@tiptap/pm/transform";

// 32文字。32は256を割り切るので、乱数1バイトの下位5ビットで偏りなく選べる。
const ID_ALPHABET = "0123456789abcdefghjkmnpqrstvwxyz";
export const ARTICLE_ID_PATTERN = /^[0-9abcdefghjkmnpqrstvwxyz]{12}$/;
const HEADING_ID_PATTERN = /^[0-9abcdefghjkmnpqrstvwxyz]{8}$/;
export const YOUTUBE_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;
export const ARTICLE_IMAGE_URL_PREFIX = "https://assets.roseu.net/articles/";
// iOSのSafariはcanvasからWebPを書き出せないので、JPEGも受け付ける。
const ARTICLE_IMAGE_URL_PATTERN = /^https:\/\/assets\.roseu\.net\/articles\/\d{4}\/[0-9a-f-]{36}\.(?:webp|jpg)$/;
const ALLOWED_LINK_PATTERN = /^(?:https?:\/\/|mailto:)/i;
export const MAX_BODY_JSON_BYTES = 512 * 1024;
export const MAX_TITLE_LENGTH = 200;
export const MAX_SUMMARY_LENGTH = 400;

export function randomId(length: number) {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, byte => ID_ALPHABET[byte & 31]).join("");
}

export const isArticleId = (value: string) => ARTICLE_ID_PATTERN.test(value);
export const isArticleImageUrl = (value: unknown): value is string => typeof value === "string" && ARTICLE_IMAGE_URL_PATTERN.test(value);
export const isAllowedLink = (value: unknown): value is string => typeof value === "string" && ALLOWED_LINK_PATTERN.test(value.trim());

// 見出しのIDは節への直リンクに使うので、文言を直しても変えない。
// 無いもの（新しい見出し）と重複したもの（貼り付けた見出し）にだけ新しいIDを振る。
const ArticleHeading = Heading.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      id: {
        default: null,
        // 外から貼った見出しのIDは形式が合わないので持ち込まない。
        parseHTML: () => null,
        renderHTML: (attributes: { id?: string | null }) => attributes.id ? { id: attributes.id } : {},
      },
    };
  },
  parseHTML() {
    return [1, 2, 3, 4, 5, 6].map(level => ({ tag: `h${level}`, attrs: { level: level <= 2 ? 2 : 3 } }));
  },
  addProseMirrorPlugins() {
    const type = this.type;
    return [new Plugin({
      appendTransaction: (transactions, _old, state) => {
        if (!transactions.some(transaction => transaction.docChanged)) return null;
        const seen = new Set<string>();
        const tr = state.tr;
        state.doc.descendants((node, pos) => {
          if (node.type !== type) return;
          const id = node.attrs.id as string | null;
          if (id && HEADING_ID_PATTERN.test(id) && !seen.has(id)) { seen.add(id); return false; }
          let next = randomId(8);
          while (seen.has(next)) next = randomId(8);
          seen.add(next);
          tr.setNodeMarkup(pos, undefined, { ...node.attrs, id: next });
          return false;
        });
        return tr.docChanged ? tr.setMeta("addToHistory", false) : null;
      },
    })];
  },
}).configure({ levels: [2, 3] });

export const Figure = Node.create({
  name: "figure",
  group: "block",
  content: "inline*",
  marks: "",
  draggable: true,
  isolating: true,
  addAttributes() {
    return {
      src: { default: null },
      alt: { default: "" },
      width: { default: null },
      height: { default: null },
    };
  },
  parseHTML() {
    return [{
      tag: "figure",
      contentElement: (dom: HTMLElement) => dom.querySelector("figcaption") ?? dom.ownerDocument.createElement("figcaption"),
      // ほかのサイトの画像は貼り付けても持ち込まない。記事の画像はR2に上げたものだけにする。
      getAttrs: (dom: HTMLElement) => {
        const image = dom.querySelector("img");
        const src = image?.getAttribute("src");
        if (!isArticleImageUrl(src)) return false;
        const width = Number(image?.getAttribute("width")) || null;
        const height = Number(image?.getAttribute("height")) || null;
        return { src, alt: image?.getAttribute("alt") ?? "", width, height };
      },
    }];
  },
  // キャプションの中でEnterを押したら、画像の下の段落へ抜ける（無ければ作る）。
  addKeyboardShortcuts() {
    return {
      Enter: ({ editor }) => {
        const { $from } = editor.state.selection;
        if ($from.parent.type !== this.type) return false;
        const after = $from.after();
        const next = editor.state.doc.resolve(after).nodeAfter;
        if (next?.type.name === "paragraph") return editor.chain().setTextSelection(after + 1).scrollIntoView().run();
        return editor.chain().insertContentAt(after, { type: "paragraph" }).setTextSelection(after + 1).scrollIntoView().run();
      },
    };
  },
  renderHTML({ node }) {
    const { src, alt, width, height } = node.attrs as { src: string; alt: string; width: number | null; height: number | null };
    return ["figure", { class: "article-figure" },
      ["img", { src, alt, width: width ?? undefined, height: height ?? undefined, loading: "lazy", decoding: "async" }],
      ["figcaption", 0]];
  },
});

const YOUTUBE_URL = /(?:https?:\/\/)?(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?(?:\S*?&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})\S*/g;

export function parseYoutubeId(url: string) {
  YOUTUBE_URL.lastIndex = 0;
  const match = YOUTUBE_URL.exec(url.trim());
  return match?.[1] ?? null;
}

export const YoutubeEmbed = Node.create({
  name: "youtube",
  group: "block",
  atom: true,
  draggable: true,
  addAttributes() {
    return { videoId: { default: null } };
  },
  parseHTML() {
    return [{
      tag: "div[data-youtube-video-id]",
      getAttrs: (dom: HTMLElement) => {
        const videoId = dom.getAttribute("data-youtube-video-id");
        return videoId && YOUTUBE_ID_PATTERN.test(videoId) ? { videoId } : false;
      },
    }];
  },
  renderHTML({ node }) {
    const videoId = node.attrs.videoId as string;
    return ["div", { class: "article-embed", "data-youtube-video-id": videoId },
      ["iframe", {
        src: `https://www.youtube-nocookie.com/embed/${videoId}`,
        title: "YouTube動画",
        allow: "accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture",
        // HTMLの属性名は大文字小文字を区別しないので、エディタのDOMでもHTML文字列の描画でもこのままでよい。
        allowFullScreen: "true",
        loading: "lazy",
        referrerPolicy: "strict-origin-when-cross-origin",
      }]];
  },
  addPasteRules() {
    return [nodePasteRule({ find: YOUTUBE_URL, type: this.type, getAttributes: match => ({ videoId: match[1] }) })];
  },
});

// リンクで保存するのは href だけ。貼り付け元の rel・target・class・title を持ち込むと、
// 外部リンクに付ける noopener noreferrer が上書きされるので、ほかの属性は固定値にする。
const LINK_FIXED_ATTRS = { target: null, rel: "noopener noreferrer", class: null, title: null } as const;
const ArticleLink = Link.extend({
  // 自動リンクを有効にすると、Tiptapはリンクの直後に打った文字もリンクに含める。
  // 見た目では続きがリンクかどうか分からないので、リンクの外に打った文字はリンクにしない。
  inclusive: () => false,
  addAttributes() {
    const fixed = Object.fromEntries(Object.entries(LINK_FIXED_ATTRS).map(([name, value]) => [name, { default: value, parseHTML: () => value }]));
    return { ...this.parent?.(), ...fixed };
  },
}).configure({
  openOnClick: false,
  autolink: true,
  linkOnPaste: true,
  defaultProtocol: "https",
  isAllowedUri: url => isAllowedLink(url),
});

// 標準の `**太字**` の入力ルールは直前に空白が要るので、日本語の文中では効かない。空白なしでも変換する。
// 引用は、空の段落でEnterを押したら外へ抜ける（リストと同じ感覚にする）。
const JapaneseFriendlyInput = Extension.create({
  name: "japaneseFriendlyInput",
  addInputRules() {
    return [markInputRule({ find: /(\*\*(?!\s+\*\*)((?:[^*]+))\*\*(?!\s+\*\*))$/, type: this.editor.schema.marks.bold })];
  },
  addKeyboardShortcuts() {
    return {
      Enter: ({ editor }) => {
        const { $from, empty } = editor.state.selection;
        if (!empty || $from.depth < 2 || $from.node(-1).type.name !== "blockquote") return false;
        if ($from.parent.type.name !== "paragraph" || $from.parent.content.size > 0) return false;
        return editor.commands.lift("blockquote");
      },
    };
  },
});

// リストの項目は、見出しで始めてもよい（目次に出したい項目のため）。2つ目以降には段落や入れ子のリストを置ける。
const ArticleListItem = ListItem.extend({ content: "(paragraph | heading) block*" });

// 2つ目以降の項目の先頭でBackspaceを押したら、番号だけを外して前の項目の続きの段落にする。
// 標準（ListKeymap）はリストの外へ出すので、番号付きリストが2つに分かれて番号が1から振り直される。
// ListKeymapより先に判定するため、優先度を上げる。
const ListContinuation = Extension.create({
  name: "listContinuation",
  priority: 101,
  addKeyboardShortcuts() {
    return {
      Backspace: ({ editor }) => {
        const { selection, doc } = editor.state;
        const { $from } = selection;
        if (!selection.empty || $from.parentOffset !== 0 || $from.depth < 3) return false;
        if ($from.node(-1).type.name !== "listItem" || $from.index(-1) !== 0 || $from.index(-2) === 0) return false;
        const itemStart = $from.before(-1);
        if (!canJoin(doc, itemStart)) return false;
        return editor.commands.command(({ tr }) => { tr.join(itemStart); return true; });
      },
    };
  },
});

// 文字色やフォントの拡張を入れないので、貼り付けたそれらの書式はスキーマに無く自然に落ちる。
export const articleExtensions: Extensions = [
  StarterKit.configure({ heading: false, link: false, listItem: false }),
  ArticleListItem,
  ListContinuation,
  JapaneseFriendlyInput,
  ArticleLink,
  ArticleHeading,
  Highlight,
  Figure,
  YoutubeEmbed,
];

export function emptyArticleBody(): JSONContent {
  return { type: "doc", content: [{ type: "paragraph" }] };
}

export class ArticleContentError extends Error {}

export const MAX_TAGS = 10;
export const MAX_TAG_LENGTH = 24;

// 入力されたタグをそろえる。先頭の「#」は付けて書く人が多いので外し、空白は1つにまとめる。
export function normalizeTag(raw: string) {
  return raw.replace(/[\p{Cc}\p{Cf}]/gu, "").replace(/^[#＃]+/, "").replace(/\s+/g, " ").trim();
}

// 大文字と小文字だけが違うタグは同じものとみなし、先に書いたほうを残す。
export function validateTags(value: unknown): string[] {
  if (!Array.isArray(value)) throw new ArticleContentError("タグの形式が正しくありません。");
  const tags: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (typeof item !== "string") throw new ArticleContentError("タグの形式が正しくありません。");
    const tag = normalizeTag(item);
    if (!tag) continue;
    if (tag.length > MAX_TAG_LENGTH) throw new ArticleContentError(`タグは${MAX_TAG_LENGTH}文字までです。`);
    if (seen.has(tag.toLowerCase())) continue;
    seen.add(tag.toLowerCase());
    tags.push(tag);
  }
  if (tags.length > MAX_TAGS) throw new ArticleContentError(`タグは${MAX_TAGS}個までです。`);
  return tags;
}

let cachedSchema: ReturnType<typeof getSchema> | undefined;
function articleSchema() {
  cachedSchema ??= getSchema(articleExtensions);
  return cachedSchema;
}

function walk(node: JSONContent, visit: (node: JSONContent) => void) {
  visit(node);
  for (const child of node.content ?? []) walk(child, visit);
}

// スキーマに合うかを確かめたうえで、属性の値も検証する。戻り値は正規化したJSON。
export function validateArticleBody(value: unknown): JSONContent {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ArticleContentError("本文の形式が正しくありません。");
  let normalized: JSONContent;
  try {
    const node = articleSchema().nodeFromJSON(value);
    node.check();
    normalized = node.toJSON() as JSONContent;
  } catch {
    throw new ArticleContentError("本文に使えない要素が含まれています。");
  }
  if (normalized.type !== "doc") throw new ArticleContentError("本文の形式が正しくありません。");
  const headingIds = new Set<string>();
  walk(normalized, node => {
    for (const mark of node.marks ?? []) {
      if (mark.type !== "link") continue;
      if (!isAllowedLink(mark.attrs?.href)) throw new ArticleContentError("リンクに使えないURLがあります。");
      mark.attrs = { href: (mark.attrs!.href as string).trim(), ...LINK_FIXED_ATTRS };
    }
    if (node.type === "figure") {
      const { src, alt, width, height } = node.attrs ?? {};
      if (!isArticleImageUrl(src)) throw new ArticleContentError("画像のURLが正しくありません。");
      if (typeof alt !== "string" || alt.length > 300) throw new ArticleContentError("画像の代替テキストが正しくありません。");
      for (const size of [width, height]) {
        if (size !== null && (!Number.isInteger(size) || size < 1 || size > 10000)) throw new ArticleContentError("画像の大きさが正しくありません。");
      }
    }
    if (node.type === "youtube" && !(typeof node.attrs?.videoId === "string" && YOUTUBE_ID_PATTERN.test(node.attrs.videoId))) {
      throw new ArticleContentError("YouTubeの動画IDが正しくありません。");
    }
    if (node.type === "heading") {
      const id = node.attrs?.id;
      if (node.attrs?.level !== 2 && node.attrs?.level !== 3) throw new ArticleContentError("見出しはH2とH3だけ使えます。");
      if (typeof id !== "string" || !HEADING_ID_PATTERN.test(id) || headingIds.has(id)) throw new ArticleContentError("見出しのIDが正しくありません。");
      headingIds.add(id);
    }
  });
  return normalized;
}

function textOf(node: JSONContent): string {
  if (node.type === "text") return node.text ?? "";
  if (node.type === "hardBreak") return "\n";
  return (node.content ?? []).map(textOf).join("");
}

export interface OutlineItem { id: string; level: 2 | 3; text: string }

// エディタの見出し一覧と、公開ページの目次で共通に使う。引用やリストの中の見出しも本文の順に拾う。
export function articleOutline(body: JSONContent): OutlineItem[] {
  const items: OutlineItem[] = [];
  walk(body, node => {
    if (node.type === "heading" && typeof node.attrs?.id === "string") {
      items.push({ id: node.attrs.id, level: node.attrs.level === 3 ? 3 : 2, text: textOf(node).trim() });
    }
  });
  return items;
}

// 文字数は本文（見出し・キャプション・コードを含む）の文字だけを数え、空白・タブ・改行・全角スペースは数えない。
// 公開側の一覧はD1のSQLで同じ数え方をしているので（store.server.ts の CHAR_COUNT）、変えるときは両方を直す。
const UNCOUNTED_CHARACTERS = /[ \t\n　]/g;
export function articleCharCount(node: JSONContent): number {
  if (node.type === "text") return [...(node.text ?? "").replace(UNCOUNTED_CHARACTERS, "")].length;
  return (node.content ?? []).reduce((sum, child) => sum + articleCharCount(child), 0);
}

// 日本語の文章を読む速さを1分に500字とみなす。短い記事も「1分」と出す。
const READING_CHARS_PER_MINUTE = 500;
export function readingMinutes(charCount: number) {
  return Math.max(1, Math.ceil(charCount / READING_CHARS_PER_MINUTE));
}

export function articleExcerpt(body: JSONContent, maxLength = 120) {
  const paragraph = (body.content ?? []).find(node => node.type === "paragraph" && textOf(node).trim());
  const text = paragraph ? textOf(paragraph).replace(/\s+/g, " ").trim() : "";
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

// 共有したときのカードに使う、本文の最初の画像。入れ子（引用やリストの中）も見る。
export function articleFirstImage(node: JSONContent): { src: string; alt: string; width: number | null; height: number | null } | null {
  if (node.type === "figure" && typeof node.attrs?.src === "string") {
    const { src, alt, width, height } = node.attrs as { src: string; alt?: string; width?: number | null; height?: number | null };
    return { src, alt: alt ?? "", width: width ?? null, height: height ?? null };
  }
  for (const child of node.content ?? []) {
    const found = articleFirstImage(child);
    if (found) return found;
  }
  return null;
}
