import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { format } from 'date-fns'

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', maximumFractionDigits: 0 }).format(n)
}

const CATEGORY_ICONS: Record<string, string> = {
  Food: '🍔', Transport: '🚗', Entertainment: '🎬', Utilities: '💡',
  Health: '💊', Shopping: '🛍️', Subscriptions: '📱', Other: '📦', Uncategorized: '📋',
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const now = new Date()
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`

  const [
    { data: currentMonthTxs },
    { data: recentTxs },
    { data: budgets },
    { data: subscriptions },
  ] = await Promise.all([
    supabase.from('transactions').select('amount, category').eq('user_id', user.id).gte('date', monthStart).gt('amount', 0),
    supabase.from('transactions').select('date, merchant, amount, category').eq('user_id', user.id).order('date', { ascending: false }).limit(8),
    supabase.from('budgets').select('*').eq('user_id', user.id),
    supabase.from('subscriptions').select('*').eq('user_id', user.id).limit(5),
  ])

  const totalThisMonth = (currentMonthTxs ?? []).reduce((sum, t) => sum + Number(t.amount), 0)

  const byCategory: Record<string, number> = {}
  for (const t of currentMonthTxs ?? []) {
    byCategory[t.category] = (byCategory[t.category] ?? 0) + Number(t.amount)
  }
  const topCategories = Object.entries(byCategory).sort((a, b) => b[1] - a[1]).slice(0, 5)
  const spentMap: Record<string, number> = {}
  for (const t of currentMonthTxs ?? []) {
    spentMap[t.category] = (spentMap[t.category] ?? 0) + Number(t.amount)
  }

  const hasData = (recentTxs ?? []).length > 0

  return (
    <div className="max-w-6xl mx-auto py-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: '#4a5568' }}>Overview</h2>
          <p className="text-sm mt-0.5" style={{ color: '#8896a7' }}>{format(now, 'MMMM yyyy')}</p>
        </div>
        <Link href="/dashboard/chat" className="neu-btn-accent px-5 py-2.5 text-sm font-semibold">
          Ask AI Assistant
        </Link>
      </div>

      {!hasData && (
        <div className="neu-inset p-8 text-center">
          <div className="text-4xl mb-3">📊</div>
          <p className="font-semibold" style={{ color: '#4a5568' }}>No transactions yet</p>
          <p className="text-sm mt-1" style={{ color: '#8896a7' }}>
            <Link href="/dashboard/upload" className="font-semibold underline" style={{ color: '#6c9bcf' }}>Import a CSV</Link> to get started
          </p>
        </div>
      )}

      {hasData && (
        <>
          {/* Stats row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {[
              { label: 'Spent this month', value: formatCurrency(totalThisMonth), icon: '💸' },
              { label: 'Transactions', value: String((currentMonthTxs ?? []).length), icon: '🧾' },
              { label: 'Subscriptions', value: String((subscriptions ?? []).length), icon: '🔄' },
            ].map(({ label, value, icon }) => (
              <div key={label} className="neu-card p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="neu-flat w-10 h-10 flex items-center justify-center text-lg rounded-xl">{icon}</div>
                  <p className="text-sm" style={{ color: '#8896a7' }}>{label}</p>
                </div>
                <p className="text-2xl font-bold" style={{ color: '#4a5568' }}>{value}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Spending by category */}
            <div className="neu-card p-6">
              <h3 className="font-semibold mb-5" style={{ color: '#4a5568' }}>Spending by category</h3>
              {topCategories.length === 0 ? (
                <p className="text-sm" style={{ color: '#8896a7' }}>No data</p>
              ) : (
                <div className="space-y-4">
                  {topCategories.map(([cat, amount]) => (
                    <div key={cat}>
                      <div className="flex justify-between text-sm mb-2">
                        <span style={{ color: '#6b7a8d' }}>
                          {CATEGORY_ICONS[cat] ?? '📋'} {cat}
                        </span>
                        <span className="font-semibold" style={{ color: '#4a5568' }}>{formatCurrency(amount)}</span>
                      </div>
                      <div className="neu-track h-2">
                        <div
                          className="h-2 rounded-full"
                          style={{
                            width: `${Math.min(100, (amount / totalThisMonth) * 100)}%`,
                            background: 'linear-gradient(90deg, #7aadd6, #5f8ec2)',
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Budgets */}
            <div className="neu-card p-6">
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-semibold" style={{ color: '#4a5568' }}>Budgets</h3>
                <Link href="/dashboard/chat" className="text-xs font-semibold" style={{ color: '#6c9bcf' }}>
                  Set a budget →
                </Link>
              </div>
              {(budgets ?? []).length === 0 ? (
                <div className="neu-inset p-4 text-sm text-center" style={{ color: '#8896a7' }}>
                  Tell the assistant:<br />
                  <span className="font-medium" style={{ color: '#6b7a8d' }}>"Set a $500 budget for Food"</span>
                </div>
              ) : (
                <div className="space-y-4">
                  {(budgets ?? []).map((b: any) => {
                    const spent = spentMap[b.category] ?? 0
                    const pct = Math.min(100, Math.round((spent / b.limit_amt) * 100))
                    const over = spent > b.limit_amt
                    const barColor = over ? '#fc8181' : pct > 80 ? '#f6ad55' : '#68d391'
                    return (
                      <div key={b.id}>
                        <div className="flex justify-between text-sm mb-2">
                          <span style={{ color: '#6b7a8d' }}>{CATEGORY_ICONS[b.category] ?? '📋'} {b.category}</span>
                          <span className="font-semibold" style={{ color: over ? '#e05252' : '#4a5568' }}>
                            {formatCurrency(spent)} / {formatCurrency(b.limit_amt)}
                          </span>
                        </div>
                        <div className="neu-track h-2">
                          <div className="h-2 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: barColor }} />
                        </div>
                        {over && (
                          <p className="text-xs mt-1" style={{ color: '#e05252' }}>
                            Over by {formatCurrency(spent - b.limit_amt)}
                          </p>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Recent transactions */}
          <div className="neu-card p-6">
            <h3 className="font-semibold mb-5" style={{ color: '#4a5568' }}>Recent transactions</h3>
            <div className="space-y-2">
              {(recentTxs ?? []).map((tx: any, i: number) => (
                <div key={i} className="neu-flat px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="neu-inset w-9 h-9 flex items-center justify-center text-base rounded-xl">
                      {CATEGORY_ICONS[tx.category] ?? '📋'}
                    </div>
                    <div>
                      <p className="text-sm font-medium" style={{ color: '#4a5568' }}>{tx.merchant}</p>
                      <p className="text-xs" style={{ color: '#8896a7' }}>{tx.category} · {tx.date}</p>
                    </div>
                  </div>
                  <span className="text-sm font-bold" style={{ color: Number(tx.amount) < 0 ? '#48bb78' : '#4a5568' }}>
                    {Number(tx.amount) < 0 ? '+' : '-'}{formatCurrency(Math.abs(Number(tx.amount)))}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
