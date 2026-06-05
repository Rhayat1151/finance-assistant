# Personal Finance Assistant

An AI-driven, multi-user personal finance companion. Users sign in, import their transaction history, and talk to an AI assistant in plain English about their money.

> Built for the Revonix Full Stack AI Engineer take-home assessment.
> Full design rationale, architectural decisions, and trade-offs: [DESIGN.md](DESIGN.md)

---

## Features

| Feature | Status |
|---|---|
| Multi-user auth with private data isolation | ✅ |
| CSV transaction import (dedup, category inference, dirty data handling) | ✅ |
| Mock bank sync endpoint | ✅ |
| Receipt photo scanning — extracts 15+ fields (tax, tip, discount, items, payment method) | ✅ |
| Conversational AI with streaming responses | ✅ |
| Spending queries ("how much on food last month?") | ✅ |
| Time comparisons ("am I spending more than usual?") | ✅ |
| Recurring subscription detection | ✅ |
| Anomaly / unusual charge detection | ✅ |
| Budget setting and tracking via natural language | ✅ |
| Unknown merchant web lookup | ✅ |
| Finance summary and cut-back suggestions | ✅ |
| Persistent user memory ("I get paid on the 1st") | ✅ |

---

## Setup

### Prerequisites

- Node.js 18+
- A free [Supabase](https://supabase.com) account
- A free [Groq](https://console.groq.com) account

---

### Step 1 — Clone and install

```bash
git clone https://github.com/Rhayat1151/finance-assistant.git
cd finance-assistant
npm install
```

---

### Step 2 — Create a Supabase project

1. Go to [supabase.com](https://supabase.com) → **New project**
2. Give it a name, set a database password, choose a region, click **Create**
3. Wait ~1 minute for provisioning

---

### Step 3 — Run the database migration

1. In your Supabase project, go to **SQL Editor** (left sidebar)
2. Click **New query**
3. Copy the entire contents of `supabase/migrations/001_schema.sql` and paste it in
4. Click **Run**

You should see: `Success. No rows returned.`

Then run this additional migration to support rich receipt data:

```sql
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS receipt_metadata JSONB;
```

---

### Step 4 — Get your API keys

**Supabase keys** — go to **Project Settings → API**:
- `Project URL` → looks like `https://abcdefgh.supabase.co`
- `anon` `public` key → long JWT string
- `service_role` `secret` key → long JWT string (keep this private)

**Groq key** — go to [console.groq.com](https://console.groq.com) → **API Keys** → **Create API Key**

---

### Step 5 — Configure environment

```bash
cp .env.local.example .env.local
```

Open `.env.local` and fill in your values:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
GROQ_API_KEY=your-groq-api-key
```

---

### Step 6 — Run the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## First Steps After Setup

1. **Sign up** — create an account at `/signup` and verify your email
2. **Import data** — go to `/dashboard/upload` and upload `sample-transactions.csv` (included in the repo)
3. **Chat** — go to `/dashboard/chat` and start asking questions
4. **Dashboard** — go to `/dashboard` to see spending breakdown, budgets, and recent transactions

---

## Example Chat Prompts

```
How much did I spend on food last month?
What subscriptions do I have?
Am I spending more than usual this month?
Any unusual charges lately?
Set a PKR 5000 food budget
I get paid on the 1st
What is AMZN MKTP?
Summarize my finances
Where can I cut back?
```

---

## Architecture Overview

The core design decision is the **intent routing layer** — every message is classified by a fast cheap model (Llama 3.1 8B, ~200ms) before any expensive work happens. This routes to one of 10 handlers, each with different cost and latency profiles.

```
User message
    ↓
Intent classifier (8B, ~200ms)
    ↓
┌─────────────────────────────────────────┐
│ SIMPLE_AGGREGATE → SQL aggregate (<1s)  │
│ SUBSCRIPTION_LIST → pre-computed (<0.5s)│
│ BUDGET_STATUS → pre-computed (<0.5s)    │
│ MEMORY_WRITE → DB upsert (<0.3s)        │
│ TIME_COMPARISON → summaries + 70B (<2s) │
│ ANOMALY_CHECK → stats + 70B (<2s)       │
│ SUMMARY_REQUEST → summaries + 70B (<3s) │
│ WEB_LOOKUP → DuckDuckGo + 70B (2–4s)   │
└─────────────────────────────────────────┘
    ↓
Streamed response
```

Transaction history is never passed raw to the model. Pre-computed `monthly_summaries` keep all historical queries O(months), not O(transactions).

Full details in [DESIGN.md](DESIGN.md).

---

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Database + Auth | Supabase (Postgres + RLS) |
| AI — fast path | Groq Llama 3.1 8B |
| AI — reasoning | Groq Llama 3.3 70B |
| AI — vision (receipts) | Groq Llama 4 Scout Vision |
| Styling | Tailwind CSS (Soft Neumorphism) |

---

## CSV Format

The importer accepts flexible CSV. Column names are case-insensitive and common variants are handled automatically.

| Column | Required | Notes |
|---|---|---|
| `date` | Yes | Most date formats accepted (YYYY-MM-DD, MM/DD/YYYY, etc.) |
| `amount` | Yes | Positive = expense, negative = refund. Currency symbols stripped. |
| `merchant` | Yes | Store or vendor name |
| `category` | No | Auto-inferred from merchant name if missing |
| `description` | No | Optional notes |

**Dirty data handling:**
- Duplicate rows → silently skipped (content hash deduplication)
- Missing category → inferred from merchant keywords, fallback to "Uncategorized"
- Zero or unparseable amounts → skipped, count reported back to user
- Inconsistent column names → normalized automatically

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/transactions/import` | Import CSV file |
| POST | `/api/transactions/sync` | Mock bank sync (generates sample transactions) |
| GET | `/api/transactions` | List transactions (paginated) |
| POST | `/api/chat` | AI chat (streaming SSE) |
| POST | `/api/receipts/upload` | Extract receipt details via Vision |
| PUT | `/api/receipts/upload` | Save confirmed receipt as transaction |
| GET | `/api/budgets` | List budgets with current spend |
| POST | `/api/budgets` | Create or update a budget |
| DELETE | `/api/budgets` | Delete a budget |

---

## Project Structure

```
app/
  (auth)/login        # Sign in page
  (auth)/signup       # Sign up page
  dashboard/          # Overview (Server Component)
  dashboard/chat      # AI chat interface
  dashboard/upload    # CSV + receipt import
  api/chat            # Streaming AI endpoint
  api/transactions/   # Import + list endpoints
  api/receipts/       # Vision OCR endpoint
  api/budgets/        # Budget CRUD

lib/
  groq.ts             # Groq client (lazy singleton)
  router.ts           # Intent classifier
  supabase/           # Browser + server clients
  tools/              # SQL queries, web search, memory
  jobs/               # Background compute jobs

supabase/
  migrations/001_schema.sql   # Full DB schema with RLS
```
