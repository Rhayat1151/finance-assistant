import { SupabaseClient } from '@supabase/supabase-js'

export async function loadUserContext(supabase: SupabaseClient, userId: string): Promise<string> {
  const { data } = await supabase
    .from('user_context')
    .select('key, value')
    .eq('user_id', userId)

  if (!data || data.length === 0) return ''
  return 'User context:\n' + data.map((r: { key: string; value: string }) => `- ${r.key}: ${r.value}`).join('\n')
}

export async function saveUserContext(
  supabase: SupabaseClient,
  userId: string,
  key: string,
  value: string
): Promise<void> {
  await supabase.from('user_context').upsert({ user_id: userId, key, value })
}

export async function extractAndSaveContext(
  supabase: SupabaseClient,
  userId: string,
  message: string
): Promise<string> {
  // Simple regex-based extraction for common patterns
  const patterns: Array<{ regex: RegExp; key: string; extract: (m: RegExpMatchArray) => string }> = [
    { regex: /i (?:get paid|am paid|receive (?:my )?(?:salary|paycheck)) on the (\w+)/i, key: 'payday', extract: m => m[1] },
    { regex: /(?:don'?t|do not) count (.+?) in (?:my )?(.+?) budget/i, key: 'budget_exclusion', extract: m => `exclude ${m[1]} from ${m[2]} budget` },
    { regex: /my (?:monthly )?(?:salary|income|pay) is \$?([\d,]+)/i, key: 'monthly_income', extract: m => m[1].replace(',','') },
    { regex: /i (?:live|am) in ([A-Za-z\s]+)/i, key: 'location', extract: m => m[1].trim() },
  ]

  for (const p of patterns) {
    const match = message.match(p.regex)
    if (match) {
      const value = p.extract(match)
      await saveUserContext(supabase, userId, p.key, value)
      return `Got it — I'll remember that your ${p.key.replace(/_/g, ' ')} is "${value}".`
    }
  }

  return `I've noted that: "${message}". I'll keep this in mind for future conversations.`
}
