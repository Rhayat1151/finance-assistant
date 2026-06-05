import { groq, MODELS, type Intent } from './groq'

const INTENT_SYSTEM = `You are an intent classifier for a personal finance assistant. The user may have typos — infer intent from the closest meaning.
Classify the user message into exactly one of these intents:
- SIMPLE_AGGREGATE: spending totals, amounts, counts for a category/period ("how much", "what did I spend", "total")
- TIME_COMPARISON: comparing current vs past spending ("more than usual", "compared to last month")
- SUBSCRIPTION_LIST: asking about recurring charges or subscriptions ("subscriptions", "recurring", "monthly charges")
- BUDGET_STATUS: asking about budget limits or progress ("budget", "limit", "how much left")
- ANOMALY_CHECK: unusual, suspicious, weird, strange, unexpected, out-of-pattern charges (even with typos like "unusal", "unusul", "unusual", "strange charges")
- WEB_LOOKUP: asking what a specific named merchant/company is ("what is AMZN", "who is MKTP")
- MEMORY_WRITE: telling the assistant a personal fact to remember ("I get paid", "don't count", "my salary is")
- SUMMARY_REQUEST: asking for an overview or summary of finances ("summarize", "overview", "where does my money go")
- CUTBACK_ADVICE: asking for saving tips or where to spend less ("cut back", "save money", "reduce spending")
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
