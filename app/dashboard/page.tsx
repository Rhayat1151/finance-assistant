import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { format } from 'date-fns'

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
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
    supabase.from('transactions').select('date, merchant, amount, category').eq('user_id', user.id).order('date', { ascending: false }).limit(10),
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
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Overview</h2>
          <p className="text-gray-500">{format(now, 'MMMM yyyy')}</p>
        </div>
        <Link
          href="/dashboard/chat"
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          Ask AI Assistant
        </Link>
      </div>

      {!hasData && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 text-center">
          <p className="text-blue-800 font-medium">No transactions yet</p>
          <p className="text-blue-600 text-sm mt-1">
            <Link href="/dashboard/upload" className="underline">Import a CSV</Link> to get started
          </p>
        </div>
      )}

      {hasData && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <p className="text-sm text-gray-500">Spent this month</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(totalThisMonth)}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <p className="text-sm text-gray-500">Transactions this month</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{(currentMonthTxs ?? []).length}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <p className="text-sm text-gray-500">Active subscriptions</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{(subscriptions ?? []).length}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top categories */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-900 mb-4">Spending by category</h3>
              {topCategories.length === 0 ? (
                <p className="text-sm text-gray-400">No data</p>
              ) : (
                <div className="space-y-3">
                  {topCategories.map(([cat, amount]) => (
                    <div key={cat}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-700">{cat}</span>
                        <span className="font-medium text-gray-900">{formatCurrency(amount)}</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full">
                        <div
                          className="h-1.5 bg-blue-500 rounded-full"
                          style={{ width: `${Math.min(100, (amount / totalThisMonth) * 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Budgets */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900">Budgets</h3>
                <Link href="/dashboard/chat" className="text-xs text-blue-600 hover:underline">Set a budget →</Link>
              </div>
              {(budgets ?? []).length === 0 ? (
                <p className="text-sm text-gray-400">No budgets set. Tell the assistant "Set a $500 budget for Food".</p>
              ) : (
                <div className="space-y-3">
                  {(budgets ?? []).map((b: any) => {
                    const spent = spentMap[b.category] ?? 0
                    const pct = Math.min(100, Math.round((spent / b.limit_amt) * 100))
                    const over = spent > b.limit_amt
                    return (
                      <div key={b.id}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-700">{b.category}</span>
                          <span className={`font-medium ${over ? 'text-red-600' : 'text-gray-900'}`}>
                            {formatCurrency(spent)} / {formatCurrency(b.limit_amt)}
                          </span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full">
                          <div
                            className={`h-1.5 rounded-full ${over ? 'bg-red-500' : pct > 80 ? 'bg-yellow-500' : 'bg-green-500'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        {over && <p className="text-xs text-red-600 mt-0.5">Over budget by {formatCurrency(spent - b.limit_amt)}</p>}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Recent transactions */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-900 mb-4">Recent transactions</h3>
            <div className="divide-y divide-gray-100">
              {(recentTxs ?? []).map((tx: any, i: number) => (
                <div key={i} className="flex items-center justify-between py-2.5">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{tx.merchant}</p>
                    <p className="text-xs text-gray-400">{tx.category} · {tx.date}</p>
                  </div>
                  <span className={`text-sm font-semibold ${Number(tx.amount) < 0 ? 'text-green-600' : 'text-gray-900'}`}>
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
