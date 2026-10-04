import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useOrg } from '../../hooks/useOrg.jsx'
import { useAsync } from '../../hooks/useAsync'
import { createClient, createPurchase, listProperties, deleteClient } from '../../lib/api'
import { Card, ErrorBox, Loading } from '../../components/ui/Data'
import { Alert } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import {
  ClientFields, PurchaseFields, PaymentFields, emptyClient, emptyPurchase, emptyPayment,
  cleanClient, purchaseRow, savePayment,
} from './clientForms'

export default function NewClient() {
  const { org, can } = useOrg()
  const navigate = useNavigate()
  const { data: properties, error: loadError, loading } = useAsync(() => listProperties(org.id), [org.id])
  const [client, setClient] = useState(emptyClient)
  const [purchase, setPurchase] = useState(emptyPurchase)
  const [withPayment, setWithPayment] = useState(true)
  const [payment, setPayment] = useState(emptyPayment)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  if (loading) return <Loading />
  if (loadError) return <ErrorBox error={loadError} />

  const save = async () => {
    setError('')
    if (client.full_name.trim().length < 2) return setError("Please enter the client's full name.")
    let row
    try { row = purchaseRow(org.id, null, properties, purchase) } catch (e) { return setError(e.message) }
    if (withPayment && !(Number(payment.amount) > 0)) return setError('Please enter the amount paid, or untick "Record a payment".')

    setBusy(true)
    let saved
    try {
      saved = await createClient({ ...cleanClient(client), org_id: org.id, source: 'manual' })
      const sub = await createPurchase({ ...row, client_id: saved.id })
      if (withPayment) await savePayment(org.id, sub.id, payment)
      navigate(`/app/clients/${saved.id}`, { replace: true })
    } catch (e) {
      // Don't leave a half-created client behind if the purchase failed
      if (saved && can('deleteRecords')) await deleteClient(saved.id).catch(() => {})
      setError(e.message)
      setBusy(false)
    }
  }

  if (!properties.length) {
    return <Alert variant="info">Add a property first (Directors → Properties) so the client's purchase can be recorded.</Alert>
  }

  return (
    <div className="max-w-3xl space-y-5">
      <p className="text-sm text-slate-400">
        For clients who can't use the online form, or who paid before you joined DocuSend.
        Most clients should fill your <Link to="/app/forms" className="text-blue-400 hover:underline">subscription form</Link> themselves.
      </p>

      <Card title="1. Client details"><ClientFields value={client} onChange={setClient} /></Card>
      <Card title="2. What they're buying"><PurchaseFields properties={properties} value={purchase} onChange={setPurchase} /></Card>
      <Card title="3. Payment" action={
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" className="w-4 h-4 accent-blue-500" checked={withPayment} onChange={e => setWithPayment(e.target.checked)} />
          Record a payment
        </label>}>
        {withPayment
          ? <PaymentFields value={payment} onChange={setPayment} canConfirm={can('confirmPayments')} />
          : <p className="text-sm text-slate-400">You can record payments later from the client's page. Past clients with several payments: add the first one here and the rest on their page.</p>}
      </Card>

      {error && <Alert>{error}</Alert>}
      <div className="flex gap-2.5 pb-8">
        <Button variant="secondary" onClick={() => navigate(-1)}>Cancel</Button>
        <Button className="flex-1 sm:flex-none" loading={busy} onClick={save}>Save client</Button>
      </div>
    </div>
  )
}
