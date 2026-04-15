# 🏠 佐瀬家アプリ

佐瀬家のプライベートアプリをまとめたポータル＆ダッシュボードです。各アプリへのリンクと、最新情報をひとめで確認できるウィジェットを表示します。

**URL:** https://sase-apps.vercel.app/

---

## 機能

### アプリ一覧
家族の各アプリへのリンクカードを表示：

| アプリ | 説明 |
|---|---|
| 📸 今日のことちゃん | 娘の成長アルバム |
| 🌙 こんや話そ | ふたりの話し合いノート |
| ⛺ ふぁみキャン△ | キャンプ計画・記録帳 |
| 📅 夫婦の共有予定帳 | 家族の共有カレンダー |

### ダッシュボードウィジェット

| ウィジェット | 内容 |
|---|---|
| 📸 最新のことね | koto-chanから最新の写真・コメントを取得 |
| 📅 今週の予定 | fufu-yoteiから今後7日間の予定を表示 |
| 🍀 ことねの成長 | 生年月日（2024-02-19）から現在の月齢・日齢を計算 |
| 🏕️ 次のキャンプ | fami-campから最も近い予定キャンプを表示 |
| 💬 話し合いたいこと | konya-hanaso から未解決トピック一覧 |

---

## 技術スタック

| 項目 | 内容 |
|---|---|
| フロントエンド | HTML / CSS / Vanilla JavaScript |
| バックエンド (DB) | [Supabase](https://supabase.com/)（PostgreSQL） |
| ホスティング | [Vercel](https://vercel.com/) |
| フォント | Noto Sans JP / Zen Maru Gothic（Google Fonts） |

---

## ファイル構成

```
sase-apps/
├── index.html            # アプリ本体（ポータル＋ダッシュボード）
├── styles.css            # スタイル
├── config.json           # Supabase接続情報（gitignore推奨）
├── apple-touch-icon.png  # PWAアイコン
└── vercel.json           # Vercelデプロイ設定
```

---

## Supabase接続

`config.json` に Supabase の接続情報を記述します：

```json
{
  "supabaseUrl": "https://xxxx.supabase.co",
  "supabaseKey": "your-anon-key"
}
```

ダッシュボードは以下のテーブルに読み取りアクセスします：

| テーブル | アプリ | 取得内容 |
|---|---|---|
| `posts` | koto-chan | 最新の写真・コメント |
| `schedules` | fufu-yotei | 今後7日間の予定 |
| `camps` / `camp_members` | fami-camp | 次回のキャンプ情報 |
| `topics` | konya-hanaso | 未解決の話し合いトピック |

---

## デプロイ

GitHub の `main` ブランチにプッシュすると Vercel が自動デプロイします。
