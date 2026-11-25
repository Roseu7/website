import { useLayoutEffect, useRef, useState, type MouseEvent } from "react";
import { getMarkRange } from "@tiptap/core";
import { useEditorState, type Editor } from "@tiptap/react";
import { ExternalLink } from "lucide-react";

// カーソルがリンクの中にあるあいだ、リンクの下にリンク先と「編集」「外す」を出す。
// 文字の見た目だけではリンクかどうかが分かりにくいので、どこへのリンクかをその場で見せる。
export function LinkBubble({ editor, onEdit }: { editor: Editor; onEdit: () => void }) {
  const link = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      if (!e.isFocused || !e.isActive("link")) return null;
      const { state } = e;
      const range = getMarkRange(state.selection.$from, state.schema.marks.link) ?? { from: state.selection.from, to: state.selection.to };
      return { href: String(e.getAttributes("link").href ?? ""), from: range.from, to: range.to };
    },
  });
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  useLayoutEffect(() => {
    const bubble = ref.current;
    const container = bubble?.offsetParent;
    if (!link || !bubble || !container) { setPosition(null); return; }
    const start = editor.view.coordsAtPos(link.from);
    const end = editor.view.coordsAtPos(link.to);
    const box = container.getBoundingClientRect();
    // リンクが折り返していたら最後の行の下に出し、書いている行を隠さないようにする。
    const anchor = end.top > start.top ? box.left : start.left;
    const left = Math.min(Math.max(anchor - box.left, 0), Math.max(box.width - bubble.offsetWidth, 0));
    setPosition({ top: end.bottom - box.top + 6, left });
  }, [editor, link]);
  if (!link) return null;
  const label = link.href.replace(/^https?:\/\//, "").replace(/^mailto:/, "");
  // ボタンを押してもエディタからフォーカスが外れないようにする（外れると吹き出しが消える）。
  const keep = (event: MouseEvent) => event.preventDefault();
  const remove = () => editor.chain().focus().setTextSelection({ from: link.from, to: link.to }).unsetLink().setTextSelection(link.to).run();
  return (
    <div
      ref={ref}
      className="article-link-bubble"
      role="group"
      aria-label="リンク"
      style={position ? { insetBlockStart: position.top, insetInlineStart: position.left } : { visibility: "hidden" }}
    >
      <a className="article-link-bubble__url" href={link.href} target="_blank" rel="noopener noreferrer" onMouseDown={keep} title={link.href}>
        <span>{label}</span><ExternalLink size={13} aria-hidden />
      </a>
      <button type="button" className="article-link-bubble__action" onMouseDown={keep} onClick={onEdit}>編集</button>
      <button type="button" className="article-link-bubble__action" onMouseDown={keep} onClick={remove}>外す</button>
    </div>
  );
}
