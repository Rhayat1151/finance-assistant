import Groq from 'groq-sdk'

let _groq: Groq | null = null

export function getGroq(): Groq {
  if (!_groq) {
    _groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
  }
  return _groq
}

// Convenience export — same interface as before but lazy
export const groq = new Proxy({} as Groq, {
  get(_target, prop) {
    return (getGroq() as any)[prop]
  },
})

export const MODELS = {
  FAST: 'llama-3.1-8b-instant',
  SMART: 'llama-3.3-70b-versatile',
  VISION: 'meta-llama/llama-4-scout-17b-16e-instruct',
} as const

export type Intent =
  | 'SIMPLE_AGGREGATE'
  | 'TIME_COMPARISON'
  | 'SUBSCRIPTION_LIST'
  | 'BUDGET_STATUS'
  | 'ANOMALY_CHECK'
  | 'WEB_LOOKUP'
  | 'MEMORY_WRITE'
  | 'SUMMARY_REQUEST'
  | 'CUTBACK_ADVICE'
  | 'UNKNOWN'
