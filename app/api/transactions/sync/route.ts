import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { computeSummaries } from '@/lib/jobs/computeSummaries'
import { detectSubscriptions } from '@/lib/jobs/detectSubscriptions'

// Mock bank endpoint — simulates fetching recent transactions from a bank API.
// In production this would be replaced with a Plaid/TrueLayer OAuth call.
function generateMockTransactions() {
  const merchants = [
    { name: 'Whole Foods', category: 'Food', amount: () => +(60 + Math.random() * 40).toFixed(2) },
    { name: 'Starbucks', category: 'Food', amount: () => +(4 + Math.random() * 3).toFixed(2) },
    { name: 'Uber', category: 'Transport', amount: () => +(8 + Math.random() * 20).toFixed(2) },
    { name: 'Netflix', category: 'Subscriptions', amount: () => 15.99 },
    { name: 'Spotify', category: 'Subscriptions', amount: () => 9.99 },
    { name: 'Amazon', category: 'Shopping', amount: () => +(20 + Math.random() * 80).toFixed(2) },
    { name: 'Shell Gas Station', category: 'Transport', amount: () => +(45 + Math.random() * 25).toFixed(2) },
    { name: 'CVS Pharmacy', category: 'Health', amount: () => +(10 + Math.random() * 30).toFixed(2) },
  ]

  const now = new Date()
  const transactions = []

  for (let i = 0; i < 10; i++) {
    const daysAgo = Math.floor(Math.random() * 30)
    const date = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000)
    const merchant = merchants[Math.floor(Math.random() * merchants.length)]

    transactions.push({
      date: date.toISOString().split('T')[0],
      merchant: merchant.name,
      amount: merchant.amount(),
      category: merchant.category,
      description: `Bank sync — ${merchant.name}`,
    })
  }

  return transactions
}

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const mockTransactions = generateMockTransactions()

  const rows = mockTransactions.map(tx => ({
    user_id: user.id,
    date: tx.date,
    amount: tx.amount,
    merchant: tx.merchant,
    category: tx.category,
    description: tx.description,
    source: 'bank_sync',
    dedup_hash: crypto
      .createHash('md5')
      .update(`${user.id}|${tx.date}|${tx.amount}|${tx.merchant}`)
      .digest('hex'),
  }))

  const { error } = await supabase
    .from('transactions')
    .upsert(rows, { onConflict: 'dedup_hash', ignoreDuplicates: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Async background jobs
  Promise.all([
    computeSummaries(supabase as any, user.id),
    detectSubscriptions(supabase as any, user.id),
  ]).catch(console.error)

  return NextResponse.json({
    synced: rows.length,
    message: `Synced ${rows.length} transactions from mock bank.`,
    note: 'In production this endpoint connects to Plaid or TrueLayer via OAuth.',
  })
}
