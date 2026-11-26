import { useEffect, useId, useRef, useState } from "react";
import { NodeViewContent, NodeViewWrapper, type ReactNodeViewProps } from "@tiptap/react";

// キャプションは本文と同じようにその場で書く。代替テキストは畳んだ欄で書く。どちらも任意。
// 画像を何枚も貼ったときに本文の流れが途切れないよう、代替テキストの欄はふだん閉じておく。
export function FigureView({ node, updateAttributes, deleteNode, selected }: ReactNodeViewProps) {
  const altId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [editingAlt, setEditingAlt] = useState(false);
  const { src, alt, width, height } = node.attrs as { src: string; alt: string; width: number | null; height: number | null };
  // 欄の値はこのコンポーネントで持つ。ノードの属性を直接表示すると、属性の反映が次の描画まで遅れるため、
  // Reactが打った直後の値を古い値に戻してしまい、日本語の変換中の文字が消える。
  const [draft, setDraft] = useState(alt);
  // 元に戻すなど、欄の外で属性が変わったときだけ欄に反映する。打っている最中は欄の値が先に進んでいる。
  useEffect(() => {
    if (document.activeElement !== input.current) setDraft(alt);
  }, [alt]);
  // 欄はノードビューの描画が終わってから表示されるので、フォーカスはその後で移す。
  useEffect(() => {
    if (editingAlt) input.current?.focus();
  }, [editingAlt]);
  return (
    <NodeViewWrapper as="figure" className={`article-figure${selected ? " is-selected" : ""}`}>
      <img src={src} alt={alt} width={width ?? undefined} height={height ?? undefined} draggable={false} data-drag-handle="" />
      <NodeViewContent className="article-figure__caption" data-empty={node.content.size === 0 ? "" : undefined} />
      <div className="article-figure__tools" contentEditable={false}>
        <button type="button" className="article-figure__tool" aria-expanded={editingAlt} aria-controls={altId} onClick={() => setEditingAlt(open => !open)}>
          代替テキスト{alt ? "（入力済み）" : ""}
        </button>
        <button type="button" className="article-figure__tool" onClick={deleteNode}>画像を削除</button>
      </div>
      <div id={altId} className="article-figure__alt" contentEditable={false} hidden={!editingAlt}>
        <label htmlFor={`${altId}-input`}>代替テキスト（画像が見えない人向けの説明）</label>
        <input
          ref={input}
          id={`${altId}-input`}
          type="text"
          value={draft}
          maxLength={300}
          onChange={event => { setDraft(event.target.value); updateAttributes({ alt: event.target.value }); }}
        />
      </div>
    </NodeViewWrapper>
  );
}
