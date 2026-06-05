import { NextRequest, NextResponse } from 'next/server'
import Papa from 'papaparse'
import crypto from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { computeSummaries } from '@/lib/jobs/computeSummaries'
import { detectSubscriptions } from '@/lib/jobs/detectSubscriptions'

const CATEGORY_MAP: Record<string, string> = {
  netflix: 'Subscriptions', spotify: 'Subscriptions', amazon: 'Shopping',
  uber: 'Transport', lyft: 'Transport', grocery: 'Food', supermarket: 'Food',
  restaurant: 'Food', cafe: 'Food', coffee: 'Food', pharmacy: 'Health',
  hospital: 'Health', gym: 'Health', electricity: 'Utilities', gas: 'Utilities',
  water: 'Utilities', internet: 'Utilities', fuel: 'Transport',
}

function inferCategory(merchant: string): string {
  const lower = merchant.toLowerCase()
  for (const [keyword, category] of Object.entries(CATEGORY_MAP)) {
    if (lower.includes(keyword)) return category
  }
  return 'Uncategorized'
}

function dedupHash(userId: string, date: string, amount: string, merchant: string): string {
  return crypto.createHash('md5').update(`${userId}|${date}|${amount}|${merchant}`).digest('hex')
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  const text = await file.text()
  const { data: rows, errors } = Papa.parse(text, { header: true, skipEmptyLines: true })

  if (errors.length > 0 && rows.length === 0) {
    return NextResponse.json({ error: 'Could not parse CSV' }, { status: 400 })
  }

  const transactions = []
  let skipped = 0

  for (const row of rows as Record<string, string>[]) {
    // Normalize field names (handle different CSV column naming)
    const date = row.date || row.Date || row.DATE || row.transaction_date
    const amountRaw = row.amount || row.Amount || row.AMOUNT || row.value
    const merchant = (row.merchant || row.Merchant || row.description || row.Description || row.merchant_name || '').trim()

    if (!date || !amountRaw || !merchant) { skipped++; continue }

    const parsedDate = new Date(date)
    if (isNaN(parsedDate.getTime())) { skipped++; continue }

    const amount = parseFloat(amountRaw.replace(/[^0-9.-]/g, ''))
    if (isNaN(amount) || amount === 0) { skipped++; continue }

    const category = row.category || row.Category || inferCategory(merchant)

    transactions.push({
      user_id: user.id,
      date: parsedDate.toISOString().split('T')[0],
      amount,
      merchant,
      category,
      description: row.description || row.Description || null,
      source: 'import',
      dedup_hash: dedupHash(user.id, parsedDate.toISOString().split('T')[0], String(amount), merchant),
    })
  }

  if (transactions.length === 0) {
    return NextResponse.json({ error: 'No valid transactions found', skipped }, { status: 400 })
  }

  const { error: insertError } = await supabase
    .from('transactions')
    .upsert(transactions, { onConflict: 'dedup_hash', ignoreDuplicates: true })
  const count = transactions.length

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  // Run background jobs (don't await — return fast)
  Promise.all([
    computeSummaries(supabase, user.id),
    detectSubscriptions(supabase, user.id),
  ]).catch(console.error)

  return NextResponse.json({
    inserted: count ?? transactions.length,
    skipped,
    message: `Imported ${count ?? transactions.length} transactions${skipped > 0 ? `, skipped ${skipped} invalid rows` : ''}.`,
  })
}
