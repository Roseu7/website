import { Fragment } from "react";
import { articleDate } from "~/utils/articles/date";

// 公開側の日付と読み時間の目安。「2026年11月26日 公開 | 約9分で読めます」の形にする。
// 更新日は、公開した日と違う日のときだけ公開日の後ろに出す。区切りの「|」は読み上げない。
export function ArticleDates({ published, updated, readingMinutes, className }: { published: number; updated: number; readingMinutes: number; className: string }) {
  const showUpdated = articleDate.format(updated) !== articleDate.format(published);
  const items = [
    <span key="published"><time dateTime={new Date(published).toISOString()}>{articleDate.format(published)}</time> 公開</span>,
    showUpdated && <span key="updated"><time dateTime={new Date(updated).toISOString()}>{articleDate.format(updated)}</time> 更新</span>,
    <span key="reading">約{readingMinutes}分で読めます</span>,
  ].filter(Boolean);
  return (
    <div className={className}>
      {items.map((item, index) => (
        <Fragment key={index}>
          {index > 0 && <span className="article-dates__separator" aria-hidden>|</span>}
          {item}
        </Fragment>
      ))}
    </div>
  );
}
