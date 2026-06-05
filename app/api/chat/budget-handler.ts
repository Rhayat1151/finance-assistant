import { SupabaseClient } from '@supabase/supabase-js'

// Detect budget set/update requests in a message and handle them
export async function handleBudgetCommand(
  supabase: SupabaseClient,
  userId: string,
  message: string
): Promise<string | null> {
  // Match: "set a $300 food budget" or "set food budget to $300" or "budget $300 for food"
  const patterns = [
    /set (?:a )?\$?([\d,]+) (\w+) budget/i,
    /set (\w+) budget (?:to )?\$?([\d,]+)/i,
    /budget \$?([\d,]+) for (\w+)/i,
    /(\w+) budget (?:of )?\$?([\d,]+)/i,
  ]

  const CATEGORIES = ['Food', 'Transport', 'Entertainment', 'Utilities', 'Health', 'Shopping', 'Subscriptions', 'Other']

  for (const pattern of patterns) {
    const match = message.match(pattern)
    if (!match) continue

    let amount: number
    let category: string

    if (pattern.source.startsWith('set (?:a )')) {
      amount = parseFloat(match[1].replace(',', ''))
      category = match[2]
    } else if (pattern.source.startsWith('set (')) {
      category = match[1]
      amount = parseFloat(match[2].replace(',', ''))
    } else {
      amount = parseFloat(match[1].replace(',', ''))
      category = match[2]
    }

    // Normalize category
    const normalizedCategory = CATEGORIES.find(c => c.toLowerCase() === category.toLowerCase()) ?? 'Other'
    if (isNaN(amount) || amount <= 0) continue

    await supabase.from('budgets').upsert(
      { user_id: userId, category: normalizedCategory, limit_amt: amount, period: 'monthly' },
      { onConflict: 'user_id,category' }
    )

    return `Budget set: $${amount.toFixed(2)}/month for ${normalizedCategory}. I'll track this and warn you when you're close to the limit.`
  }

  return null
}
