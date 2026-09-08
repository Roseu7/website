# Digital Sandbox

[roseu.net](https://roseu.net/) — 個人サイト・Webツール。

## 機能

- プロフィール・制作物一覧
- Wordle Solver
- Minecraftサーバー管理
- PCの状態確認・電源操作

## 技術構成

React / React Router / TypeScript / Tailwind CSS / DaisyUI

Cloudflare Workers / D1 / Access

## ディレクトリ

```text
app/                   ページ・UI・API・アプリケーションロジック
workers/               Cloudflare Workers
db/migrations/         D1マイグレーション
services/wake-lambda/   Wake-on-LAN API
```

## 設定

Cloudflare設定例: [wrangler.example.jsonc](wrangler.example.jsonc)

実運用の設定・認証情報・一部アセットは非同梱。
