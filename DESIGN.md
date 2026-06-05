# Design Note — Personal Finance Assistant

## What I Built

A full-stack AI-powered personal finance assistant where users sign in, import transaction history, and talk to an AI in plain English about their money. The core product loop is: **import data → ask questions → get actionable answers**.

Live features:
- Multi-user auth with private data isolation (Supabase RLS)
- CSV transaction import with deduplication and category inference
- Receipt photo scanning (AI vision extracts merchant, amount, date)
- Conversational AI assistant with streaming responses
- Spending queries, time comparisons, subscription detection, anomaly flagging
- Budget setting and tracking (via natural language)
- Persistent user memory ("I get paid on the 1st")
- Web lookup for unknown merchants
- Spending summaries and cut-back suggestions

---

## The Most Important Decision: The Routing Layer

The heart of the system is not the AI model — it is the **intent classifier** that sits in front of every message.

Every user message first hits a fast classification step (Llama 3.1 8B, ~200ms) that assigns it one of ten intents:

```
SIMPLE_AGGREGATE   → "how much did I spend on groceries?"
TIME_COMPARISON    → "am I spending more than usual?"
SUBSCRIPTION_LIST  → "what subscriptions do I have?"
BUDGET_STATUS      → "how's my food budget?"
ANOMALY_CHECK      → "anything unusual lately?"
WEB_LOOKUP         → "what is AMZN MKTP?"
MEMORY_WRITE       → "I get paid on the 1st"
SUMMARY_REQUEST    → "summarize my finances"
CUTBACK_ADVICE     → "where can I cut back?"
UNKNOWN            → ask for clarification
```

Each intent routes to a different handler with different cost and latency profiles:

| Intent | Model | Data source | Latency |
|---|---|---|---|
| SIMPLE_AGGREGATE | Llama 3.1 8B | SQL aggregate | <1s |
| SUBSCRIPTION_LIST | Llama 3.1 8B | Pre-computed table | <0.5s |
| BUDGET_STATUS | Llama 3.1 8B | Pre-computed table | <0.5s |
| MEMORY_WRITE | None | DB upsert only | <0.3s |
| TIME_COMPARISON | Llama 3.3 70B | Monthly summaries | <2s |
| ANOMALY_CHECK | Llama 3.3 70B | Statistical query | <2s |
| SUMMARY_REQUEST | Llama 3.3 70B | Monthly summaries | <3s |
| CUTBACK_ADVICE | Llama 3.3 70B | Monthly summaries | <3s |
| WEB_LOOKUP | Llama 3.3 70B | DuckDuckGo API | 2–4s |

**Why this matters:** About 60% of real user queries fall into SIMPLE_AGGREGATE, SUBSCRIPTION_LIST, or BUDGET_STATUS. These are served in under a second using pre-computed data and the cheapest model. The expensive 70B model is reserved for genuine reasoning tasks. This is what makes the system both fast and economical to run — not any single technical trick, but the deliberate mismatch of effort to task.

---

## Handling Large Transaction History

**The problem:** A user with 3 years of history has 30,000+ transactions. Passing them all into a context window is expensive, slow, and hits token limits.

**The rule I enforced: never pass raw transactions to the model.**

Instead:
- **Numerical questions** → `SELECT SUM(amount) FROM transactions WHERE ...` — Postgres does the math, the model only formats the answer
- **Historical comparisons** → query the `monthly_summaries` table (always O(months), never O(transactions))
- **Anomaly detection** → z-score SQL over available data, return only outliers
- **Subscriptions** → pre-detected and stored in a separate table after every import

### Pre-computation jobs

After every CSV import, two background jobs run asynchronously (without blocking the import response):

1. **`computeSummaries`** — aggregates spending into `monthly_summaries` by year/month/category
2. **`detectSubscriptions`** — groups transactions by merchant, checks for consistent amounts and regular intervals (weekly/monthly/annual), stores results in `subscriptions`

These run once; every subsequent query reads from tiny aggregated tables instead of scanning raw transactions.

---

## Data Model

```
transactions      — raw rows (date, merchant, amount, category, dedup_hash)
monthly_summaries — pre-aggregated (user, year, month, category, total, count)
subscriptions     — detected recurring charges (merchant, amount, interval)
budgets           — user-set limits per category
user_context      — persistent memory (key-value pairs per user)
conversations     — message history (stored client-side for now)
```

Row Level Security is enabled on every table. The policy on each is `auth.uid() = user_id`. This means even if application code has a bug that leaks a user_id, the database will reject the query. User data isolation is enforced at the storage layer, not the application layer.

---

## Technology Choices

**Groq instead of OpenAI**

The "feels fast" constraint in the brief is non-negotiable for a finance assistant — users asking simple questions cannot wait 3 seconds. Groq's LPU inference runs Llama 3.1 8B at ~800 tokens/second, giving sub-second responses for the majority of queries. The speed advantage over GPT-4o mini is significant for the fast path, and the cost is lower. For reasoning-heavy tasks, Llama 3.3 70B performs comparably to GPT-4o on analytical queries.

**Supabase instead of raw Postgres + separate auth**

One service gives managed Postgres, Row Level Security, Auth, and file Storage. For a six-hour assessment, this saves roughly an hour of infrastructure setup. The trade-off is vendor lock-in, which is acceptable here — everything uses standard Postgres SQL and can be migrated.

**Next.js App Router (unified frontend + backend)**

Initially considered separating a Vite frontend from a Next.js API backend, but a unified Next.js project is strictly better for this use case: no CORS configuration, no URL env vars, Server Components for data-fetching pages, and a single deploy. The only reason to split would be if the frontend needed a different runtime, which it does not.

**No LangChain or agent framework**

The routing logic is explicit and simple enough to write directly. A custom router gives full visibility into cost, latency, and fallback behavior. Framework abstractions are harder to debug and tune under time pressure, and they would obscure the routing decisions that are meant to be the interesting part of this submission.

---

## Edge Cases and How They're Handled

**Blurry / rotated / foreign-language receipts**
The Vision model prompt explicitly requests `null` for any field it cannot read confidently — it never guesses amounts. After extraction, the UI presents a confirmation step showing the extracted fields before saving. If all fields are null, the user is told to enter manually.

**Dirty CSV data**
- Duplicate rows: `dedup_hash` unique index + `ON CONFLICT DO NOTHING`
- Missing category: keyword-based inference from merchant name (e.g. "Netflix" → Subscriptions), fallback to "Uncategorized"
- Negative amounts: stored as-is, treated as refunds, excluded from spend totals
- Unparseable date or zero-amount rows: skipped, count returned in the response
- Inconsistent column names: field normalization handles common variants (Date/date/DATE, Amount/amount, etc.)

**Ambiguous questions**
The intent classifier is prompted to handle typos and near-matches. If intent is UNKNOWN, the assistant asks one clarifying question rather than guessing silently.

**No data for current period**
If a user asks "how much did I spend this month?" but their data is from a different year, the system detects the empty result and falls back to the most recent available month, clearly labelling it.

**Contradictory data (receipt vs bank)**
Both records are stored; the assistant surfaces both to the user. Auto-resolution is not attempted.

---

## What Was Intentionally Skipped or Stubbed

| Feature | Decision | Reason |
|---|---|---|
| Real bank connection (Plaid/TrueLayer) | Mock endpoint only | Architecture is pluggable; the import pipeline accepts any source that outputs the same schema |
| Transaction embeddings (pgvector) | Schema ready, not populated | Core query patterns work via SQL; semantic search is additive, not required for the primary flows |
| Push notifications for budget alerts | In-chat warnings only | Sufficient for a demo; production would add webhooks |
| Multi-currency support | Single currency assumed | Out of scope for the data provided |
| Rate limiting per user | Not implemented | Production: Redis sliding window per `user_id`; omitted here to keep dependencies minimal |
| Full conversation persistence | Client-side only | Last 6 messages sent with each request; sufficient for context, Supabase table is there for extension |

---

## What I Would Do With More Time

1. **Streaming budget alerts mid-response** — if a query reveals a budget is over 80%, proactively surface it in the same response
2. **Populate pgvector embeddings** — enable "find that coffee shop near the office" style fuzzy queries
3. **Plaid integration** — replace CSV import with live bank sync; the import pipeline already abstracts the source
4. **Smarter subscription detection** — current algorithm is interval-based; a small classifier could handle irregular billing cycles
5. **Export and reporting** — PDF monthly summary, CSV export

---

## Assumptions

1. Single currency (matching the sample dataset)
2. The mock bank endpoint returns JSON with the same schema as the CSV
3. "Multiple users" means tens to low hundreds of concurrent users, not millions
4. Transaction categories are a fixed set: Food, Transport, Entertainment, Utilities, Health, Shopping, Subscriptions, Other
5. Groq free tier is sufficient for evaluation; production would use a paid tier with higher rate limits
