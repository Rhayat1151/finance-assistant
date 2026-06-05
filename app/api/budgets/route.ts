import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: budgets } = await supabase
    .from('budgets')
    .select('*')
    .eq('user_id', user.id)

  // Get current month spend per category
  const now = new Date()
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`

  const { data: txs } = await supabase
    .from('transactions')
    .select('category, amount')
    .eq('user_id', user.id)
    .gte('date', monthStart)
    .gt('amount', 0)

  const spent: Record<string, number> = {}
  for (const tx of txs ?? []) {
    spent[tx.category] = (spent[tx.category] ?? 0) + Number(tx.amount)
  }

  const result = (budgets ?? []).map(b => ({
    ...b,
    spent: spent[b.category] ?? 0,
    percent: b.limit_amt > 0 ? Math.round(((spent[b.category] ?? 0) / b.limit_amt) * 100) : 0,
  }))

  return NextResponse.json({ budgets: result })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { category, limit_amt, period } = await req.json()
  if (!category || !limit_amt) {
    return NextResponse.json({ error: 'category and limit_amt required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('budgets')
    .upsert({ user_id: user.id, category, limit_amt, period: period ?? 'monthly' }, { onConflict: 'user_id,category' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ budget: data })
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { category } = await req.json()
  await supabase.from('budgets').delete().eq('user_id', user.id).eq('category', category)
  return NextResponse.json({ ok: true })
}
