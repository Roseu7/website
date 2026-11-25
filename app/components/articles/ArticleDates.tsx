import { articleDate } from "~/utils/articles/date";

// 公開側の日付。更新日は、公開した日と違う日のときだけ出す。
export function ArticleDates({ published, updated, className }: { published: number; updated: number; className: string }) {
  const showUpdated = articleDate.format(updated) !== articleDate.format(published);
  return (
    <div className={className}>
      <span>公開 <time dateTime={new Date(published).toISOString()}>{articleDate.format(published)}</time></span>
      {showUpdated && <span>更新 <time dateTime={new Date(updated).toISOString()}>{articleDate.format(updated)}</time></span>}
    </div>
  );
}
