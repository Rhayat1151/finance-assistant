import { SupabaseClient } from '@supabase/supabase-js'

export interface SpendSummary {
  category: string
  total: number
  tx_count: number
}

export async function getSpendByCategory(
  supabase: SupabaseClient,
  userId: string,
  months = 1
): Promise<SpendSummary[]> {
  const { data } = await supabase.rpc('get_spend_by_category', {
    p_user_id: userId,
    p_months: months,
  })
  return data ?? []
}

export async function getMonthlySummaries(
  supabase: SupabaseClient,
  userId: string,
  monthsBack = 6
): Promise<Array<{ year: number; month: number; category: string; total: number; tx_count: number }>> {
  const { data } = await supabase
    .from('monthly_summaries')
    .select('year, month, category, total, tx_count')
    .eq('user_id', userId)
    .order('year', { ascending: false })
    .order('month', { ascending: false })
    .limit(monthsBack * 20)
  return data ?? []
}

export async function getAnomalies(
  supabase: SupabaseClient,
  userId: string
): Promise<Array<{ merchant: string; amount: number; date: string; category: string; zscore: number }>> {
  const { data } = await supabase.rpc('get_anomalies', { p_user_id: userId })
  return data ?? []
}

export async function getCurrentMonthSpend(
  supabase: SupabaseClient,
  userId: string
): Promise<SpendSummary[]> {
  const now = new Date()
  const { data } = await supabase
    .from('transactions')
    .select('category, amount')
    .eq('user_id', userId)
    .gte('date', `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`)
    .gt('amount', 0)

  if (!data) return []

  const map: Record<string, { total: number; count: number }> = {}
  for (const row of data) {
    const cat = row.category ?? 'Uncategorized'
    if (!map[cat]) map[cat] = { total: 0, count: 0 }
    map[cat].total += Number(row.amount)
    map[cat].count++
  }
  return Object.entries(map).map(([category, v]) => ({
    category,
    total: v.total,
    tx_count: v.count,
  }))
}

export async function getRecentTransactions(
  supabase: SupabaseClient,
  userId: string,
  limit = 50
) {
  const { data } = await supabase
    .from('transactions')
    .select('date, merchant, amount, category, description')
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .limit(limit)
  return data ?? []
}
