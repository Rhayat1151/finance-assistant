import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { groq, MODELS } from '@/lib/groq'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('image') as File | null
  if (!file) return NextResponse.json({ error: 'No image provided' }, { status: 400 })

  // Validate file type
  if (!file.type.startsWith('image/')) {
    return NextResponse.json({ error: 'File must be an image' }, { status: 400 })
  }

  // Convert to base64 for Groq Vision
  const buffer = await file.arrayBuffer()
  const base64 = Buffer.from(buffer).toString('base64')
  const mediaType = file.type as 'image/jpeg' | 'image/png' | 'image/webp'

  let extracted: {
    merchant: string | null
    amount: number | null
    date: string | null
    items: Array<{ name: string; price: number }> | null
    currency: string | null
  } = { merchant: null, amount: null, date: null, items: null, currency: null }

  try {
    const response = await groq.chat.completions.create({
      model: MODELS.VISION,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: `data:${mediaType};base64,${base64}` },
            },
            {
              type: 'text',
              text: `Extract receipt details and return ONLY valid JSON with these fields:
{
  "merchant": "store name or null if unreadable",
  "amount": total amount as number or null,
  "date": "YYYY-MM-DD format or null",
  "currency": "USD/GBP/etc or null",
  "items": [{"name": "item", "price": 0.00}] or null
}
Use null for any field you cannot read confidently. Do not guess amounts.`,
            },
          ],
        },
      ],
      max_tokens: 500,
      temperature: 0,
    })

    const content = response.choices[0]?.message?.content ?? ''
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      extracted = JSON.parse(jsonMatch[0])
    }
  } catch (err) {
    console.error('Vision extraction failed:', err)
  }

  // If we got nothing useful, tell the user
  if (!extracted.merchant && !extracted.amount) {
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

// Confirm and save endpoint
export async function PUT(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { merchant, amount, date, description } = await req.json()
  if (!merchant || !amount || !date) {
    return NextResponse.json({ error: 'merchant, amount, and date are required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('transactions')
    .insert({
      user_id: user.id,
      merchant,
      amount: Number(amount),
      date,
      description: description ?? null,
      source: 'receipt',
      category: 'Uncategorized',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ transaction: data })
}
