import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'

function formatPeso(amount) {
  return `₱${Number(amount || 0).toLocaleString()}`
}

function formatDate(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
}

function timeAgo(dateStr) {
  if (!dateStr) return ''
  const diff  = Date.now() - new Date(dateStr).getTime()
  const mins  = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days  = Math.floor(diff / 86400000)
  if (mins < 1)   return 'Just now'
  if (mins < 60)  return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days === 1) return 'Yesterday'
  return `${days}d ago`
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

const STATUS_UNIT = {
  occupied:    { dot: 'bg-emerald-500', badge: 'bg-emerald-100 text-emerald-700' },
  vacant:      { dot: 'bg-amber-400',   badge: 'bg-amber-100 text-amber-700' },
  maintenance: { dot: 'bg-red-500',     badge: 'bg-red-100 text-red-600' },
}

const STATUS_PAYMENT = {
  paid:    { dot: 'bg-emerald-500', text: 'text-emerald-700', badge: 'bg-emerald-100 text-emerald-700' },
  pending: { dot: 'bg-amber-400',   text: 'text-amber-700',   badge: 'bg-amber-100 text-amber-700' },
  overdue: { dot: 'bg-red-500',     text: 'text-red-600',     badge: 'bg-red-100 text-red-600' },
}

const STATUS_MAINT = {
  pending:     { dot: 'bg-amber-400', badge: 'bg-amber-100 text-amber-700',     label: 'Pending' },
  in_progress: { dot: 'bg-blue-500',  badge: 'bg-blue-100 text-blue-700',       label: 'In progress' },
  resolved:    { dot: 'bg-emerald-500', badge: 'bg-emerald-100 text-emerald-700', label: 'Resolved' },
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [loading, setLoading]         = useState(true)
  const [adminName, setAdminName]     = useState('Admin')
  const [units, setUnits]             = useState([])
  const [tenants, setTenants]         = useState([])
  const [payments, setPayments]       = useState([])
  const [maintenance, setMaintenance] = useState([])
  const [announcements, setAnnouncements] = useState([])

  useEffect(() => {
    fetchAll()
  }, [])

  async function fetchAll() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: profile } = await supabase
        .from('users')
        .select('full_name')
        .eq('id', user.id)
        .single()
      if (profile?.full_name) setAdminName(profile.full_name)
    }

    const [
      { data: unitsData },
      { data: tenantsData },
      { data: paymentsData },
      { data: maintData },
      { data: annData },
    ] = await Promise.all([
      supabase.from('units').select('*').order('unit_number', { ascending: true }),
      supabase.from('tenants').select('*, users(full_name, email), units(unit_number, rent_amount)').eq('status', 'active'),
      supabase.from('payments').select('*, tenants(users(full_name), units(unit_number))').order('created_at', { ascending: false }).limit(5),
      supabase.from('maintenance_requests').select('*, tenants(users(full_name), units(unit_number))').order('created_at', { ascending: false }).limit(5),
      supabase.from('announcements').select('*').order('created_at', { ascending: false }).limit(3),
    ])

    if (unitsData)   setUnits(unitsData)
    if (tenantsData) setTenants(tenantsData)
    if (paymentsData) setPayments(paymentsData)
    if (maintData)   setMaintenance(maintData)
    if (annData)     setAnnouncements(annData)
    setLoading(false)
  }

  // ── Computed stats ────────────────────────────────────────
  const totalUnits    = units.length
  const occupiedUnits = units.filter(u => u.status === 'occupied').length
  const vacantUnits   = units.filter(u => u.status === 'vacant').length
  const occupancyRate = totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 100) : 0

  const activeTenants = tenants.length
  const expiringLeases = tenants.filter(t => {
    if (!t.lease_end) return false
    const days = (new Date(t.lease_end) - new Date()) / 86400000
    return days >= 0 && days <= 30
  }).length

  // All payments for stats (need separate fetch — use from payments limited fetch as proxy)
  const pendingPayments = payments.filter(p => p.status === 'pending').length
  const overduePayments = payments.filter(p => p.status === 'overdue').length
  const pendingMaint    = maintenance.filter(m => m.status === 'pending').length
  const inProgressMaint = maintenance.filter(m => m.status === 'in_progress').length

  const today = new Date().toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-amber-900/20 border-t-amber-900 rounded-full animate-spin"></div>
          <p className="text-xs text-stone-400">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">

      {/* ── HEADER ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-amber-950 tracking-tight">
            {getGreeting()}, {adminName.split(' ')[0]} 
          </h1>
          <p className="text-xs text-stone-400 mt-0.5">{today}</p>
        </div>
        <button
          onClick={() => navigate('/announcements')}
          className="flex items-center justify-center gap-2 bg-amber-900 hover:bg-amber-950 text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition-colors shadow-sm w-full sm:w-auto"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M2 8.5V6a4 4 0 018 0v2.5"/><path d="M1 9h14v.5a2 2 0 01-2 2H3a2 2 0 01-2-2V9z"/>
          </svg>
          Post announcement
        </button>
      </div>

      {/* ── ALERT STRIP ── */}
      {(overduePayments > 0 || expiringLeases > 0 || pendingMaint > 0) && (
        <div className="flex flex-col sm:flex-row gap-2">
          {overduePayments > 0 && (
            <button onClick={() => navigate('/payments')}
              className="flex-1 flex items-center gap-2.5 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 hover:bg-red-100 transition-colors text-left">
              <span className="w-6 h-6 bg-red-100 rounded-lg flex items-center justify-center text-red-600 text-xs flex-shrink-0">!</span>
              <div>
                <div className="text-xs font-bold text-red-700">{overduePayments} overdue payment{overduePayments > 1 ? 's' : ''}</div>
                <div className="text-[11px] text-red-500">Tap to view</div>
              </div>
            </button>
          )}
          {expiringLeases > 0 && (
            <button onClick={() => navigate('/tenants')}
              className="flex-1 flex items-center gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 hover:bg-amber-100 transition-colors text-left">
              <span className="w-6 h-6 bg-amber-100 rounded-lg flex items-center justify-center text-amber-700 text-xs flex-shrink-0">⚠</span>
              <div>
                <div className="text-xs font-bold text-amber-800">{expiringLeases} lease{expiringLeases > 1 ? 's' : ''} expiring soon</div>
                <div className="text-[11px] text-amber-600">Within 30 days</div>
              </div>
            </button>
          )}
          {pendingMaint > 0 && (
            <button onClick={() => navigate('/maintenance')}
              className="flex-1 flex items-center gap-2.5 bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5 hover:bg-blue-100 transition-colors text-left">
              <span className="w-6 h-6 bg-blue-100 rounded-lg flex items-center justify-center text-blue-700 text-xs flex-shrink-0">🔧</span>
              <div>
                <div className="text-xs font-bold text-blue-800">{pendingMaint} maintenance request{pendingMaint > 1 ? 's' : ''}</div>
                <div className="text-[11px] text-blue-600">Waiting for action</div>
              </div>
            </button>
          )}
        </div>
      )}

      {/* ── KPI CARDS ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {
            label: 'Units occupied', value: `${occupiedUnits}/${totalUnits}`,
            sub: `${occupancyRate}% occupancy`, color: 'text-amber-950',
            bg: 'bg-white', border: 'border-stone-200',
            icon: (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <path d="M2 14V7l6-5 6 5v7"/><path d="M6 14v-4h4v4"/>
              </svg>
            ),
            route: '/units'
          },
          {
            label: 'Active tenants', value: activeTenants,
            sub: `${vacantUnits} unit${vacantUnits !== 1 ? 's' : ''} available`, color: 'text-emerald-700',
            bg: 'bg-emerald-50/50', border: 'border-emerald-100',
            icon: (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <circle cx="8" cy="5" r="3"/><path d="M2 14c0-3 2.7-5 6-5s6 2 6 5"/>
              </svg>
            ),
            route: '/tenants'
          },
          {
            label: 'Pending payments', value: pendingPayments,
            sub: overduePayments > 0 ? `${overduePayments} overdue` : 'All on track',
            color: pendingPayments > 0 ? 'text-amber-800' : 'text-emerald-700',
            bg: pendingPayments > 0 ? 'bg-amber-50/50' : 'bg-emerald-50/50',
            border: pendingPayments > 0 ? 'border-amber-200/60' : 'border-emerald-100',
            icon: (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <rect x="1" y="4" width="14" height="9" rx="2"/><path d="M1 7h14"/>
              </svg>
            ),
            route: '/payments'
          },
          {
            label: 'Maintenance', value: pendingMaint + inProgressMaint,
            sub: `${inProgressMaint} in progress`, color: pendingMaint > 0 ? 'text-blue-700' : 'text-emerald-700',
            bg: pendingMaint > 0 ? 'bg-blue-50/50' : 'bg-emerald-50/50',
            border: pendingMaint > 0 ? 'border-blue-100' : 'border-emerald-100',
            icon: (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <path d="M10 3l-6.5 6.5a2 2 0 002.8 2.8L12.8 5.8A2.8 2.8 0 1010 3z"/><path d="M7.5 9l2 2"/>
              </svg>
            ),
            route: '/maintenance'
          },
        ].map(card => (
          <button
            key={card.label}
            onClick={() => navigate(card.route)}
            className={`${card.bg} ${card.border} border rounded-xl p-4 text-left hover:shadow-sm hover:scale-[1.01] transition-all group`}
          >
            <div className="flex items-start justify-between mb-2">
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${card.bg === 'bg-white' ? 'bg-stone-100 text-stone-500' : 'bg-white/60 text-stone-600'}`}>
                {card.icon}
              </div>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
                className="text-stone-300 group-hover:text-stone-500 group-hover:translate-x-0.5 transition-all mt-1">
                <path d="M2 6h8M6 2l4 4-4 4"/>
              </svg>
            </div>
            <div className={`text-2xl font-bold ${card.color}`}>{card.value}</div>
            <div className="text-xs font-medium text-stone-500 mt-0.5">{card.label}</div>
            <div className="text-[11px] text-stone-400 mt-0.5">{card.sub}</div>
          </button>
        ))}
      </div>

      {/* ── MAIN CONTENT ROW ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Unit grid */}
        <div className="bg-white border border-stone-200 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-amber-950">All units</h3>
              <p className="text-xs text-stone-400 mt-0.5">Ground floor — quick view</p>
            </div>
            <button onClick={() => navigate('/units')}
              className="text-xs font-semibold text-amber-800 hover:text-amber-950 transition-colors">
              Manage →
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1.5 mb-3">
            {units.map(unit => {
              const cfg = STATUS_UNIT[unit.status]
              return (
                <button
                  key={unit.id}
                  onClick={() => navigate('/units')}
                  title={`Unit ${unit.unit_number} — ${unit.status}`}
                  className={`aspect-square rounded-lg flex items-center justify-center text-[10px] font-bold transition-all hover:scale-110 hover:shadow-sm ${cfg.badge}`}
                >
                  {unit.unit_number}
                </button>
              )
            })}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-3 flex-wrap">
            {[
              { color: 'bg-emerald-500', label: `Occupied (${occupiedUnits})` },
              { color: 'bg-amber-400',   label: `Vacant (${vacantUnits})` },
            ].map(s => (
              <div key={s.label} className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${s.color}`}></span>
                <span className="text-[11px] text-stone-400">{s.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent payments */}
        <div className="bg-white border border-stone-200 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-amber-950">Recent payments</h3>
              <p className="text-xs text-stone-400 mt-0.5">Latest billing activity</p>
            </div>
            <button onClick={() => navigate('/payments')}
              className="text-xs font-semibold text-amber-800 hover:text-amber-950 transition-colors">
              View all →
            </button>
          </div>

          {payments.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-stone-300 text-xs">No payments yet</div>
          ) : (
            <div className="flex flex-col gap-2">
              {payments.slice(0, 5).map(payment => {
                const cfg  = STATUS_PAYMENT[payment.status]
                const name = payment.tenants?.users?.full_name || 'Unknown'
                const unit = payment.tenants?.units?.unit_number
                return (
                  <div key={payment.id}
                    onClick={() => navigate('/payments')}
                    className="flex items-center justify-between gap-3 p-2.5 rounded-xl hover:bg-stone-50 cursor-pointer transition-colors group">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot}`}></span>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-stone-700 truncate">{name}</div>
                        <div className="text-[11px] text-stone-400">{unit ? `Unit ${unit}` : '—'} · {timeAgo(payment.created_at)}</div>
                      </div>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <div className="text-xs font-bold text-stone-700">₱{Number(payment.amount).toLocaleString()}</div>
                      <span className={`text-[10px] font-semibold capitalize ${cfg.text}`}>{payment.status}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Recent maintenance */}
        <div className="bg-white border border-stone-200 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-amber-950">Maintenance</h3>
              <p className="text-xs text-stone-400 mt-0.5">Latest requests</p>
            </div>
            <button onClick={() => navigate('/maintenance')}
              className="text-xs font-semibold text-amber-800 hover:text-amber-950 transition-colors">
              View all →
            </button>
          </div>

          {maintenance.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-stone-300 text-xs">No requests yet</div>
          ) : (
            <div className="flex flex-col gap-2">
              {maintenance.slice(0, 5).map(req => {
                const cfg  = STATUS_MAINT[req.status]
                const name = req.tenants?.users?.full_name || 'Unknown'
                const unit = req.tenants?.units?.unit_number
                return (
                  <div key={req.id}
                    onClick={() => navigate('/maintenance')}
                    className="flex items-start justify-between gap-3 p-2.5 rounded-xl hover:bg-stone-50 cursor-pointer transition-colors">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 mt-1 ${cfg.dot}`}></span>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-stone-700 truncate">{req.title}</div>
                        <div className="text-[11px] text-stone-400">{unit ? `Unit ${unit}` : name} · {timeAgo(req.created_at)}</div>
                      </div>
                    </div>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0 ${cfg.badge}`}>
                      {cfg.label}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── BOTTOM ROW: TENANTS + ANNOUNCEMENTS + QUICK ACTIONS ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Active tenants list */}
        <div className="bg-white border border-stone-200 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-amber-950">Active tenants</h3>
              <p className="text-xs text-stone-400 mt-0.5">{activeTenants} currently renting</p>
            </div>
            <button onClick={() => navigate('/tenants')}
              className="text-xs font-semibold text-amber-800 hover:text-amber-950 transition-colors">
              Manage →
            </button>
          </div>

          {tenants.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-stone-300 text-xs">No active tenants</div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {tenants.slice(0, 6).map(tenant => {
                const name     = tenant.users?.full_name || 'Unknown'
                const unit     = tenant.units?.unit_number
                // Removed initials and color logic here
                const expiring = tenant.lease_end && (new Date(tenant.lease_end) - new Date()) / 86400000 <= 30
                return (
                  <div key={tenant.id}
                    onClick={() => navigate('/tenants')}
                    className="flex items-center justify-between gap-2.5 p-2 rounded-xl hover:bg-stone-50 cursor-pointer transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-stone-700 truncate">{name}</div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {expiring && <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>}
                      <span className="text-[11px] font-semibold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded-md">
                        {unit ? `U${unit}` : '—'}
                      </span>
                    </div>
                  </div>
                )
              })}
              {tenants.length > 6 && (
                <button onClick={() => navigate('/tenants')}
                  className="text-[11px] text-stone-400 hover:text-amber-800 transition-colors pt-1 text-center">
                  +{tenants.length - 6} more tenants
                </button>
              )}
            </div>
          )}
        </div>

        {/* Recent announcements */}
        <div className="bg-white border border-stone-200 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-amber-950">Announcements</h3>
              <p className="text-xs text-stone-400 mt-0.5">Recently posted</p>
            </div>
            <button onClick={() => navigate('/announcements')}
              className="text-xs font-semibold text-amber-800 hover:text-amber-950 transition-colors">
              View all →
            </button>
          </div>

          {announcements.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 gap-2">
              <div className="text-stone-200 text-2xl">📢</div>
              <div className="text-xs text-stone-300">No announcements yet</div>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {announcements.map(ann => (
                <div key={ann.id}
                  onClick={() => navigate('/announcements')}
                  className="p-3 rounded-xl border border-stone-100 hover:border-amber-200 hover:bg-amber-50/30 cursor-pointer transition-all">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <span className="text-xs font-bold text-amber-950 leading-snug">{ann.title}</span>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                      ann.target === 'all' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                    }`}>
                      {ann.target === 'all' ? 'All' : `U${ann.target}`}
                    </span>
                  </div>
                  <p className="text-[11px] text-stone-400 line-clamp-2 leading-relaxed">{ann.message}</p>
                  <div className="text-[10px] text-stone-300 mt-1.5">{timeAgo(ann.created_at)}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick actions */}
        <div className="bg-white border border-stone-200 rounded-2xl p-5">
          <h3 className="text-sm font-bold text-amber-950 mb-1">Quick actions</h3>
          <p className="text-xs text-stone-400 mb-4">Common tasks</p>

          <div className="flex flex-col gap-2">
            {[
              {
                label: 'Add new tenant',
                sub: 'Register a tenant account',
                color: 'bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100',
                icon: (
                  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                    <circle cx="7" cy="5" r="3"/><path d="M1 14c0-3 2.7-5 6-5"/><path d="M12 10v4M10 12h4"/>
                  </svg>
                ),
                route: '/tenants'
              },
              {
                label: 'Record payment',
                sub: 'Mark a tenant as paid',
                color: 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100',
                icon: (
                  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                    <rect x="1" y="4" width="14" height="9" rx="2"/><path d="M1 7h14"/><path d="M5 11h2"/>
                  </svg>
                ),
                route: '/payments'
              },
              {
                label: 'View maintenance',
                sub: `${pendingMaint + inProgressMaint} open requests`,
                color: 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100',
                icon: (
                  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                    <path d="M10 3L3.5 9.5a2 2 0 002.8 2.8L12.8 5.8A2.8 2.8 0 1010 3z"/>
                  </svg>
                ),
                route: '/maintenance'
              },
              {
                label: 'Post announcement',
                sub: 'Notify your tenants',
                color: 'bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100',
                icon: (
                  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                    <path d="M2 8.5V6a4 4 0 018 0v2.5"/><path d="M1 9h14v.5a2 2 0 01-2 2H3a2 2 0 01-2-2V9z"/>
                  </svg>
                ),
                route: '/announcements'
              },
              {
                label: 'View reports',
                sub: 'Full performance overview',
                color: 'bg-stone-50 border-stone-200 text-stone-600 hover:bg-stone-100',
                icon: (
                  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                    <path d="M3 12V7M6 12V3M9 12V8M12 12V5"/>
                  </svg>
                ),
                route: '/reports'
              },
            ].map(action => (
              <button
                key={action.label}
                onClick={() => navigate(action.route)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all text-left ${action.color}`}
              >
                <span className="flex-shrink-0">{action.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold">{action.label}</div>
                  <div className="text-[11px] opacity-70">{action.sub}</div>
                </div>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="opacity-40">
                  <path d="M2 6h8M6 2l4 4-4 4"/>
                </svg>
              </button>
            ))}
          </div>
        </div>
      </div>

    </div>
  )
}