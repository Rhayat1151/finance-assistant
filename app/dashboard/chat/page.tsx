'use client'

import { useState, useRef, useEffect } from 'react'
import { Send } from 'lucide-react'

interface Message {
  role: 'user' | 'assistant'
  content: string
  intent?: string
}

const SUGGESTIONS = [
  { emoji: '💸', text: 'How much did I spend this month?' },
  { emoji: '🔄', text: 'What subscriptions do I have?' },
  { emoji: '📊', text: 'Summarize my finances' },
  { emoji: '✂️', text: 'Where can I cut back?' },
  { emoji: '🚨', text: 'Any unusual charges lately?' },
]

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMessage(text?: string) {
    const msg = (text ?? input).trim()
    if (!msg || loading) return

    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: msg }])
    setLoading(true)

    const history = messages.slice(-6)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, history }),
      })

      if (!res.ok) throw new Error('Request failed')
      const contentType = res.headers.get('content-type') ?? ''

      if (contentType.includes('application/json')) {
        const json = await res.json()
        setMessages(prev => [...prev, { role: 'assistant', content: json.reply, intent: json.intent }])
        setLoading(false)
        return
      }

      setMessages(prev => [...prev, { role: 'assistant', content: '' }])
      const reader = res.body!.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const lines = decoder.decode(value).split('\n').filter(l => l.startsWith('data: '))
        for (const line of lines) {
          const data = JSON.parse(line.slice(6))
          if (data.error) {
            setMessages(prev => { const u = [...prev]; u[u.length - 1].content = data.error; return u })
            break
          }
          if (data.text) {
            setMessages(prev => {
              const u = [...prev]
              u[u.length - 1] = { ...u[u.length - 1], content: u[u.length - 1].content + data.text }
              return u
            })
          }
          if (data.done) {
            setMessages(prev => { const u = [...prev]; u[u.length - 1] = { ...u[u.length - 1], intent: data.intent }; return u })
          }
        }
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Something went wrong. Please try again.' }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="h-full flex flex-col max-w-3xl mx-auto" style={{ height: 'calc(100vh - 100px)' }}>
      {/* Messages */}
      <div className="flex-1 overflow-y-auto py-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center pt-12">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl neu-card text-3xl mb-4">🤖</div>
            <h2 className="text-xl font-semibold" style={{ color: '#4a5568' }}>Ask about your finances</h2>
            <p className="text-sm mt-1 mb-8" style={{ color: '#8896a7' }}>
              I can answer questions, track budgets, detect subscriptions, and more.
            </p>
            <div className="flex flex-wrap gap-3 justify-center">
              {SUGGESTIONS.map(s => (
                <button
                  key={s.text}
                  onClick={() => sendMessage(s.text)}
                  className="neu-btn px-4 py-2 text-sm flex items-center gap-2"
                  style={{ color: '#6b7a8d' }}
                >
                  <span>{s.emoji}</span> {s.text}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'assistant' && (
              <div className="w-8 h-8 rounded-xl neu-flat flex items-center justify-center text-sm mr-2 mt-1 shrink-0">🤖</div>
            )}
            <div
              className="max-w-[78%] px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap"
              style={msg.role === 'user' ? {
                background: 'linear-gradient(145deg, #7aadd6, #5f8ec2)',
                borderRadius: '16px 16px 4px 16px',
                color: '#fff',
                boxShadow: '4px 4px 10px #a3b1c6, -2px -2px 6px #ffffff',
              } : {
                background: '#e0e5ec',
                borderRadius: '16px 16px 16px 4px',
                color: '#4a5568',
                boxShadow: '4px 4px 10px #a3b1c6, -4px -4px 10px #ffffff',
              }}
            >
              {msg.content || (loading && i === messages.length - 1 ? (
                <span className="flex gap-1 items-center py-0.5">
                  <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ backgroundColor: '#8896a7', animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ backgroundColor: '#8896a7', animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ backgroundColor: '#8896a7', animationDelay: '300ms' }} />
                </span>
              ) : '')}
              {msg.role === 'assistant' && msg.intent && msg.intent !== 'UNKNOWN' && msg.content && (
                <span className="block mt-2 text-xs" style={{ color: '#8896a7' }}>
                  {msg.intent.replace(/_/g, ' ').toLowerCase()}
                </span>
              )}
            </div>
          </div>
        ))}

        {loading && messages[messages.length - 1]?.role === 'user' && (
          <div className="flex justify-start items-center gap-2">
            <div className="w-8 h-8 rounded-xl neu-flat flex items-center justify-center text-sm shrink-0">🤖</div>
            <div className="neu-flat px-4 py-3">
              <span className="flex gap-1 items-center">
                <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ backgroundColor: '#8896a7', animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ backgroundColor: '#8896a7', animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ backgroundColor: '#8896a7', animationDelay: '300ms' }} />
              </span>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div className="py-4">
        <div className="neu-card px-4 py-3">
          <form onSubmit={e => { e.preventDefault(); sendMessage() }} className="flex gap-3 items-end">
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
              placeholder="Ask about your finances…"
              rows={1}
              className="neu-input flex-1 px-4 py-2.5 text-sm resize-none"
              style={{ color: '#4a5568' }}
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              className="neu-btn-accent p-2.5 rounded-xl"
            >
              <Send size={17} />
            </button>
          </form>
          <p className="text-xs mt-2" style={{ color: '#a3b1c6' }}>
            Try: "I get paid on the 1st" · "Set a $300 food budget" · "What is AMZN MKTP?"
          </p>
        </div>
      </div>
    </div>
  )
}
