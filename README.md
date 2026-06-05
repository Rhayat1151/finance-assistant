# Personal Finance Assistant

An AI-driven, multi-user financial companion built for the Revonix Full Stack AI Engineer assessment.

## Quick Start

### 1. Clone & install

```bash
git clone <repo-url>
cd finance-assistant
npm install
```

### 2. Set up Supabase

1. Create a free project at [supabase.com](https://supabase.com)
2. In the **SQL Editor**, run the contents of `supabase/migrations/001_schema.sql`
3. In **Project Settings → API**, copy your Project URL and keys

### 3. Configure environment

```bash
cp .env.local.example .env.local
```

Fill in `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJh...
SUPABASE_SERVICE_ROLE_KEY=eyJh...
GROQ_API_KEY=gsk_...
```

Get your Groq API key at [console.groq.com](https://console.groq.com) (free).

### 4. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Usage

1. **Sign up** at `/signup` and verify your email
2. **Import data** at `/dashboard/upload` — use `sample-transactions.csv` for quick testing
3. **Chat** at `/dashboard/chat` — ask questions in plain English
4. **View overview** at `/dashboard` — spending breakdown, budgets, recent transactions

### Example chat prompts

```
How much did I spend on food last month?
What subscriptions do I have?
Am I spending more than usual this month?
Any unusual charges?
Set a $400 food budget
I get paid on the 1st
What is AMZN MKTP?
Summarize my finances
Where can I cut back?
```

---

## Architecture

See [DESIGN.md](DESIGN.md) for full design notes. Quick summary:

- **Intent classifier** (Llama 3.1 8B, ~200ms) routes every message to the right handler before any expensive work
- **Pre-computed summaries** mean historical queries never scan raw transaction rows — always O(months) not O(transactions)
- **Two-model strategy**: 8B for fast/cheap queries (<1s), 70B for reasoning-heavy tasks
- **Streaming responses** via SSE so users see tokens instantly even for slow queries
- **Row Level Security** at the database level — user data isolation enforced even if app code has a bug

### Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 14 App Router |
| Database + Auth | Supabase (Postgres) |
| AI | Groq (Llama 3.1 8B / 70B + Llama 4 Vision) |
| Styling | Tailwind CSS |

---

## CSV Format

The importer accepts flexible CSV with these columns (case-insensitive):

| Column | Required | Notes |
|---|---|---|
| `date` | Yes | Most date formats accepted |
| `amount` | Yes | Positive = expense, negative = refund |
| `merchant` | Yes | Store/vendor name |
| `category` | No | Auto-inferred from merchant name if missing |
| `description` | No | Optional notes |

Duplicate rows (same date + amount + merchant) are silently skipped. Invalid rows are counted and reported.
