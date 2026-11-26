import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { flushSync } from "react-dom";
import { Extension, type JSONContent } from "@tiptap/core";
import { Selection, TextSelection } from "@tiptap/pm/state";
import { EditorContent, ReactNodeViewRenderer, useEditor, type Editor } from "@tiptap/react";
import { Placeholder } from "@tiptap/extensions";
import InvisibleCharacters, { HardBreakNode, InvisibleCharacter, ParagraphNode } from "@tiptap/extension-invisible-characters";
import { ArrowLeft, ExternalLink, Eye, PenLine } from "lucide-react";
import { useLoaderData } from "~/framework/navigation";
import { ArticleBody } from "~/components/articles/ArticleBody";
import { EditorToolbar } from "~/components/articles/EditorToolbar";
import { LinkBubble } from "~/components/articles/LinkBubble";
import { TagInput } from "~/components/articles/TagInput";
import { FigureView } from "~/components/articles/FigureView";
import { uploadArticleImage, type UploadedImage } from "~/components/articles/image-upload";
import { findBackup, removeStoredBackup, useArticleSaver, type PublishMode, type StoredBackup } from "~/components/articles/useArticleSaver";
import {
  Figure, MAX_SUMMARY_LENGTH, MAX_TITLE_LENGTH, articleCharCount, articleExtensions, articleOutline, isAllowedLink, parseYoutubeId, readingMinutes,
} from "~/utils/articles/content";
import { renderArticleHtml } from "~/utils/articles/render";
import type { loader } from "./article-edit.server";

const STATUS_LABEL = { draft: "下書き", unlisted: "限定公開", published: "公開中" } as const;
const SAVE_LABEL = { saved: "保存済み", dirty: "未保存", saving: "保存中…", error: "保存できていません", conflict: "競合しています" } as const;

// 画像は、position がある段落の直後に入れる（引用やリストの中ならその中に入る）。空の段落ならそれと置き換える。
// 戻り値は、置いた画像の下の空の段落の中の位置。続けて入れる画像はそこに入る。
function insertFigure(editor: Editor, position: number, image: UploadedImage) {
  const $pos = editor.state.doc.resolve(Math.min(position, editor.state.doc.content.size));
  const block = $pos.parent.isTextblock && $pos.depth > 0 ? $pos.parent : null;
  const replace = block?.type.name === "paragraph" && block.content.size === 0;
  const from = block ? (replace ? $pos.before() : $pos.after()) : $pos.pos;
  const to = block && replace ? $pos.after() : from;
  editor.chain()
    .insertContentAt({ from, to }, [
      { type: "figure", attrs: { src: image.url, alt: "", width: image.width, height: image.height } },
      { type: "paragraph" },
    ])
    .run();
  const next = from + (editor.state.doc.nodeAt(from)?.nodeSize ?? 0) + 1;
  editor.chain().focus().setTextSelection(next).scrollIntoView().run();
  return next;
}

// 上下の矢印で段落の境目を越えるときは、ブラウザに任せずに移動先を決める。
// 編集中の印（¶）や画像の操作ボタンのような編集できない要素があると、ブラウザによってはカーソルがそこで止まる。
// 横の位置は、移動先の行のうち今のカーソルと同じ横位置のところにする（測れなければ段落の端）。
function moveAcrossBlocks(editor: Editor, direction: "up" | "down") {
  const { view, state } = editor;
  const { selection } = state;
  if (!(selection instanceof TextSelection) || !selection.empty || view.composing) return false;
  const { $head } = selection;
  // 空の行は1行しかない。endOfTextblock は空の行の中の印や案内文の位置で測るので、空の行では見ない。
  if ($head.parent.content.size > 0 && !view.endOfTextblock(direction)) return false;
  const boundary = direction === "up" ? $head.before() : $head.after();
  const target = Selection.findFrom(state.doc.resolve(boundary), direction === "up" ? -1 : 1);
  if (!target) return false;
  let next: Selection = target;
  if (target instanceof TextSelection) {
    const left = view.coordsAtPos($head.pos).left;
    const line = view.coordsAtPos(target.head);
    const found = view.posAtCoords({ left, top: (line.top + line.bottom) / 2 });
    if (found && state.doc.resolve(found.pos).parent === target.$head.parent) next = TextSelection.create(state.doc, found.pos);
  }
  view.dispatch(state.tr.setSelection(next).scrollIntoView());
  return true;
}

// カーソルが、上に固定した帯・ツールバーと、下に固定したツールバー（とキーボード）の間に見えるようにスクロールする。
function revealCaret(editor: Editor) {
  const viewport = window.visualViewport;
  const viewTop = viewport?.offsetTop ?? 0;
  const viewBottom = viewTop + (viewport?.height ?? window.innerHeight);
  let top = viewTop + 16;
  let bottom = viewBottom - 24;
  for (const element of document.querySelectorAll<HTMLElement>(".article-admin__bar, .article-toolbar")) {
    const position = getComputedStyle(element).position;
    const rect = element.getBoundingClientRect();
    if (position === "fixed" && rect.top > (viewTop + viewBottom) / 2) bottom = Math.min(bottom, rect.top - 16);
    else if (position === "sticky" || position === "fixed") top = Math.max(top, rect.bottom + 16);
  }
  const coords = editor.view.coordsAtPos(editor.state.selection.from);
  if (coords.bottom > bottom) window.scrollBy({ top: coords.bottom - bottom });
  else if (coords.top < top) window.scrollBy({ top: coords.top - top });
}

// 画面のキーボードの高さを --keyboard-offset に入れ、スマホのツールバーをその上に置く。
function useKeyboardOffset() {
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const root = document.documentElement;
    const update = () => {
      const offset = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
      root.style.setProperty("--keyboard-offset", `${offset}px`);
      root.toggleAttribute("data-keyboard-open", offset > 0);
    };
    update();
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    return () => {
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
      root.style.removeProperty("--keyboard-offset");
      root.removeAttribute("data-keyboard-open");
    };
  }, []);
}

// 上の帯は折り返すと高さが変わるので、実際の高さを測って、ツールバーをその真下に付ける。
// 帯の要素が付いた時点で測り始めるよう、ref は state で受け取る。
function useBarHeight() {
  const [bar, setBar] = useState<HTMLElement | null>(null);
  useEffect(() => {
    const owner = bar?.parentElement;
    if (!bar || !owner) return;
    const observer = new ResizeObserver(([entry]) => {
      owner.style.setProperty("--article-bar-height", `${entry.borderBoxSize[0]?.blockSize ?? entry.target.getBoundingClientRect().height}px`);
    });
    observer.observe(bar);
    return () => observer.disconnect();
  }, [bar]);
  return setBar;
}

function useDialog() {
  const ref = useRef<HTMLDialogElement>(null);
  return { ref, open: () => ref.current?.showModal(), close: () => ref.current?.close() };
}

export default function ArticleEditPage() {
  const { article, tagSuggestions } = useLoaderData<typeof loader>();
  const [title, setTitle] = useState(article.title);
  const [summary, setSummary] = useState(article.summary);
  const [tags, setTags] = useState(article.tags);
  const [status, setStatus] = useState(article.status);
  const [hasUnpublishedChanges, setHasUnpublishedChanges] = useState(article.hasUnpublishedChanges);
  const [preview, setPreview] = useState<string | null>(null);
  const [imageJobs, setImageJobs] = useState(0);
  const [notice, setNotice] = useState("");
  const [backup, setBackup] = useState<StoredBackup | null>(null);
  const [linkError, setLinkError] = useState("");
  const [outline, setOutline] = useState(() => articleOutline(article.body as JSONContent));
  const [charCount, setCharCount] = useState(() => articleCharCount(article.body as JSONContent));
  const titleRef = useRef(title);
  const summaryRef = useRef(summary);
  const tagsRef = useRef(tags);
  titleRef.current = title;
  summaryRef.current = summary;
  tagsRef.current = tags;
  const editorRef = useRef<Editor | null>(null);
  const returnScroll = useRef(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const imageTarget = useRef(0);
  const linkDialog = useDialog();
  const youtubeDialog = useDialog();
  const publishDialog = useDialog();
  const settingsDialog = useDialog();
  const deleteDialog = useDialog();
  const [deleting, setDeleting] = useState(false);
  const [linkValue, setLinkValue] = useState("");
  const [linkText, setLinkText] = useState("");
  // ダイアログを開いたときの対象。リンクの中なら、そのリンク全体。複数の段落にまたがる範囲は文字を書き換えられない。
  const [linkTarget, setLinkTarget] = useState({ from: 0, to: 0, text: "", existing: false, editableText: true });
  const [youtubeValue, setYoutubeValue] = useState("");
  const [youtubeError, setYoutubeError] = useState("");
  const [confirmUnpublish, setConfirmUnpublish] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [urlCopied, setUrlCopied] = useState(false);
  useKeyboardOffset();
  const barRef = useBarHeight();

  const saver = useArticleSaver({
    id: article.id,
    initialRevision: article.revision,
    getDraft: () => ({ title: titleRef.current, summary: summaryRef.current, tags: tagsRef.current, body: editorRef.current?.getJSON() ?? (article.body as JSONContent) }),
    onWritten: result => setHasUnpublishedChanges(result.hasUnpublishedChanges),
  });
  const saverRef = useRef(saver);
  saverRef.current = saver;

  const openLinkDialog = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const existing = editor.isActive("link");
    if (existing) editor.commands.extendMarkRange("link");
    const { from, to, $from, $to } = editor.state.selection;
    const editableText = $from.sameParent($to);
    const text = editableText ? editor.state.doc.textBetween(from, to) : "";
    setLinkTarget({ from, to, text, existing, editableText });
    setLinkText(text);
    setLinkValue((editor.getAttributes("link").href as string | undefined) ?? "");
    setLinkError("");
    linkDialog.open();
  }, [linkDialog]);
  const openLinkRef = useRef(openLinkDialog);
  openLinkRef.current = openLinkDialog;

  const insertImages = useCallback(async (files: File[], position: number) => {
    const editor = editorRef.current;
    if (!editor) return;
    // アップロード中にも書き続けられるので、挿入先は文書の変更に合わせてずらしていく。
    let target = position;
    const follow = ({ transaction }: { transaction: { mapping: { map: (pos: number) => number } } }) => { target = transaction.mapping.map(target); };
    editor.on("transaction", follow);
    try {
      for (const file of files) {
        setImageJobs(count => count + 1);
        try {
          const image = await uploadArticleImage(file);
          editor.off("transaction", follow);
          target = insertFigure(editor, target, image);
          editor.on("transaction", follow);
        } catch (error) {
          setNotice(error instanceof Error ? error.message : "画像をアップロードできませんでした。");
        } finally {
          setImageJobs(count => count - 1);
        }
      }
    } finally {
      editor.off("transaction", follow);
    }
  }, []);

  const extensions = useMemo(() => [
    ...articleExtensions.map(extension => extension.name === "figure"
      ? Figure.extend({ addNodeView: () => ReactNodeViewRenderer(FigureView) })
      : extension),
    Placeholder.configure({
      placeholder: ({ node }) => node.type.name === "figure" ? "キャプション（任意）" : node.type.name === "paragraph" ? "本文を書く" : "",
    }),
    // 編集中だけ、段落の終わり・段落内の改行・タブ・全角スペースに薄い印を出す。
    // 日本語では半角スペースの印は出番が少ないので出さない。CSSは articles-admin.css に書く。
    InvisibleCharacters.configure({
      injectCSS: false,
      builders: [
        new ParagraphNode(),
        new HardBreakNode(),
        new InvisibleCharacter({ type: "tab", predicate: character => character === "\t" }),
        new InvisibleCharacter({ type: "ideographic-space", predicate: character => character === "\u3000" }),
      ],
    }),
    Extension.create({
      name: "articleShortcuts",
      addKeyboardShortcuts: () => ({
        "Mod-k": () => { openLinkRef.current(); return true; },
        // リストの中では、Tabは字下げ（入れ子）にする。最初の項目のように字下げできないときも、
        // ブラウザの既定（フォーカスが次の欄へ移る）にしない。リストの外ではタブ文字を入れる。
        // この拡張はリストの拡張より後に書いたので、Tiptapでは先に呼ばれる。
        Tab: ({ editor: current }) => {
          if (current.isActive("listItem")) { current.commands.sinkListItem("listItem"); return true; }
          return current.commands.insertContent("\t");
        },
        ArrowUp: ({ editor: current }) => moveAcrossBlocks(current, "up"),
        ArrowDown: ({ editor: current }) => moveAcrossBlocks(current, "down"),
      }),
    }),
  ], []);

  const editor = useEditor({
    extensions,
    content: article.body as JSONContent,
    immediatelyRender: false,
    editorProps: {
      attributes: { id: "article-editor-body", class: "article-body article-editor", "aria-label": "本文" },
      handlePaste: (view, event) => {
        const files = Array.from(event.clipboardData?.files ?? []).filter(file => file.type.startsWith("image/"));
        if (!files.length) return false;
        void insertImages(files, view.state.selection.from);
        return true;
      },
      handleDrop: (view, event, _slice, moved) => {
        if (moved) return false;
        const files = Array.from(event.dataTransfer?.files ?? []).filter(file => file.type.startsWith("image/"));
        if (!files.length) return false;
        event.preventDefault();
        const position = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos ?? view.state.selection.from;
        void insertImages(files, position);
        return true;
      },
    },
    onUpdate: ({ editor: current }) => {
      saverRef.current.markChanged();
      const json = current.getJSON();
      setOutline(articleOutline(json));
      setCharCount(articleCharCount(json));
    },
  });
  editorRef.current = editor;

  useEffect(() => {
    // 自分の控え（このタブの編集）以外で、いちばん新しい控えを戻す候補にする。
    const stored = findBackup(article.id, saverRef.current.ownBackupKey);
    if (stored) setBackup(stored);
  }, [article.id]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void saverRef.current.saveNow();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const changeTitle = (value: string) => { setTitle(value); titleRef.current = value; saver.markChanged(); };
  const changeSummary = (value: string) => { setSummary(value); summaryRef.current = value; saver.markChanged(); };
  const changeTags = (value: string[]) => { setTags(value); tagsRef.current = value; saver.markChanged(); };

  // 戻す候補の控えは、このタブの控えとは別のキーにあるので、判断するまで編集しても消えない。
  // 戻したら、その内容はこのタブの控えに書き写してから元の控えを消す。
  const restoreBackup = () => {
    if (!backup || !editor) return;
    const { title: storedTitle, summary: storedSummary, tags: storedTags, body, baseRevision } = backup.backup;
    setTitle(storedTitle);
    setSummary(storedSummary);
    setTags(storedTags);
    titleRef.current = storedTitle;
    summaryRef.current = storedSummary;
    tagsRef.current = storedTags;
    editor.commands.setContent(body, { emitUpdate: false });
    setOutline(articleOutline(body));
    setCharCount(articleCharCount(body));
    saver.restoreFrom(baseRevision);
    removeStoredBackup(backup.key);
    setBackup(null);
  };
  const discardBackup = () => { if (backup) removeStoredBackup(backup.key); setBackup(null); };

  const openPreview = () => {
    if (!editor) return;
    returnScroll.current = window.scrollY;
    setPreview(renderArticleHtml(editor.getJSON()));
    window.scrollTo({ top: 0 });
  };
  const closePreview = () => {
    // iOSのSafariは、クリックの処理の中で同期的にフォーカスしないとキーボードを開かないので、
    // 表示の切り替えをその場で反映してから、同じ処理の中でフォーカスする。
    flushSync(() => setPreview(null));
    window.scrollTo({ top: returnScroll.current });
    if (!editor) return;
    editor.view.focus();
    revealCaret(editor);
    // キーボードは開きながら表示領域を何度も変えるので、開き終わるまで合わせ直す。
    const viewport = window.visualViewport;
    if (!viewport) return;
    const again = () => revealCaret(editor);
    viewport.addEventListener("resize", again);
    setTimeout(() => viewport.removeEventListener("resize", again), 800);
  };

  const jumpTo = (headingId: string) => {
    if (!editor) return;
    let target = -1;
    editor.state.doc.descendants((node, pos) => {
      if (target < 0 && node.type.name === "heading" && node.attrs.id === headingId) target = pos + 1;
      return target < 0;
    });
    if (target < 0) return;
    editor.chain().setTextSelection(target).run();
    editor.view.focus();
    revealCaret(editor);
  };

  const applyLink = (event: FormEvent) => {
    event.preventDefault();
    if (!editor) return;
    const value = linkValue.trim();
    if (!value) { setLinkError("URLを入れてください。"); return; }
    const href = /^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`;
    if (!isAllowedLink(href)) { setLinkError("リンクに使えるのは http、https、mailto のURLだけです。"); return; }
    const { from, to, text, editableText } = linkTarget;
    // 表示する文字が空なら、URLをそのまま表示する。
    const label = linkText.trim() ? linkText : value;
    if (!editableText || (label === text && from !== to)) {
      // 文字を変えないときは、太字などのほかの装飾を残したままリンクだけ付け替える。
      editor.chain().focus().setTextSelection({ from, to }).setLink({ href }).setTextSelection(to).run();
    } else {
      editor.chain().focus().insertContentAt({ from, to }, { type: "text", text: label, marks: [{ type: "link", attrs: { href } }] }).run();
    }
    linkDialog.close();
  };
  const removeLink = () => {
    editor?.chain().focus().setTextSelection({ from: linkTarget.from, to: linkTarget.to }).unsetLink().setTextSelection(linkTarget.to).run();
    linkDialog.close();
  };

  const insertYoutube = (event: FormEvent) => {
    event.preventDefault();
    const videoId = parseYoutubeId(youtubeValue);
    if (!videoId || !editor) { setYoutubeError("YouTubeの動画のURLを入れてください。"); return; }
    editor.chain().focus().insertContent([{ type: "youtube", attrs: { videoId } }, { type: "paragraph" }]).run();
    setYoutubeValue("");
    setYoutubeError("");
    youtubeDialog.close();
  };

  const publish = async (mode: PublishMode) => {
    const ok = await saver.publish(mode);
    // 失敗したときも閉じて、競合やエラーのバナーを操作できるようにする。
    publishDialog.close();
    if (!ok) return;
    if (mode.kind === "first") setStatus(mode.status);
    setNotice(mode.kind === "first" ? (mode.status === "published" ? "公開しました。" : "限定公開にしました。") : "更新を公開しました。");
  };

  const postStatus = async (body: Record<string, unknown>) => {
    const response = await fetch(`/admin/api/articles/${article.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
    }).catch(() => null);
    const result = await response?.json().catch(() => null) as { status?: typeof status; error?: { message?: string } } | null;
    setConfirmUnpublish(false);
    settingsDialog.close();
    if (!response?.ok || !result?.status) { setNotice(result?.error?.message ?? "変更できませんでした。"); return; }
    setStatus(result.status);
    if (result.status === "draft") setHasUnpublishedChanges(false);
    setNotice(result.status === "draft" ? "非公開に戻しました。" : result.status === "published" ? "一般公開にしました。" : "限定公開にしました。");
  };

  const publicUrl = `https://roseu.net/articles/${article.id}`;
  const copyPublicUrl = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setUrlCopied(true);
      setTimeout(() => setUrlCopied(false), 1500);
    } catch {
      document.querySelector<HTMLInputElement>("#public-url")?.select();
    }
  };

  const deleteArticle = async () => {
    setDeleting(true);
    const response = await fetch(`/admin/api/articles/${article.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ op: "delete" }),
    }).catch(() => null);
    if (!response?.ok) {
      setDeleting(false);
      deleteDialog.close();
      setNotice("削除できませんでした。");
      return;
    }
    saver.forgetArticle();
    window.location.assign("/admin/articles");
  };

  const outlineContent = (
    <>
      {outline.length
        ? (
          <ol>
            {outline.map(item => (
              <li key={item.id} data-level={item.level}>
                <button type="button" onClick={() => jumpTo(item.id)}>{item.text || "（空の見出し）"}</button>
              </li>
            ))}
          </ol>
        )
        : <p className="article-outline__empty">見出しはまだありません。</p>}
      <p className="article-outline__stats">{charCount.toLocaleString("ja-JP")}字{charCount > 0 && `・約${readingMinutes(charCount)}分で読めます`}</p>
    </>
  );

  const busy = imageJobs > 0;
  const blocked = saver.state === "conflict";
  const canPublishUpdate = !blocked && !busy && (hasUnpublishedChanges || saver.state !== "saved");
  // 公開中の記事は「保存済み」だけだと公開版にも反映されたと読めるので、未反映であることを書き添える。
  const saveLabel = busy ? "画像をアップロード中…"
    : saver.state === "saved" && status !== "draft" && hasUnpublishedChanges ? "保存済み（公開版には未反映）"
    : SAVE_LABEL[saver.state];

  return (
    <main className="article-admin article-admin--edit">
      <header ref={barRef} className="article-admin__bar">
        <a className="article-admin__back" href="/admin/articles"><ArrowLeft size={14} aria-hidden />記事一覧</a>
        <span className="article-status" data-status={status}>{STATUS_LABEL[status]}</span>
        <span className="article-save-state" role="status" data-state={saver.state}>{saveLabel}</span>
        <div className="article-admin__actions">
          {preview
            ? <button type="button" className="site-button site-button--ghost site-button--small" onClick={closePreview}><PenLine size={13} aria-hidden />編集に戻る</button>
            : <button type="button" className="site-button site-button--ghost site-button--small" onClick={openPreview} disabled={!editor}><Eye size={13} aria-hidden />プレビュー</button>}
          {status === "draft"
            ? <button type="button" className="site-button site-button--small" onClick={publishDialog.open} disabled={blocked || busy}>公開…</button>
            : <>
                <button type="button" className="site-button site-button--ghost site-button--small" onClick={() => { setConfirmUnpublish(false); settingsDialog.open(); }}>公開設定</button>
                <button type="button" className="site-button site-button--small" onClick={() => void publish({ kind: "update" })} disabled={!canPublishUpdate}>更新を公開</button>
              </>}
        </div>
      </header>

      <div className="article-admin__messages">
        {backup && (
          <div className="article-banner" role="alert">
            <p>この記事に、サーバーに送れていない変更があります（{new Date(backup.backup.savedAt).toLocaleString("ja-JP")}）。</p>
            <div>
              <button type="button" className="site-button site-button--small" onClick={restoreBackup} disabled={!editor}>変更を戻す</button>
              <button type="button" className="site-button site-button--ghost site-button--small" onClick={discardBackup}>捨てる</button>
            </div>
          </div>
        )}
        {saver.state === "conflict" && (
          <div className="article-banner" role="alert">
            <p>ほかの画面で先に保存されています。この画面の原稿は消えていません。</p>
            <div>
              <button type="button" className="site-button site-button--small" onClick={() => void saver.overwriteAfterConflict()}>この原稿で上書きする</button>
              {confirmDiscard
                ? <button type="button" className="site-button site-button--ghost site-button--small" onClick={saver.discardAndReload}>本当に捨てて読み込む</button>
                : <button type="button" className="site-button site-button--ghost site-button--small" onClick={() => setConfirmDiscard(true)}>この原稿を捨ててサーバーの版を読み込む…</button>}
            </div>
          </div>
        )}
        {saver.state === "error" && saver.message && (
          <div className="article-banner" role="alert">
            <p>{saver.message}</p>
            <div><button type="button" className="site-button site-button--small" onClick={() => void saver.saveNow()}>もう一度保存</button></div>
          </div>
        )}
        {saver.backupFailed && (
          <p className="article-banner" role="alert">この端末に原稿の控えを残せていません（ブラウザの保存領域が使えない状態です）。サーバーに保存されるまで、ページを閉じないでください。</p>
        )}
        {notice && (
          <p className="article-notice" role="status">
            {notice}
            <button type="button" className="article-notice__close" onClick={() => setNotice("")} aria-label="お知らせを閉じる">×</button>
          </p>
        )}
      </div>

      {preview && (
        <article className="article-preview" aria-label="プレビュー">
          <h1 className="article-preview__title">{title || "無題"}</h1>
          <ArticleBody html={preview} shareUrl={publicUrl} />
        </article>
      )}

      <div className="article-compose" hidden={preview !== null}>
        <label className="sr-only" htmlFor="article-title">タイトル</label>
        <textarea
          // 新しく作った記事（タイトルが空）は、開いてすぐタイトルから書き始められるようにする。
          autoFocus={!article.title}
          id="article-title"
          className="article-compose__title"
          rows={1}
          maxLength={MAX_TITLE_LENGTH}
          placeholder="タイトル"
          value={title}
          onChange={event => changeTitle(event.target.value)}
          onKeyDown={event => {
            // 変換を確定するEnterで本文に移らないようにする。
            if (event.key === "Enter" && !event.nativeEvent.isComposing) { event.preventDefault(); editor?.commands.focus("start"); }
          }}
        />
        {/* 概要は任意なので畳んでおき、タイトルから本文へすぐ入れるようにする。書いてあれば開いておく。 */}
        <details className="article-fold" open={article.summary !== "" || undefined}>
          <summary>概要{summary ? "" : "（任意）"}</summary>
          <label className="article-compose__summary-label" htmlFor="article-summary">空なら、本文の最初の段落を使います。</label>
          <textarea
            id="article-summary"
            className="article-compose__summary"
            rows={2}
            maxLength={MAX_SUMMARY_LENGTH}
            value={summary}
            onChange={event => changeSummary(event.target.value)}
          />
        </details>
        <details className="article-fold" open={article.tags.length > 0 || undefined}>
          <summary id="article-tags-label">タグ{tags.length ? `（${tags.length}）` : "（任意）"}</summary>
          <TagInput value={tags} suggestions={tagSuggestions} labelledBy="article-tags-label" onChange={changeTags} />
        </details>
        {/* 狭い画面では畳んで本文の上に、広い画面では本文の右に、目次と文字数を出す（どちらを見せるかはCSSで切り替える）。 */}
        <details className="article-outline article-fold article-outline--fold">
          <summary>目次{outline.length ? `（${outline.length}）` : ""}</summary>
          {outlineContent}
        </details>
        {editor && (
          <EditorToolbar
            editor={editor}
            imageBusy={busy}
            onLink={openLinkDialog}
            onImage={() => { imageTarget.current = editor.state.selection.from; fileInput.current?.click(); }}
            onYoutube={() => { setYoutubeError(""); youtubeDialog.open(); }}
          />
        )}
        <EditorContent editor={editor} className="article-compose__body" />
        <aside className="article-compose__aside" aria-label="目次と文字数">
          <div className="article-outline article-compose__aside-inner">
            <p className="article-compose__aside-title">目次</p>
            {outlineContent}
          </div>
        </aside>
        {editor && <LinkBubble editor={editor} onEdit={openLinkDialog} />}
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={event => {
            const files = Array.from(event.target.files ?? []);
            event.target.value = "";
            if (files.length) void insertImages(files, imageTarget.current);
          }}
        />
        {/* 取り消せない操作なので、公開ボタンの近くではなく画面のいちばん下に置く。 */}
        <div className="article-compose__danger">
          <button type="button" className="site-button site-button--ghost site-button--small" onClick={deleteDialog.open}>この記事を削除…</button>
        </div>
      </div>

      <dialog ref={linkDialog.ref} className="article-dialog" aria-labelledby="link-dialog-title" {...{ closedby: "any" }}>
        <form onSubmit={applyLink}>
          <h2 id="link-dialog-title">リンク</h2>
          {linkTarget.editableText && (
            <>
              <label htmlFor="link-text">表示する文字</label>
              <input id="link-text" type="text" value={linkText} onChange={event => setLinkText(event.target.value)} placeholder="空ならURLをそのまま表示" />
            </>
          )}
          <label htmlFor="link-url">URL</label>
          <input id="link-url" type="text" inputMode="url" autoComplete="url" spellCheck={false} autoCapitalize="none" autoFocus value={linkValue} onChange={event => setLinkValue(event.target.value)} placeholder="https://" aria-describedby="link-error" aria-invalid={linkError ? true : undefined} />
          <p id="link-error" className="article-dialog__error">{linkError}</p>
          <div className="article-dialog__actions">
            {linkTarget.existing && <button type="button" className="site-button site-button--ghost site-button--small article-dialog__start" onClick={removeLink}>リンクを外す</button>}
            <button type="button" className="site-button site-button--ghost site-button--small" onClick={linkDialog.close}>やめる</button>
            <button type="submit" className="site-button site-button--small">決定</button>
          </div>
        </form>
      </dialog>

      <dialog ref={youtubeDialog.ref} className="article-dialog" aria-labelledby="youtube-dialog-title" {...{ closedby: "any" }}>
        <form onSubmit={insertYoutube}>
          <h2 id="youtube-dialog-title">YouTube動画</h2>
          <label htmlFor="youtube-url">動画のURL</label>
          <input id="youtube-url" type="text" inputMode="url" spellCheck={false} autoCapitalize="none" autoFocus value={youtubeValue} onChange={event => setYoutubeValue(event.target.value)} aria-describedby="youtube-error" aria-invalid={youtubeError ? true : undefined} />
          <p id="youtube-error" className="article-dialog__error">{youtubeError}</p>
          <div className="article-dialog__actions">
            <button type="button" className="site-button site-button--ghost site-button--small" onClick={youtubeDialog.close}>やめる</button>
            <button type="submit" className="site-button site-button--small">入れる</button>
          </div>
        </form>
      </dialog>

      <dialog ref={publishDialog.ref} className="article-dialog" aria-labelledby="publish-dialog-title" {...{ closedby: "any" }}>
        <form onSubmit={event => {
          event.preventDefault();
          const target = new FormData(event.currentTarget).get("visibility") === "unlisted" ? "unlisted" : "published";
          void publish({ kind: "first", status: target });
        }}>
          <h2 id="publish-dialog-title">公開する</h2>
          <p>いま画面にある原稿を公開します。URLは公開後も変わりません。</p>
          <fieldset className="article-dialog__choices">
            <legend className="sr-only">公開の種類</legend>
            <label><input type="radio" name="visibility" value="published" defaultChecked />一般公開<span>記事一覧に載ります。</span></label>
            <label><input type="radio" name="visibility" value="unlisted" />限定公開<span>URLを知っている人だけが読めます。</span></label>
          </fieldset>
          <div className="article-dialog__actions">
            <button type="button" className="site-button site-button--ghost site-button--small" onClick={publishDialog.close} autoFocus>やめる</button>
            <button type="submit" className="site-button site-button--small" disabled={blocked || busy}>公開する</button>
          </div>
        </form>
      </dialog>

      <dialog ref={deleteDialog.ref} className="article-dialog" aria-labelledby="delete-dialog-title" {...{ closedby: "any" }}>
        <h2 id="delete-dialog-title">記事を削除</h2>
        <p>「{title || "無題"}」を削除します。{status === "draft" ? "" : "公開ページも見られなくなります。"}元に戻せません。アップロードした画像は残ります。</p>
        <div className="article-dialog__actions">
          <button type="button" className="site-button site-button--ghost site-button--small" onClick={deleteDialog.close} autoFocus>やめる</button>
          <button type="button" className="site-button site-button--small" disabled={deleting} onClick={() => void deleteArticle()}>削除する</button>
        </div>
      </dialog>

      <dialog ref={settingsDialog.ref} className="article-dialog" aria-labelledby="settings-dialog-title" {...{ closedby: "any" }}>
        <h2 id="settings-dialog-title">公開設定</h2>
        <p>いまは{status === "published" ? "一般公開（記事一覧に載ります）" : "限定公開（URLを知っている人だけが読めます）"}です。公開の種類を変えても、書きかけの修正は公開されません。</p>
        <div className="article-dialog__url">
          <label htmlFor="public-url">公開URL</label>
          <div>
            <input id="public-url" type="text" readOnly value={publicUrl} onFocus={event => event.currentTarget.select()} />
            <button type="button" className="site-button site-button--ghost site-button--small" onClick={() => void copyPublicUrl()}>{urlCopied ? "コピーしました" : "コピー"}</button>
          </div>
          <a href={`/articles/${article.id}`} target="_blank" rel="noopener">公開ページを新しいタブで開く<ExternalLink size={13} aria-hidden /></a>
        </div>
        <div className="article-dialog__actions article-dialog__actions--stack">
          {status === "unlisted"
            ? <button type="button" className="site-button site-button--small" onClick={() => void postStatus({ op: "visibility", from: "unlisted", status: "published" })}>一般公開にする</button>
            : <button type="button" className="site-button site-button--small" onClick={() => void postStatus({ op: "visibility", from: "published", status: "unlisted" })}>限定公開にする</button>}
          {confirmUnpublish
            ? <>
                <p className="article-dialog__warning">公開ページは見られなくなります。書いている原稿は残ります。</p>
                <button type="button" className="site-button site-button--small" onClick={() => void postStatus({ op: "unpublish" })}>非公開に戻す</button>
              </>
            : <button type="button" className="site-button site-button--ghost site-button--small" onClick={() => setConfirmUnpublish(true)}>非公開に戻す…</button>}
          <button type="button" className="site-button site-button--ghost site-button--small" onClick={settingsDialog.close} autoFocus>閉じる</button>
        </div>
      </dialog>
    </main>
  );
}
