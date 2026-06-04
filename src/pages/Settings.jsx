import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

function Section({ title, description, children }) {
  return (
    <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-stone-100">
        <h3 className="text-sm font-bold text-amber-950">{title}</h3>
        {description && <p className="text-xs text-stone-400 mt-0.5">{description}</p>}
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold text-stone-500 uppercase tracking-wider">{label}</label>
      {children}
    </div>
  )
}

// Added className prop and browser icon hiding variants
function Input({ value, onChange, type = 'text', placeholder, disabled, className = '' }) {
  return (
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      disabled={disabled}
      className={`w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2.5 text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-900/10 focus:border-amber-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed [&::-ms-reveal]:hidden [&::-ms-clear]:hidden ${className}`}
    />
  )
}

function SaveButton({ loading, label = 'Save changes', onClick }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="bg-amber-900 hover:bg-amber-950 active:bg-stone-900 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors disabled:opacity-50 shadow-sm"
    >
      {loading ? 'Saving...' : label}
    </button>
  )
}

function Toast({ message, type }) {
  if (!message) return null
  return (
    <div className={`fixed bottom-5 right-5 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg border text-sm font-semibold transition-all ${
      type === 'success'
        ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
        : 'bg-red-50 border-red-200 text-red-700'
    }`}>
      <span>{type === 'success' ? '✓' : '✕'}</span>
      {message}
    </div>
  )
}

export default function Settings() {
  const [user, setUser]           = useState(null)
  const [loading, setLoading]     = useState(true)
  const [toast, setToast]         = useState({ message: '', type: 'success' })

  // Profile form
  const [profile, setProfile] = useState({ full_name: '', email: '', phone: '' })
  const [savingProfile, setSavingProfile] = useState(false)

  // Password form
  const [passwords, setPasswords] = useState({ current: '', newPass: '', confirm: '' })
  const [savingPassword, setSavingPassword] = useState(false)
  const [showPasswords, setShowPasswords]   = useState({ current: false, newPass: false, confirm: false })

  useEffect(() => { fetchProfile() }, [])

  function showToast(message, type = 'success') {
    setToast({ message, type })
    setTimeout(() => setToast({ message: '', type: 'success' }), 3000)
  }

  async function fetchProfile() {
    setLoading(true)
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser) { setLoading(false); return }
    setUser(authUser)
    const { data } = await supabase.from('users').select('*').eq('id', authUser.id).single()
    if (data) {
      setProfile({ full_name: data.full_name || '', email: data.email || '', phone: data.phone || '' })
    }
    setLoading(false)
  }

  async function handleSaveProfile() {
    if (!profile.full_name.trim()) return showToast('Full name is required.', 'error')
    setSavingProfile(true)
    const { error } = await supabase
      .from('users')
      .update({ full_name: profile.full_name.trim(), phone: profile.phone.trim() })
      .eq('id', user.id)
    if (error) showToast(error.message, 'error')
    else showToast('Profile updated successfully.')
    setSavingProfile(false)
  }

  async function handleChangePassword() {
    if (!passwords.newPass) return showToast('New password is required.', 'error')
    if (passwords.newPass.length < 6) return showToast('Password must be at least 6 characters.', 'error')
    if (passwords.newPass !== passwords.confirm) return showToast('Passwords do not match.', 'error')
    setSavingPassword(true)
    const { error } = await supabase.auth.updateUser({ password: passwords.newPass })
    if (error) showToast(error.message, 'error')
    else {
      showToast('Password changed successfully.')
      setPasswords({ current: '', newPass: '', confirm: '' })
    }
    setSavingPassword(false)
  }

  async function handleSignOut() {
    if (!window.confirm('Sign out of ApartaAdmin?')) return
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-amber-900/20 border-t-amber-900 rounded-full animate-spin"></div>
          <p className="text-xs text-stone-400">Loading settings...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5 max-w-2xl">

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-amber-950 tracking-tight">Settings</h1>
        <p className="text-xs font-medium text-stone-400 mt-0.5">Manage your account and password</p>
      </div>

      {/* ── PROFILE CARD ── */}
      <div className="bg-white border border-stone-200 rounded-2xl p-5">
        <div className="text-base font-bold text-amber-950">{profile.full_name || 'Admin'}</div>
        <div className="text-xs text-stone-400 mt-0.5">{profile.email}</div>
        <span className="inline-block mt-1.5 text-[11px] font-semibold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
          Administrator
        </span>
      </div>

      {/* ── PROFILE SETTINGS ── */}
      <Section title="Profile" description="Update your name and contact information.">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
          <Field label="Full name">
            <Input
              value={profile.full_name}
              onChange={e => setProfile(p => ({ ...p, full_name: e.target.value }))}
              placeholder="Your full name"
            />
          </Field>
          <Field label="Email address">
            <Input
              value={profile.email}
              disabled
              placeholder="admin@email.com"
            />
            <p className="text-[11px] text-stone-400">Email cannot be changed here.</p>
          </Field>
          <Field label="Phone number">
            <Input
              value={profile.phone}
              onChange={e => setProfile(p => ({ ...p, phone: e.target.value }))}
              placeholder="09XXXXXXXXX"
            />
          </Field>
          <Field label="Role">
            <Input value="Administrator" disabled />
          </Field>
        </div>
        <SaveButton loading={savingProfile} onClick={handleSaveProfile} />
      </Section>

      {/* ── CHANGE PASSWORD ── */}
      <Section title="Change password" description="Use a strong password of at least 6 characters.">
        <div className="flex flex-col gap-4 mb-5">
          <Field label="New password">
            <div className="relative">
              <Input
                type={showPasswords.newPass ? 'text' : 'password'}
                value={passwords.newPass}
                onChange={e => setPasswords(p => ({ ...p, newPass: e.target.value }))}
                placeholder="Enter new password"
                className="pr-14" /* Added right padding to prevent text overlap */
              />
              <button
                type="button"
                onClick={() => setShowPasswords(s => ({ ...s, newPass: !s.newPass }))}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 transition-colors text-xs font-semibold"
              >
                {showPasswords.newPass ? 'Hide' : 'Show'}
              </button>
            </div>
          </Field>
          <Field label="Confirm new password">
            <div className="relative">
              <Input
                type={showPasswords.confirm ? 'text' : 'password'}
                value={passwords.confirm}
                onChange={e => setPasswords(p => ({ ...p, confirm: e.target.value }))}
                placeholder="Repeat new password"
                className="pr-14" /* Added right padding to prevent text overlap */
              />
              <button
                type="button"
                onClick={() => setShowPasswords(s => ({ ...s, confirm: !s.confirm }))}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 transition-colors text-xs font-semibold"
              >
                {showPasswords.confirm ? 'Hide' : 'Show'}
              </button>
            </div>
            {passwords.confirm && passwords.newPass !== passwords.confirm && (
              <p className="text-[11px] text-red-500 mt-0.5">Passwords do not match.</p>
            )}
            {passwords.confirm && passwords.newPass === passwords.confirm && passwords.newPass && (
              <p className="text-[11px] text-emerald-600 mt-0.5">✓ Passwords match.</p>
            )}
          </Field>
        </div>
        <SaveButton loading={savingPassword} label="Change password" onClick={handleChangePassword} />
      </Section>

      {/* ── DANGER ZONE ── */}
      <div className="bg-white border border-red-100 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-red-100">
          <h3 className="text-sm font-bold text-red-700">Danger zone</h3>
          <p className="text-xs text-stone-400 mt-0.5">Actions that cannot be undone.</p>
        </div>
        <div className="p-5">
          <div className="flex items-center justify-between gap-4 p-4 bg-red-50/50 border border-red-100 rounded-xl">
            <div>
              <div className="text-sm font-semibold text-stone-700">Sign out</div>
              <div className="text-xs text-stone-400 mt-0.5">You will be redirected to the login page.</div>
            </div>
            <button
              onClick={handleSignOut}
              className="flex-shrink-0 text-sm font-semibold px-4 py-2 bg-white hover:bg-red-50 text-red-600 border border-red-200 rounded-xl transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>

      {/* Toast */}
      <Toast message={toast.message} type={toast.type} />
    </div>
  )
}