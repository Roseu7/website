import { useEffect, useRef, type ReactNode } from "react";
import { useEditorState, type Editor } from "@tiptap/react";
import {
  Bold, Code, CornerDownLeft, Film, Heading2, Heading3, Highlighter, ImagePlus, Italic, Link2, List, ListOrdered,
  Minus, Quote, Redo2, SquareCode, Strikethrough, Underline, Undo2,
} from "lucide-react";

function ToolButton({ label, shortcut, active, disabled, onClick, children }: {
  label: string; shortcut?: string; active?: boolean; disabled?: boolean; onClick: () => void; children: ReactNode;
}) {
  return (
    <button
      type="button"
      className="article-tool"
      aria-label={label}
      title={shortcut ? `${label}（${shortcut}）` : label}
      aria-pressed={active === undefined ? undefined : active}
      disabled={disabled}
      // ボタンを押してもエディタの選択範囲を失わないようにする。
      onMouseDown={event => event.preventDefault()}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

// focusgroup が無いブラウザでは、ツールバー内の移動を矢印キーで行うために tabindex を回す。
function useRovingFallback(ref: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const bar = ref.current;
    if (!bar || "focusGroup" in HTMLElement.prototype) return;
    const items = () => Array.from(bar.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"));
    items().forEach((item, index) => { item.tabIndex = index === 0 ? 0 : -1; });
    const onFocus = (event: FocusEvent) => {
      const list = items();
      if (list.includes(event.target as HTMLButtonElement)) list.forEach(item => { item.tabIndex = item === event.target ? 0 : -1; });
    };
    const onKey = (event: KeyboardEvent) => {
      const list = items();
      const index = list.indexOf(document.activeElement as HTMLButtonElement);
      if (index < 0) return;
      const next = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: list.length - 1 }[event.key];
      if (next === undefined) return;
      event.preventDefault();
      list[(next + list.length) % list.length]?.focus();
    };
    bar.addEventListener("focusin", onFocus);
    bar.addEventListener("keydown", onKey);
    return () => { bar.removeEventListener("focusin", onFocus); bar.removeEventListener("keydown", onKey); };
  }, [ref]);
}

export function EditorToolbar({ editor, onLink, onImage, onYoutube, imageBusy }: {
  editor: Editor;
  onLink: () => void;
  onImage: () => void;
  onYoutube: () => void;
  imageBusy: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useRovingFallback(ref);
  const active = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      h2: e.isActive("heading", { level: 2 }),
      h3: e.isActive("heading", { level: 3 }),
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      underline: e.isActive("underline"),
      strike: e.isActive("strike"),
      highlight: e.isActive("highlight"),
      code: e.isActive("code"),
      link: e.isActive("link"),
      bulletList: e.isActive("bulletList"),
      orderedList: e.isActive("orderedList"),
      blockquote: e.isActive("blockquote"),
      codeBlock: e.isActive("codeBlock"),
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  });
  const chain = () => editor.chain().focus();
  const size = 18;
  return (
    <div ref={ref} className="article-toolbar" role="toolbar" aria-label="書式" aria-controls="article-editor-body" {...{ focusgroup: "toolbar" }}>
      <div role="group" aria-label="取り消し">
        <ToolButton label="元に戻す" shortcut="Ctrl+Z" disabled={!active.canUndo} onClick={() => chain().undo().run()}><Undo2 size={size} aria-hidden /></ToolButton>
        <ToolButton label="やり直す" shortcut="Ctrl+Shift+Z" disabled={!active.canRedo} onClick={() => chain().redo().run()}><Redo2 size={size} aria-hidden /></ToolButton>
      </div>
      <span role="separator" aria-orientation="vertical" />
      <div role="group" aria-label="見出し">
        <ToolButton label="大見出し" active={active.h2} onClick={() => chain().toggleHeading({ level: 2 }).run()}><Heading2 size={size} aria-hidden /></ToolButton>
        <ToolButton label="小見出し" active={active.h3} onClick={() => chain().toggleHeading({ level: 3 }).run()}><Heading3 size={size} aria-hidden /></ToolButton>
      </div>
      <span role="separator" aria-orientation="vertical" />
      <div role="group" aria-label="よく使う装飾">
        <ToolButton label="太字" shortcut="Ctrl+B" active={active.bold} onClick={() => chain().toggleBold().run()}><Bold size={size} aria-hidden /></ToolButton>
        <ToolButton label="マーカー" active={active.highlight} onClick={() => chain().toggleHighlight().run()}><Highlighter size={size} aria-hidden /></ToolButton>
        <ToolButton label="リンク" shortcut="Ctrl+K" active={active.link} onClick={onLink}><Link2 size={size} aria-hidden /></ToolButton>
      </div>
      <span role="separator" aria-orientation="vertical" />
      <div role="group" aria-label="段落と挿入">
        <ToolButton label="箇条書き" active={active.bulletList} onClick={() => chain().toggleBulletList().run()}><List size={size} aria-hidden /></ToolButton>
        <ToolButton label="引用" active={active.blockquote} onClick={() => chain().toggleBlockquote().run()}><Quote size={size} aria-hidden /></ToolButton>
        <ToolButton label={imageBusy ? "画像をアップロード中" : "画像"} disabled={imageBusy} onClick={onImage}><ImagePlus size={size} aria-hidden /></ToolButton>
        <ToolButton label="YouTube動画" onClick={onYoutube}><Film size={size} aria-hidden /></ToolButton>
        <ToolButton label="段落内の改行" shortcut="Shift+Enter" onClick={() => chain().setHardBreak().run()}><CornerDownLeft size={size} aria-hidden /></ToolButton>
      </div>
      <span role="separator" aria-orientation="vertical" />
      <div role="group" aria-label="そのほか">
        <ToolButton label="番号付きリスト" active={active.orderedList} onClick={() => chain().toggleOrderedList().run()}><ListOrdered size={size} aria-hidden /></ToolButton>
        <ToolButton label="コード" active={active.code} onClick={() => chain().toggleCode().run()}><Code size={size} aria-hidden /></ToolButton>
        <ToolButton label="コードブロック" active={active.codeBlock} onClick={() => chain().toggleCodeBlock().run()}><SquareCode size={size} aria-hidden /></ToolButton>
        <ToolButton label="区切り線" onClick={() => chain().setHorizontalRule().run()}><Minus size={size} aria-hidden /></ToolButton>
        <ToolButton label="取り消し線" active={active.strike} onClick={() => chain().toggleStrike().run()}><Strikethrough size={size} aria-hidden /></ToolButton>
        <ToolButton label="斜体" shortcut="Ctrl+I" active={active.italic} onClick={() => chain().toggleItalic().run()}><Italic size={size} aria-hidden /></ToolButton>
        <ToolButton label="下線" shortcut="Ctrl+U" active={active.underline} onClick={() => chain().toggleUnderline().run()}><Underline size={size} aria-hidden /></ToolButton>
      </div>
    </div>
  );
}
