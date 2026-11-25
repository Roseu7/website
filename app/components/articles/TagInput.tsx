import { useState, type KeyboardEvent } from "react";
import { X } from "lucide-react";
import { MAX_TAGS, MAX_TAG_LENGTH, normalizeTag } from "~/utils/articles/content";

// 記事のタグ。打ってEnterで足すほか、これまでに使ったタグを押しても足せる。
// 候補は打った文字で絞り込む。大文字と小文字だけが違うタグは同じものとして扱う（サーバーの検査と同じ）。
export function TagInput({ value, suggestions, labelledBy, onChange }: { value: string[]; suggestions: string[]; labelledBy: string; onChange: (tags: string[]) => void }) {
  const [input, setInput] = useState("");
  const chosen = new Set(value.map(tag => tag.toLowerCase()));
  const query = normalizeTag(input).toLowerCase();
  const candidates = suggestions.filter(tag => !chosen.has(tag.toLowerCase()) && (!query || tag.toLowerCase().includes(query)));
  const full = value.length >= MAX_TAGS;

  const add = (raw: string) => {
    const tag = normalizeTag(raw).slice(0, MAX_TAG_LENGTH);
    setInput("");
    if (!tag || full || chosen.has(tag.toLowerCase())) return;
    // 候補と大文字・小文字だけが違うときは、候補の書き方にそろえる。
    onChange([...value, suggestions.find(existing => existing.toLowerCase() === tag.toLowerCase()) ?? tag]);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    // 変換を確定するEnterでは足さない。
    if (event.nativeEvent.isComposing) return;
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      add(input);
    } else if (event.key === "Backspace" && !input && value.length) {
      onChange(value.slice(0, -1));
    }
  };

  return (
    <div className="article-tags">
      {value.length > 0 && (
        <ul className="article-tags__chosen" aria-label="付けたタグ">
          {value.map(tag => (
            <li key={tag}>
              <span>{tag}</span>
              <button type="button" aria-label={`タグ「${tag}」を外す`} title={`「${tag}」を外す`} onClick={() => onChange(value.filter(item => item !== tag))}><X size={14} aria-hidden /></button>
            </li>
          ))}
        </ul>
      )}
      <div className="article-tags__entry">
        <input
          id="article-tag-input"
          type="text"
          value={input}
          maxLength={MAX_TAG_LENGTH}
          disabled={full}
          placeholder={full ? `タグは${MAX_TAGS}個まで` : "タグを入れてEnter"}
          aria-labelledby={labelledBy}
          aria-describedby="article-tag-help"
          onChange={event => setInput(event.target.value)}
          onKeyDown={onKeyDown}
        />
        <button type="button" className="site-button site-button--ghost site-button--small" disabled={full || !normalizeTag(input)} onClick={() => add(input)}>追加</button>
      </div>
      <p id="article-tag-help" className="article-compose__summary-label">公開すると、記事のページと一覧に出ます。タグを押すと、同じタグの記事だけを読めます。</p>
      {candidates.length > 0 && !full && (
        <div className="article-tags__suggestions" role="group" aria-label="これまでのタグ">
          {candidates.slice(0, 20).map(tag => (
            <button key={tag} type="button" onClick={() => add(tag)}>{tag}</button>
          ))}
        </div>
      )}
    </div>
  );
}
