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

const DEFAULT_RENT_AMOUNT = 6500

function formatDate(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })
}

function getCurrentMonthYear() {
  const now = new Date()
  return { month: now.getMonth() + 1, year: now.getFullYear() }
}

// FIX 1: Changed to calculate the NEXT billing month instead of the current one
function getNextBillingMonthInput() {
  const now = new Date()
  // Using the 1st of the month prevents JS Date rollover bugs (e.g. Jan 31 + 1 month = Mar 3)
  const nextMonthDate = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  const year = nextMonthDate.getFullYear()
  const month = nextMonthDate.getMonth() + 1 // getMonth() is 0-indexed
  return `${year}-${String(month).padStart(2, '0')}`
}

function getBillingMonthParts(monthInput) {
  const [year, month] = monthInput.split('-').map(Number)
  const monthPadded = String(month).padStart(2, '0')
  const lastDay = new Date(year, month, 0).getDate()

  return {
    year,
    month,
    label: `${MONTHS[month - 1]} ${year}`,
    billingMonth: `${year}-${monthPadded}-01`,
    monthEnd: `${year}-${monthPadded}-${String(lastDay).padStart(2, '0')}`,
  }
}

function getTenantDueDateForBillingMonth(leaseStart, billingMonth) {
  if (!leaseStart) return null
  const leaseDay = Number(leaseStart.split('-')[2])
  const lastBillingDay = Number(billingMonth.monthEnd.split('-')[2])
  const dueDay = Math.min(leaseDay, lastBillingDay)

  return `${billingMonth.year}-${String(billingMonth.month).padStart(2, '0')}-${String(dueDay).padStart(2, '0')}`
}

function getBillingMonthFromDate(dateStr) {
  if (!dateStr) return null
  const [year, month] = dateStr.split('-')
  return `${year}-${month}-01`
}

function isDuplicateBillingError(error) {
  return error?.code === '23505' || error?.message?.includes('unique_tenant_billing_month')
}

function getCleanPaymentError(error, fallback = 'Unable to update payment. Please try again.') {
  if (isDuplicateBillingError(error)) return 'A bill already exists for this tenant and billing month.'
  return error?.message || fallback
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
  const billingMonthInput = getNextBillingMonthInput()
  const [notice, setNotice]             = useState(null)
  const [confirmAction, setConfirmAction] = useState(null)

  // FIX 3: Removed unused month/year from addForm since they were never submitted to Supabase
  const [addForm, setAddForm] = useState({
    tenant_id: '', amount: DEFAULT_RENT_AMOUNT, due_date: ''
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
    setError('')
    setShowMarkModal(true)
  }

  async function handleMarkPaid() {
    if (!selectedPayment) return
    setError('')

    if (selectedPayment.status === 'paid') {
      setShowMarkModal(false)
      setNotice({
        type: 'info',
        title: 'Already paid',
        message: 'This payment is already marked as paid.',
      })
      return
    }

    setSaving(true)
    const today = new Date().toISOString().split('T')[0]
    const { error } = await supabase
      .from('payments')
      .update({ status: 'paid', paid_date: today })
      .eq('id', selectedPayment.id)

    if (error) {
      setNotice({
        type: 'error',
        title: 'Action failed',
        message: getCleanPaymentError(error, 'Unable to mark this payment as paid. Please try again.'),
      })
    } else {
      setShowMarkModal(false)
      setSelectedPayment(null)
      await fetchAll()
      setNotice({
        type: 'success',
        title: 'Payment confirmed',
        message: 'Payment was marked as paid.',
      })
    }

    setSaving(false)
  }

  async function handleMarkOverdue(payment) {
    setSaving(true)
    const { error } = await supabase.from('payments').update({ status: 'overdue' }).eq('id', payment.id)

    if (error) {
      setNotice({
        type: 'error',
        title: 'Action failed',
        message: getCleanPaymentError(error, 'Unable to mark payment overdue. Please try again.'),
      })
    } else {
      await fetchAll()
      setNotice({
        type: 'warning',
        title: 'Payment marked overdue',
        message: 'The payment status was updated to overdue.',
      })
    }

    setSaving(false)
  }

  // FIX 2: Check the due date when undoing a paid payment
  async function handleMarkPending(payment) {
    setSaving(true)
    const today = new Date().toISOString().split('T')[0]
    const newStatus = payment.due_date < today ? 'overdue' : 'pending'

    const { error } = await supabase.from('payments').update({ status: newStatus, paid_date: null }).eq('id', payment.id)

    if (error) {
      setNotice({
        type: 'error',
        title: 'Action failed',
        message: getCleanPaymentError(error, 'Unable to undo this payment. Please try again.'),
      })
    } else {
      await fetchAll()
      setNotice({
        type: 'info',
        title: 'Payment reopened',
        message: `The payment was moved back to ${newStatus} and the paid date was cleared.`,
      })
    }

    setSaving(false)
  }

  function handleDelete(payment) {
    if (!['pending', 'overdue'].includes(payment.status)) {
      setNotice({
        type: 'warning',
        title: 'Payment history preserved',
        message: 'Paid payment records cannot be deleted. Use Undo if it was marked paid by mistake.',
      })
      return
    }

    setConfirmAction({
      title: 'Delete payment',
      message: 'Delete this payment record?',
      confirmText: 'Delete',
      tone: 'danger',
      onConfirm: () => handleDeleteConfirmed(payment),
    })
  }

  async function runConfirmAction() {
    if (!confirmAction?.onConfirm) return
    const action = confirmAction

    try {
      await action.onConfirm()
    } catch {
      setNotice({
        type: 'error',
        title: 'Action failed',
        message: 'Something went wrong. Please try again.',
      })
    } finally {
      setConfirmAction(null)
    }
  }

  async function handleDeleteConfirmed(payment) {
    setSaving(true)
    const { error } = await supabase.from('payments').delete().eq('id', payment.id)

    if (error) {
      setNotice({
        type: 'error',
        title: 'Action failed',
        message: getCleanPaymentError(error, 'Unable to delete payment record. Please try again.'),
      })
    } else {
      if (selectedPayment?.id === payment.id) {
        setSelectedPayment(null)
        setShowMarkModal(false)
      }
      await fetchAll()
      setNotice({
        type: 'success',
        title: 'Payment deleted',
        message: 'The selected payment record was deleted.',
      })
    }

    setSaving(false)
  }

  // Add payment modal
  function openAdd() {
    setAddForm({ tenant_id: '', amount: DEFAULT_RENT_AMOUNT, due_date: '' })
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
        billing_month: getBillingMonthFromDate(addForm.due_date),
      })
    if (error) {
      setNotice({
        type: 'error',
        title: 'Action failed',
        message: getCleanPaymentError(error, 'Unable to add payment. Please try again.'),
      })
    } else {
      setShowAddModal(false)
      await fetchAll()
      setNotice({
        type: 'success',
        title: 'Payment added',
        message: 'The payment record was added.',
      })
    }
    setSaving(false)
  }

  function handleGenerateBills() {
    const selectedMonth = getBillingMonthParts(billingMonthInput)

    setConfirmAction({
      title: 'Generate bills',
      message: `Generate bills for ${selectedMonth.label}?`,
      confirmText: 'Generate bills',
      tone: 'success',
      onConfirm: () => handleGenerateBillsConfirmed(),
    })
  }

  // Generate bills manually for the current billing month.
  async function handleGenerateBillsConfirmed() {
    setNotice(null)
    setError('')

    const selectedMonth = getBillingMonthParts(billingMonthInput)

    setSaving(true)

    const { data: activeTenants, error: tenantsError } = await supabase
      .from('tenants')
      .select(`*, users ( full_name, email ), units ( unit_number, rent_amount )`)
      .eq('status', 'active')
      .order('created_at', { ascending: true })

    if (tenantsError) {
      setNotice({
        type: 'error',
        title: 'Action failed',
        message: getCleanPaymentError(tenantsError, 'Unable to load active tenants. Please try again.'),
      })
      setSaving(false)
      return
    }

    const currentActiveTenants = activeTenants || []
    setTenants(currentActiveTenants)

    if (currentActiveTenants.length === 0) {
      setNotice({
        type: 'warning',
        title: 'No active tenants',
        message: 'There are no active tenants to generate bills for.',
      })
      setSaving(false)
      return
    }

    const tenantsInBillingMonth = currentActiveTenants.filter(t => t.lease_start && t.lease_start <= selectedMonth.monthEnd)

    if (tenantsInBillingMonth.length === 0) {
      setNotice({
        type: 'warning',
        title: 'No active tenants',
        message: 'There are no active tenants to generate bills for.',
      })
      setSaving(false)
      return
    }

    const activeTenantIds = tenantsInBillingMonth.map(t => t.id)

    // Any bill for this tenant/month blocks generation, including paid or overdue records.
    const { data: existingBills, error: existingBillsError } = await supabase
      .from('payments')
      .select('tenant_id')
      .eq('billing_month', selectedMonth.billingMonth)
      .in('tenant_id', activeTenantIds)

    if (existingBillsError) {
      setNotice({
        type: 'error',
        title: 'Action failed',
        message: getCleanPaymentError(existingBillsError, 'Unable to check existing bills. Please try again.'),
      })
      setSaving(false)
      return
    }

    const existingTenantIds = new Set((existingBills || []).map(p => p.tenant_id))
    const tenantsToBill = tenantsInBillingMonth.filter(t => !existingTenantIds.has(t.id))
    const skippedCount = tenantsInBillingMonth.length - tenantsToBill.length

    if (tenantsToBill.length === 0) {
      await fetchAll()
      setNotice({
        type: 'info',
        title: 'No duplicates created',
        message: 'Bills for this month already exist. No duplicate bills were created.',
      })
      setSaving(false)
      return
    }

    const inserts = tenantsToBill.map(t => ({
      tenant_id: t.id,
      amount:    Number(t.units?.rent_amount || DEFAULT_RENT_AMOUNT),
      status:    'pending',
      due_date:  getTenantDueDateForBillingMonth(t.lease_start, selectedMonth),
      billing_month: selectedMonth.billingMonth,
    }))

    const { data: generatedBills, error } = await supabase
      .from('payments')
      .insert(inserts)
      .select('tenant_id')

    if (error) {
      if (isDuplicateBillingError(error)) {
        await fetchAll()
        setNotice({
          type: 'info',
          title: 'No duplicates created',
          message: 'Bills for this month already exist. No duplicate bills were created.',
        })
      } else {
        setNotice({
          type: 'error',
          title: 'Action failed',
          message: getCleanPaymentError(error, 'Unable to generate bills. Please try again.'),
        })
      }
    } else {
      const generatedCount = generatedBills?.length ?? tenantsToBill.length
      setNotice({
        type: 'success',
        title: 'Bills generated',
        message: `Generated ${generatedCount} new bill${generatedCount === 1 ? '' : 's'}. Skipped ${skippedCount} existing bill${skippedCount === 1 ? '' : 's'}.`,
      })
      await fetchAll()
    }

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
            disabled={saving}
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
                          {['pending', 'overdue'].includes(payment.status) && (
                            <button
                              onClick={() => handleDelete(payment)}
                              className="text-[11px] font-semibold px-2.5 py-1 bg-white hover:bg-red-50 text-red-500 border border-stone-200 hover:border-red-200 rounded-lg transition-colors"
                            >
                              Delete
                            </button>
                          )}
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
                    {['pending', 'overdue'].includes(payment.status) && (
                      <button
                        onClick={() => handleDelete(payment)}
                        className="text-xs font-semibold px-3 py-1.5 text-red-500 border border-stone-200 rounded-lg"
                      >
                        Delete
                      </button>
                    )}
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
                    setAddForm(f => ({ ...f, tenant_id: e.target.value, amount: t?.units?.rent_amount || DEFAULT_RENT_AMOUNT }))
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

      {confirmAction && (
        <div
          className="fixed inset-0 z-[65] flex items-center justify-center bg-[#2B1F17]/45 p-4 backdrop-blur-sm"
          onClick={() => { if (!saving) setConfirmAction(null) }}
        >
          <div
            className="w-full max-w-sm rounded-[22px] border border-[#EADFD4] bg-[#FFFCF8] p-5 shadow-[0_24px_80px_rgba(43,31,23,0.22)]"
            onClick={e => e.stopPropagation()}
          >
            <div className={`mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl text-xl font-extrabold ${
              confirmAction.tone === 'danger'
                ? 'bg-red-50 text-red-700'
                : confirmAction.tone === 'warning'
                  ? 'bg-amber-50 text-amber-800'
                  : 'bg-[#F3E4D7] text-[#2B1F17]'
            }`}>
              {confirmAction.tone === 'danger' || confirmAction.tone === 'warning' ? '!' : '?'}
            </div>

            <h3 className="text-center text-lg font-extrabold text-[#2B1F17]">
              {confirmAction.title}
            </h3>

            <p className="mt-2 text-center text-sm leading-6 text-[#7A6258]">
              {confirmAction.message}
            </p>

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={() => setConfirmAction(null)}
                className="flex-1 rounded-xl border border-[#EADFD4] bg-[#FAF7F5] py-2.5 text-sm font-semibold text-[#7A6258] transition-colors hover:bg-[#F3E4D7] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={runConfirmAction}
                className={`flex-1 rounded-xl py-2.5 text-sm font-semibold text-[#F5EDE6] transition-colors disabled:opacity-50 ${
                  confirmAction.tone === 'danger'
                    ? 'bg-red-700 hover:bg-red-800'
                    : confirmAction.tone === 'warning'
                      ? 'bg-[#C99061] hover:bg-[#B87E4F]'
                      : 'bg-[#2B1F17] hover:bg-[#3A2A20]'
                }`}
              >
                {saving ? 'Working...' : confirmAction.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}

      {notice && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-[#2B1F17]/45 p-4 backdrop-blur-sm"
          onClick={() => setNotice(null)}
        >
          <div
            className="w-full max-w-sm rounded-[22px] border border-[#EADFD4] bg-[#FFFCF8] p-5 shadow-[0_24px_80px_rgba(43,31,23,0.22)]"
            onClick={e => e.stopPropagation()}
          >
            <div className={`mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl text-xl font-extrabold ${
              notice.type === 'success'
                ? 'bg-emerald-50 text-emerald-700'
                : notice.type === 'error'
                  ? 'bg-red-50 text-red-700'
                  : notice.type === 'warning'
                    ? 'bg-amber-50 text-amber-800'
                    : 'bg-[#F3E4D7] text-[#2B1F17]'
            }`}>
              {notice.type === 'success' ? 'OK' : notice.type === 'error' || notice.type === 'warning' ? '!' : 'i'}
            </div>

            <h3 className="text-center text-lg font-extrabold text-[#2B1F17]">
              {notice.title}
            </h3>

            <p className="mt-2 text-center text-sm leading-6 text-[#7A6258]">
              {notice.message}
            </p>

            <button
              type="button"
              onClick={() => setNotice(null)}
              className="mt-5 w-full rounded-xl bg-[#2B1F17] py-2.5 text-sm font-semibold text-[#F5EDE6] transition-colors hover:bg-[#3A2A20]"
            >
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  )
}