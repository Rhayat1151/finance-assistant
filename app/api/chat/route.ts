import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { groq, MODELS } from '@/lib/groq'
import { classifyIntent, needsSmartModel } from '@/lib/router'
import { loadUserContext, extractAndSaveContext } from '@/lib/tools/memory'
import { getMonthlySummaries, getCurrentMonthSpend } from '@/lib/tools/sqlQuery'
import { searchMerchant } from '@/lib/tools/webSearch'
import { handleBudgetCommand } from './budget-handler'

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}

async function buildDataContext(
  supabase: ReturnType<typeof import('@supabase/supabase-js').createClient>,
  userId: string,
  intent: string,
  message: string
): Promise<string> {
  const now = new Date()

  switch (intent) {
    case 'SIMPLE_AGGREGATE': {
      const currentSpend = await getCurrentMonthSpend(supabase as any, userId)
      const summaries = await getMonthlySummaries(supabase as any, userId, 3)
      return `Current month spend by category:\n${currentSpend.map(s => `${s.category}: ${formatCurrency(s.total)} (${s.tx_count} transactions)`).join('\n')}\n\nRecent monthly history:\n${JSON.stringify(summaries.slice(0, 30))}`
    }

    case 'TIME_COMPARISON': {
      const summaries = await getMonthlySummaries(supabase as any, userId, 6)
      return `Monthly spending history (last 6 months):\n${JSON.stringify(summaries)}`
    }

    case 'SUBSCRIPTION_LIST': {
      const { data } = await (supabase as any).from('subscriptions').select('*').eq('user_id', userId)
      if (!data || data.length === 0) return 'No recurring subscriptions detected yet.'
      return `Detected subscriptions:\n${data.map((s: any) => `${s.merchant}: ${formatCurrency(s.amount)}/${s.interval} (last charged: ${s.last_seen})`).join('\n')}`
    }

    case 'BUDGET_STATUS': {
      const { data: budgets } = await (supabase as any).from('budgets').select('*').eq('user_id', userId)
      const currentSpend = await getCurrentMonthSpend(supabase as any, userId)
      const spentMap = Object.fromEntries(currentSpend.map(s => [s.category, s.total]))
      if (!budgets || budgets.length === 0) return 'No budgets set. User can set budgets in the dashboard.'
      return `Budget status this month:\n${budgets.map((b: any) => {
        const spent = spentMap[b.category] ?? 0
        const pct = Math.round((spent / b.limit_amt) * 100)
        return `${b.category}: ${formatCurrency(spent)} of ${formatCurrency(b.limit_amt)} (${pct}%)`
      }).join('\n')}`
    }

    case 'ANOMALY_CHECK': {
      // Get last 90 days and compute z-scores per category
      const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      const { data: txs } = await (supabase as any)
        .from('transactions')
        .select('date, merchant, amount, category')
        .eq('user_id', userId)
        .gte('date', ninetyDaysAgo)
        .gt('amount', 0)
        .order('amount', { ascending: false })

      if (!txs || txs.length === 0) return 'Not enough transaction data to detect anomalies.'

      // Find top 5 largest charges compared to average
      const byCategory: Record<string, number[]> = {}
      for (const tx of txs) {
        if (!byCategory[tx.category]) byCategory[tx.category] = []
        byCategory[tx.category].push(Number(tx.amount))
      }

      const anomalies = txs.filter((tx: any) => {
        const amounts = byCategory[tx.category]
        if (amounts.length < 3) return false
        const mean = amounts.reduce((a: number, b: number) => a + b, 0) / amounts.length
        const std = Math.sqrt(amounts.reduce((a: number, b: number) => a + Math.pow(b - mean, 2), 0) / amounts.length)
        return std > 0 && (Number(tx.amount) - mean) / std > 1.5
      }).slice(0, 5)

      if (anomalies.length === 0) return 'No unusual charges detected in the last 90 days.'
      return `Potentially unusual charges:\n${anomalies.map((t: any) => `${t.date} — ${t.merchant}: ${formatCurrency(t.amount)} (${t.category})`).join('\n')}`
    }

    case 'WEB_LOOKUP': {
      // Extract merchant name from message
      const merchantMatch = message.match(/(?:what is|what's|who is|tell me about|look up)\s+(.+?)(?:\?|$)/i)
      const query = merchantMatch ? merchantMatch[1] : message
      const result = await searchMerchant(query)
      return `Web search result for "${query}":\n${result}`
    }

    case 'SUMMARY_REQUEST':
    case 'CUTBACK_ADVICE': {
      const summaries = await getMonthlySummaries(supabase as any, userId, 3)
      const subs = await (supabase as any).from('subscriptions').select('merchant, amount, interval').eq('user_id', userId)
      return `3-month spending summary:\n${JSON.stringify(summaries)}\n\nSubscriptions: ${JSON.stringify(subs.data ?? [])}`
    }

    default:
      return await getCurrentMonthSpend(supabase as any, userId).then(s =>
        s.length > 0 ? `Current month spend:\n${s.map(x => `${x.category}: ${formatCurrency(x.total)}`).join('\n')}` : ''
      )
  }
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { message, history = [] } = await req.json()
  if (!message?.trim()) return new Response('Message required', { status: 400 })

  const intent = await classifyIntent(message)

  // Handle memory write without streaming (instant)
  if (intent === 'MEMORY_WRITE') {
    const reply = await extractAndSaveContext(supabase as any, user.id, message)
    return new Response(
      JSON.stringify({ reply, intent }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  }

  // Handle budget set commands inline
  const budgetReply = await handleBudgetCommand(supabase as any, user.id, message)
  if (budgetReply) {
    return new Response(
      JSON.stringify({ reply: budgetReply, intent: 'BUDGET_STATUS' }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  }

  // Load user context + data
  const [userContext, dataContext] = await Promise.all([
    loadUserContext(supabase as any, user.id),
    buildDataContext(supabase as any, user.id, intent, message),
  ])

  const systemPrompt = `You are a personal finance assistant. Be direct, use specific numbers, and keep responses concise.
${userContext ? `\n${userContext}\n` : ''}
Rules:
- If data shows empty results, say so honestly — never invent numbers
- Always cite specific figures from the data provided
- For ambiguous questions, ask one clarifying question
- Format currency as $X,XXX.XX
- Keep responses under 200 words unless a summary is explicitly requested

Current financial data:
${dataContext || 'No financial data available yet. Ask the user to import transactions.'}`

  const messages = [
    ...history.slice(-6).map((m: { role: string; content: string }) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    { role: 'user' as const, content: message },
  ]

  const model = needsSmartModel(intent) ? MODELS.SMART : MODELS.FAST

  // Stream response
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const completion = await groq.chat.completions.create({
          model,
          messages: [{ role: 'system', content: systemPrompt }, ...messages],
          stream: true,
          max_tokens: 600,
          temperature: 0.3,
        })

        for await (const chunk of completion) {
          const text = chunk.choices[0]?.delta?.content ?? ''
          if (text) controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`))
        }

        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, intent })}\n\n`))
        controller.close()
      } catch (err) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: 'Assistant temporarily unavailable. Please try again.' })}\n\n`))
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
