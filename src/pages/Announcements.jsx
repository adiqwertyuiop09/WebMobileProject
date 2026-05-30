import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

function formatDate(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-PH', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
}

function timeAgo(dateStr) {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins  = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days  = Math.floor(diff / 86400000)
  if (mins < 1)   return 'Just now'
  if (mins < 60)  return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days === 1) return 'Yesterday'
  if (days < 7)   return `${days} days ago`
  return formatDate(dateStr)
}

export default function Announcements() {
  const [announcements, setAnnouncements] = useState([])
  const [units, setUnits]                 = useState([])
  const [adminId, setAdminId]             = useState(null)
  const [loading, setLoading]             = useState(true)
  const [search, setSearch]               = useState('')
  const [filterTarget, setFilterTarget]   = useState('all')
  const [showModal, setShowModal]         = useState(false)
  const [showView, setShowView]           = useState(false)
  const [viewing, setViewing]             = useState(null)
  const [editing, setEditing]             = useState(null)
  const [saving, setSaving]               = useState(false)
  const [error, setError]                 = useState('')
  const [form, setForm] = useState({ title: '', message: '', target: 'all' })

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setAdminId(data?.user?.id))
    fetchAll()
  }, [])

  async function fetchAll() {
    setLoading(true)
    const [{ data: annData }, { data: unitsData }] = await Promise.all([
      supabase
        .from('announcements')
        .select('*, users ( full_name )')
        .order('created_at', { ascending: false }),
      supabase
        .from('units')
        .select('id, unit_number')
        .order('unit_number', { ascending: true })
    ])
    if (annData)   setAnnouncements(annData)
    if (unitsData) setUnits(unitsData)
    setLoading(false)
  }

  const filtered = announcements.filter(a => {
    const titleMatch   = a.title?.toLowerCase().includes(search.toLowerCase())
    const messageMatch = a.message?.toLowerCase().includes(search.toLowerCase())
    const targetMatch  = filterTarget === 'all' || a.target === filterTarget
    return (titleMatch || messageMatch) && targetMatch
  })

  function openAdd() {
    setEditing(null)
    setForm({ title: '', message: '', target: 'all' })
    setError('')
    setShowModal(true)
  }

  function openEdit(ann, e) {
    e?.stopPropagation()
    setEditing(ann)
    setForm({ title: ann.title, message: ann.message, target: ann.target })
    setError('')
    setShowModal(true)
  }

  function openView(ann) {
    setViewing(ann)
    setShowView(true)
  }

  async function handleSave() {
    setError('')
    if (!form.title.trim())   return setError('Title is required.')
    if (!form.message.trim()) return setError('Message is required.')
    setSaving(true)

    if (editing) {
      const { error: err } = await supabase
        .from('announcements')
        .update({ title: form.title.trim(), message: form.message.trim(), target: form.target })
        .eq('id', editing.id)
      if (err) { setError(err.message); setSaving(false); return }
    } else {
      const { error: err } = await supabase
        .from('announcements')
        .insert({ title: form.title.trim(), message: form.message.trim(), target: form.target, created_by: adminId })
      if (err) { setError(err.message); setSaving(false); return }
    }

    setShowModal(false)
    fetchAll()
    setSaving(false)
  }

  async function handleDelete(ann, e) {
    e?.stopPropagation()
    if (!window.confirm(`Delete "${ann.title}"?`)) return
    await supabase.from('announcements').delete().eq('id', ann.id)
    if (viewing?.id === ann.id) setShowView(false)
    fetchAll()
  }

  const countAll      = announcements.length
  const countAllTen   = announcements.filter(a => a.target === 'all').length
  const countSpecific = announcements.filter(a => a.target !== 'all').length

  return (
    <div className="flex flex-col gap-5">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-amber-950 tracking-tight">Announcements</h1>
          <p className="text-xs font-medium text-stone-400 mt-0.5">
            {countAll} total · {countAllTen} to all tenants · {countSpecific} unit-specific
          </p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center justify-center gap-2 bg-amber-900 hover:bg-amber-950 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors w-full sm:w-auto shadow-sm"
        >
          <span className="text-base leading-none">+</span> Post announcement
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total',          value: countAll,      color: 'text-amber-950',  bg: 'bg-white',         border: 'border-stone-200',    key: 'all' },
          { label: 'All tenants',    value: countAllTen,   color: 'text-blue-700',   bg: 'bg-blue-50/60',    border: 'border-blue-100',     key: 'all-tenants' },
          { label: 'Unit-specific',  value: countSpecific, color: 'text-purple-700', bg: 'bg-purple-50/60',  border: 'border-purple-100',   key: 'specific' },
        ].map(s => (
          <div key={s.key} className={`${s.bg} ${s.border} border rounded-xl p-4`}>
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs font-medium text-stone-500 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Search + Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-sm">⌕</span>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search announcements..."
            className="w-full bg-white border border-stone-200 rounded-xl pl-8 pr-4 py-2.5 text-sm text-stone-700 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-900/10 focus:border-amber-900 transition-colors"
          />
        </div>
        <select
          value={filterTarget}
          onChange={e => setFilterTarget(e.target.value)}
          className="bg-white border border-stone-200 rounded-xl px-3 py-2.5 text-sm text-stone-700 focus:outline-none focus:ring-2 focus:ring-amber-900/10 focus:border-amber-900 transition-colors"
        >
          <option value="all">All targets</option>
          <option value="all">All tenants</option>
          {units.map(u => (
            <option key={u.id} value={u.unit_number}>Unit {u.unit_number}</option>
          ))}
        </select>
      </div>

      {/* Announcements list */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-stone-400 text-sm">Loading announcements...</div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="w-12 h-12 bg-stone-100 rounded-2xl flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-stone-400">
              <path d="M4 11V7a6 6 0 0112 0v4"/><path d="M2 12h16v1a3 3 0 01-3 3H5a3 3 0 01-3-3v-1z"/>
            </svg>
          </div>
          <div className="text-stone-400 text-sm text-center">
            {search ? 'No announcements match your search.' : 'No announcements yet. Post your first one!'}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map(ann => {
            const isAll = ann.target === 'all'
            return (
              <div
                key={ann.id}
                onClick={() => openView(ann)}
                className="bg-white border border-stone-200 rounded-xl p-4 hover:border-amber-300 hover:shadow-sm transition-all cursor-pointer"
              >
                <div className="flex items-start justify-between gap-4">
                  {/* Icon */}
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 ${
                    isAll ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                  }`}>
                    {isAll ? (
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                        <path d="M2 8.5V6a4 4 0 018 0v2.5"/><path d="M1 9h14v.5a2 2 0 01-2 2H3a2 2 0 01-2-2V9z"/>
                      </svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                        <rect x="2" y="2" width="12" height="12" rx="2"/><path d="M5 8h6M5 5h3M5 11h4"/>
                      </svg>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-amber-950 truncate">{ann.title}</span>
                          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${
                            isAll
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-purple-100 text-purple-700'
                          }`}>
                            {isAll ? 'All tenants' : `Unit ${ann.target}`}
                          </span>
                        </div>
                        <p className="text-xs text-stone-500 mt-1 line-clamp-2 leading-relaxed">
                          {ann.message}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-[11px] text-stone-400">{timeAgo(ann.created_at)}</span>
                      {ann.users?.full_name && (
                        <>
                          <span className="text-stone-200">·</span>
                          <span className="text-[11px] text-stone-400">by {ann.users.full_name}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 flex-shrink-0" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={e => openEdit(ann, e)}
                      className="text-xs font-medium px-3 py-1.5 border border-amber-200 rounded-lg text-amber-800 hover:bg-amber-50 transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={e => handleDelete(ann, e)}
                      className="text-xs font-medium px-3 py-1.5 border border-stone-200 rounded-lg text-red-500 hover:bg-red-50 hover:border-red-200 transition-colors"
                    >
                      Delete
                    </button>
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
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl border border-stone-100 w-full sm:max-w-lg p-6">
            <div className="w-10 h-1 bg-stone-200 rounded-full mx-auto mb-5 sm:hidden"></div>

            {/* Header */}
            <div className="flex items-start gap-3 mb-4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                viewing.target === 'all' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
              }`}>
                {viewing.target === 'all' ? (
                  <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                    <path d="M2 8.5V6a4 4 0 018 0v2.5"/><path d="M1 9h14v.5a2 2 0 01-2 2H3a2 2 0 01-2-2V9z"/>
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                    <rect x="2" y="2" width="12" height="12" rx="2"/><path d="M5 8h6M5 5h3M5 11h4"/>
                  </svg>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-base font-bold text-amber-950">{viewing.title}</h2>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                    viewing.target === 'all' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                  }`}>
                    {viewing.target === 'all' ? 'All tenants' : `Unit ${viewing.target}`}
                  </span>
                  <span className="text-[11px] text-stone-400">{formatDate(viewing.created_at)}</span>
                </div>
              </div>
            </div>

            {/* Message */}
            <div className="bg-stone-50 rounded-xl p-4 mb-5">
              <p className="text-sm text-stone-600 leading-relaxed whitespace-pre-wrap">{viewing.message}</p>
            </div>

            {/* Meta */}
            {viewing.users?.full_name && (
              <div className="flex items-center gap-2 mb-5">
                <div className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center text-[10px] font-bold text-amber-800">
                  {viewing.users.full_name.charAt(0).toUpperCase()}
                </div>
                <span className="text-xs text-stone-400">Posted by <span className="font-medium text-stone-600">{viewing.users.full_name}</span></span>
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => setShowView(false)}
                className="flex-1 text-sm font-semibold py-2.5 border border-stone-200 rounded-xl text-stone-600 hover:bg-stone-50 transition-colors"
              >
                Close
              </button>
              <button
                onClick={e => { setShowView(false); openEdit(viewing, e) }}
                className="flex-1 text-sm font-semibold py-2.5 bg-amber-900 hover:bg-amber-950 text-white rounded-xl transition-colors shadow-sm"
              >
                Edit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Modal */}
      {showModal && (
        <div
          className="fixed inset-0 bg-amber-950/20 backdrop-blur-xs flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
          onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}
        >
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl border border-stone-100 w-full sm:max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="w-10 h-1 bg-stone-200 rounded-full mx-auto mb-5 sm:hidden"></div>

            <h2 className="text-base font-bold text-amber-950 mb-1">
              {editing ? 'Edit announcement' : 'Post announcement'}
            </h2>
            <p className="text-xs text-stone-400 mb-5">
              {editing ? 'Update the announcement details below.' : 'Write a message to send to your tenants.'}
            </p>

            {error && (
              <div className="mb-4 text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl p-3">{error}</div>
            )}

            <div className="flex flex-col gap-4">

              {/* Target */}
              <div>
                <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2">Send to</label>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, target: 'all' }))}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                      form.target === 'all'
                        ? 'bg-blue-50 border-blue-300 text-blue-700'
                        : 'bg-stone-50 border-stone-200 text-stone-500 hover:border-stone-300'
                    }`}
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                      <path d="M2 8.5V6a4 4 0 018 0v2.5"/><path d="M1 9h14v.5a2 2 0 01-2 2H3a2 2 0 01-2-2V9z"/>
                    </svg>
                    All tenants
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, target: units[0]?.unit_number || '101' }))}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                      form.target !== 'all'
                        ? 'bg-purple-50 border-purple-300 text-purple-700'
                        : 'bg-stone-50 border-stone-200 text-stone-500 hover:border-stone-300'
                    }`}
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                      <rect x="2" y="2" width="12" height="12" rx="2"/><path d="M5 8h6M5 5h3M5 11h4"/>
                    </svg>
                    Specific unit
                  </button>
                </div>

                {/* Unit dropdown — only shows if specific unit selected */}
                {form.target !== 'all' && (
                  <select
                    value={form.target}
                    onChange={e => setForm(f => ({ ...f, target: e.target.value }))}
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-900/10 focus:border-amber-900 text-stone-800"
                  >
                    {units.map(u => (
                      <option key={u.id} value={u.unit_number}>Unit {u.unit_number}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Title */}
              <div>
                <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wider mb-1">Title</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. Water interruption notice"
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-900/10 focus:border-amber-900 text-stone-800"
                />
              </div>

              {/* Message */}
              <div>
                <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wider mb-1">Message</label>
                <textarea
                  value={form.message}
                  onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                  placeholder="Write your announcement here..."
                  rows={5}
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-900/10 focus:border-amber-900 text-stone-800 resize-none leading-relaxed"
                />
                <div className="text-right text-[11px] text-stone-400 mt-1">{form.message.length} characters</div>
              </div>

              {/* Preview */}
              {(form.title || form.message) && (
                <div className="bg-amber-50/50 border border-amber-100 rounded-xl p-4">
                  <div className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-2">Preview</div>
                  <div className="text-sm font-bold text-amber-950 mb-1">{form.title || 'Untitled'}</div>
                  <p className="text-xs text-stone-500 leading-relaxed whitespace-pre-wrap">{form.message || 'No message yet...'}</p>
                  <div className="mt-2">
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                      form.target === 'all' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                    }`}>
                      {form.target === 'all' ? 'All tenants' : `Unit ${form.target}`}
                    </span>
                  </div>
                </div>
              )}
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
                {saving ? 'Posting...' : editing ? 'Save changes' : 'Post announcement'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}