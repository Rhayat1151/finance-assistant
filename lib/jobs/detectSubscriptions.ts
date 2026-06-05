import { SupabaseClient } from '@supabase/supabase-js'

export async function detectSubscriptions(supabase: SupabaseClient, userId: string) {
  const { data: transactions } = await supabase
    .from('transactions')
    .select('date, merchant, amount')
    .eq('user_id', userId)
    .gt('amount', 0)
    .order('date', { ascending: true })

  if (!transactions || transactions.length === 0) return

  // Group by merchant
  const byMerchant: Record<string, Array<{ date: string; amount: number }>> = {}
  for (const tx of transactions) {
    if (!byMerchant[tx.merchant]) byMerchant[tx.merchant] = []
    byMerchant[tx.merchant].push({ date: tx.date, amount: tx.amount })
  }

  const subscriptions = []

  for (const [merchant, txs] of Object.entries(byMerchant)) {
    if (txs.length < 2) continue

    // Check if amounts are consistent (within 5%)
    const amounts = txs.map(t => t.amount)
    const avgAmount = amounts.reduce((a, b) => a + b, 0) / amounts.length
    const consistent = amounts.every(a => Math.abs(a - avgAmount) / avgAmount < 0.05)
    if (!consistent) continue

    // Check interval between charges
    const dates = txs.map(t => new Date(t.date).getTime()).sort()
    const gaps = dates.slice(1).map((d, i) => Math.round((d - dates[i]) / (1000 * 60 * 60 * 24)))
    const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length

    let interval: string | null = null
    if (avgGap >= 25 && avgGap <= 35) interval = 'monthly'
    else if (avgGap >= 355 && avgGap <= 375) interval = 'annual'
    else if (avgGap >= 5 && avgGap <= 9) interval = 'weekly'

    if (!interval) continue

    subscriptions.push({
      user_id: userId,
      merchant,
      amount: avgAmount,
      interval,
      last_seen: txs[txs.length - 1].date,
    })
  }

  if (subscriptions.length > 0) {
    await supabase
      .from('subscriptions')
      .upsert(subscriptions, { onConflict: 'user_id,merchant' })
  }
}
