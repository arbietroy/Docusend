import { useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { useOrg } from '../../hooks/useOrg.jsx'
import { useAsync } from '../../hooks/useAsync'
import { listPayments, confirmPayment, rejectPayment, proofUrl } from '../../lib/api'
import { naira, fmtDate, fmtDateTime, toCsv, downloadFile } from '../../lib/format'
import { Card, EmptyState, ErrorBox, Loading, PageHeader, Tabs, Field } from '../../components/ui/Data'
import { Alert, Badge, Modal } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Input, Textarea } from '../../components/ui/Input'

export default function Payments() {
  const { org, can } = useOrg()
  const { refreshPending } = useOutletContext() || {}
  const [tab, setTab] = useState('pending')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const { data: payments, error, loading, reload } = useAsync(() => listPayments(org.id), [org.id])

  if (loading && !payments) return <Loading />
  if (error) return <ErrorBox error={error} onRetry={reload} />

  const q = search.trim().toLowerCase()
  const counts = { pending: 0, confirmed: 0, rejected: 0 }
  payments.forEach(p => { counts[p.status]++ })
  const rows = payments.filter(p => p.status === tab).filter(p => !q || [
    p.subscriptions?.clients?.full_name, p.subscriptions?.client_number, p.bank_reference, p.receipt_number, p.payer_name,
  ].some(v => v?.toLowerCase().includes(q)))

  const exportCsv = () => downloadFile(`payments-${tab}.csv`, toCsv(rows, [
    { label: 'Client', value: r => r.subscriptions?.clients?.full_name },
    { label: 'Client number', value: r => r.subscriptions?.client_number },
    { label: 'Property', value: r => r.subscriptions?.properties?.name },
    { label: 'Amount', value: r => r.amount },
    { label: 'Paid on', value: r => r.paid_on },
    { label: 'Bank reference', value: r => r.bank_reference },
    { label: 'Receipt', value: r => r.receipt_number },
    { label: 'Status', value: r => r.status },
  ]))

  const done = () => { setSelected(null); reload(); refreshPending?.() }

  return (
    <div>
      <PageHeader
        subtitle={can('confirmPayments')
          ? 'Check each payment against your bank statement, then confirm or reject it.'
          : 'Payments submitted by clients or recorded by the team. A team lead confirms them.'}
        actions={can('exportData') && <Button size="sm" variant="secondary" onClick={exportCsv}>⬇ Export CSV</Button>}
      />
      <Tabs value={tab} onChange={setTab} tabs={[
        { id: 'pending', label: 'Awaiting confirmation', count: counts.pending },
        { id: 'confirmed', label: 'Confirmed', count: counts.confirmed },
        { id: 'rejected', label: 'Rejected', count: counts.rejected },
      ]} />
      <Input placeholder="Search by name, client number, reference or receipt…" value={search} onChange={e => setSearch(e.target.value)} className="mb-4" />

      <Card className="!p-0">
        {rows.length === 0 ? (
          <EmptyState icon={tab === 'pending' ? '✅' : '📭'} title={tab === 'pending' ? 'Nothing waiting' : 'No payments here'}>
            {tab === 'pending' && 'When clients fill your payment forms, their payments land here for confirmation.'}
          </EmptyState>
        ) : (
          <div className="divide-y divide-white/5">
            {rows.map(p => (
              <button key={p.id} onClick={() => setSelected(p)} className="w-full text-left flex items-center justify-between gap-3 px-4 py-3.5 hover:bg-white/3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">
                    {p.subscriptions?.clients?.full_name}
                    {p.source === 'form' && <span className="ml-2 align-middle"><Badge variant="slate">Form</Badge></span>}
                  </p>
                  <p className="text-xs text-slate-400 truncate">
                    {p.subscriptions?.client_number || 'New client'} · {p.subscriptions?.properties?.name} · paid {fmtDate(p.paid_on)}
                  </p>
                  {p.status === 'rejected' && <p className="text-xs text-red-300 truncate">Rejected: {p.rejection_reason}</p>}
                  {p.status === 'confirmed' && <p className="text-xs text-slate-500 truncate">{p.receipt_number}</p>}
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-sm font-bold ${p.status === 'pending' ? 'text-amber-400' : p.status === 'confirmed' ? 'text-green-400' : 'text-slate-400 line-through'}`}>{naira(p.amount)}</p>
                  {p.status === 'pending' && <p className="text-xs text-blue-400">{can('confirmPayments') ? 'Review →' : 'View →'}</p>}
                </div>
              </button>
            ))}
          </div>
        )}
      </Card>

      <PaymentModal payment={selected} onClose={() => setSelected(null)} onDone={done} />
    </div>
  )
}

export function PaymentModal({ payment, onClose, onDone }) {
  const { can } = useOrg()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')
  const [result, setResult] = useState(null)

  const close = () => { setError(''); setRejecting(false); setReason(''); setResult(null); onClose() }
  if (!payment) return null
  const s = payment.subscriptions || {}

  const viewProof = async () => {
    try { window.open(await proofUrl(payment.proof_path), '_blank', 'noopener') }
    catch (e) { setError(e.message) }
  }
  const confirm = async () => {
    setBusy(true); setError('')
    try { setResult(await confirmPayment(payment.id)) }
    catch (e) { setError(e.message) }
    setBusy(false)
  }
  const reject = async () => {
    if (!reason.trim()) return setError('Please say why this payment is being rejected.')
    setBusy(true); setError('')
    try { await rejectPayment(payment.id, reason); close(); onDone() }
    catch (e) { setError(e.message) }
    setBusy(false)
  }

  return (
    <Modal isOpen onClose={result ? () => { close(); onDone() } : close} title={result ? 'Payment confirmed' : 'Payment details'}>
      {result ? (
        <div>
          <div className="text-4xl mb-3">✅</div>
          <p className="text-sm text-slate-300 mb-1">{naira(payment.amount)} from <strong>{s.clients?.full_name}</strong> is confirmed.</p>
          <p className="text-sm text-slate-400 mb-5">Receipt number <strong className="text-white">{result}</strong>. The client's balance has been updated.</p>
          <Alert variant="info">Automatic receipts and documents by email are coming in the next update. For now, the receipt number is saved on the client's record.</Alert>
          <div className="flex gap-2.5 mt-5">
            <Link to={`/app/clients/${s.client_id}`} className="flex-1 text-center bg-white/5 border border-white/10 rounded-lg py-2.5 text-sm font-semibold">Open client</Link>
            <Button className="flex-1" onClick={() => { close(); onDone() }}>Done</Button>
          </div>
        </div>
      ) : (
        <div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 bg-white/3 border border-white/8 rounded-xl p-4 mb-4">
            <Field label="Client"><Link to={`/app/clients/${s.client_id}`} className="text-blue-400 hover:underline">{s.clients?.full_name}</Link></Field>
            <Field label="Client number">{s.client_number || 'Assigned on confirmation'}</Field>
            <Field label="Property">{s.properties?.name}</Field>
            <Field label="Plan">{s.plan_name} · {Number(s.units)} unit{Number(s.units) !== 1 ? 's' : ''}</Field>
            <Field label="Amount"><span className="text-green-400 font-bold">{naira(payment.amount)}</span></Field>
            <Field label="Paid on">{fmtDate(payment.paid_on)}</Field>
            <Field label="Payer name">{payment.payer_name}</Field>
            <Field label="Bank reference">{payment.bank_reference}</Field>
            <Field label="Submitted">{fmtDateTime(payment.submitted_at)} · {payment.source === 'form' ? 'client form' : 'by staff'}</Field>
            <Field label="Realtor">{s.realtor_name}</Field>
            {payment.notes && <div className="col-span-2"><Field label="Notes">{payment.notes}</Field></div>}
            {payment.status === 'confirmed' && <Field label="Receipt">{payment.receipt_number}</Field>}
            {payment.status === 'rejected' && <div className="col-span-2"><Field label="Rejected because">{payment.rejection_reason}</Field></div>}
          </div>

          {payment.proof_path
            ? <Button variant="secondary" className="w-full mb-4" onClick={viewProof}>📎 View proof of payment</Button>
            : <p className="text-xs text-slate-500 mb-4">No proof of payment was attached.</p>}

          {error && <div className="mb-4"><Alert>{error}</Alert></div>}

          {payment.status === 'pending' && (can('confirmPayments') ? (
            rejecting ? (
              <div className="flex flex-col gap-3">
                <Textarea label="Reason for rejecting" placeholder="e.g. Not found on bank statement" value={reason} onChange={e => setReason(e.target.value)} />
                <div className="flex gap-2.5">
                  <Button variant="secondary" onClick={() => setRejecting(false)}>Back</Button>
                  <Button variant="danger" className="flex-1" loading={busy} onClick={reject}>Reject payment</Button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2.5">
                <Button variant="danger" onClick={() => setRejecting(true)}>Reject</Button>
                <Button className="flex-1" loading={busy} onClick={confirm}>✓ Confirm payment</Button>
              </div>
            )
          ) : <Alert variant="info">A team lead or admin needs to confirm this payment.</Alert>)}
        </div>
      )}
    </Modal>
  )
}
