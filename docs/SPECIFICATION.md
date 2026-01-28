# PKP（Personal Knowledge Pack）仕様書

**Version**: 1.1 (Implementation-ready)  
**提供形態**: PWA対応Webアプリ（Phase 1）＋手書き端末（Phase 2）  
**目的**: メモ入力の摩擦を極小化し、AIが自動で整理・検索（RAG）・週次要約（Knowledge Pack）できる個人知識基盤を構築する。

---

## 0. 意思決定（最重要：この仕様の固定方針）

### 0.1 認証・データアクセス（固定）

- **認証**：Clerk
- **DB**：Supabase Postgres + pgvector
- **クライアントからDB直叩きは禁止**（MVP）
- すべて **Next.js /api/*** 経由
- APIサーバは Clerk セッションから `user_id`（Clerk userId）を取得し、DBに保存する `user_id` は **text（Clerk userId）** とする
- **Supabase接続**：Service Role（サーバのみ）
- **アクセス制御は API層で必ず実施**
- **RLSは将来の直叩き解放に備え 設計だけは実装**（Defense-in-depth）

### 0.2 非同期ジョブ（固定）

- Workerは **DBキュー（jobsテーブル）+ Cronでrunner起動**
- Cron（Vercel Cron or Supabase Scheduled）から `POST /api/jobs/run` を **1分おきに呼ぶ**
- 生成系（分類/embedding/ink caption/pack）は **すべてジョブ化**（保存は絶対にブロックしない）

### 0.3 RAG API（固定）

- `/api/rag/query` は **1回呼び出しで sources + answer を返す**（ConfirmはUI側で「根拠を開く」）

### 0.4 Ink（手書き）検索性（固定）

- **OCR保証はしない**（非目標）
- 代わりに **inkをPNGレンダ → マルチモーダルで1行キャプション生成**し、RAG/embedding対象に含める
- `ink_caption` を必須の検索テキスト資産にする

### 0.5 Deviceペアリング（固定）

- **ペアコード方式**（6〜8桁、10分有効）
- 端末は匿名でpair_code発行 → Webで入力 → device_token発行（1回だけ返す）
- Device APIは `Authorization: Bearer <device_token>` のみ
- `device_token` は平文保存しない（sha256 hashを保存）、revoke/rotate可能

---

## 1. 成功条件（KPI / Exit Criteria）

### 1.1 プロダクトKPI（自分が使う前提）

| 指標 | 目標 |
|------|------|
| **Capture** | 新規メモ作成→保存まで 中央値10秒以内（スマホ） |
| **Habit** | 週5日以上、1日1件以上入力（最低2週間連続） |
| **Recall** | 週1回以上、RAG検索で過去メモを実際に活用 |
| **Zero-friction** | 保存時の操作は 最大2タップ（分類/整理で精神的摩擦を増やさない） |

### 1.2 技術Exit Criteria（就活用に強い状態）

- README（セットアップ/アーキ/デモ/設計思想/制約/ロードマップ）
- API仕様（エンドポイント・認証・例）
- DB設計（ER + RLS方針 + migration）
- デモ動画：スマホ入力→AI分類→RAG→週次Pack、端末送信→Web反映
- テスト：API/Workerユニット + E2E 1本（Playwright）

---

## 2. ペルソナとユースケース

### 2.1 ペルソナ

- **Primary**：あなた（日本語/英語混在、見返さない、AI検索で回収したい）
- **Secondary**：スマホのみ一般ユーザー（入力と最低限編集だけで続けたい）

### 2.2 主要ユースケース

| ID | ユースケース |
|----|--------------|
| U1 | 瞬間メモ（1行/短文）を素早く保存 |
| U2 | 学習メモ（日英混在、例：apple=りんご） |
| U3 | 経験ログ（失敗/学び/気づき/次やる） |
| U4 | "AIに聞く"（RAGで過去メモを根拠に回答） |
| U5 | 週次Knowledge Pack自動生成（ハイライト/用語/来週提案） |

---

## 3. スコープ

### 3.1 MVP（Phase 1 = Web）

- **notes**：作成/編集/削除/一覧（スマホ最適）
- **categories**：ユーザー単位、AI提案 → 採用/変更/新規作成
- **embeddings**：生成・保存・検索（pgvector）
- **rag**：類似ノート取得 → 回答生成（sources付き）
- **weekly knowledge pack**：自動生成（週次）+ 手動生成

### 3.2 Phase 2（Hardware）

- ESP32-S3手書き端末：Draw/Clear/Send/New + Status
- 端末→Webへストローク送信、Webで再描画
- 送信失敗時の保持と再送（MVP）
- （Phase 2.5）キュー：N件まで端末保持（microSD or flash）

### 3.3 非目標（当面）

- Apple Pencil級（筆圧/傾き/完璧パームリジェクション）
- チーム共有/共同編集
- OCRの高精度保証
- 量産筐体完成品化
- 完全オフライン運用（最低限の下書き保持は可）

---

## 4. 技術スタック

| カテゴリ | 技術 |
|----------|------|
| Web | Next.js（App Router）+ TypeScript + Tailwind + shadcn/ui |
| Auth | Clerk |
| DB | Supabase Postgres + pgvector |
| Storage | Supabase Storage（ink png / 任意ログ） |
| AI | OpenAI（分類/埋め込み/RAG回答/pack/ink caption） |
| Job runner | Vercel Cron（or Supabase Scheduled）→ /api/jobs/run |
| Package manager | pnpm |
| Formatter/Linter | Biome |

---

## 5. 全体アーキテクチャ

### 5.1 コンポーネント

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Client     │────▶│    API       │────▶│    DB        │
│   (PWA)      │     │  (Next.js)   │     │  (Supabase)  │
└──────────────┘     └──────────────┘     └──────────────┘
                            │                    │
                            ▼                    │
                     ┌──────────────┐            │
                     │   Storage    │◀───────────┘
                     │  (Supabase)  │
                     └──────────────┘
       
┌──────────────┐
│   Device     │──────▶ /api/ingest/ink
│  (ESP32)     │
└──────────────┘
```

### 5.2 基本フロー（Phase 1）

1. `POST /api/notes` で raw 保存（即レス）
2. jobsに `classify_note`、`embed_note` をenqueue
3. UIは保存完了を即表示（分類チップは「提案中→反映」でも可）
4. RAG：`POST /api/rag/query` → sources取得→回答生成
5. Pack：週次cron or 手動で `generate_pack`

### 5.3 Inkフロー（Phase 2）

1. Device ingest：`POST /api/ingest/ink`（ink_json保存・即レス）
2. jobsに `render_ink_png`（任意）→ `caption_ink` → `embed_note`
3. Webで再描画（ink_json）＋画像表示（任意）

---

## 6. ドメイン定義

### 6.1 Note（メモ）

| フィールド | 説明 |
|------------|------|
| type | `text` \| `ink` \| `hybrid` |
| content_text | 本文（任意） |
| ink_json | 手書きストローク（任意） |
| ink_image_path | レンダ画像パス（任意） |
| ink_caption | ink向け1行説明（検索用） |
| category_id | カテゴリ（AI提案から採用） |
| tags | タグ配列 |

### 6.2 Category（カテゴリ）

- ユーザー単位のカテゴリ集合
- AIが既存カテゴリ割当 or 新規提案

### 6.3 Knowledge Pack（週次）

- 期間（通常7日、月曜開始〜日曜終了）
- 生成物：Markdown
- "振り返り強制"はしない（自動生成がデフォルト）

---

## 7. UX仕様（摩擦最小）

### 7.1 共通原則

- 入力は最短（1画面、ワンタップ保存）
- 整理はAI主導、ユーザーは採用/変更のみ
- "後で直せる"前提（保存時に完璧を要求しない）

### 7.2 主要画面（MVP）

| パス | 機能 |
|------|------|
| `/` | Capture：テキスト入力 + 保存 + カテゴリ提案チップ |
| `/notes` | 一覧：無限スクロール、検索導線 |
| `/notes/:id` | 詳細：本文、ink再描画、カテゴリ/タグ編集 |
| `/ask` | RAG：質問入力、回答、根拠ノート一覧 |
| `/packs` | Pack一覧：週ごとに表示 |
| `/settings/devices` | Device管理：ペアリング、revoke |

### 7.3 保存時の操作制約

保存時にユーザーがやることは **最大2タップ**：
1. 何も触らず保存 → AI提案を後で反映
2. タップでカテゴリ変更
3. new category

---

## 8. AI仕様（コスパ×就活映え）

### 8.1 モデル設定（環境変数で差し替え可能）

```env
OPENAI_MODEL_CLASSIFY=gpt-4o-mini
OPENAI_MODEL_RAG=gpt-4o
OPENAI_MODEL_PACK=gpt-4o
OPENAI_MODEL_INK_CAPTION=gpt-4o
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
```

### 8.2 分類（classify_note）

**入力**
- note本文（title + content_text + ink_caption）
- 既存カテゴリ一覧（最大50）
- 最近使用上位カテゴリ（最大10）

**出力（JSON）**
```json
{
  "proposed_category_name": "string",
  "confidence": 0.0,
  "new_category_reason": "string|null",
  "language_mix": { "ja": 0.0, "en": 0.0 }
}
```

**適用ルール**
- confidence >= 0.7 なら自動で category_id を確定（既存一致の場合）
- 新規カテゴリは 自動作成しない（ユーザー採用時に作成）
- 低confidenceは「提案のみ」

### 8.3 Embedding戦略（embed_note）

- embedding対象：`title + content_text + ink_caption`
- 再生成条件：`content_hash` が変わった時のみ
- 保存：`note_embeddings` に upsert（note_id pk）

### 8.4 Ink caption（caption_ink）

- 生成目的：OCRではなく「この手書きの内容を1行で説明」
- 出力：`ink_caption`（日本語/英語混在OK）
- その後 `embed_note` を必ず実行

### 8.5 Weekly Knowledge Pack（generate_pack）

- 週定義：月曜開始〜日曜終了
- cron：日曜 23:30（ユーザーTZ、デフォルトAmerica/Chicago）

**出力（Markdown）**
- top themes（3〜7）
- highlights
- decisions / learnings
- open loops
- glossary（日英混在対応）
- next week suggestions

**冪等性**
- `unique(user_id, range_start, range_end)`
- `mode=skip|overwrite` で制御

---

## 9. データモデル（Supabase / Postgres）

### 9.1 方針

- `user_id` は text（Clerk userId）
- uuid は内部IDとして使用

### 9.2 DDL

```sql
create extension if not exists vector;

create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  name text not null,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create table if not exists notes (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  type text not null check (type in ('text', 'ink', 'hybrid')),
  title text null,
  content_text text null,
  ink_json jsonb null,
  ink_image_path text null,
  ink_caption text null,
  category_id uuid null references categories(id) on delete set null,
  tags text[] not null default '{}',
  language_mix jsonb null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists notes_user_created_idx on notes (user_id, created_at desc, id desc);
create index if not exists notes_category_idx on notes (user_id, category_id);

create table if not exists note_embeddings (
  note_id uuid primary key references notes(id) on delete cascade,
  user_id text not null,
  embedding vector(1536) not null,
  model text not null,
  content_hash text not null,
  created_at timestamptz not null default now()
);

create index if not exists note_embeddings_user_idx on note_embeddings (user_id);
create index if not exists note_embeddings_vec_idx on note_embeddings using ivfflat (embedding vector_cosine_ops) with (lists = 100);

create table if not exists knowledge_packs (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  range_start date not null,
  range_end date not null,
  content_md text not null,
  created_at timestamptz not null default now(),
  unique (user_id, range_start, range_end)
);

create index if not exists knowledge_packs_user_idx on knowledge_packs (user_id, range_start desc);

create table if not exists devices (
  id uuid primary key default gen_random_uuid(),
  user_id text null,
  device_name text not null default 'pkp device',
  device_key_hash text null,
  pair_code text null,
  pair_expires_at timestamptz null,
  last_seen_at timestamptz null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz null
);

create index if not exists devices_pair_code_idx on devices (pair_code);

create table if not exists jobs (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  type text not null,
  payload jsonb not null,
  status text not null check (status in ('queued', 'running', 'succeeded', 'failed')),
  attempts int not null default 0,
  max_attempts int not null default 3,
  run_after timestamptz not null default now(),
  locked_at timestamptz null,
  locked_by text null,
  started_at timestamptz null,
  finished_at timestamptz null,
  duration_ms int null,
  tokens_estimate int null,
  last_error text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists jobs_queue_idx on jobs (status, run_after);
```

### 9.3 RLS方針（Defense-in-depth）

MVPはService RoleでDB操作し、APIでアクセス制御する。
将来の「クライアント直叩き」に備え、RLSを用意する。

```sql
alter table notes enable row level security;
alter table categories enable row level security;
alter table note_embeddings enable row level security;
alter table knowledge_packs enable row level security;
alter table devices enable row level security;
alter table jobs enable row level security;

create policy notes_select on notes
for select using (user_id = (auth.jwt() ->> 'sub'));

create policy notes_insert on notes
for insert with check (user_id = (auth.jwt() ->> 'sub'));

create policy notes_update on notes
for update using (user_id = (auth.jwt() ->> 'sub'));

create policy notes_delete on notes
for delete using (user_id = (auth.jwt() ->> 'sub'));

-- 他テーブルも同様に user_id = (auth.jwt() ->> 'sub')
```

---

## 10. API仕様（Next.js /api/*）

### 10.1 認証

- **Web API**：Clerkセッション必須
- **Device API**：Bearer device_token

### 10.2 共通エラー形式

```json
{
  "error": {
    "code": "validation_error",
    "message": "invalid payload",
    "details": {}
  }
}
```

### 10.3 Notes API

#### POST /api/notes

**Request**
```json
{
  "type": "text",
  "title": "optional",
  "content_text": "apple = りんご",
  "tags": ["vocab"]
}
```

**Response 201**
```json
{
  "note": {
    "id": "uuid",
    "type": "text",
    "title": "optional",
    "content_text": "apple = りんご",
    "category_id": null,
    "tags": ["vocab"],
    "created_at": "2026-01-27T00:00:00Z",
    "updated_at": "2026-01-27T00:00:00Z"
  },
  "jobs_enqueued": ["classify_note", "embed_note"]
}
```

#### PATCH /api/notes/:id

**Request**
```json
{
  "title": "new",
  "content_text": "updated text",
  "category_id": "uuid-or-null",
  "tags": ["a", "b"]
}
```

#### DELETE /api/notes/:id

削除（embeddingはcascade）

#### GET /api/notes?cursor=...&limit=20

**Response**
```json
{
  "items": [{ "id": "uuid", "title": null, "snippet": "....", "created_at": "..." }],
  "next_cursor": "base64..."
}
```

### 10.4 Device API

#### POST /api/device/bootstrap（匿名）

**Request**
```json
{ "device_name": "waveshare-esp32s3" }
```

**Response**
```json
{
  "device_id": "uuid",
  "pair_code": "834271",
  "expires_at": "2026-01-27T00:10:00Z"
}
```

#### POST /api/device/claim（ログイン必須）

**Request**
```json
{ "pair_code": "834271" }
```

**Response**
```json
{
  "device_id": "uuid",
  "device_token": "base64url-long-random",
  "note": "device_token is shown only once"
}
```

#### POST /api/ingest/ink（device bearer）

**Request**
```json
{
  "device_id": "uuid",
  "captured_at_ms": 1730000000000,
  "canvas_w": 320,
  "canvas_h": 480,
  "strokes": [
    { "tool": "pen", "width": 1, "points": [[10,12,0],[11,13,16]] }
  ],
  "client_meta": { "fw_version": "0.1.0", "battery": 0.82, "locale": "en-US" }
}
```

**Response 201**
```json
{
  "note_id": "uuid",
  "jobs_enqueued": ["caption_ink", "embed_note"]
}
```

### 10.5 RAG API

#### POST /api/rag/query

**Request**
```json
{ "query": "appleって何だっけ？", "top_k": 8 }
```

**Response**
```json
{
  "answer": "過去メモでは「apple = りんご」と書いてあります。",
  "sources": [
    { "note_id": "uuid", "title": null, "snippet": "apple = りんご", "score": 0.12, "created_at": "..." }
  ]
}
```

### 10.6 Knowledge Pack API

#### POST /api/knowledge-pack/generate

**Request**
```json
{ "range_start": "2026-01-19", "range_end": "2026-01-25", "mode": "skip" }
```

**Response**
```json
{ "pack_id": "uuid", "content_md": "# Weekly Pack...\n..." }
```

### 10.7 Jobs API

#### POST /api/jobs/run（cron専用）

- ヘッダ：`x-cron-secret: <value>`
- runnerは queued を `for update skip locked` で取得して処理

---

## 11. Job処理仕様

### 11.1 ジョブ種類

- `classify_note`
- `embed_note`
- `caption_ink`
- `generate_pack`

### 11.2 runnerアルゴリズム

```
while (processed < batch_limit) {
  job = lock_next_job()
  if (!job) break

  mark_running(job)
  try {
    execute(job)
    mark_succeeded(job)
  } catch (e) {
    mark_failed_or_retry(job, e)
  }
}
```

### 11.3 backoff

- `run_after = now() + (2 ** attempts) minutes`
- `attempts >= max_attempts` で failed 固定

### 11.4 冪等性

- embedding：content_hash が同じならスキップ
- pack：unique制約 + modeで制御
- ink caption：ink_caption が既にあるならスキップ可

---

## 12. 生成プロンプト

### 12.1 分類プロンプト

**System**: 出力はJSONのみ  
**User**: note_text / categories / recent_categories

### 12.2 RAG回答プロンプト

**System**: 根拠の範囲内で回答、根拠が弱ければ不確実性を明示  
**User**: query + sources

### 12.3 Weekly Packプロンプト

**System**: 期間内のノートから構造化Markdownを生成  
**User**: 期間、ノート一覧

### 12.4 Ink caption

**入力**: ink png  
**出力**: 1行説明

---

## 13. Hardware仕様（Phase 2）

### 13.1 採用ボード

Waveshare ESP32-S3 3.5" Capacitive Touch (320×480)

### 13.2 最小BOM

- ボード
- LiPo 3.7V
- USB-Cケーブル
- スタイラス：ディスク型
- 絶縁材

### 13.3 安全要件

- PCB裏面の絶縁（必須）
- バッテリー固定（必須）
- USB抜き差しで基板に負荷がかからない構造

### 13.4 端末UI（MVP）

- Canvas（手書き）
- Soft buttons：Clear / Send / New
- Status：Wi-Fi、送信成否、電池残量

---

## 14. 運用・コスト制御

- AI生成結果はDBに保存し再利用
- embeddingはhashで再生成回避
- packは週次まとめ（バッチ優先）
- jobsに tokens_estimate 等を入れ、将来コスト可視化

---

## 15. 観測性

- jobs：status/attempts/last_error/duration_ms を保存
- UI（簡易管理ページ）で failed jobs を一覧
- pack生成の履歴表示

---

## 16. テスト・受入基準

### 16.1 Web受入

- スマホで10秒以内にノート作成
- AI分類提案 → 最大2タップで確定
- RAGで根拠ノートがリンク付きで返る
- 週次Packが保存され履歴で閲覧できる

### 16.2 Device受入

- 書ける体感遅延
- Clear/Send/Newが機能
- /api/ingest/ink 送信 → Webで再描画
- 失敗時に消えない

### 16.3 テスト計画

- unit：jobs runner、rag query
- e2e：Capture→保存→Ask→sources表示（Playwright 1本）

---

## 17. リポジトリ構成

```
apps/web/           # Next.js（ui + api）
packages/core/      # 型、zodスキーマ、共通ロジック
firmware/device/    # ESP32ファーム（Phase 2）
docs/               # ドキュメント
```

---

## 18. 実装順（最短ルート）

1. DB migration
2. Auth（Clerk）+ API middleware
3. Notes CRUD
4. jobs runner
5. classify_note → カテゴリ提案
6. embed_note → vector検索
7. rag/query
8. pack/generate
9. device/bootstrap + claim
10. ingest/ink → caption_ink → embed_note
