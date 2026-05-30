import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

const STATUS_STYLES = {
  paid:    { bg: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500', label: 'Paid' },
  pending: { bg: 'bg-amber-50 text-amber-800 border-amber-200',       dot: 'bg-amber-400',  label: 'Pending' },
  overdue: { bg: 'bg-red-50 text-red-700 border-red-200',             dot: 'bg-red-500',    label: 'Overdue' },
}

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
]

function formatDate(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })
}

function getCurrentMonthYear() {
  const now = new Date()
  return { month: now.getMonth() + 1, year: now.getFullYear() }
}

export default function Payments() {
  const [payments, setPayments]         = useState([])
  const [tenants, setTenants]           = useState([])
  const [loading, setLoading]           = useState(true)
  const [filter, setFilter]             = useState('all')
  const [search, setSearch]             = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [showMarkModal, setShowMarkModal] = useState(false)
  const [selectedPayment, setSelectedPayment] = useState(null)
  const [saving, setSaving]             = useState(false)
  const [error, setError]               = useState('')

  const { month: curMonth, year: curYear } = getCurrentMonthYear()

  const [addForm, setAddForm] = useState({
    tenant_id: '', amount: 6500, due_date: '', month: curMonth, year: curYear
  })

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const [{ data: paymentsData }, { data: tenantsData }] = await Promise.all([
      supabase
        .from('payments')
        .select(`
          *,
          tenants (
            id,
            unit_id,
            users ( full_name, email ),
            units ( unit_number, rent_amount )
          )
        `)
        .order('due_date', { ascending: false }),
      supabase
        .from('tenants')
        .select(`*, users ( full_name, email ), units ( unit_number, rent_amount )`)
        .eq('status', 'active')
        .order('created_at', { ascending: true })
    ])
    if (paymentsData) setPayments(paymentsData)
    if (tenantsData)  setTenants(tenantsData)
    setLoading(false)
  }

  // Stats
  const totalCollected = payments.filter(p => p.status === 'paid').reduce((sum, p) => sum + Number(p.amount), 0)
  const countPaid      = payments.filter(p => p.status === 'paid').length
  const countPending   = payments.filter(p => p.status === 'pending').length
  const countOverdue   = payments.filter(p => p.status === 'overdue').length

  // Filter + search
  const filtered = payments.filter(p => {
    const name  = p.tenants?.users?.full_name?.toLowerCase() || ''
    const unit  = p.tenants?.units?.unit_number || ''
    const q     = search.toLowerCase()
    const matchSearch = name.includes(q) || unit.includes(q)
    const matchFilter = filter === 'all' || p.status === filter
    return matchSearch && matchFilter
  })

  // Mark as paid modal
  function openMarkPaid(payment) {
    setSelectedPayment(payment)
    setShowMarkModal(true)
  }

  async function handleMarkPaid() {
    if (!selectedPayment) return
    setSaving(true)
    const today = new Date().toISOString().split('T')[0]
    const { error } = await supabase
      .from('payments')
      .update({ status: 'paid', paid_date: today })
      .eq('id', selectedPayment.id)
    if (error) { setError(error.message) }
    else { setShowMarkModal(false); fetchAll() }
    setSaving(false)
  }

  async function handleMarkOverdue(payment) {
    await supabase.from('payments').update({ status: 'overdue' }).eq('id', payment.id)
    fetchAll()
  }

  async function handleMarkPending(payment) {
    await supabase.from('payments').update({ status: 'pending', paid_date: null }).eq('id', payment.id)
    fetchAll()
  }

  async function handleDelete(payment) {
    if (!window.confirm('Delete this payment record?')) return
    await supabase.from('payments').delete().eq('id', payment.id)
    fetchAll()
  }

  // Add payment modal
  function openAdd() {
    setAddForm({ tenant_id: '', amount: 6500, due_date: '', month: curMonth, year: curYear })
    setError('')
    setShowAddModal(true)
  }

  async function handleAddPayment() {
    setError('')
    if (!addForm.tenant_id) return setError('Please select a tenant.')
    if (!addForm.due_date)  return setError('Due date is required.')
    setSaving(true)
    const { error } = await supabase
      .from('payments')
      .insert({
        tenant_id: addForm.tenant_id,
        amount:    Number(addForm.amount),
        status:    'pending',
        due_date:  addForm.due_date,
      })
    if (error) setError(error.message)
    else { setShowAddModal(false); fetchAll() }
    setSaving(false)
  }

  // Generate bills for ALL active tenants for a given month
  async function handleGenerateBills() {
    if (!window.confirm(`Generate billing for all ${tenants.length} active tenants for ${MONTHS[curMonth - 1]} ${curYear}?`)) return
    setSaving(true)
    const lastDay = new Date(curYear, curMonth, 0).getDate()
    const dueDate = `${curYear}-${String(curMonth).padStart(2, '0')}-${lastDay}`
    const inserts = tenants.map(t => ({
      tenant_id: t.id,
      amount:    Number(t.units?.rent_amount || 6500),
      status:    'pending',
      due_date:  dueDate,
    }))
    const { error } = await supabase.from('payments').insert(inserts)
    if (error) alert(error.message)
    else fetchAll()
    setSaving(false)
  }

  return (
    <div className="flex flex-col gap-5">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-amber-950 tracking-tight">Payments</h1>
          <p className="text-xs font-medium text-stone-400 mt-0.5">Rent collection and billing records</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={handleGenerateBills}
            disabled={saving || tenants.length === 0}
            className="flex items-center justify-center gap-2 bg-white hover:bg-stone-50 border border-stone-200 text-stone-700 text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors disabled:opacity-40 shadow-sm"
          >
            ⚡ Generate bills
          </button>
          <button
            onClick={openAdd}
            className="flex items-center justify-center gap-2 bg-amber-900 hover:bg-amber-950 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors shadow-sm"
          >
            <span className="text-base leading-none">+</span> Add payment
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total collected', value: `₱${totalCollected.toLocaleString()}`, color: 'text-emerald-700', bg: 'bg-emerald-50/60', border: 'border-emerald-100' },
          { label: 'Paid',            value: countPaid,    color: 'text-emerald-700', bg: 'bg-emerald-50/40', border: 'border-emerald-100' },
          { label: 'Pending',         value: countPending, color: 'text-amber-800',   bg: 'bg-amber-50/60',   border: 'border-amber-200/60' },
          { label: 'Overdue',         value: countOverdue, color: 'text-red-700',     bg: 'bg-red-50/60',     border: 'border-red-100' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} ${s.border} border rounded-xl p-4`}>
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs font-medium text-stone-500 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters + Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex gap-2 flex-wrap">
          {['all', 'paid', 'pending', 'overdue'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-all capitalize ${
                filter === f
                  ? 'bg-amber-900 text-white border-amber-900 shadow-sm'
                  : 'bg-white text-stone-500 border-stone-200 hover:border-stone-300'
              }`}
            >
              {f === 'all' ? `All (${payments.length})` : `${STATUS_STYLES[f].label} (${payments.filter(p => p.status === f).length})`}
            </button>
          ))}
        </div>
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-sm">⌕</span>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by tenant or unit..."
            className="w-full bg-white border border-stone-200 rounded-xl pl-8 pr-4 py-2 text-sm text-stone-700 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-900/10 focus:border-amber-900 transition-colors"
          />
        </div>
      </div>

      {/* Payments table */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-stone-400 text-sm">Loading payments...</div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-2">
          <div className="text-2xl">₱</div>
          <div className="text-stone-400 text-sm">{search ? 'No payments match your search.' : 'No payment records yet. Use "Generate bills" to create monthly billing.'}</div>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden sm:block bg-white border border-stone-200 rounded-2xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-stone-100 bg-stone-50/60">
                  <th className="text-left text-[11px] font-bold text-stone-400 uppercase tracking-wider px-5 py-3">Tenant</th>
                  <th className="text-left text-[11px] font-bold text-stone-400 uppercase tracking-wider px-4 py-3">Unit</th>
                  <th className="text-left text-[11px] font-bold text-stone-400 uppercase tracking-wider px-4 py-3">Amount</th>
                  <th className="text-left text-[11px] font-bold text-stone-400 uppercase tracking-wider px-4 py-3">Due date</th>
                  <th className="text-left text-[11px] font-bold text-stone-400 uppercase tracking-wider px-4 py-3">Paid date</th>
                  <th className="text-left text-[11px] font-bold text-stone-400 uppercase tracking-wider px-4 py-3">Status</th>
                  <th className="text-left text-[11px] font-bold text-stone-400 uppercase tracking-wider px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((payment, idx) => {
                  const s    = STATUS_STYLES[payment.status]
                  const name = payment.tenants?.users?.full_name || 'Unknown'
                  const unit = payment.tenants?.units?.unit_number
                  return (
                    <tr key={payment.id} className={`border-b border-stone-50 hover:bg-stone-50/60 transition-colors ${idx % 2 === 0 ? '' : 'bg-stone-50/30'}`}>
                      <td className="px-5 py-3.5">
                        <div className="text-sm font-semibold text-amber-950">{name}</div>
                        <div className="text-xs text-stone-400">{payment.tenants?.users?.email}</div>
                      </td>
                      <td className="px-4 py-3.5">
                        {unit ? (
                          <span className="text-xs font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">Unit {unit}</span>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="text-sm font-bold text-stone-700">₱{Number(payment.amount).toLocaleString()}</span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="text-xs text-stone-500">{formatDate(payment.due_date)}</span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="text-xs text-stone-500">{formatDate(payment.paid_date)}</span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border flex items-center gap-1 w-fit ${s.bg}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`}></span>
                          {s.label}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1.5">
                          {payment.status !== 'paid' && (
                            <button
                              onClick={() => openMarkPaid(payment)}
                              className="text-[11px] font-semibold px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg transition-colors"
                            >
                              Mark paid
                            </button>
                          )}
                          {payment.status === 'pending' && (
                            <button
                              onClick={() => handleMarkOverdue(payment)}
                              className="text-[11px] font-semibold px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-lg transition-colors"
                            >
                              Overdue
                            </button>
                          )}
                          {payment.status === 'paid' && (
                            <button
                              onClick={() => handleMarkPending(payment)}
                              className="text-[11px] font-semibold px-2.5 py-1 bg-stone-50 hover:bg-stone-100 text-stone-500 border border-stone-200 rounded-lg transition-colors"
                            >
                              Undo
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(payment)}
                            className="text-[11px] font-semibold px-2.5 py-1 bg-white hover:bg-red-50 text-red-500 border border-stone-200 hover:border-red-200 rounded-lg transition-colors"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="sm:hidden flex flex-col gap-3">
            {filtered.map(payment => {
              const s    = STATUS_STYLES[payment.status]
              const name = payment.tenants?.users?.full_name || 'Unknown'
              const unit = payment.tenants?.units?.unit_number
              return (
                <div key={payment.id} className="bg-white border border-stone-200 rounded-xl p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="text-sm font-bold text-amber-950">{name}</div>
                      <div className="text-xs text-stone-400 mt-0.5">{unit ? `Unit ${unit}` : '—'}</div>
                    </div>
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border flex items-center gap-1 ${s.bg}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`}></span>
                      {s.label}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div className="bg-stone-50 rounded-lg p-2">
                      <div className="text-[10px] text-stone-400 font-medium">Amount</div>
                      <div className="text-sm font-bold text-stone-700">₱{Number(payment.amount).toLocaleString()}</div>
                    </div>
                    <div className="bg-stone-50 rounded-lg p-2">
                      <div className="text-[10px] text-stone-400 font-medium">Due date</div>
                      <div className="text-xs font-semibold text-stone-600">{formatDate(payment.due_date)}</div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {payment.status !== 'paid' && (
                      <button
                        onClick={() => openMarkPaid(payment)}
                        className="flex-1 text-xs font-semibold py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg"
                      >
                        Mark paid
                      </button>
                    )}
                    {payment.status === 'pending' && (
                      <button
                        onClick={() => handleMarkOverdue(payment)}
                        className="flex-1 text-xs font-semibold py-1.5 bg-red-50 text-red-600 border border-red-200 rounded-lg"
                      >
                        Overdue
                      </button>
                    )}
                    {payment.status === 'paid' && (
                      <button
                        onClick={() => handleMarkPending(payment)}
                        className="flex-1 text-xs font-semibold py-1.5 bg-stone-50 text-stone-500 border border-stone-200 rounded-lg"
                      >
                        Undo
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(payment)}
                      className="text-xs font-semibold px-3 py-1.5 text-red-500 border border-stone-200 rounded-lg"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* Mark as Paid confirmation modal */}
      {showMarkModal && selectedPayment && (
        <div
          className="fixed inset-0 bg-amber-950/20 backdrop-blur-xs flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
          onClick={e => { if (e.target === e.currentTarget) setShowMarkModal(false) }}
        >
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl border border-stone-100 w-full sm:max-w-sm p-6">
            <div className="w-10 h-1 bg-stone-200 rounded-full mx-auto mb-5 sm:hidden"></div>

            <div className="w-12 h-12 bg-emerald-100 rounded-2xl flex items-center justify-center text-emerald-700 text-xl mb-4 mx-auto">✓</div>
            <h2 className="text-base font-bold text-amber-950 text-center mb-1">Confirm payment</h2>
            <p className="text-xs text-stone-400 text-center mb-5">
              Mark this payment as paid for today's date?
            </p>

            <div className="bg-stone-50 rounded-xl p-4 mb-5 flex flex-col gap-2">
              <div className="flex justify-between items-center">
                <span className="text-xs text-stone-400">Tenant</span>
                <span className="text-xs font-semibold text-stone-700">{selectedPayment.tenants?.users?.full_name}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-stone-400">Unit</span>
                <span className="text-xs font-semibold text-stone-700">Unit {selectedPayment.tenants?.units?.unit_number}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-stone-400">Amount</span>
                <span className="text-sm font-bold text-emerald-700">₱{Number(selectedPayment.amount).toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-stone-400">Paid date</span>
                <span className="text-xs font-semibold text-stone-700">{formatDate(new Date().toISOString().split('T')[0])}</span>
              </div>
            </div>

            {error && <div className="mb-4 text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl p-3">{error}</div>}

            <div className="flex gap-2">
              <button
                onClick={() => setShowMarkModal(false)}
                className="flex-1 text-sm font-semibold py-2.5 border border-stone-200 rounded-xl text-stone-600 hover:bg-stone-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleMarkPaid}
                disabled={saving}
                className="flex-1 text-sm font-semibold py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-colors disabled:opacity-50 shadow-sm"
              >
                {saving ? 'Saving...' : 'Confirm paid'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add payment modal */}
      {showAddModal && (
        <div
          className="fixed inset-0 bg-amber-950/20 backdrop-blur-xs flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
          onClick={e => { if (e.target === e.currentTarget) setShowAddModal(false) }}
        >
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl border border-stone-100 w-full sm:max-w-sm p-6">
            <div className="w-10 h-1 bg-stone-200 rounded-full mx-auto mb-5 sm:hidden"></div>
            <h2 className="text-base font-bold text-amber-950 mb-1">Add payment record</h2>
            <p className="text-xs text-stone-400 mb-5">Manually create a payment bill for a tenant.</p>

            {error && <div className="mb-4 text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl p-3">{error}</div>}

            <div className="flex flex-col gap-3.5">
              <div>
                <label className="block text-xs font-semibold text-stone-500 mb-1">Tenant</label>
                <select
                  value={addForm.tenant_id}
                  onChange={e => {
                    const t = tenants.find(x => x.id === e.target.value)
                    setAddForm(f => ({ ...f, tenant_id: e.target.value, amount: t?.units?.rent_amount || 6500 }))
                  }}
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-900/10 focus:border-amber-900 text-stone-800"
                >
                  <option value="">Select tenant...</option>
                  {tenants.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.users?.full_name} — Unit {t.units?.unit_number}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-500 mb-1">Amount (₱)</label>
                <input
                  type="number"
                  value={addForm.amount}
                  onChange={e => setAddForm(f => ({ ...f, amount: e.target.value }))}
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-900/10 focus:border-amber-900 text-stone-800"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-500 mb-1">Due date</label>
                <input
                  type="date"
                  value={addForm.due_date}
                  onChange={e => setAddForm(f => ({ ...f, due_date: e.target.value }))}
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-900/10 focus:border-amber-900 text-stone-800"
                />
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 text-sm font-semibold py-2.5 border border-stone-200 rounded-xl text-stone-600 hover:bg-stone-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddPayment}
                disabled={saving}
                className="flex-1 text-sm font-semibold py-2.5 bg-amber-900 hover:bg-amber-950 text-white rounded-xl transition-colors disabled:opacity-50 shadow-sm"
              >
                {saving ? 'Saving...' : 'Add payment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}