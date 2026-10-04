import { useEffect, useState } from 'react'
import { useNavigate, useParams, useOutletContext, useSearchParams } from 'react-router-dom'
import { useOrg } from '../../hooks/useOrg.jsx'
import { useAsync } from '../../hooks/useAsync'
import {
  getClient, getPurchasesForClient, listPaymentsForPurchases, listProperties,
  updateClient, deleteClient, createPurchase, listTemplates, listDocuments,
} from '../../lib/api'
import { DocumentsList, CreateDocumentsModal } from './ClientDocuments'
import { naira, fmtDate, initials } from '../../lib/format'
import { reminderEmail, statementEmail, blankEmail } from '../../lib/emails'
import { Card, ErrorBox, Field, Loading, Progress, StatusBadge } from '../../components/ui/Data'
import { Alert, Badge, Modal } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { PaymentModal } from './Payments'
import {
  ClientFields, PurchaseFields, RecordPaymentModal, EditPurchaseModal,
  cleanClient, emptyPurchase, purchaseRow,
} from './clientForms'

export default function ClientDetail() {
  const { id } = useParams()
  const { org, can } = useOrg()
  const navigate = useNavigate()
  const { refreshPending } = useOutletContext() || {}
  const [params, setParams] = useSearchParams()
  const [modal, setModal] = useState(null)

  const { data, error, loading, reload } = useAsync(async () => {
    const [client, purchases, properties, templates] = await Promise.all([
      getClient(id), getPurchasesForClient(id), listProperties(org.id), listTemplates(org.id)])
    const ids = purchases.map(p => p.id)
    const [payments, documents] = await Promise.all([listPaymentsForPurchases(ids), listDocuments(ids)])
    return { client, purchases, properties, payments, templates, documents }
  }, [id, org.id])

  // Arriving from "Prepare documents" after confirming a payment
  const prepare = params.get('prepare')
  useEffect(() => {
    if (!prepare || !data) return
    const pay = data.payments.find(p => p.id === prepare)
    if (pay && pay.status !== 'confirmed') return // fresh data is still loading
    if (pay) setModal({ type: 'docs', purchase: data.purchases.find(x => x.id === pay.subscription_id), paymentId: pay.id })
    setParams({}, { replace: true })
  }, [prepare, data, setParams])

  if (loading && !data) return <Loading />
  if (error) return <ErrorBox error={error} onRetry={reload} />
  const { client, purchases, properties, payments, templates, documents } = data
  const close = () => setModal(null)
  const saved = () => { close(); reload(); refreshPending?.() }

  const remove = async () => {
    if (!window.confirm(`Delete ${client.full_name} and all their purchases and payments? This can't be undone.`)) return
    try { await deleteClient(client.id); navigate('/app/clients', { replace: true }) }
    catch (e) { window.alert(e.message) }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center font-bold shrink-0">{initials(client.full_name)}</div>
          <div className="min-w-0">
            <h2 className="text-lg font-bold truncate">{client.full_name}</h2>
            <p className="text-sm text-slate-400 truncate">
              {purchases.map(p => p.client_number).filter(Boolean).join(' · ') || 'No client number yet'}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {client.email && <a href={blankEmail(org, client, purchases[0])} className="text-xs font-semibold px-3 py-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10">✉️ Email</a>}
          {client.phone && <a href={`tel:${client.phone}`} className="text-xs font-semibold px-3 py-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10">📞 Call</a>}
          <Button size="sm" variant="secondary" onClick={() => setModal({ type: 'edit' })}>Edit details</Button>
          <Button size="sm" variant="secondary" onClick={() => setModal({ type: 'addPurchase' })}>+ Purchase</Button>
          {can('deleteRecords') && <Button size="sm" variant="danger" onClick={remove}>Delete</Button>}
        </div>
      </div>

      {/* Purchases */}
      {purchases.length === 0 && <Alert variant="info">This client has no purchases yet. Add one to start tracking payments.</Alert>}
      {purchases.map(p => {
        const pPayments = payments.filter(x => x.subscription_id === p.id)
        return (
          <Card key={p.id}>
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-4">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-bold">{p.property_name}</h3>
                  <StatusBadge status={p.payment_status} />
                </div>
                <p className="text-sm text-slate-400 mt-0.5">
                  <span className="font-mono">{p.client_number || 'Number assigned on first confirmed payment'}</span>
                  {' · '}{p.plan_name} · {Number(p.units)} {p.unit_type}{Number(p.units) !== 1 ? 's' : ''}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => setModal({ type: 'pay', purchase: p })}>+ Record payment</Button>
                {['owing', 'defaulting'].includes(p.payment_status) && p.client_email && (
                  <a href={reminderEmail(org, p)} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-amber-500/15 text-amber-300 border border-amber-500/30">✉️ Send reminder</a>
                )}
                {p.client_number && p.client_email && <a href={statementEmail(org, p, pPayments)} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-white/5 border border-white/10">Statement</a>}
                {can('editPurchase') && <Button size="sm" variant="secondary" onClick={() => setModal({ type: 'editPurchase', purchase: p })}>Edit</Button>}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
              <Money label="Total price" value={p.total_price} />
              <Money label="Paid" value={p.amount_paid} tone="text-green-400" />
              <Money label="Balance" value={p.balance} tone={Number(p.balance) > 0 ? 'text-amber-400' : ''} />
              <Money label={p.payment_status === 'defaulting' || p.payment_status === 'owing' ? 'Overdue now' : 'Awaiting confirmation'}
                value={p.payment_status === 'defaulting' || p.payment_status === 'owing' ? p.amount_overdue : p.amount_pending}
                tone={Number(p.amount_overdue) > 0 ? 'text-red-300' : 'text-slate-300'} />
            </div>
            <Progress value={Number(p.amount_paid)} max={Number(p.total_price)} className="mb-4" />

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-3 text-sm mb-4">
              <Field label="Purchase date">{fmtDate(p.start_date)}</Field>
              <Field label="Next due">{p.next_due_date ? fmtDate(p.next_due_date) : '—'}{p.days_overdue > 0 && p.balance > 0 ? ` (${p.days_overdue}d late)` : ''}</Field>
              <Field label="Plot / unit numbers">{p.plot_numbers}</Field>
              <Field label="Realtor">{p.realtor_name ? `${p.realtor_name}${p.realtor_email ? ' · ' + p.realtor_email : ''}` : null}</Field>
              {Number(p.discount_amount) > 0 && <div className="col-span-2"><Field label="Discount">{naira(p.discount_amount)}{p.discount_reason ? ` · ${p.discount_reason}` : ''}</Field></div>}
            </div>

            <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">Payments</p>
            {pPayments.length === 0 ? <p className="text-sm text-slate-500">No payments yet.</p> : (
              <div className="divide-y divide-white/5 border border-white/8 rounded-lg">
                {pPayments.map(x => (
                  <button key={x.id} className="w-full text-left flex items-center justify-between gap-3 px-3.5 py-2.5 hover:bg-white/3"
                    onClick={() => setModal({ type: 'payment', payment: { ...x, subscriptions: { client_id: client.id, client_number: p.client_number, plan_name: p.plan_name, units: p.units, realtor_name: p.realtor_name, clients: client, properties: { name: p.property_name } } } })}>
                    <div className="min-w-0">
                      <p className="text-sm">{fmtDate(x.paid_on)} <span className="text-slate-500">· {x.receipt_number || (x.status === 'pending' ? 'awaiting confirmation' : 'rejected')}</span></p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-sm font-semibold ${x.status === 'confirmed' ? 'text-green-400' : x.status === 'pending' ? 'text-amber-400' : 'text-slate-500 line-through'}`}>{naira(x.amount)}</span>
                      {x.status === 'pending' && <Badge variant="amber">Pending</Badge>}
                    </div>
                  </button>
                ))}
              </div>
            )}

            <DocumentsList documents={documents.filter(d => d.subscription_id === p.id)} canCreate
              onCreate={() => setModal({ type: 'docs', purchase: p })} />
          </Card>
        )
      })}

      {/* Details */}
      <Card title="Client details">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-4">
          <Field label="Email">{client.email}</Field>
          <Field label="Phone">{client.phone}</Field>
          <Field label="Address">{client.address}</Field>
          <Field label="Occupation">{client.occupation}</Field>
          <Field label="Date of birth">{client.date_of_birth && fmtDate(client.date_of_birth)}</Field>
          <Field label="ID">{[client.id_type, client.id_number].filter(Boolean).join(' · ')}</Field>
          <Field label="Next of kin">{[client.next_of_kin_name, client.next_of_kin_relationship, client.next_of_kin_phone].filter(Boolean).join(' · ')}</Field>
          <Field label="Added">{fmtDate(client.created_at)} · {client.source === 'form' ? 'online form' : 'by staff'}</Field>
          {client.notes && <div className="col-span-2 sm:col-span-3"><Field label="Notes">{client.notes}</Field></div>}
        </div>
      </Card>

      <RecordPaymentModal purchase={modal?.type === 'pay' ? modal.purchase : null} onClose={close} onSaved={saved} />
      {modal?.type === 'editPurchase' && <EditPurchaseModal purchase={modal.purchase} onClose={close} onSaved={saved} />}
      <PaymentModal payment={modal?.type === 'payment' ? modal.payment : null} onClose={close} onDone={saved} />
      {modal?.type === 'edit' && <EditClientModal client={client} onClose={close} onSaved={saved} />}
      {modal?.type === 'docs' && modal.purchase && (
        <CreateDocumentsModal client={client} purchase={modal.purchase} property={properties.find(x => x.id === modal.purchase.property_id)}
          payments={payments.filter(x => x.subscription_id === modal.purchase.id)} templates={templates}
          initialPaymentId={modal.paymentId} onClose={close} onSaved={reload} />
      )}
      {modal?.type === 'addPurchase' && <AddPurchaseModal client={client} properties={properties} onClose={close} onSaved={saved} />}
    </div>
  )
}

function Money({ label, value, tone = '' }) {
  return (
    <div className="bg-white/3 rounded-lg p-3 min-w-0">
      <p className="text-xs text-slate-500 mb-0.5">{label}</p>
      <p className={`text-sm sm:text-base font-bold truncate ${tone}`}>{naira(value)}</p>
    </div>
  )
}

function EditClientModal({ client, onClose, onSaved }) {
  const [value, setValue] = useState(() => Object.fromEntries(Object.entries(client).map(([k, v]) => [k, v ?? ''])))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const save = async () => {
    if (value.full_name.trim().length < 2) return setError("Please enter the client's full name.")
    setBusy(true); setError('')
    try { await updateClient(client.id, cleanClient(value)); onSaved() }
    catch (e) { setError(e.message); setBusy(false) }
  }
  return (
    <Modal isOpen wide onClose={onClose} title="Edit client details">
      <ClientFields value={value} onChange={setValue} />
      {error && <div className="mt-4"><Alert>{error}</Alert></div>}
      <div className="flex gap-2.5 mt-5">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button className="flex-1" loading={busy} onClick={save}>Save</Button>
      </div>
    </Modal>
  )
}

function AddPurchaseModal({ client, properties, onClose, onSaved }) {
  const { org } = useOrg()
  const [value, setValue] = useState(emptyPurchase)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const save = async () => {
    setError('')
    try {
      setBusy(true)
      await createPurchase(purchaseRow(org.id, client.id, properties, value))
      onSaved()
    } catch (e) { setError(e.message); setBusy(false) }
  }
  return (
    <Modal isOpen wide onClose={onClose} title="Add a purchase" subtitle={`Another property or more units for ${client.full_name}. Record the payment after saving.`}>
      <PurchaseFields properties={properties} value={value} onChange={setValue} />
      {error && <div className="mt-4"><Alert>{error}</Alert></div>}
      <div className="flex gap-2.5 mt-5">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button className="flex-1" loading={busy} onClick={save}>Add purchase</Button>
      </div>
    </Modal>
  )
}
