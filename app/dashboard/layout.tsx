import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import LogoutButton from '@/components/LogoutButton'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="h-full flex flex-col" style={{ backgroundColor: '#e0e5ec' }}>
      {/* Neumorphic top nav */}
      <header className="px-6 py-4" style={{ backgroundColor: '#e0e5ec' }}>
        <div className="neu-card px-6 py-3 flex items-center justify-between">
          <nav className="flex items-center gap-2">
            <span className="font-bold text-base mr-4" style={{ color: '#4a5568' }}>💰 Finance</span>
            {[
              { href: '/dashboard', label: 'Overview' },
              { href: '/dashboard/chat', label: 'Chat' },
              { href: '/dashboard/upload', label: 'Import' },
            ].map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className="neu-btn px-4 py-1.5 text-sm font-medium"
                style={{ color: '#6b7a8d' }}
              >
                {label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-4">
            <div className="neu-inset px-3 py-1.5 text-xs" style={{ color: '#8896a7' }}>
              {user.email}
            </div>
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="flex-1 overflow-auto px-6 pb-6">{children}</main>
    </div>
  )
}
