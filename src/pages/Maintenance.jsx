import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

const STATUS_CONFIG = {
  pending:     { bg: 'bg-amber-50 text-amber-800 border-amber-200', dot: 'bg-amber-400', label: 'Pending', next: 'in_progress' },
  in_progress: { bg: 'bg-blue-50 text-blue-700 border-blue-200', dot: 'bg-blue-500', label: 'In progress', next: 'resolved' },
  resolved:    { bg: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500', label: 'Resolved', next: null },
}

const NEXT_LABEL = {
  pending: 'Start work',
  in_progress: 'Mark resolved',
}

function formatDate(dateStr) {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })
}

function formatDateTime(dateStr) {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function timeAgo(dateStr) {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} days ago`
  return formatDate(dateStr)
}

function getImageUrl(imageUrl) {
  return typeof imageUrl === 'string' ? imageUrl.trim() : ''
}

export default function Maintenance() {
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [viewing, setViewing] = useState(null)
  const [updating, setUpdating] = useState(null)
  const [previewImage, setPreviewImage] = useState(null)

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
    all: requests.length,
    pending: requests.filter(r => r.status === 'pending').length,
    in_progress: requests.filter(r => r.status === 'in_progress').length,
    resolved: requests.filter(r => r.status === 'resolved').length,
  }

  const filtered = requests.filter(r => {
    const name = r.tenants?.users?.full_name?.toLowerCase() || ''
    const unit = String(r.tenants?.units?.unit_number || r.units?.unit_number || '').toLowerCase()
    const title = r.title?.toLowerCase() || ''
    const q = search.toLowerCase()
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

  async function handleDelete(request) {
    const unit = request.tenants?.units?.unit_number || request.units?.unit_number
    const unitLabel = unit ? `Unit ${unit}` : 'this unit'
    if (!window.confirm(`Delete this maintenance request from ${unitLabel}?`)) return
    await supabase.from('maintenance_requests').delete().eq('id', request.id)
    if (viewing?.id === request.id) setViewing(null)
    fetchRequests()
  }

  const viewingUnit = viewing?.tenants?.units?.unit_number || viewing?.units?.unit_number
  const viewingImageUrl = getImageUrl(viewing?.image_url)

  return (
    <div className="flex flex-col gap-5">
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

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { key: 'all', label: 'Total', color: 'text-amber-950', bg: 'bg-white', border: 'border-stone-200' },
          { key: 'pending', label: 'Pending', color: 'text-amber-800', bg: 'bg-amber-50/60', border: 'border-amber-200/60' },
          { key: 'in_progress', label: 'In progress', color: 'text-blue-700', bg: 'bg-blue-50/60', border: 'border-blue-100' },
          { key: 'resolved', label: 'Resolved', color: 'text-emerald-700', bg: 'bg-emerald-50/60', border: 'border-emerald-100' },
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

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex gap-2 flex-wrap">
          {[
            { key: 'all', label: `All (${counts.all})` },
            { key: 'pending', label: `Pending (${counts.pending})` },
            { key: 'in_progress', label: `In progress (${counts.in_progress})` },
            { key: 'resolved', label: `Resolved (${counts.resolved})` },
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
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-sm">/</span>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by tenant, unit or issue..."
            className="w-full bg-white border border-stone-200 rounded-xl pl-8 pr-4 py-2 text-sm text-stone-700 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-900/10 focus:border-amber-900 transition-colors"
          />
        </div>
      </div>

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
            const cfg = STATUS_CONFIG[request.status] || STATUS_CONFIG.pending
            const name = request.tenants?.users?.full_name || 'Unknown tenant'
            const unit = request.tenants?.units?.unit_number || request.units?.unit_number
            const isUpdating = updating === request.id
            const attachmentUrl = getImageUrl(request.image_url)

            return (
              <div
                key={request.id}
                className={`bg-white border rounded-xl p-4 transition-all hover:shadow-sm ${
                  request.status === 'resolved' ? 'border-stone-100 opacity-70' : 'border-stone-200 hover:border-stone-300'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className="flex flex-col items-center gap-1 pt-1 flex-shrink-0">
                    <span className={`w-2.5 h-2.5 rounded-full ${cfg.dot}`}></span>
                  </div>

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
                          <span className="text-stone-200">.</span>
                          <span className="text-xs text-stone-400">{timeAgo(request.created_at)}</span>
                        </div>
                        {request.description && (
                          <p className="text-xs text-stone-500 mt-2 line-clamp-2 leading-relaxed">
                            {request.description}
                          </p>
                        )}
                        {attachmentUrl && (
                          <span className="mt-2.5 inline-flex w-fit items-center gap-1.5 rounded-full border border-[#EADFD4] bg-[#FAF7F5] px-2.5 py-1 text-xs font-semibold text-[#7A6258]">
                            <span className="h-1.5 w-1.5 rounded-full bg-[#C99061]"></span>
                            Image attached
                          </span>
                        )}
                        {request.resolved_at && (
                          <p className="text-xs text-emerald-600 mt-1 font-medium">
                            Resolved {formatDateTime(request.resolved_at)}
                          </p>
                        )}
                      </div>

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
                            {isUpdating ? 'Saving...' : NEXT_LABEL[request.status]}
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

      {viewing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#2B1F17]/45 p-4 backdrop-blur-sm sm:p-6"
          onClick={e => { if (e.target === e.currentTarget) setViewing(null) }}
        >
          <div className="max-h-[90vh] w-full max-w-[720px] overflow-y-auto rounded-[22px] border border-[#EADFD4] bg-[#FFFCF8] shadow-[0_24px_80px_rgba(43,31,23,0.22)]">
            <div className="flex items-center justify-between gap-4 border-b border-[#EADFD4] px-5 py-4 sm:px-6 sm:py-5">
              <h3 className="text-lg font-extrabold text-[#2B1F17] sm:text-xl">Maintenance Request</h3>
              <button
                type="button"
                onClick={() => setViewing(null)}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-[#EADFD4] bg-[#FAF7F5] text-lg font-bold leading-none text-[#2B1F17] transition-colors hover:bg-[#F3E4D7]"
                aria-label="Close request details"
              >
                &times;
              </button>
            </div>

            <div className="px-5 py-5 sm:px-6 sm:py-6">
              <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <h2 className="text-xl font-extrabold leading-tight text-[#2B1F17] sm:text-2xl">{viewing.title}</h2>
                <span className={`w-fit text-[11px] font-semibold px-2.5 py-1 rounded-full border ${STATUS_CONFIG[viewing.status]?.bg}`}>
                  {STATUS_CONFIG[viewing.status]?.label}
                </span>
              </div>

              <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                {[
                  { label: 'Tenant', value: viewing.tenants?.users?.full_name || 'Unknown tenant' },
                  { label: 'Unit', value: viewingUnit ? `Unit ${viewingUnit}` : '-' },
                  { label: 'Submitted', value: formatDateTime(viewing.created_at) },
                ].map(item => (
                  <div key={item.label} className="rounded-2xl border border-[#EADFD4] bg-[#FAF7F5] p-3.5">
                    <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-[#A89080]">{item.label}</p>
                    <p className="text-sm font-bold text-[#2B1F17]">{item.value}</p>
                  </div>
                ))}
              </div>

              <section>
                <h4 className="mb-2.5 text-sm font-extrabold text-[#2B1F17]">Description</h4>
                <div className="rounded-2xl border border-[#EADFD4] bg-white p-4">
                  <p className="text-sm leading-relaxed text-[#4B3A31]">
                    {viewing.description || 'No description provided.'}
                  </p>
                </div>
              </section>

              <section className="mt-5">
                <h4 className="mb-2.5 text-sm font-extrabold text-[#2B1F17]">Attachment</h4>
                {viewingImageUrl ? (
                  <div className="rounded-[18px] border border-[#EADFD4] bg-[#FAF7F5] p-2.5">
                    <button
                      type="button"
                      onClick={() => setPreviewImage(viewingImageUrl)}
                      className="block w-full rounded-[14px] focus:outline-none focus:ring-2 focus:ring-[#C99061]/35"
                      aria-label="Expand maintenance attachment"
                    >
                      <img
                        src={viewingImageUrl}
                        alt="Maintenance attachment"
                        className="max-h-[360px] w-full rounded-[14px] bg-[#F3E4D7] object-contain"
                      />
                    </button>
                  </div>
                ) : (
                  <p className="text-sm font-medium text-[#A89080]">No image attached.</p>
                )}
              </section>
            </div>

            {/* Fixed Modal Buttons - Removed setViewing(null) from actions so modal updates in place smoothly */}
            <div className="flex flex-col gap-2 border-t border-[#EADFD4] px-5 py-4 sm:flex-row sm:px-6">
              <button
                onClick={() => setViewing(null)}
                className="flex-1 rounded-xl border border-[#EADFD4] bg-white py-2.5 text-sm font-semibold text-[#7A6258] transition-colors hover:bg-[#FAF7F5]"
              >
                Close
              </button>
              {viewing.status !== 'resolved' && (
                <button
                  onClick={() => handleAdvanceStatus(viewing)}
                  disabled={updating === viewing.id}
                  className="flex-1 rounded-xl bg-amber-900 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-amber-950 disabled:opacity-50"
                >
                  {updating === viewing.id ? 'Saving...' : NEXT_LABEL[viewing.status]}
                </button>
              )}
            </div>

          </div>
        </div>
      )}

      {previewImage && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-[#2B1F17]/75 p-4"
          onClick={() => setPreviewImage(null)}
        >
          <div
            className="w-full max-w-3xl rounded-2xl border border-[#EADFD4] bg-[#FAF7F5] p-4 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-base font-bold text-[#2B1F17]">Maintenance Attachment</h3>
              <button
                type="button"
                onClick={() => setPreviewImage(null)}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-[#EADFD4] bg-white text-lg font-bold leading-none text-[#7A6258] transition-colors hover:bg-[#F3E4D7] hover:text-[#2B1F17]"
                aria-label="Close image preview"
              >
                &times;
              </button>
            </div>
            <img
              src={previewImage}
              alt="Maintenance attachment preview"
              className="max-h-[72vh] w-full rounded-xl border border-[#EADFD4] bg-[#F3E4D7] object-contain"
            />
          </div>
        </div>
      )}
    </div>
  )
}