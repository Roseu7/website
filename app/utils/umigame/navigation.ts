const PAGE_NAMES: Record<string, string> = {
  "/": "ホーム",
  "/games": "ゲーム一覧",
  "/games/umigame": "問題一覧",
  "/games/umigame/about": "情報",
  "/games/umigame/admin": "管理画面",
  "/games/umigame/admin/jev": "Jev監視",
  "/games/umigame/favorites": "お気に入り",
  "/games/umigame/rankings": "ランキング",
  "/games/umigame/recommend": "おすすめ",
  "/games/umigame/licenses": "ライセンス一覧",
  "/games/umigame/new": "問題投稿",
  "/games/umigame/settings/profile": "アカウント設定",
  "/games/umigame/author/quality": "作者向け分析",
};

export function labelForPreviousPath(path: string) {
  const pathname = path.split(/[?#]/)[0];
  let name = PAGE_NAMES[pathname];
  if (/^\/games\/umigame\/p\/\d{7,}$/.test(pathname)) name = "問題詳細";
  if (/^\/games\/umigame\/p\/\d{7,}\/play$/.test(pathname)) name = "プレイ画面";
  if (/^\/games\/umigame\/p\/\d{7,}\/edit$/.test(pathname)) name = "問題編集";
  if (/^\/games\/umigame\/u\/[^/]+$/.test(pathname)) name = "プロフィール";
  return name ? `${name}に戻る` : "前のページに戻る";
}
