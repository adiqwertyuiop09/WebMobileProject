import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'

export default function Login() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [showPassword, setShowPassword] = useState(false) // Added state for toggle
  const navigate = useNavigate()

  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
    if (authError) setError(authError.message)
    else navigate('/')
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      
      {/* === LEFT / TOP SECTION (Dark Branded Area) === */}
      <div
        className="w-full lg:w-[420px] flex-shrink-0 flex flex-col justify-center p-8 lg:p-10"
        style={{ backgroundColor: '#2B1F17' }}
      >
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.15em] mb-3" style={{ color: '#A89080' }}>
            Property management
          </p>
          <h1 className="text-2xl lg:text-3xl font-bold leading-snug mb-4" style={{ color: '#F5EDE6' }}>
            Manage your apartment, simply.
          </h1>
          <p className="text-sm leading-relaxed" style={{ color: '#A89080' }}>
            One dashboard for units, tenants, payments, and maintenance.
          </p>
        </div>

        <p className="text-xs mt-10 hidden lg:block" style={{ color: '#5C4033' }}>
          Administrator access only
        </p>
      </div>

      {/* === RIGHT / BOTTOM SECTION (Light Form Area) === */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-8 bg-[#FAF7F5]">
        <div className="w-full max-w-sm">

          {/* Heading */}
          <div className="mb-7">
            <h2 className="text-xl font-bold mb-1" style={{ color: '#2B1F17' }}>
              Sign in
            </h2>
            <p className="text-sm" style={{ color: '#A89080' }}>
              Enter your credentials to continue
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-5 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleLogin} className="flex flex-col gap-4">

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#7A6258' }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="admin@email.com"
                style={{ borderColor: '#DDD0C8' }}
                className="w-full bg-white border rounded-lg px-3.5 py-2.5 text-sm text-stone-800 placeholder:text-stone-300 outline-none focus:border-[#2B1F17] transition-colors"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#7A6258' }}>
                Password
              </label>
              {/* Added relative wrapper to position the icon inside the input */}
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'} // <-- Toggles type dynamically
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  style={{ borderColor: '#DDD0C8' }}
                  // Added pr-10 so text doesn't overlap the eye icon
                  className="w-full bg-white border rounded-lg px-3.5 py-2.5 pr-10 text-sm text-stone-800 placeholder:text-stone-300 outline-none focus:border-[#2B1F17] transition-colors"
                />
                {/* The Toggle Button */}
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    // Eye Off Icon
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 1l16 16" /><path d="M9 5a4 4 0 014 4m-1.2 3.8A4 4 0 015.2 6.2" /><path d="M17 9s-3-6-8-6c-1.4 0-2.7.4-3.8 1M1 9s3 6 8 6c1.4 0 2.7-.4 3.8-1" />
                    </svg>
                  ) : (
                    // Eye Open Icon
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 9s3-6 8-6 8 6 8 6-3 6-8 6-8-6-8-6z" /><circle cx="9" cy="9" r="2.5" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{ backgroundColor: '#2B1F17' }}
              className="w-full mt-1 text-sm font-semibold py-2.5 rounded-lg text-[#F5EDE6] hover:opacity-90 active:opacity-100 active:scale-[0.99] transition-all disabled:opacity-40"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>

          </form>

          {/* Bottom divider line */}
          <div className="mt-8 pt-6 border-t" style={{ borderColor: '#E8DDD8' }}>
            <p className="text-xs text-center" style={{ color: '#C4B0A2' }}>
              Administrator access only
            </p>
          </div>

        </div>
      </div>
    </div>
  )
}