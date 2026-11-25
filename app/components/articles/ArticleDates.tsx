import { articleDate } from "~/utils/articles/date";

// 公開側の日付と読み時間の目安。更新日は、公開した日と違う日のときだけ出す。読み時間は最後（更新日があればその横）に置く。
export function ArticleDates({ published, updated, readingMinutes, className }: { published: number; updated: number; readingMinutes: number; className: string }) {
  const showUpdated = articleDate.format(updated) !== articleDate.format(published);
  return (
    <div className={className}>
      <span>公開 <time dateTime={new Date(published).toISOString()}>{articleDate.format(published)}</time></span>
      {showUpdated && <span>更新 <time dateTime={new Date(updated).toISOString()}>{articleDate.format(updated)}</time></span>}
      <span>約{readingMinutes}分で読めます</span>
    </div>
  );
}
