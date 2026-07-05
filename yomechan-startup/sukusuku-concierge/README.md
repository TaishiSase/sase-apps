# Hagumi

「きょう、なにしよう。」を副題にしたAI育児コンシェルジュMVP。

## 構成

- `index.html`: 画面
- `styles.css`: 明るい育児向けデザイン
- `script.js`: localStorage保存、AI相談、実施記録、振り返り
- `/api/sukusuku-suggest.js`: OpenAI Responses APIを呼ぶVercel Function
- `/supabase/sukusuku_concierge_schema.sql`: 将来公開を見据えたDB/RLS設計

## ローカル

Vercel Functionを動かす場合は、プロジェクトルートでVercel devを使う。

```powershell
cd C:\Users\taish\work\sase-apps
vercel dev
```

`OPENAI_API_KEY` は `.env.local` に保存済み。

## 注意

- APIキーはブラウザへ出さず、`/api/sukusuku-suggest` 経由で使う。
- MVPの画面保存はlocalStorage。Supabase連携は次フェーズ。
- Vercel本番でAIを動かすには、Vercel側にも `OPENAI_API_KEY` を設定する。
