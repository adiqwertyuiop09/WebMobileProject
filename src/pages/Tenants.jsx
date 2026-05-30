import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { createClient } from '@supabase/supabase-js'

const AVATAR_COLORS = [
  'bg-amber-100 text-amber-800',
  'bg-emerald-100 text-emerald-800',
  'bg-blue-100 text-blue-800',
  'bg-purple-100 text-purple-800',
  'bg-rose-100 text-rose-800',
  'bg-teal-100 text-teal-800',
]

function getInitials(name) {
  if (!name) return '?'
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

function getAvatarColor(name) {
  if (!name) return AVATAR_COLORS[0]
  const index = name.charCodeAt(0) % AVATAR_COLORS.length
  return AVATAR_COLORS[index]
}

function formatDate(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })
}

function isLeaseExpiringSoon(leaseEnd) {
  if (!leaseEnd) return false
  const daysLeft = (new Date(leaseEnd) - new Date()) / (1000 * 60 * 60 * 24)
  return daysLeft <= 30 && daysLeft > 0
}

function isLeaseExpired(leaseEnd) {
  if (!leaseEnd) return false
  return new Date(leaseEnd) < new Date()
}

export default function Tenants() {
  const [tenants, setTenants]     = useState([])
  const [units, setUnits]         = useState([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [showModal, setShowModal] = useState(false)
  const [showView, setShowView]   = useState(false)
  const [viewing, setViewing]     = useState(null)
  const [editing, setEditing]     = useState(null)
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')
  const [form, setForm]           = useState({
    full_name: '', email: '', phone: '',
    unit_id: '', lease_start: '', lease_end: '',
    password: 'Tenant@1234'
  })

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const [{ data: tenantsData }, { data: unitsData }] = await Promise.all([
      supabase
        .from('tenants')
        .select(`
          *,
          users ( id, full_name, email, phone, status ),
          units ( id, unit_number, type, rent_amount )
        `)
        .order('created_at', { ascending: false }),
      supabase
        .from('units')
        .select('*')
        .eq('status', 'vacant')
        .order('unit_number', { ascending: true })
    ])
    if (tenantsData) setTenants(tenantsData)
    if (unitsData) setUnits(unitsData)
    setLoading(false)
  }

  const filtered = tenants.filter(t => {
    const name  = t.users?.full_name?.toLowerCase() || ''
    const email = t.users?.email?.toLowerCase() || ''
    const unit  = t.units?.unit_number || ''
    const q     = search.toLowerCase()
    return name.includes(q) || email.includes(q) || unit.includes(q)
  })

  function openAdd() {
    setEditing(null)
    setForm({ full_name: '', email: '', phone: '', unit_id: '', lease_start: '', lease_end: '', password: 'Tenant@1234' })
    setError('')
    setShowModal(true)
  }

  function openEdit(tenant) {
    setEditing(tenant)
    setForm({
      full_name:   tenant.users?.full_name || '',
      email:       tenant.users?.email || '',
      phone:       tenant.users?.phone || '',
      unit_id:     tenant.unit_id || '',
      lease_start: tenant.lease_start || '',
      lease_end:   tenant.lease_end || '',
      password:    ''
    })
    setError('')
    setShowModal(true)
  }

  function openView(tenant) {
    setViewing(tenant)
    setShowView(true)
  }

  async function handleSave() {
    setError('')
    if (!form.full_name.trim()) return setError('Full name is required.')
    if (!form.email.trim())     return setError('Email is required.')
    if (!form.unit_id)          return setError('Please assign a unit.')
    if (!form.lease_start)      return setError('Lease start date is required.')
    if (!form.lease_end)        return setError('Lease end date is required.')
    if (!editing && !form.password) return setError('Password is required.')

    setSaving(true)

    if (editing) {
      // Update user profile
      const { error: userErr } = await supabase
        .from('users')
        .update({ full_name: form.full_name.trim(), phone: form.phone.trim() })
        .eq('id', editing.user_id)
      if (userErr) { setError(userErr.message); setSaving(false); return }

      // Update tenant record
      const { error: tenantErr } = await supabase
        .from('tenants')
        .update({ unit_id: form.unit_id, lease_start: form.lease_start, lease_end: form.lease_end })
        .eq('id', editing.id)
      if (tenantErr) { setError(tenantErr.message); setSaving(false); return }

      // Update unit statuses
      if (editing.unit_id !== form.unit_id) {
        // Free old unit
        if (editing.unit_id) {
          await supabase.from('units').update({ status: 'vacant' }).eq('id', editing.unit_id)
        }
        // Occupy new unit
        await supabase.from('units').update({ status: 'occupied' }).eq('id', form.unit_id)
      }

    } else {
      // Create new auth user via Supabase Admin API
      const { data: authData, error: authErr } = await supabase.auth.signUp({
        email:    form.email.trim(),
        password: form.password,
        options:  { data: { full_name: form.full_name.trim(), role: 'tenant' } }
      })
      if (authErr) { setError(authErr.message); setSaving(false); return }

      // Update phone (trigger creates the user row automatically)
      if (form.phone) {
        await supabase
          .from('users')
          .update({ phone: form.phone.trim() })
          .eq('id', authData.user.id)
      }

      // Create tenant record
      const { error: tenantErr } = await supabase
        .from('tenants')
        .insert({ user_id: authData.user.id, unit_id: form.unit_id, lease_start: form.lease_start, lease_end: form.lease_end })
      if (tenantErr) { setError(tenantErr.message); setSaving(false); return }

      // Mark unit as occupied
      await supabase.from('units').update({ status: 'occupied' }).eq('id', form.unit_id)
    }

    setShowModal(false)
    fetchAll()
    setSaving(false)
  }

  async function handleDeactivate(tenant) {
    if (!window.confirm(`Deactivate ${tenant.users?.full_name}'s account?`)) return

    await supabase.from('users').update({ status: 'inactive' }).eq('id', tenant.user_id)
    await supabase.from('tenants').update({ status: 'inactive' }).eq('id', tenant.id)
    await supabase.from('units').update({ status: 'vacant' }).eq('id', tenant.unit_id)

    //disable Supabase Auth account using admin client
    const supabaseAdmin = createClient(
        import.meta.env.VITE_SUPABASE_URL,
        import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY
    )

    await supabaseAdmin.auth.admin.updateUserById(tenant.user_id, {
        ban_duration: 'none' // Sets account to banned permanently
    })

    fetchAll()
}

  async function handleReactivate(tenant) {
    if (!window.confirm(`Reactivate ${tenant.users?.full_name}'s account?`)) return

    // Update database records
    await supabase.from('users').update({ status: 'active' }).eq('id', tenant.user_id)
    await supabase.from('tenants').update({ status: 'active' }).eq('id', tenant.id)
    await supabase.from('units').update({ status: 'occupied' }).eq('id', tenant.unit_id)

    // Unban the Supabase Auth account
    const supabaseAdmin = createClient(
        import.meta.env.VITE_SUPABASE_URL,
        import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY
    )

    await supabaseAdmin.auth.admin.updateUserById(tenant.user_id, {
        ban_duration: '0'   // '0' removes the ban completely
    })

    fetchAll()
}

  const activeTenants   = tenants.filter(t => t.status === 'active').length
  const inactiveTenants = tenants.filter(t => t.status === 'inactive').length

  // For edit modal — include current tenant's unit in dropdown
  const unitOptions = editing
    ? [...units, ...(editing.units ? [editing.units] : [])].filter((u, i, arr) => arr.findIndex(x => x.id === u.id) === i)
    : units

  return (
    <div className="flex flex-col gap-5">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-amber-950 tracking-tight">Tenants</h1>
          <p className="text-xs font-medium text-stone-400 mt-0.5">{activeTenants} active · {inactiveTenants} inactive</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center justify-center gap-2 bg-amber-900 hover:bg-amber-950 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors w-full sm:w-auto shadow-sm"
        >
          <span className="text-base leading-none">+</span> Add tenant
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total tenants',  value: tenants.length,   color: 'text-amber-950',   bg: 'bg-white',         border: 'border-stone-200' },
          { label: 'Active',         value: activeTenants,    color: 'text-emerald-700', bg: 'bg-emerald-50/60', border: 'border-emerald-100' },
          { label: 'Inactive',       value: inactiveTenants,  color: 'text-stone-400',   bg: 'bg-stone-50',      border: 'border-stone-200' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} ${s.border} border rounded-xl p-4`}>
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs font-medium text-stone-500 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-sm">⌕</span>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, email or unit..."
          className="w-full bg-white border border-stone-200 rounded-xl pl-8 pr-4 py-2.5 text-sm text-stone-700 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-900/10 focus:border-amber-900 transition-colors"
        />
      </div>

      {/* Tenants list */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-stone-400 text-sm">Loading tenants...</div>
      ) : filtered.length === 0 ? (
        <div className="flex items-center justify-center py-20 text-stone-400 text-sm">
          {search ? 'No tenants match your search.' : 'No tenants yet. Add your first tenant!'}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map(tenant => {
            const name      = tenant.users?.full_name || 'Unknown'
            const email     = tenant.users?.email || ''
            const phone     = tenant.users?.phone || '—'
            const unit      = tenant.units?.unit_number
            const isActive  = tenant.status === 'active'
            const expiring  = isLeaseExpiringSoon(tenant.lease_end)
            const expired   = isLeaseExpired(tenant.lease_end)

            return (
              <div
                key={tenant.id}
                className={`bg-white border rounded-xl p-4 transition-all hover:shadow-sm ${
                  isActive ? 'border-stone-200 hover:border-stone-300' : 'border-stone-100 opacity-60'
                }`}
              >
                <div className="flex items-start gap-4">
                  {/* Avatar */}
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0 ${getAvatarColor(name)}`}>
                    {getInitials(name)}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                      <span className="text-sm font-bold text-amber-950 truncate">{name}</span>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {unit && (
                          <span className="text-[11px] font-semibold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                            Unit {unit}
                          </span>
                        )}
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                          isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-stone-100 text-stone-500'
                        }`}>
                          {isActive ? 'Active' : 'Inactive'}
                        </span>
                        {expiring && (
                          <span className="text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">
                            Lease expiring soon
                          </span>
                        )}
                        {expired && isActive && (
                          <span className="text-[11px] font-semibold bg-red-50 text-red-600 border border-red-200 px-2 py-0.5 rounded-full">
                            Lease expired
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="mt-1.5 flex flex-col sm:flex-row gap-1 sm:gap-4">
                      <span className="text-xs text-stone-400 truncate">{email}</span>
                      <span className="text-xs text-stone-400">{phone}</span>
                    </div>

                    <div className="mt-1.5 flex gap-4">
                      <div className="text-xs text-stone-400">
                        <span className="font-medium text-stone-500">Lease: </span>
                        {formatDate(tenant.lease_start)} — {formatDate(tenant.lease_end)}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col sm:flex-row gap-2 flex-shrink-0">
                    <button
                      onClick={() => openView(tenant)}
                      className="text-xs font-medium px-3 py-1.5 border border-stone-200 rounded-lg text-stone-600 hover:bg-stone-50 transition-colors"
                    >
                      View
                    </button>
                    <button
                      onClick={() => openEdit(tenant)}
                      className="text-xs font-medium px-3 py-1.5 border border-amber-200 rounded-lg text-amber-800 hover:bg-amber-50 transition-colors"
                    >
                      Edit
                    </button>
                    {isActive ? (
                      <button
                        onClick={() => handleDeactivate(tenant)}
                        className="text-xs font-medium px-3 py-1.5 border border-red-100 rounded-lg text-red-600 hover:bg-red-50 transition-colors"
                      >
                        Deactivate
                      </button>
                    ) : (
                      <button
                        onClick={() => handleReactivate(tenant)}
                        className="text-xs font-medium px-3 py-1.5 border border-emerald-100 rounded-lg text-emerald-700 hover:bg-emerald-50 transition-colors"
                      >
                        Reactivate
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* View Modal */}
      {showView && viewing && (
        <div
          className="fixed inset-0 bg-amber-950/20 backdrop-blur-xs flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
          onClick={e => { if (e.target === e.currentTarget) setShowView(false) }}
        >
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl border border-stone-100 w-full sm:max-w-md p-6">
            <div className="w-10 h-1 bg-stone-200 rounded-full mx-auto mb-5 sm:hidden"></div>

            <div className="flex items-center gap-4 mb-5">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-lg font-bold ${getAvatarColor(viewing.users?.full_name)}`}>
                {getInitials(viewing.users?.full_name)}
              </div>
              <div>
                <div className="text-base font-bold text-amber-950">{viewing.users?.full_name}</div>
                <div className="text-xs text-stone-400 mt-0.5">{viewing.users?.email}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Phone',       value: viewing.users?.phone || '—' },
                { label: 'Unit',        value: viewing.units ? `Unit ${viewing.units.unit_number}` : '—' },
                { label: 'Unit type',   value: viewing.units?.type || '—' },
                { label: 'Rent',        value: viewing.units ? `₱${Number(viewing.units.rent_amount).toLocaleString()}/mo` : '—' },
                { label: 'Lease start', value: formatDate(viewing.lease_start) },
                { label: 'Lease end',   value: formatDate(viewing.lease_end) },
                { label: 'Status',      value: viewing.status },
                { label: 'Since',       value: formatDate(viewing.created_at) },
              ].map(item => (
                <div key={item.label} className="bg-stone-50 rounded-xl p-3">
                  <div className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider mb-0.5">{item.label}</div>
                  <div className="text-sm font-semibold text-stone-700 capitalize">{item.value}</div>
                </div>
              ))}
            </div>

            <button
              onClick={() => setShowView(false)}
              className="w-full mt-5 text-sm font-semibold py-2.5 border border-stone-200 rounded-xl text-stone-600 hover:bg-stone-50 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Add / Edit Modal */}
      {showModal && (
        <div
          className="fixed inset-0 bg-amber-950/20 backdrop-blur-xs flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
          onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}
        >
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl border border-stone-100 w-full sm:max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <div className="w-10 h-1 bg-stone-200 rounded-full mx-auto mb-5 sm:hidden"></div>

            <h2 className="text-base font-bold text-amber-950 mb-1">
              {editing ? `Edit — ${editing.users?.full_name}` : 'Add new tenant'}
            </h2>
            <p className="text-xs text-stone-400 mb-5">
              {editing ? 'Update tenant details and lease information.' : 'Create a new tenant account and assign a unit.'}
            </p>

            {error && (
              <div className="mb-4 text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl p-3">{error}</div>
            )}

            <div className="flex flex-col gap-4">

              {/* Personal info section */}
              <div>
                <div className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-2">Personal info</div>
                <div className="flex flex-col gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-stone-500 mb-1">Full name</label>
                    <input
                      type="text"
                      value={form.full_name}
                      onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                      placeholder="e.g. Juan dela Cruz"
                      className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-900/10 focus:border-amber-900 text-stone-800"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-stone-500 mb-1">
                      Email {editing && <span className="text-stone-400 font-normal">(cannot be changed)</span>}
                    </label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                      placeholder="tenant@apartment.com"
                      disabled={!!editing}
                      className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-900/10 focus:border-amber-900 text-stone-800 disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-stone-500 mb-1">Phone number</label>
                    <input
                      type="text"
                      value={form.phone}
                      onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                      placeholder="09XXXXXXXXX"
                      className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-900/10 focus:border-amber-900 text-stone-800"
                    />
                  </div>
                </div>
              </div>

              {/* Account section — only for new tenants */}
              {!editing && (
                <div>
                  <div className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-2">Account credentials</div>
                  <div>
                    <label className="block text-xs font-semibold text-stone-500 mb-1">Password</label>
                    <input
                      type="text"
                      value={form.password}
                      onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                      placeholder="Password for mobile app"
                      className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-900/10 focus:border-amber-900 text-stone-800"
                    />
                    <p className="text-[11px] text-stone-400 mt-1">Give this password to the tenant for their mobile app login.</p>
                  </div>
                </div>
              )}

              {/* Unit & Lease section */}
              <div>
                <div className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-2">Unit & lease</div>
                <div className="flex flex-col gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-stone-500 mb-1">Assign unit</label>
                    <select
                      value={form.unit_id}
                      onChange={e => setForm(f => ({ ...f, unit_id: e.target.value }))}
                      className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-900/10 focus:border-amber-900 text-stone-800"
                    >
                      <option value="">Select a unit...</option>
                      {unitOptions.map(unit => (
                        <option key={unit.id} value={unit.id}>
                          Unit {unit.unit_number} — {unit.type} (₱{Number(unit.rent_amount).toLocaleString()}/mo)
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-stone-500 mb-1">Lease start</label>
                      <input
                        type="date"
                        value={form.lease_start}
                        onChange={e => setForm(f => ({ ...f, lease_start: e.target.value }))}
                        className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-900/10 focus:border-amber-900 text-stone-800"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-stone-500 mb-1">Lease end</label>
                      <input
                        type="date"
                        value={form.lease_end}
                        onChange={e => setForm(f => ({ ...f, lease_end: e.target.value }))}
                        className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-900/10 focus:border-amber-900 text-stone-800"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 text-sm font-semibold py-2.5 border border-stone-200 rounded-xl text-stone-600 hover:bg-stone-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 text-sm font-semibold py-2.5 bg-amber-900 hover:bg-amber-950 text-white rounded-xl transition-colors disabled:opacity-50 shadow-sm"
              >
                {saving ? 'Saving...' : editing ? 'Save changes' : 'Create tenant'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}