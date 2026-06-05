'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const router = useRouter()

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    const supabase = createClient()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/api/auth/callback` },
    })
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      setDone(true)
    }
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: '#e0e5ec' }}>
        <div className="neu-card p-10 text-center max-w-md w-full">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl neu-flat mb-4">
            <span className="text-2xl">📧</span>
          </div>
          <h2 className="text-xl font-bold" style={{ color: '#4a5568' }}>Check your email</h2>
          <p className="mt-2 text-sm" style={{ color: '#8896a7' }}>
            We sent a confirmation link to <span className="font-semibold" style={{ color: '#4a5568' }}>{email}</span>
          </p>
          <Link href="/login" className="mt-6 inline-block text-sm font-semibold" style={{ color: '#6c9bcf' }}>
            Back to sign in
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: '#e0e5ec' }}>
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4 neu-card">
            <span className="text-2xl">💰</span>
          </div>
          <h1 className="text-2xl font-bold" style={{ color: '#4a5568' }}>Finance Assistant</h1>
          <p className="mt-1 text-sm" style={{ color: '#8896a7' }}>Your AI-powered money companion</p>
        </div>

        <div className="neu-card p-8">
          <h2 className="text-lg font-semibold mb-6" style={{ color: '#4a5568' }}>Create account</h2>

          <form onSubmit={handleSignup} className="space-y-5">
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
                minLength={6}
                className="neu-input w-full px-4 py-3 text-sm"
                placeholder="Min. 6 characters"
              />
            </div>

            {error && (
              <div className="neu-inset px-4 py-3">
                <p className="text-sm" style={{ color: '#e05252' }}>{error}</p>
              </div>
            )}

            <button type="submit" disabled={loading} className="neu-btn-accent w-full py-3 text-sm font-semibold">
              {loading ? 'Creating account…' : 'Create account'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm" style={{ color: '#8896a7' }}>
            Already have an account?{' '}
            <Link href="/login" className="font-semibold" style={{ color: '#6c9bcf' }}>Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
