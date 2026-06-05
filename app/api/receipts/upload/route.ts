import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { groq, MODELS } from '@/lib/groq'

export interface ReceiptExtracted {
  merchant: string | null
  date: string | null
  currency: string | null
  subtotal: number | null
  tax: number | null
  tip: number | null
  discount: number | null
  total: number | null
  payment_method: string | null
  card_last4: string | null
  receipt_number: string | null
  store_address: string | null
  cashier: string | null
  items: Array<{ name: string; qty?: number; price: number }> | null
  notes: string | null
}

const VISION_PROMPT = `You are a receipt data extraction assistant. Analyze this receipt image carefully and extract ALL available information.

Return ONLY valid JSON with exactly these fields (use null for any field not present or unreadable — never guess):

{
  "merchant": "store/restaurant name",
  "date": "YYYY-MM-DD",
  "currency": "USD or GBP or PKR etc",
  "subtotal": 0.00,
  "tax": 0.00,
  "tip": 0.00,
  "discount": 0.00,
  "total": 0.00,
  "payment_method": "cash or credit card or debit card or mobile pay",
  "card_last4": "1234 or null",
  "receipt_number": "receipt/order/invoice number",
  "store_address": "full address if shown",
  "cashier": "cashier/server name if shown",
  "items": [
    { "name": "item description", "qty": 1, "price": 0.00 }
  ],
  "notes": "any other relevant text (loyalty points, promo codes, special messages)"
}

Rules:
- Use null for any field you cannot read with confidence
- Never invent or estimate numbers
- The "total" field should be the final amount paid
- For discounts, use a positive number (e.g. 5.00 not -5.00)
- Include ALL line items you can read in the items array`

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('image') as File | null
  if (!file) return NextResponse.json({ error: 'No image provided' }, { status: 400 })

  if (!file.type.startsWith('image/')) {
    return NextResponse.json({ error: 'File must be an image' }, { status: 400 })
  }

  const buffer = await file.arrayBuffer()
  const base64 = Buffer.from(buffer).toString('base64')
  const mediaType = file.type as 'image/jpeg' | 'image/png' | 'image/webp'

  let extracted: ReceiptExtracted = {
    merchant: null, date: null, currency: null,
    subtotal: null, tax: null, tip: null, discount: null, total: null,
    payment_method: null, card_last4: null, receipt_number: null,
    store_address: null, cashier: null, items: null, notes: null,
  }

  try {
    const response = await groq.chat.completions.create({
      model: MODELS.VISION,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: `data:${mediaType};base64,${base64}` } },
            { type: 'text', text: VISION_PROMPT },
          ],
        },
      ],
      max_tokens: 1000,
      temperature: 0,
    })

    const content = response.choices[0]?.message?.content ?? ''
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      extracted = { ...extracted, ...JSON.parse(jsonMatch[0]) }
    }
  } catch (err) {
    console.error('Vision extraction failed:', err)
  }

  if (!extracted.merchant && !extracted.total) {
    return NextResponse.json({
      success: false,
      message: "I couldn't read this receipt clearly. Please enter the details manually.",
      extracted: null,
    })
  }

  return NextResponse.json({
    success: true,
    extracted,
    message: 'Review the extracted details and confirm to save.',
  })
}

// Confirm and save
export async function PUT(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { merchant, total, date, extracted } = body

  if (!merchant || !total || !date) {
    return NextResponse.json({ error: 'merchant, total, and date are required' }, { status: 400 })
  }

  // Build a human-readable description summary
  const parts: string[] = []
  const fmt = (n: number) => `PKR ${n.toLocaleString('en-PK', { maximumFractionDigits: 0 })}`
  if (extracted?.subtotal) parts.push(`Subtotal: ${fmt(extracted.subtotal)}`)
  if (extracted?.tax) parts.push(`Tax: ${fmt(extracted.tax)}`)
  if (extracted?.tip) parts.push(`Tip: ${fmt(extracted.tip)}`)
  if (extracted?.discount) parts.push(`Discount: -${fmt(extracted.discount)}`)
  if (extracted?.payment_method) parts.push(`Paid by: ${extracted.payment_method}`)
  if (extracted?.receipt_number) parts.push(`Receipt #${extracted.receipt_number}`)

  const description = parts.length > 0 ? parts.join(' | ') : null

  const { data, error } = await supabase
    .from('transactions')
    .insert({
      user_id: user.id,
      merchant,
      amount: Number(total),
      date,
      description,
      source: 'receipt',
      category: 'Uncategorized',
      receipt_metadata: extracted ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ transaction: data })
}
