import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import LogoutButton from '@/components/LogoutButton'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="h-full flex flex-col">
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <nav className="flex items-center gap-6">
          <span className="font-bold text-gray-900 text-lg">Finance Assistant</span>
          <Link href="/dashboard" className="text-sm text-gray-600 hover:text-gray-900">Overview</Link>
          <Link href="/dashboard/chat" className="text-sm text-gray-600 hover:text-gray-900">Chat</Link>
          <Link href="/dashboard/upload" className="text-sm text-gray-600 hover:text-gray-900">Import</Link>
        </nav>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">{user.email}</span>
          <LogoutButton />
        </div>
      </header>
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}
