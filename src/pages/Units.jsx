import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

const STATUS_STYLES = {
  occupied:    { bg: 'bg-emerald-50 text-emerald-700 border-emerald-200/60',  dot: 'bg-emerald-500',  label: 'Occupied' },
  vacant:      { bg: 'bg-amber-50 text-amber-900 border-amber-200/60',        dot: 'bg-amber-500',    label: 'Vacant' },
  maintenance: { bg: 'bg-red-50 text-red-700 border-red-200/60',              dot: 'bg-red-500',      label: 'Maintenance' },
}

const FILTERS = ['all', 'occupied', 'vacant', 'maintenance']

export default function Units() {
  const [units, setUnits]         = useState([])
  const [loading, setLoading]     = useState(true)
  const [filter, setFilter]       = useState('all')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing]     = useState(null)
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')
  const [form, setForm]           = useState({ unit_number: '', type: '1 bedroom', rent_amount: 6500, status: 'vacant' })

  useEffect(() => { fetchUnits() }, [])

  async function fetchUnits() {
    setLoading(true)
    const { data, error } = await supabase
      .from('units')
      .select('*')
      .order('unit_number', { ascending: true })
    if (!error) setUnits(data)
    setLoading(false)
  }

  const counts = {
    all:         units.length,
    occupied:    units.filter(u => u.status === 'occupied').length,
    vacant:      units.filter(u => u.status === 'vacant').length,
    maintenance: units.filter(u => u.status === 'maintenance').length,
  }

  const filtered = filter === 'all' ? units : units.filter(u => u.status === filter)

  function openAdd() {
    setEditing(null)
    setForm({ unit_number: '', type: '1 bedroom', rent_amount: 6500, status: 'vacant' })
    setError('')
    setShowModal(true)
  }

  function openEdit(unit) {
    setEditing(unit)
    setForm({ unit_number: unit.unit_number, type: unit.type, rent_amount: unit.rent_amount, status: unit.status })
    setError('')
    setShowModal(true)
  }

  async function handleSave() {
    setError('')
    if (!form.unit_number.trim()) return setError('Unit number is required.')
    setSaving(true)
    if (editing) {
      const { error } = await supabase
        .from('units')
        .update({ type: form.type, rent_amount: Number(form.rent_amount), status: form.status })
        .eq('id', editing.id)
      if (error) setError(error.message)
      else { setShowModal(false); fetchUnits() }
    } else {
      const { error } = await supabase
        .from('units')
        .insert({ unit_number: form.unit_number.trim(), type: form.type, rent_amount: Number(form.rent_amount), status: form.status })
      if (error) setError(error.message)
      else { setShowModal(false); fetchUnits() }
    }
    setSaving(false)
  }

  async function handleDelete(unit) {
    if (!window.confirm(`Delete Unit ${unit.unit_number}? This cannot be undone.`)) return
    const { error } = await supabase.from('units').delete().eq('id', unit.id)
    if (!error) fetchUnits()
  }

  async function handleStatusChange(unit, newStatus) {
    await supabase.from('units').update({ status: newStatus }).eq('id', unit.id)
    fetchUnits()
  }

  return (
    <div className="flex flex-col gap-5">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-amber-950 tracking-tight">Units</h1>
          <p className="text-xs font-medium text-stone-400 mt-0.5">Ground floor — {units.length} units total</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center justify-center gap-2 bg-amber-900 hover:bg-amber-950 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors w-full sm:w-auto shadow-sm"
        >
          <span className="text-base leading-none">+</span> Add unit
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { key: 'all',         label: 'Total units',  value: counts.all,         color: 'text-amber-950',  bg: 'bg-white',         border: 'border-stone-200' },
          { key: 'occupied',    label: 'Occupied',     value: counts.occupied,    color: 'text-emerald-700', bg: 'bg-emerald-50/60', border: 'border-emerald-100' },
          { key: 'vacant',      label: 'Vacant',       value: counts.vacant,      color: 'text-amber-900',   bg: 'bg-amber-50/40',   border: 'border-amber-200/60' },
          { key: 'maintenance', label: 'Maintenance',  value: counts.maintenance, color: 'text-red-700',     bg: 'bg-red-50/60',     border: 'border-red-100' },
        ].map(s => (
          <button
            key={s.key}
            onClick={() => setFilter(s.key)}
            className={`${s.bg} ${s.border} border rounded-xl p-4 text-left transition-all ${
              filter === s.key ? 'ring-2 ring-amber-900/10 border-amber-900 shadow-sm' : 'hover:border-stone-300'
            }`}
          >
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs font-medium text-stone-500 mt-1">{s.label}</div>
          </button>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {FILTERS.map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-all capitalize ${
              filter === f
                ? 'bg-amber-900 text-white border-amber-900 shadow-sm'
                : 'bg-white text-stone-500 border-stone-200 hover:border-stone-300 hover:text-stone-700'
            }`}
          >
            {f === 'all' ? `All (${counts.all})` : `${STATUS_STYLES[f]?.label} (${counts[f]})`}
          </button>
        ))}
      </div>

      {/* Units grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-stone-400 text-sm">Loading units...</div>
      ) : filtered.length === 0 ? (
        <div className="flex items-center justify-center py-20 text-stone-400 text-sm">No units found.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(unit => {
            const s = STATUS_STYLES[unit.status]
            return (
              <div
                key={unit.id}
                className="bg-white border border-stone-200 rounded-xl p-4 flex flex-col gap-3 hover:border-stone-300 hover:shadow-sm transition-all"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-base font-bold text-amber-950">Unit {unit.unit_number}</div>
                    <div className="text-xs font-medium text-stone-400 mt-0.5">{unit.type}</div>
                  </div>
                  <span className={`text-[11px] px-2 py-0.5 rounded-full border font-semibold flex items-center gap-1 flex-shrink-0 ${s.bg}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`}></span>
                    {s.label}
                  </span>
                </div>

                <div className="text-sm font-semibold text-stone-700">
                  ₱{Number(unit.rent_amount).toLocaleString()}
                  <span className="text-xs text-stone-400 font-normal">/mo</span>
                </div>

                {/* Quick status change */}
                <select
                  value={unit.status}
                  onChange={e => handleStatusChange(unit, e.target.value)}
                  className="text-xs border border-stone-200 rounded-lg px-2 py-1.5 bg-stone-50 text-stone-600 font-medium focus:outline-none focus:ring-2 focus:ring-amber-900/10 focus:border-amber-900 transition-colors"
                >
                  <option value="occupied">Occupied</option>
                  <option value="vacant">Vacant</option>
                  <option value="maintenance">Maintenance</option>
                </select>

                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => openEdit(unit)}
                    className="flex-1 text-xs font-medium py-1.5 border border-stone-200 rounded-lg text-stone-600 hover:bg-stone-50 transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(unit)}
                    className="flex-1 text-xs font-medium py-1.5 border border-red-100 rounded-lg text-red-600 hover:bg-red-50 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div
          className="fixed inset-0 bg-amber-950/20 backdrop-blur-xs flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
          onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}
        >
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl border border-stone-100 w-full sm:max-w-sm p-6 animate-in fade-in slide-in-from-bottom-4 sm:zoom-in-95 duration-150">
            {/* Modal handle for mobile */}
            <div className="w-10 h-1 bg-stone-200 rounded-full mx-auto mb-4 sm:hidden"></div>

            <h2 className="text-base font-bold text-amber-950 mb-4">
              {editing ? `Edit Unit ${editing.unit_number}` : 'Add new unit'}
            </h2>

            {error && (
              <div className="mb-4 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">{error}</div>
            )}

            <div className="flex flex-col gap-3.5">
              {!editing && (
                <div>
                  <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wider mb-1">Unit number</label>
                  <input
                    type="text"
                    value={form.unit_number}
                    onChange={e => setForm(f => ({ ...f, unit_number: e.target.value }))}
                    placeholder="e.g. 115"
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-900/10 focus:border-amber-900 text-stone-800"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wider mb-1">Type</label>
                <select
                  value={form.type}
                  onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-900/10 focus:border-amber-900 text-stone-800"
                >
                  <option>Studio</option>
                  <option>1 bedroom</option>
                  <option>2 bedroom</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wider mb-1">Monthly rent (₱)</label>
                <input
                  type="number"
                  value={form.rent_amount}
                  onChange={e => setForm(f => ({ ...f, rent_amount: e.target.value }))}
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-900/10 focus:border-amber-900 text-stone-800"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wider mb-1">Status</label>
                <select
                  value={form.status}
                  onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-900/10 focus:border-amber-900 text-stone-800"
                >
                  <option value="vacant">Vacant</option>
                  <option value="occupied">Occupied</option>
                  <option value="maintenance">Maintenance</option>
                </select>
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
                {saving ? 'Saving...' : editing ? 'Save changes' : 'Add unit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}