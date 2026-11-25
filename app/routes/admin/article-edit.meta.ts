import { siteConfig } from "~/utils/site";

// ルート定義は meta を共通のチャンクに残すので、エディタを含むページのモジュールとは分けておく。
// 同じファイルにすると、Tiptap 一式が全ページの読み込みに入る。
export const meta = () => [
  { title: `記事の編集 | ${siteConfig.fullName}` },
  { name: "robots", content: "noindex, nofollow" },
];
