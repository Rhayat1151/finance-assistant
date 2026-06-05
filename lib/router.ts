import { groq, MODELS, type Intent } from './groq'

const INTENT_SYSTEM = `You are an intent classifier for a personal finance assistant.
Classify the user message into exactly one of these intents:
- SIMPLE_AGGREGATE: spending totals, amounts, counts for a category/period
- TIME_COMPARISON: comparing current vs past spending
- SUBSCRIPTION_LIST: asking about recurring charges or subscriptions
- BUDGET_STATUS: asking about budget limits or progress
- ANOMALY_CHECK: unusual charges, suspicious activity, out-of-pattern spending
- WEB_LOOKUP: asking what a merchant/charge is
- MEMORY_WRITE: telling the assistant a personal fact to remember (pay date, preferences)
- SUMMARY_REQUEST: asking for an overview or summary of finances
- CUTBACK_ADVICE: asking for saving tips or where to spend less
- UNKNOWN: cannot determine intent

Reply with ONLY the intent name, nothing else.`

export async function classifyIntent(message: string): Promise<Intent> {
  try {
    const res = await groq.chat.completions.create({
      model: MODELS.FAST,
      messages: [
        { role: 'system', content: INTENT_SYSTEM },
        { role: 'user', content: message },
      ],
      max_tokens: 20,
      temperature: 0,
    })
    const raw = res.choices[0]?.message?.content?.trim().toUpperCase() ?? 'UNKNOWN'
    const valid: Intent[] = [
      'SIMPLE_AGGREGATE','TIME_COMPARISON','SUBSCRIPTION_LIST','BUDGET_STATUS',
      'ANOMALY_CHECK','WEB_LOOKUP','MEMORY_WRITE','SUMMARY_REQUEST','CUTBACK_ADVICE','UNKNOWN',
    ]
    return valid.includes(raw as Intent) ? (raw as Intent) : 'UNKNOWN'
  } catch {
    return 'UNKNOWN'
  }
}

export function needsSmartModel(intent: Intent): boolean {
  return ['TIME_COMPARISON','ANOMALY_CHECK','SUMMARY_REQUEST','CUTBACK_ADVICE','WEB_LOOKUP'].includes(intent)
}
