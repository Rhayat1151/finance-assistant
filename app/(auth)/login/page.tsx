'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push('/dashboard')
      router.refresh()
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: '#e0e5ec' }}>
      <div className="w-full max-w-md">
        {/* Logo area */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4 neu-card">
            <span className="text-2xl">💰</span>
          </div>
          <h1 className="text-2xl font-bold" style={{ color: '#4a5568' }}>Finance Assistant</h1>
          <p className="mt-1 text-sm" style={{ color: '#8896a7' }}>Your AI-powered money companion</p>
        </div>

        {/* Card */}
        <div className="neu-card p-8">
          <h2 className="text-lg font-semibold mb-6" style={{ color: '#4a5568' }}>Welcome back</h2>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: '#6b7a8d' }}>Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="neu-input w-full px-4 py-3 text-sm"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: '#6b7a8d' }}>Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="neu-input w-full px-4 py-3 text-sm"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="neu-inset px-4 py-3">
                <p className="text-sm" style={{ color: '#e05252' }}>{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="neu-btn-accent w-full py-3 text-sm font-semibold"
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm" style={{ color: '#8896a7' }}>
            No account?{' '}
            <Link href="/signup" className="font-semibold" style={{ color: '#6c9bcf' }}>
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
