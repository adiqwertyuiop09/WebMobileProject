import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

const STATUS_CONFIG = {
  pending:     { bg: 'bg-amber-50 text-amber-800 border-amber-200',   dot: 'bg-amber-400',  label: 'Pending',     next: 'in_progress' },
  in_progress: { bg: 'bg-blue-50 text-blue-700 border-blue-200',      dot: 'bg-blue-500',   label: 'In progress', next: 'resolved' },
  resolved:    { bg: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500', label: 'Resolved', next: null },
}

const NEXT_LABEL = {
  pending:     'Start work',
  in_progress: 'Mark resolved',
}

function formatDate(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })
}

function formatDateTime(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function timeAgo(dateStr) {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7)  return `${days} days ago`
  return formatDate(dateStr)
}

const IssueIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 1.5v8M8 12.5v1" strokeWidth="2"/>
  </svg>
)

export default function Maintenance() {
  const [requests, setRequests]   = useState([])
  const [loading, setLoading]     = useState(true)
  const [filter, setFilter]       = useState('all')
  const [search, setSearch]       = useState('')
  const [viewing, setViewing]     = useState(null)
  const [updating, setUpdating]   = useState(null)

  useEffect(() => { fetchRequests() }, [])

  async function fetchRequests() {
    setLoading(true)
    const { data, error } = await supabase
      .from('maintenance_requests')
      .select(`
        *,
        tenants (
          id,
          users ( full_name, email, phone ),
          units ( unit_number )
        ),
        units ( unit_number )
      `)
      .order('created_at', { ascending: false })
    if (!error && data) setRequests(data)
    setLoading(false)
  }

  const counts = {
    all:         requests.length,
    pending:     requests.filter(r => r.status === 'pending').length,
    in_progress: requests.filter(r => r.status === 'in_progress').length,
    resolved:    requests.filter(r => r.status === 'resolved').length,
  }

  const filtered = requests.filter(r => {
    const name  = r.tenants?.users?.full_name?.toLowerCase() || ''
    const unit  = r.tenants?.units?.unit_number || r.units?.unit_number || ''
    const title = r.title?.toLowerCase() || ''
    const q     = search.toLowerCase()
    const matchSearch = name.includes(q) || unit.includes(q) || title.includes(q)
    const matchFilter = filter === 'all' || r.status === filter
    return matchSearch && matchFilter
  })

  async function handleAdvanceStatus(request) {
    const next = STATUS_CONFIG[request.status]?.next
    if (!next) return
    setUpdating(request.id)
    const updates = { status: next }
    if (next === 'resolved') updates.resolved_at = new Date().toISOString()
    await supabase.from('maintenance_requests').update(updates).eq('id', request.id)
    setUpdating(null)
    fetchRequests()
    if (viewing?.id === request.id) setViewing(prev => ({ ...prev, ...updates }))
  }

  async function handleReopen(request) {
    setUpdating(request.id)
    await supabase.from('maintenance_requests').update({ status: 'pending', resolved_at: null }).eq('id', request.id)
    setUpdating(null)
    fetchRequests()
  }

  async function handleDelete(request) {
    if (!window.confirm(`Delete this maintenance request from Unit ${request.tenants?.units?.unit_number}?`)) return
    await supabase.from('maintenance_requests').delete().eq('id', request.id)
    if (viewing?.id === request.id) setViewing(null)
    fetchRequests()
  }

  return (
    <div className="flex flex-col gap-5">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-amber-950 tracking-tight">Maintenance</h1>
          <p className="text-xs font-medium text-stone-400 mt-0.5">
            {counts.pending > 0
              ? `${counts.pending} request${counts.pending > 1 ? 's' : ''} waiting for action`
              : 'All requests up to date'}
          </p>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { key: 'all',         label: 'Total',       color: 'text-amber-950',   bg: 'bg-white',         border: 'border-stone-200' },
          { key: 'pending',     label: 'Pending',     color: 'text-amber-800',   bg: 'bg-amber-50/60',   border: 'border-amber-200/60' },
          { key: 'in_progress', label: 'In progress', color: 'text-blue-700',    bg: 'bg-blue-50/60',    border: 'border-blue-100' },
          { key: 'resolved',    label: 'Resolved',    color: 'text-emerald-700', bg: 'bg-emerald-50/60', border: 'border-emerald-100' },
        ].map(s => (
          <button
            key={s.key}
            onClick={() => setFilter(s.key)}
            className={`${s.bg} ${s.border} border rounded-xl p-4 text-left transition-all ${
              filter === s.key ? 'ring-2 ring-amber-900/10 border-amber-900 shadow-sm' : 'hover:border-stone-300'
            }`}
          >
            <div className={`text-2xl font-bold ${s.color}`}>{counts[s.key]}</div>
            <div className="text-xs font-medium text-stone-500 mt-1">{s.label}</div>
          </button>
        ))}
      </div>

      {/* Filters + Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex gap-2 flex-wrap">
          {[
            { key: 'all',         label: `All (${counts.all})` },
            { key: 'pending',     label: `Pending (${counts.pending})` },
            { key: 'in_progress', label: `In progress (${counts.in_progress})` },
            { key: 'resolved',    label: `Resolved (${counts.resolved})` },
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-all ${
                filter === f.key
                  ? 'bg-amber-900 text-white border-amber-900 shadow-sm'
                  : 'bg-white text-stone-500 border-stone-200 hover:border-stone-300'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-sm">⌕</span>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by tenant, unit or issue..."
            className="w-full bg-white border border-stone-200 rounded-xl pl-8 pr-4 py-2 text-sm text-stone-700 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-900/10 focus:border-amber-900 transition-colors"
          />
        </div>
      </div>

      {/* Requests list */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-stone-400 text-sm">Loading requests...</div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-2">
          <div className="w-12 h-12 bg-stone-100 rounded-2xl flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-stone-400">
              <path d="M11.3 5.3l-7 7a2.1 2.1 0 003 3l7-7a3 3 0 10-3-3z"/><path d="M8.5 10.5l3 3"/>
            </svg>
          </div>
          <div className="text-stone-400 text-sm">{search ? 'No requests match your search.' : 'No maintenance requests yet.'}</div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map(request => {
            const cfg    = STATUS_CONFIG[request.status]
            const name   = request.tenants?.users?.full_name || 'Unknown tenant'
            const unit   = request.tenants?.units?.unit_number || request.units?.unit_number
            const isUpdating = updating === request.id

            return (
              <div
                key={request.id}
                className={`bg-white border rounded-xl p-4 transition-all hover:shadow-sm ${
                  request.status === 'resolved' ? 'border-stone-100 opacity-70' : 'border-stone-200 hover:border-stone-300'
                }`}
              >
                <div className="flex items-start gap-4">

                  {/* Status dot column */}
                  <div className="flex flex-col items-center gap-1 pt-1 flex-shrink-0">
                    <span className={`w-2.5 h-2.5 rounded-full ${cfg.dot}`}></span>
                  </div>

                  {/* Main content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-amber-950 truncate">{request.title}</span>
                          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${cfg.bg}`}>
                            {cfg.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          {unit && (
                            <span className="text-xs font-semibold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                              Unit {unit}
                            </span>
                          )}
                          <span className="text-xs text-stone-400">{name}</span>
                          <span className="text-stone-200">·</span>
                          <span className="text-xs text-stone-400">{timeAgo(request.created_at)}</span>
                        </div>
                        {request.description && (
                          <p className="text-xs text-stone-500 mt-2 line-clamp-2 leading-relaxed">
                            {request.description}
                          </p>
                        )}
                        {request.resolved_at && (
                          <p className="text-xs text-emerald-600 mt-1 font-medium">
                            ✓ Resolved {formatDateTime(request.resolved_at)}
                          </p>
                        )}
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                        <button
                          onClick={() => setViewing(request)}
                          className="text-xs font-medium px-3 py-1.5 border border-stone-200 rounded-lg text-stone-500 hover:bg-stone-50 transition-colors"
                        >
                          View
                        </button>

                        {request.status !== 'resolved' && (
                          <button
                            onClick={() => handleAdvanceStatus(request)}
                            disabled={isUpdating}
                            className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-50 ${
                              request.status === 'pending'
                                ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
                                : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                            }`}
                          >
                            {isUpdating ? '...' : NEXT_LABEL[request.status]}
                          </button>
                        )}

                        {request.status === 'resolved' && (
                          <button
                            onClick={() => handleReopen(request)}
                            disabled={isUpdating}
                            className="text-xs font-medium px-3 py-1.5 border border-amber-200 rounded-lg text-amber-700 hover:bg-amber-50 transition-colors disabled:opacity-50"
                          >
                            Reopen
                          </button>
                        )}

                        <button
                          onClick={() => handleDelete(request)}
                          className="text-xs font-medium px-3 py-1.5 border border-stone-200 rounded-lg text-red-500 hover:bg-red-50 hover:border-red-200 transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* View detail modal */}
      {viewing && (
        <div
          className="fixed inset-0 bg-amber-950/20 backdrop-blur-xs flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
          onClick={e => { if (e.target === e.currentTarget) setViewing(null) }}
        >
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl border border-stone-100 w-full sm:max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <div className="w-10 h-1 bg-stone-200 rounded-full mx-auto mb-5 sm:hidden"></div>

            {/* Header */}
            <div className="flex items-start justify-between gap-3 mb-5">
              <div>
                <h2 className="text-base font-bold text-amber-950">{viewing.title}</h2>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  {(() => {
                    const unit = viewing.tenants?.units?.unit_number || viewing.units?.unit_number
                    return unit ? (
                      <span className="text-xs font-semibold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">Unit {unit}</span>
                    ) : null
                  })()}
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${STATUS_CONFIG[viewing.status]?.bg}`}>
                    {STATUS_CONFIG[viewing.status]?.label}
                  </span>
                </div>
              </div>
            </div>

            {/* Description */}
            {viewing.description && (
              <div className="bg-stone-50 rounded-xl p-4 mb-4">
                <div className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-2">Description</div>
                <p className="text-sm text-stone-600 leading-relaxed">{viewing.description}</p>
              </div>
            )}

            {/* Details grid */}
            <div className="grid grid-cols-2 gap-3 mb-5">
              {[
                { label: 'Reported by',  value: viewing.tenants?.users?.full_name || '—' },
                { label: 'Contact',      value: viewing.tenants?.users?.phone || viewing.tenants?.users?.email || '—' },
                { label: 'Unit',         value: viewing.tenants?.units?.unit_number ? `Unit ${viewing.tenants.units.unit_number}` : '—' },
                { label: 'Submitted',    value: formatDateTime(viewing.created_at) },
                { label: 'Status',       value: STATUS_CONFIG[viewing.status]?.label },
                { label: 'Resolved at',  value: formatDateTime(viewing.resolved_at) },
              ].map(item => (
                <div key={item.label} className="bg-stone-50 rounded-xl p-3">
                  <div className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider mb-0.5">{item.label}</div>
                  <div className="text-sm font-semibold text-stone-700">{item.value}</div>
                </div>
              ))}
            </div>

            {/* Status progress */}
            <div className="mb-5">
              <div className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-3">Progress</div>
              <div className="flex items-center gap-0">
                {['pending', 'in_progress', 'resolved'].map((step, idx) => {
                  const cfg = STATUS_CONFIG[step]
                  const isActive  = viewing.status === step
                  const isPast    = ['pending', 'in_progress', 'resolved'].indexOf(viewing.status) > idx
                  return (
                    <div key={step} className="flex items-center flex-1">
                      <div className={`flex flex-col items-center flex-1`}>
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                          isActive ? `${cfg.dot} border-transparent text-white` :
                          isPast   ? 'bg-emerald-500 border-transparent text-white' :
                                     'bg-white border-stone-200 text-stone-300'
                        }`}>
                          {isPast ? '✓' : idx + 1}
                        </div>
                        <span className={`text-[10px] font-semibold mt-1 ${isActive ? 'text-amber-900' : isPast ? 'text-emerald-600' : 'text-stone-300'}`}>
                          {cfg.label}
                        </span>
                      </div>
                      {idx < 2 && (
                        <div className={`h-0.5 flex-1 -mt-4 mx-1 ${isPast ? 'bg-emerald-400' : 'bg-stone-200'}`}></div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={() => setViewing(null)}
                className="flex-1 text-sm font-semibold py-2.5 border border-stone-200 rounded-xl text-stone-600 hover:bg-stone-50 transition-colors"
              >
                Close
              </button>
              {viewing.status !== 'resolved' && (
                <button
                  onClick={() => { handleAdvanceStatus(viewing); setViewing(null) }}
                  className={`flex-1 text-sm font-semibold py-2.5 rounded-xl transition-colors shadow-sm ${
                    viewing.status === 'pending'
                      ? 'bg-blue-600 hover:bg-blue-700 text-white'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  }`}
                >
                  {NEXT_LABEL[viewing.status]}
                </button>
              )}
              {viewing.status === 'resolved' && (
                <button
                  onClick={() => { handleReopen(viewing); setViewing(null) }}
                  className="flex-1 text-sm font-semibold py-2.5 border border-amber-200 bg-amber-50 text-amber-800 rounded-xl hover:bg-amber-100 transition-colors"
                >
                  Reopen
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}