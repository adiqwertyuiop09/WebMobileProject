import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function formatPeso(amount) {
  return `₱${Number(amount || 0).toLocaleString()}`
}

function formatDate(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })
}

// Simple bar chart using divs
function BarChart({ data, maxValue, color = 'bg-amber-800' }) {
  if (!data || data.length === 0) return null
  return (
    <div className="flex items-end gap-1.5 h-28">
      {data.map((item, idx) => {
        const height = maxValue > 0 ? Math.max((item.value / maxValue) * 100, item.value > 0 ? 8 : 0) : 0
        return (
          <div key={idx} className="flex flex-col items-center gap-1 flex-1 group">
            <div className="relative w-full flex flex-col justify-end" style={{ height: '88px' }}>
              {item.value > 0 && (
                <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-stone-800 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                  {typeof item.value === 'number' && item.value > 1000 ? formatPeso(item.value) : item.value}
                </div>
              )}
              <div
                className={`w-full rounded-t-md transition-all ${item.value > 0 ? color : 'bg-stone-100'}`}
                style={{ height: `${height}%` }}
              />
            </div>
            <span className="text-[10px] text-stone-400 font-medium">{item.label}</span>
          </div>
        )
      })}
    </div>
  )
}

// Donut chart using SVG
function DonutChart({ segments, size = 80 }) {
  const r = 28
  const cx = size / 2
  const cy = size / 2
  const circumference = 2 * Math.PI * r
  const total = segments.reduce((sum, s) => sum + s.value, 0)
  let offset = 0

  if (total === 0) {
    return (
      <svg width={size} height={size}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e7e5e4" strokeWidth="10" />
      </svg>
    )
  }

  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e7e5e4" strokeWidth="10" />
      {segments.map((seg, idx) => {
        if (seg.value === 0) return null
        const dash = (seg.value / total) * circumference
        const gap = circumference - dash
        const el = (
          <circle
            key={idx}
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke={seg.color}
            strokeWidth="10"
            strokeDasharray={`${dash} ${gap}`}
            strokeDashoffset={-offset}
          />
        )
        offset += dash
        return el
      })}
    </svg>
  )
}

export default function Reports() {
  const [loading, setLoading]   = useState(true)
  const [units, setUnits]       = useState([])
  const [tenants, setTenants]   = useState([])
  const [payments, setPayments] = useState([])
  const [maintenance, setMaintenance] = useState([])

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const [
      { data: unitsData },
      { data: tenantsData },
      { data: paymentsData },
      { data: maintenanceData },
    ] = await Promise.all([
      supabase.from('units').select('*'),
      supabase.from('tenants').select('*, users(full_name), units(unit_number, rent_amount)'),
      supabase.from('payments').select('*').order('created_at', { ascending: true }),
      supabase.from('maintenance_requests').select('*'),
    ])
    if (unitsData)       setUnits(unitsData)
    if (tenantsData)     setTenants(tenantsData)
    if (paymentsData)    setPayments(paymentsData)
    if (maintenanceData) setMaintenance(maintenanceData)
    setLoading(false)
  }

  // ── Unit stats ──────────────────────────────────────────
  const totalUnits      = units.length
  const occupiedUnits   = units.filter(u => u.status === 'occupied').length
  const vacantUnits     = units.filter(u => u.status === 'vacant').length
  const maintUnits      = units.filter(u => u.status === 'maintenance').length
  const occupancyRate   = totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 100) : 0

  // ── Tenant stats ─────────────────────────────────────────
  const activeTenants   = tenants.filter(t => t.status === 'active').length
  const inactiveTenants = tenants.filter(t => t.status === 'inactive').length

  // Leases expiring in 30 days
  const expiringLeases  = tenants.filter(t => {
    if (!t.lease_end || t.status !== 'active') return false
    const days = (new Date(t.lease_end) - new Date()) / 86400000
    return days >= 0 && days <= 30
  })

  // ── Payment stats ─────────────────────────────────────────
  const totalCollected  = payments.filter(p => p.status === 'paid').reduce((s, p) => s + Number(p.amount), 0)
  const totalPending    = payments.filter(p => p.status === 'pending').reduce((s, p) => s + Number(p.amount), 0)
  const totalOverdue    = payments.filter(p => p.status === 'overdue').reduce((s, p) => s + Number(p.amount), 0)
  const countPaid       = payments.filter(p => p.status === 'paid').length
  const countPending    = payments.filter(p => p.status === 'pending').length
  const countOverdue    = payments.filter(p => p.status === 'overdue').length

  // Monthly income chart — last 6 months
  const now = new Date()
  const monthlyIncome = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
    const month = d.getMonth()
    const year  = d.getFullYear()
    const total = payments
      .filter(p => {
        if (p.status !== 'paid' || !p.paid_date) return false
        const pd = new Date(p.paid_date)
        return pd.getMonth() === month && pd.getFullYear() === year
      })
      .reduce((s, p) => s + Number(p.amount), 0)
    return { label: MONTHS[month], value: total }
  })
  const maxMonthly = Math.max(...monthlyIncome.map(m => m.value), 1)

  // ── Maintenance stats ─────────────────────────────────────
  const pendingMaint     = maintenance.filter(m => m.status === 'pending').length
  const inProgressMaint  = maintenance.filter(m => m.status === 'in_progress').length
  const resolvedMaint    = maintenance.filter(m => m.status === 'resolved').length
  const totalMaint       = maintenance.length
  const resolutionRate   = totalMaint > 0 ? Math.round((resolvedMaint / totalMaint) * 100) : 0

  // Recent resolved
  const recentResolved = maintenance
    .filter(m => m.status === 'resolved' && m.resolved_at)
    .sort((a, b) => new Date(b.resolved_at) - new Date(a.resolved_at))
    .slice(0, 3)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32 text-stone-400 text-sm">
        Loading reports...
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-amber-950 tracking-tight">Reports</h1>
          <p className="text-xs font-medium text-stone-400 mt-0.5">
            Overview of your apartment's performance
          </p>
        </div>
        <div className="text-xs text-stone-400 bg-white border border-stone-200 rounded-xl px-3 py-2">
          As of {new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
      </div>

      {/* ── TOP KPI ROW ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total collected',  value: formatPeso(totalCollected), color: 'text-emerald-700', bg: 'bg-emerald-50/60',  border: 'border-emerald-100', sub: `${countPaid} payments` },
          { label: 'Occupancy rate',   value: `${occupancyRate}%`,        color: 'text-amber-800',   bg: 'bg-amber-50/60',    border: 'border-amber-200/60', sub: `${occupiedUnits} of ${totalUnits} units` },
          { label: 'Active tenants',   value: activeTenants,              color: 'text-blue-700',    bg: 'bg-blue-50/60',     border: 'border-blue-100',     sub: `${inactiveTenants} inactive` },
          { label: 'Pending payments', value: formatPeso(totalPending),   color: 'text-red-700',     bg: 'bg-red-50/60',      border: 'border-red-100',      sub: `${countPending + countOverdue} unpaid` },
        ].map(s => (
          <div key={s.label} className={`${s.bg} ${s.border} border rounded-xl p-4`}>
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs font-medium text-stone-500 mt-1">{s.label}</div>
            <div className="text-[11px] text-stone-400 mt-0.5">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* ── ROW 2: INCOME CHART + PAYMENT BREAKDOWN ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Monthly income chart */}
        <div className="lg:col-span-2 bg-white border border-stone-200 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-amber-950">Monthly income</h3>
              <p className="text-xs text-stone-400 mt-0.5">Last 6 months collected rent</p>
            </div>
            <div className="text-right">
              <div className="text-lg font-bold text-emerald-700">{formatPeso(totalCollected)}</div>
              <div className="text-[11px] text-stone-400">total collected</div>
            </div>
          </div>
          <BarChart data={monthlyIncome} maxValue={maxMonthly} color="bg-amber-800" />
        </div>

        {/* Payment breakdown donut */}
        <div className="bg-white border border-stone-200 rounded-2xl p-5">
          <h3 className="text-sm font-bold text-amber-950 mb-1">Payment status</h3>
          <p className="text-xs text-stone-400 mb-4">All billing records</p>

          <div className="flex items-center justify-center mb-4">
            <div className="relative">
              <DonutChart
                size={100}
                segments={[
                  { value: countPaid,    color: '#059669' },
                  { value: countPending, color: '#d97706' },
                  { value: countOverdue, color: '#dc2626' },
                ]}
              />
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="text-base font-bold text-amber-950">{payments.length}</div>
                <div className="text-[10px] text-stone-400">total</div>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            {[
              { label: 'Paid',    count: countPaid,    amount: totalCollected, color: 'bg-emerald-500' },
              { label: 'Pending', count: countPending, amount: totalPending,   color: 'bg-amber-400' },
              { label: 'Overdue', count: countOverdue, amount: totalOverdue,   color: 'bg-red-500' },
            ].map(s => (
              <div key={s.label} className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${s.color}`}></span>
                  <span className="text-xs text-stone-500">{s.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-stone-400">{s.count} bills</span>
                  <span className="text-xs font-semibold text-stone-700">{formatPeso(s.amount)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── ROW 3: UNIT OCCUPANCY + MAINTENANCE ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Unit occupancy */}
        <div className="bg-white border border-stone-200 rounded-2xl p-5">
          <h3 className="text-sm font-bold text-amber-950 mb-1">Unit occupancy</h3>
          <p className="text-xs text-stone-400 mb-4">All 14 ground floor units</p>

          <div className="flex items-center gap-5 mb-5">
            <div className="relative flex-shrink-0">
              <DonutChart
                size={90}
                segments={[
                  { value: occupiedUnits, color: '#059669' },
                  { value: vacantUnits,   color: '#d97706' },
                  { value: maintUnits,    color: '#dc2626' },
                ]}
              />
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="text-base font-bold text-amber-950">{occupancyRate}%</div>
                <div className="text-[10px] text-stone-400">full</div>
              </div>
            </div>
            <div className="flex flex-col gap-2 flex-1">
              {[
                { label: 'Occupied',    count: occupiedUnits, color: 'bg-emerald-500', pct: totalUnits > 0 ? Math.round((occupiedUnits/totalUnits)*100) : 0 },
                { label: 'Vacant',      count: vacantUnits,   color: 'bg-amber-400',   pct: totalUnits > 0 ? Math.round((vacantUnits/totalUnits)*100) : 0 },
                { label: 'Maintenance', count: maintUnits,    color: 'bg-red-500',     pct: totalUnits > 0 ? Math.round((maintUnits/totalUnits)*100) : 0 },
              ].map(s => (
                <div key={s.label}>
                  <div className="flex justify-between items-center mb-0.5">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${s.color}`}></span>
                      <span className="text-xs text-stone-500">{s.label}</span>
                    </div>
                    <span className="text-xs font-semibold text-stone-700">{s.count} units</span>
                  </div>
                  <div className="w-full bg-stone-100 rounded-full h-1.5">
                    <div className={`h-1.5 rounded-full ${s.color} transition-all`} style={{ width: `${s.pct}%` }}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Unit grid mini */}
          <div className="grid grid-cols-7 gap-1.5">
            {units
              .sort((a, b) => a.unit_number.localeCompare(b.unit_number, undefined, { numeric: true }))
              .map(unit => (
                <div
                  key={unit.id}
                  title={`Unit ${unit.unit_number} — ${unit.status}`}
                  className={`aspect-square rounded-md flex items-center justify-center text-[9px] font-bold transition-all ${
                    unit.status === 'occupied'    ? 'bg-emerald-100 text-emerald-700' :
                    unit.status === 'maintenance' ? 'bg-red-100 text-red-600' :
                                                    'bg-amber-50 text-amber-600'
                  }`}
                >
                  {unit.unit_number}
                </div>
              ))
            }
          </div>
          <div className="flex items-center gap-3 mt-2.5 flex-wrap">
            {[
              { color: 'bg-emerald-100 text-emerald-700', label: 'Occupied' },
              { color: 'bg-amber-50 text-amber-600',      label: 'Vacant' },
              { color: 'bg-red-100 text-red-600',         label: 'Maintenance' },
            ].map(s => (
              <div key={s.label} className="flex items-center gap-1">
                <span className={`w-3 h-3 rounded-sm ${s.color} flex items-center justify-center text-[7px] font-bold`}>■</span>
                <span className="text-[11px] text-stone-400">{s.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Maintenance summary */}
        <div className="bg-white border border-stone-200 rounded-2xl p-5">
          <h3 className="text-sm font-bold text-amber-950 mb-1">Maintenance summary</h3>
          <p className="text-xs text-stone-400 mb-4">All repair requests</p>

          <div className="grid grid-cols-3 gap-2 mb-5">
            {[
              { label: 'Pending',     value: pendingMaint,    color: 'text-amber-800',   bg: 'bg-amber-50',     border: 'border-amber-100' },
              { label: 'In progress', value: inProgressMaint, color: 'text-blue-700',    bg: 'bg-blue-50',      border: 'border-blue-100' },
              { label: 'Resolved',    value: resolvedMaint,   color: 'text-emerald-700', bg: 'bg-emerald-50',   border: 'border-emerald-100' },
            ].map(s => (
              <div key={s.label} className={`${s.bg} ${s.border} border rounded-xl p-3 text-center`}>
                <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
                <div className="text-[10px] text-stone-500 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Resolution rate */}
          <div className="mb-5">
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-xs text-stone-500">Resolution rate</span>
              <span className="text-xs font-bold text-amber-950">{resolutionRate}%</span>
            </div>
            <div className="w-full bg-stone-100 rounded-full h-2">
              <div className="h-2 rounded-full bg-emerald-500 transition-all" style={{ width: `${resolutionRate}%` }}></div>
            </div>
            <div className="text-[11px] text-stone-400 mt-1">{resolvedMaint} of {totalMaint} requests resolved</div>
          </div>

          {/* Recent resolved */}
          {recentResolved.length > 0 && (
            <div>
              <div className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-2">Recently resolved</div>
              <div className="flex flex-col gap-2">
                {recentResolved.map(r => (
                  <div key={r.id} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0"></span>
                      <span className="text-xs text-stone-600 truncate">{r.title}</span>
                    </div>
                    <span className="text-[11px] text-stone-400 flex-shrink-0">{formatDate(r.resolved_at)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── ROW 4: EXPIRING LEASES + TENANT TABLE ── */}
      {expiringLeases.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 bg-amber-200 rounded-lg flex items-center justify-center text-amber-800 text-sm">⚠</div>
            <div>
              <h3 className="text-sm font-bold text-amber-950">Leases expiring soon</h3>
              <p className="text-xs text-amber-700/70">{expiringLeases.length} lease{expiringLeases.length > 1 ? 's' : ''} expiring within 30 days</p>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            {expiringLeases.map(t => {
              const daysLeft = Math.ceil((new Date(t.lease_end) - new Date()) / 86400000)
              return (
                <div key={t.id} className="flex items-center justify-between bg-white/70 rounded-xl px-4 py-2.5">
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center text-xs font-bold text-amber-800">
                      {t.users?.full_name?.charAt(0) || '?'}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-amber-950">{t.users?.full_name}</div>
                      <div className="text-xs text-amber-700/60">Unit {t.units?.unit_number}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-bold text-amber-800">{daysLeft} day{daysLeft !== 1 ? 's' : ''} left</div>
                    <div className="text-[11px] text-amber-700/60">Ends {formatDate(t.lease_end)}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── ROW 5: TENANT SUMMARY TABLE ── */}
      <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-stone-100">
          <h3 className="text-sm font-bold text-amber-950">Tenant summary</h3>
          <p className="text-xs text-stone-400 mt-0.5">All active tenants and their lease status</p>
        </div>
        {tenants.filter(t => t.status === 'active').length === 0 ? (
          <div className="py-10 text-center text-stone-400 text-sm">No active tenants yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-stone-50/60">
                  <th className="text-left text-[11px] font-bold text-stone-400 uppercase tracking-wider px-5 py-3">Tenant</th>
                  <th className="text-left text-[11px] font-bold text-stone-400 uppercase tracking-wider px-4 py-3">Unit</th>
                  <th className="text-left text-[11px] font-bold text-stone-400 uppercase tracking-wider px-4 py-3">Monthly rent</th>
                  <th className="text-left text-[11px] font-bold text-stone-400 uppercase tracking-wider px-4 py-3">Lease end</th>
                  <th className="text-left text-[11px] font-bold text-stone-400 uppercase tracking-wider px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {tenants
                  .filter(t => t.status === 'active')
                  .sort((a, b) => (a.units?.unit_number || '').localeCompare(b.units?.unit_number || '', undefined, { numeric: true }))
                  .map((tenant, idx) => {
                    const daysLeft  = tenant.lease_end ? Math.ceil((new Date(tenant.lease_end) - new Date()) / 86400000) : null
                    const expiring  = daysLeft !== null && daysLeft <= 30 && daysLeft >= 0
                    const expired   = daysLeft !== null && daysLeft < 0
                    return (
                      <tr key={tenant.id} className={`border-t border-stone-50 hover:bg-stone-50/40 transition-colors ${idx % 2 === 0 ? '' : 'bg-stone-50/20'}`}>
                        <td className="px-5 py-3">
                          <div className="text-sm font-semibold text-amber-950">{tenant.users?.full_name || '—'}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                            Unit {tenant.units?.unit_number}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm font-semibold text-stone-700">{formatPeso(tenant.units?.rent_amount)}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs text-stone-500">{formatDate(tenant.lease_end)}</span>
                        </td>
                        <td className="px-4 py-3">
                          {expired ? (
                            <span className="text-[11px] font-semibold bg-red-50 text-red-600 border border-red-200 px-2 py-0.5 rounded-full">Expired</span>
                          ) : expiring ? (
                            <span className="text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">Expiring in {daysLeft}d</span>
                          ) : (
                            <span className="text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">Active</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  )
}