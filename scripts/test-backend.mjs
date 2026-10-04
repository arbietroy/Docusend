// End-to-end checks of the database rules against a local Supabase
// (`npx supabase start`). Run: node scripts/test-backend.mjs
import { createClient } from '@supabase/supabase-js'

const URL = process.env.SB_URL || 'http://127.0.0.1:54321'
const ANON = process.env.SB_ANON
if (!ANON) { console.error('Set SB_ANON to the local anon key (npx supabase status)'); process.exit(1) }

let failures = 0
const ok = (cond, label, extra) => {
  console.log(`${cond ? '✓' : '✗'} ${label}${!cond && extra ? ' — ' + JSON.stringify(extra) : ''}`)
  if (!cond) failures++
}
const client = () => createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } })
const run = Date.now().toString(36)
async function user(name) {
  const c = client()
  const email = `${name}-${run}@test.local`
  const { error } = await c.auth.signUp({ email, password: 'password123' })
  if (error) throw error
  return { c, email }
}

// ── Company A with a super admin ──
const A = await user('owner')
const slug = `harbor-${run}`
const { data: orgId, error: orgErr } = await A.c.rpc('create_organization', { p_name: 'Harbor Crest Homes', p_slug: slug, p_prefix: 'HCH', p_full_name: 'Ada Owner' })
ok(!orgErr && orgId, 'owner creates a company', orgErr)

const { data: prop, error: propErr } = await A.c.from('properties').insert({ org_id: orgId, name: 'Palm Grove Estate', code: 'PG', total_units: 100, unit_type: 'plot', unit_size_sqm: 500 }).select().single()
ok(!propErr, 'admin adds a property', propErr)
const { data: plans, error: planErr } = await A.c.from('payment_plans').insert([
  { org_id: orgId, property_id: prop.id, name: 'Outright', duration_months: 0, price_per_unit: 1000000, min_deposit_percent: 0 },
  { org_id: orgId, property_id: prop.id, name: '6 months', duration_months: 6, price_per_unit: 1200000, min_deposit_percent: 25 },
]).select()
ok(!planErr && plans.length === 2, 'admin adds payment plans', planErr)
const sixMonth = plans.find(p => p.duration_months === 6)

const { error: orgUpdErr } = await A.c.from('organizations').update({ bank_name: 'Demo Bank', account_number: '0123456789' }).eq('id', orgId).select().single()
ok(!orgUpdErr, 'admin updates company settings', orgUpdErr)

// ── Public form (no login) ──
const anon = client()
const { data: form } = await anon.rpc('get_public_form', { p_slug: slug })
ok(form?.name === 'Harbor Crest Homes' && form.properties.length === 1 && form.properties[0].plans.length === 2, 'public form loads company, property and plans')

const proofPath = `${orgId}/${crypto.randomUUID()}.pdf`
const { error: upErr } = await anon.storage.from('payment-proofs').upload(proofPath, new Blob(['%PDF-1.4 test'], { type: 'application/pdf' }))
ok(!upErr, 'anonymous client can upload proof of payment', upErr)
const { error: badUp } = await anon.storage.from('payment-proofs').upload(`not-a-company/${crypto.randomUUID()}.pdf`, new Blob(['x'], { type: 'application/pdf' }))
ok(!!badUp, 'upload outside a company folder is refused')

const { error: subErr } = await anon.rpc('submit_subscription_form', { p_slug: slug, p: {
  full_name: 'Chidi Okeke', email: 'chidi@example.com', phone: '0803 123 4567',
  property_id: prop.id, payment_plan_id: sixMonth.id, units: 2, amount: 600000,
  realtor_name: 'Tola Realtor', realtor_email: 'tola@example.com', proof_path: proofPath,
}})
ok(!subErr, 'client submits the subscription form', subErr)
const { data: anonRead } = await anon.from('clients').select('*')
ok((anonRead ?? []).length === 0, 'anonymous visitors cannot read clients')

// ── Invite a team member ──
const B = await user('member')
const { error: invErr } = await A.c.from('invitations').insert({ org_id: orgId, email: B.email, role: 'team_member' })
ok(!invErr, 'admin invites a team member', invErr)
const { data: invites } = await B.c.rpc('my_invitations')
ok(invites?.length === 1, 'invitee sees their invitation')
const { error: accErr } = await B.c.rpc('accept_invitation', { p_invitation: invites[0].id, p_full_name: 'Bola Member' })
ok(!accErr, 'invitee joins the company', accErr)

const { data: bClients } = await B.c.from('clients').select('*')
ok(bClients?.length === 1, 'team member can see the client list')
const { data: pending } = await B.c.from('payments').select('*').eq('status', 'pending')
ok(pending?.length === 1, 'team member sees the pending payment')

const { error: bConfirm } = await B.c.rpc('confirm_payment', { p_payment: pending[0].id })
ok(!!bConfirm, 'team member cannot confirm payments')
const { error: bForge } = await B.c.from('payments').insert({ org_id: orgId, subscription_id: pending[0].subscription_id, amount: 5, status: 'confirmed' })
ok(!!bForge, 'team member cannot insert an already-confirmed payment')
const { error: bProp } = await B.c.from('properties').update({ total_units: 1 }).eq('id', prop.id).select().single()
ok(!!bProp, 'team member cannot edit property setup')
const { error: bPrice } = await B.c.from('subscriptions').update({ discount_amount: 100000 }).eq('id', pending[0].subscription_id).select().single()
ok(!!bPrice, 'team member cannot change price or discount')
const { error: bOrg } = await B.c.from('organizations').update({ name: 'Hijacked' }).eq('id', orgId).select().single()
ok(!!bOrg, 'team member cannot edit company settings')
const { error: bSeq } = await B.c.from('organizations').update({ client_seq: 999 }).eq('id', orgId).select().single()
ok(!!bSeq, 'team member cannot edit company counters')

// ── Super admin confirms ──
const { data: receipt, error: confErr } = await A.c.rpc('confirm_payment', { p_payment: pending[0].id })
ok(!confErr && receipt === 'HCH-RCT-00001', 'super admin confirms payment and gets receipt number', confErr || receipt)
const { data: sub } = await A.c.from('subscription_overview').select('*').single()
ok(sub.client_number === 'HCH-PG-001', 'client number assigned on confirmation (HCH-PG-001)', sub.client_number)
ok(Number(sub.total_price) === 2400000 && Number(sub.amount_paid) === 600000 && Number(sub.balance) === 1800000, 'balance calculated', sub)
ok(sub.payment_status === 'on_track', 'deposit paid → on track', sub.payment_status)
const { error: again } = await A.c.rpc('confirm_payment', { p_payment: pending[0].id })
ok(!!again, 'cannot confirm the same payment twice')

// ── Instalment form ──
const { error: wrongContact } = await anon.rpc('submit_payment_form', { p_slug: slug, p: { client_number: 'HCH-PG-001', contact: 'someone@else.com', amount: 300000 } })
ok(!!wrongContact, 'instalment form rejects the wrong email')
const { data: instal, error: instalErr } = await anon.rpc('submit_payment_form', { p_slug: slug, p: { client_number: 'hch-pg-001', contact: '+234 803 123 4567', amount: 300000 } })
ok(!instalErr && instal.client_name === 'Chidi Okeke', 'instalment form accepts client number + phone', instalErr)

// ── Team lead can confirm and reject ──
await A.c.rpc('update_member_role', { p_org: orgId, p_user: (await B.c.auth.getUser()).data.user.id, p_role: 'team_lead' })
const { data: p2 } = await B.c.from('payments').select('*').eq('status', 'pending').single()
const { error: rejErr } = await B.c.rpc('reject_payment', { p_payment: p2.id, p_reason: 'Not on bank statement' })
ok(!rejErr, 'team lead can reject a payment', rejErr)

// ── Overdue and defaulting ──
const { data: c2 } = await A.c.from('clients').insert({ org_id: orgId, full_name: 'Late Payer', email: 'late@example.com' }).select().single()
const startedLongAgo = new Date(Date.now() - 200 * 864e5).toISOString().slice(0, 10)
const { data: s2, error: s2Err } = await A.c.from('subscriptions').insert({ org_id: orgId, client_id: c2.id, property_id: prop.id, payment_plan_id: sixMonth.id, units: 1, plan_name: '6 months', duration_months: 6, unit_price: 1200000, min_deposit_percent: 25, start_date: startedLongAgo }).select().single()
ok(!s2Err, 'staff records a purchase for an existing client', s2Err)
const { data: p3 } = await A.c.from('payments').insert({ org_id: orgId, subscription_id: s2.id, amount: 300000, paid_on: startedLongAgo }).select().single()
await A.c.rpc('confirm_payment', { p_payment: p3.id })
const { data: late } = await A.c.from('subscription_overview').select('*').eq('id', s2.id).single()
ok(late.payment_status === 'defaulting' && Number(late.amount_overdue) === 900000 && late.client_number === 'HCH-PG-002', 'only deposit paid after 6+ months → defaulting, ₦900k overdue', late)

// ── Activity log + directors ──
const { data: logA } = await A.c.from('activity_log').select('*')
ok(logA?.length >= 8 && logA.some(l => l.summary.includes('Confirmed ₦600,000.00 from Chidi Okeke')), 'activity log records actions', logA?.map(l => l.summary))
const { data: logB } = await B.c.from('activity_log').select('*')
ok((logB ?? []).length === 0, 'team lead cannot see the activity log')
const today = new Date().toISOString().slice(0, 10)
const { data: summary, error: sumErr } = await A.c.rpc('directors_summary', { p_org: orgId, p_from: startedLongAgo, p_to: today })
ok(!sumErr && Number(summary.collected) === 900000, 'directors summary totals collections', sumErr || summary)
const { error: sumB } = await B.c.rpc('directors_summary', { p_org: orgId, p_from: today, p_to: today })
ok(!!sumB, 'team lead cannot open the directors summary')

// ── Another company can't see any of it ──
const C = await user('rival')
await C.c.rpc('create_organization', { p_name: 'Other Realty', p_slug: `other-${run}`, p_prefix: 'OTR', p_full_name: 'Other' })
const [{ data: cClients }, { data: cPays }, { data: cProps }] = await Promise.all([
  C.c.from('clients').select('*'), C.c.from('payments').select('*'), C.c.from('properties').select('*')])
ok(cClients.length === 0 && cPays.length === 0 && cProps.length === 0, 'another company sees none of this data')
const { data: cProof } = await C.c.storage.from('payment-proofs').download(proofPath)
ok(!cProof, 'another company cannot download payment proofs')
const { data: aProof } = await A.c.storage.from('payment-proofs').download(proofPath)
ok(!!aProof, 'company staff can download their payment proofs')
const { error: cConfirm } = await C.c.rpc('confirm_payment', { p_payment: p2.id })
ok(!!cConfirm, "another company cannot confirm this company's payments")

// ── Document templates and generated documents ──
const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
const fakeDocx = () => new Blob(['PK fake docx'], { type: DOCX })
const tplPath = `${orgId}/${crypto.randomUUID()}.docx`
const { error: tplUp } = await A.c.storage.from('templates').upload(tplPath, fakeDocx(), { contentType: DOCX })
ok(!tplUp, 'admin uploads a template file', tplUp)
const { data: tpl, error: tplErr } = await A.c.from('document_templates').insert({ org_id: orgId, doc_type: 'receipt', name: 'Receipt', send_on: 'every_payment', file_path: tplPath, file_name: 'receipt.docx' }).select().single()
ok(!tplErr, 'admin saves a template', tplErr)
const { error: bTpl } = await B.c.from('document_templates').insert({ org_id: orgId, doc_type: 'receipt', name: 'Hack', file_path: tplPath, file_name: 'x.docx' }).select().single()
ok(!!bTpl, 'team lead cannot add templates')
const { error: bTplUp } = await B.c.storage.from('templates').upload(`${orgId}/${crypto.randomUUID()}.docx`, fakeDocx(), { contentType: DOCX })
ok(!!bTplUp, 'team lead cannot upload template files')
const { data: bTplFile } = await B.c.storage.from('templates').download(tplPath)
ok(!!bTplFile, 'team lead can download templates to fill them in')
const docPath = `${orgId}/${s2.id}/${crypto.randomUUID()}.docx`
const { error: docUp } = await B.c.storage.from('documents').upload(docPath, fakeDocx(), { contentType: DOCX })
ok(!docUp, 'team lead files a generated document', docUp)
const { error: docErr } = await B.c.from('documents').insert({ org_id: orgId, subscription_id: s2.id, template_id: tpl.id, doc_type: 'receipt', name: 'Receipt · HCH-PG-002', file_path: docPath }).select().single()
ok(!docErr, 'team lead records the document on the client file', docErr)
const { error: fakeSent } = await B.c.from('documents').insert({ org_id: orgId, subscription_id: s2.id, doc_type: 'receipt', name: 'x', file_path: docPath, status: 'sent', sent_at: new Date().toISOString() }).select().single()
ok(!!fakeSent, 'nobody can mark a document as emailed by hand')
const [{ data: cTpls }, { data: cDocs }, { data: cTplFile }, { data: cDocFile }] = await Promise.all([
  C.c.from('document_templates').select('*'), C.c.from('documents').select('*'),
  C.c.storage.from('templates').download(tplPath), C.c.storage.from('documents').download(docPath)])
ok(cTpls.length === 0 && cDocs.length === 0 && !cTplFile && !cDocFile, "another company can't see templates or documents")
const { data: logDocs } = await A.c.from('activity_log').select('summary').like('summary', 'Generated Receipt%')
ok(logDocs?.length === 1, 'generating a document is in the activity log')

// ── Last super admin is protected ──
const { error: lastSA } = await A.c.rpc('update_member_role', { p_org: orgId, p_user: (await A.c.auth.getUser()).data.user.id, p_role: 'admin' })
ok(!!lastSA, 'the only super admin cannot demote themselves')

console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed')
process.exit(failures ? 1 : 0)
