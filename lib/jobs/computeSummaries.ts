import { SupabaseClient } from '@supabase/supabase-js'

export async function computeSummaries(supabase: SupabaseClient, userId: string) {
  const { data: transactions } = await supabase
    .from('transactions')
    .select('date, amount, category')
    .eq('user_id', userId)
    .gt('amount', 0)

  if (!transactions || transactions.length === 0) return

  const map: Record<string, { total: number; count: number }> = {}

  for (const tx of transactions) {
    const d = new Date(tx.date)
    const key = `${d.getFullYear()}-${d.getMonth() + 1}-${tx.category ?? 'Uncategorized'}`
    if (!map[key]) map[key] = { total: 0, count: 0 }
    map[key].total += Number(tx.amount)
    map[key].count++
  }

  const rows = Object.entries(map).map(([key, v]) => {
    const [year, month, ...catParts] = key.split('-')
    return {
      user_id: userId,
      year: Number(year),
      month: Number(month),
      category: catParts.join('-'),
      total: v.total,
      tx_count: v.count,
    }
  })

  await supabase
    .from('monthly_summaries')
    .upsert(rows, { onConflict: 'user_id,year,month,category' })
}
