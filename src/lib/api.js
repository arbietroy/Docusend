import { supabase, must } from './supabase'

// ── Overview of every purchase with balances and arrears ──
export const listPurchases = orgId =>
  must(supabase.from('subscription_overview').select('*').eq('org_id', orgId).order('created_at', { ascending: false }))

export const getPurchasesForClient = clientId =>
  must(supabase.from('subscription_overview').select('*').eq('client_id', clientId).order('created_at'))

// ── Clients ──
export const listClients = orgId =>
  must(supabase.from('clients').select('*').eq('org_id', orgId).order('created_at', { ascending: false }))

export const getClient = id => must(supabase.from('clients').select('*').eq('id', id).single())

export const createClient = row => must(supabase.from('clients').insert(row).select().single())
export const updateClient = (id, patch) => must(supabase.from('clients').update(patch).eq('id', id).select().single())
export const deleteClient = id => must(supabase.from('clients').delete().eq('id', id))

// ── Purchases ──
export const createPurchase = row => must(supabase.from('subscriptions').insert(row).select().single())
export const updatePurchase = (id, patch) => must(supabase.from('subscriptions').update(patch).eq('id', id).select().single())

// ── Payments ──
export const listPayments = (orgId, status) => {
  let q = supabase.from('payments')
    .select('*, subscriptions(id, client_id, client_number, plan_name, units, total_price, realtor_name, realtor_email, clients(id, full_name, email, phone), properties(name, code))')
    .eq('org_id', orgId)
    .order('submitted_at', { ascending: false })
    .limit(500)
  if (status) q = q.eq('status', status)
  return must(q)
}

export const listPaymentsForPurchases = ids =>
  ids.length ? must(supabase.from('payments').select('*').in('subscription_id', ids).order('paid_on', { ascending: false })) : Promise.resolve([])

export const recordPayment = row => must(supabase.from('payments').insert(row).select().single())
export const confirmPayment = id => must(supabase.rpc('confirm_payment', { p_payment: id }))
export const rejectPayment = (id, reason) => must(supabase.rpc('reject_payment', { p_payment: id, p_reason: reason }))

export async function proofUrl(path) {
  const data = await must(supabase.storage.from('payment-proofs').createSignedUrl(path, 60 * 10))
  return data.signedUrl
}

export async function uploadProof(orgId, file) {
  const ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '')
  const path = `${orgId}/${crypto.randomUUID()}.${ext}`
  await must(supabase.storage.from('payment-proofs').upload(path, file, { contentType: file.type }))
  return path
}

// ── Properties ──
export const listProperties = orgId =>
  must(supabase.from('properties').select('*, payment_plans(*)').eq('org_id', orgId).order('created_at'))

export const getProperty = id => must(supabase.from('properties').select('*, payment_plans(*)').eq('id', id).single())

export async function saveProperty(orgId, property, plans) {
  const fields = {
    name: property.name.trim(), code: property.code.trim().toUpperCase(), location: property.location || null,
    description: property.description || null, unit_type: property.unit_type,
    unit_size_sqm: property.unit_size_sqm ? Number(property.unit_size_sqm) : null,
    total_units: Number(property.total_units || 0), status: property.status,
    bank_name: property.bank_name || null, account_name: property.account_name || null, account_number: property.account_number || null,
  }
  const saved = property.id
    ? await must(supabase.from('properties').update(fields).eq('id', property.id).select().single())
    : await must(supabase.from('properties').insert({ ...fields, org_id: orgId }).select().single())

  for (const plan of plans) {
    const row = {
      name: plan.name.trim(), duration_months: Number(plan.duration_months || 0),
      price_per_unit: Number(plan.price_per_unit), min_deposit_percent: Number(plan.min_deposit_percent || 0),
      is_active: plan.is_active !== false,
    }
    if (plan.id) await must(supabase.from('payment_plans').update(row).eq('id', plan.id))
    else await must(supabase.from('payment_plans').insert({ ...row, org_id: orgId, property_id: saved.id }))
  }
  return saved
}

// ── Company & team ──
export const updateOrg = (id, patch) => must(supabase.from('organizations').update(patch).eq('id', id).select().single())

export const createOrganization = ({ name, slug, prefix, fullName }) =>
  must(supabase.rpc('create_organization', { p_name: name, p_slug: slug, p_prefix: prefix, p_full_name: fullName }))

export const myInvitations = () => must(supabase.rpc('my_invitations'))
export const acceptInvitation = (id, fullName) => must(supabase.rpc('accept_invitation', { p_invitation: id, p_full_name: fullName }))

export const listMembers = orgId => must(supabase.from('members').select('*').eq('org_id', orgId).order('created_at'))
export const listInvitations = orgId =>
  must(supabase.from('invitations').select('*').eq('org_id', orgId).is('accepted_at', null).order('created_at', { ascending: false }))
export const invite = (orgId, email, role) =>
  must(supabase.from('invitations').insert({ org_id: orgId, email: email.trim().toLowerCase(), role }).select().single())
export const cancelInvite = id => must(supabase.from('invitations').delete().eq('id', id))
export const setMemberRole = (orgId, userId, role) => must(supabase.rpc('update_member_role', { p_org: orgId, p_user: userId, p_role: role }))
export const removeMember = (orgId, userId) => must(supabase.rpc('remove_member', { p_org: orgId, p_user: userId }))

export async function uploadLogo(orgId, file) {
  const ext = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '')
  const path = `${orgId}/logo-${Date.now()}.${ext}`
  await must(supabase.storage.from('org-assets').upload(path, file, { contentType: file.type, upsert: true }))
  return supabase.storage.from('org-assets').getPublicUrl(path).data.publicUrl
}

export const seedDemoData = orgId => must(supabase.rpc('seed_demo_data', { p_org: orgId }))

// ── Admin ──
export const listActivity = (orgId, { limit = 200 } = {}) =>
  must(supabase.from('activity_log').select('*').eq('org_id', orgId).order('created_at', { ascending: false }).limit(limit))

export const directorsSummary = (orgId, from, to) =>
  must(supabase.rpc('directors_summary', { p_org: orgId, p_from: from, p_to: to }))

// ── Public forms ──
export const getPublicForm = slug => must(supabase.rpc('get_public_form', { p_slug: slug }))
export const submitSubscriptionForm = (slug, payload) => must(supabase.rpc('submit_subscription_form', { p_slug: slug, p: payload }))
export const submitPaymentForm = (slug, payload) => must(supabase.rpc('submit_payment_form', { p_slug: slug, p: payload }))
