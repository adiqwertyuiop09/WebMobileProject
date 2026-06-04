import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

import Login         from './pages/Login'
import Dashboard     from './pages/Dashboard'
import Units         from './pages/Units'
import Tenants       from './pages/Tenants'
import Payments      from './pages/Payments'
import Maintenance   from './pages/Maintenance'
import Announcements from './pages/Announcements'
import Reports       from './pages/Reports'
import Settings      from './pages/Settings'
import Sidebar       from './components/Sidebar'

function AdminLayout({ children }) {
  return (
    <div className="flex h-screen bg-amber-50/60 overflow-hidden">
      <Sidebar />
      {/* Main content — adds top padding on mobile for the fixed topbar */}
      <main className="flex-1 overflow-y-auto pt-14 lg:pt-0">
        <div className="p-4 sm:p-5 lg:p-6 max-w-screen-xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  )
}

// specifically checks if the logged-in user is an admin
function AdminRoute({ session, children }) {
  const [isAuthorized, setIsAuthorized] = useState(null) // null = checking, true = admin, false = tenant/other

  useEffect(() => {
    if (session?.user) {
      checkAdminRole()
    }
  }, [session])

  async function checkAdminRole() {
    const { data, error } = await supabase
      .from('users')
      .select('role')
      .eq('id', session.user.id)
      .single()

    if (data?.role === 'admin') {
      setIsAuthorized(true)
    } else {
      // If they are a tenant or have no role, kick them out!
      setIsAuthorized(false)
      await supabase.auth.signOut() // Force logout the tenant session
    }
  }

  // 1. If no session, go to login
  if (!session) return <Navigate to="/login" replace />

  // 2. Show a loading state while we check the database for their role
  if (isAuthorized === null) {
    return (
      <div className="flex items-center justify-center h-screen bg-amber-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-amber-900/20 border-t-amber-900 rounded-full animate-spin"></div>
          <p className="text-sm text-amber-700/50">Verifying access...</p>
        </div>
      </div>
    )
  }

  // 3. If they are not an admin, redirect to login
  if (isAuthorized === false) {
    return <Navigate to="/login" replace />
  }

  // 4. If they are an admin, show the dashboard layout
  return <AdminLayout>{children}</AdminLayout>
}

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
    return () => subscription.unsubscribe()
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center h-screen bg-amber-50">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 bg-amber-800 rounded-xl flex items-center justify-center">
          <span className="text-amber-100 font-bold">A</span>
        </div>
        <p className="text-sm text-amber-700/50">Loading...</p>
      </div>
    </div>
  )

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        {/* Changed ProtectedRoute to AdminRoute for all admin pages */}
        <Route path="/"              element={<AdminRoute session={session}><Dashboard /></AdminRoute>} />
        <Route path="/units"         element={<AdminRoute session={session}><Units /></AdminRoute>} />
        <Route path="/tenants"       element={<AdminRoute session={session}><Tenants /></AdminRoute>} />
        <Route path="/payments"      element={<AdminRoute session={session}><Payments /></AdminRoute>} />
        <Route path="/maintenance"   element={<AdminRoute session={session}><Maintenance /></AdminRoute>} />
        <Route path="/announcements" element={<AdminRoute session={session}><Announcements /></AdminRoute>} />
        <Route path="/reports"       element={<AdminRoute session={session}><Reports /></AdminRoute>} />
        <Route path="/settings"      element={<AdminRoute session={session}><Settings /></AdminRoute>} />
        <Route path="*"              element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}