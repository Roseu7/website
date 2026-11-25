import { Link } from "~/framework/navigation";

export const tagHref = (tag: string) => `/articles?tag=${encodeURIComponent(tag)}`;

// 記事のページのタグ。押すと、同じタグの記事の一覧へ移る。
export function ArticleTags({ tags }: { tags: string[] }) {
  if (!tags.length) return null;
  return (
    <ul className="article-tag-list" aria-label="タグ">
      {tags.map(tag => <li key={tag}><Link to={tagHref(tag)}>#{tag}</Link></li>)}
    </ul>
  );
}
